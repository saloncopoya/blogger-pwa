#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import asyncio
import logging
from pathlib import Path
from aiohttp import web
from telethon import TelegramClient

# --- CONFIGURACIÓN ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuración desde variables de entorno
API_ID = int(os.getenv('TELEGRAM_API_ID', '38389812'))
API_HASH = os.getenv('TELEGRAM_API_HASH', 'a97923c7c5c6e351f69fe9619965e85e')
CHANNEL_USERNAME = os.getenv('TELEGRAM_CHANNEL', '@chanelxmladmin')
TMP_DIR = Path("telegram_uploads")
TMP_DIR.mkdir(exist_ok=True)

class BridgeApp:
    def __init__(self):
        # Permitir archivos grandes (hasta 2GB)
        self.app = web.Application(client_max_size=2000*1024*1024)
        self.sessions = {}
        self.setup_routes()

    def setup_routes(self):
        self.app.router.add_post('/init-upload', self.handle_init)
        self.app.router.add_post('/upload-chunk', self.handle_chunk)
        self.app.router.add_post('/finalize-upload', self.handle_finalize)
        self.app.router.add_get('/health', self.handle_health)
        self.app.router.add_get('/', self.handle_health)
        # Soporte para CORS (pre-vuelo)
        self.app.router.add_route('OPTIONS', '/{tail:.*}', self.handle_options)

    async def handle_options(self, request):
        return web.Response(status=204, headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Bot-Token, Authorization'
        })

    async def handle_health(self, request):
        return web.json_response({'status': 'online', 'bridge': 'active'})

    async def handle_init(self, request):
        data = await request.json()
        sid = data.get('upload_id')
        file_name = data.get('file_name', 'archivo.dat')
        
        file_path = TMP_DIR / f"{sid}_{file_name}"
        # Guardamos el token que viene de Blogger
        token = request.headers.get('X-Bot-Token')
        
        self.sessions[sid] = {
            'path': file_path,
            'token': token,
            'name': file_name
        }
        
        return web.json_response({'success': True}, headers={'Access-Control-Allow-Origin': '*'})

    async def handle_chunk(self, request):
        data = await request.post()
        sid = data.get('session_id')
        chunk_data = data.get('chunk_data').file.read()
        
        if sid in self.sessions:
            # Escribir el pedazo de archivo en el disco inmediatamente
            with open(self.sessions[sid]['path'], 'ab') as f:
                f.write(chunk_data)
            return web.json_response({'success': True}, headers={'Access-Control-Allow-Origin': '*'})
        
        return web.json_response({'error': 'Sesion expirada'}, status=404)

    async def handle_finalize(self, request):
        data = await request.json()
        sid = data.get('session_id')
        
        if sid not in self.sessions:
            return web.json_response({'error': 'No existe la sesion'}, status=404)
        
        session = self.sessions[sid]
        file_path = session['path']
        bot_token = session['token']

        try:
            # Crear cliente de Telegram (sesión en memoria para Render)
            client = TelegramClient(None, API_ID, API_HASH)
            await client.start(bot_token=bot_token)
            
            logger.info(f"🚀 Enviando a Telegram: {session['name']}")
            
            # Enviar el archivo
            message = await client.send_file(
                CHANNEL_USERNAME,
                file=file_path,
                caption=f"Archivo: {session['name']}",
                force_document=False
            )
            
            # Cerrar sesión correctamente antes de responder
            await client.disconnect()

            # Limpiar archivo del servidor
            if file_path.exists():
                file_path.unlink()
            del self.sessions[sid]

            # Responder con los datos reales
            clean_channel = CHANNEL_USERNAME.replace('@', '')
            return web.json_response({
                'success': True,
                'message_id': message.id,
                'telegram_link': f"https://t.me/{clean_channel}/{message.id}"
            }, headers={'Access-Control-Allow-Origin': '*'})

        except Exception as e:
            logger.error(f"❌ Error crítico: {e}")
            return web.json_response({'success': False, 'error': str(e)}, status=500, headers={'Access-Control-Allow-Origin': '*'})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 10000))
    server = BridgeApp()
    web.run_app(server.app, port=port)
