#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Puente Telegram para subida de archivos +300MB
Sistema de chunks para Render.com gratuito
"""

import os
import asyncio
import logging
from datetime import datetime
from typing import Dict, Optional
from pathlib import Path

# Configuración de Render (gratuito)
RENDER = {
    'max_memory': 512 * 1024 * 1024,
    'timeout': 60,
    'chunk_size': 512 * 1024,
    'max_file_size': 2 * 1024 * 1024 * 1024,
}

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

try:
    import aiohttp
    from aiohttp import web
    import telethon
    from telethon import TelegramClient, utils
    from telethon.tl.types import InputFile, InputFileBig
    import psutil
except ImportError as e:
    logger.error(f"❌ Error de importación: {e}")
    raise

class Config:
    API_ID = int(os.getenv('TELEGRAM_API_ID', '38389812'))
    API_HASH = os.getenv('TELEGRAM_API_HASH', 'a97923c7c5c6e351f69fe9619965e85e')
    BOT_TOKEN_A = os.getenv('BOT_TOKEN_A', '8332459195:AAFKivFrdCQMTZPFo58Zj1DVyZHGadctORA')
    BOT_TOKEN_B = os.getenv('BOT_TOKEN_B', '8518953606:AAF6hnzn1uKx3UWlYhGCkWx7CnLNpsM-l_U')
    BOT_TOKEN_C = os.getenv('BOT_TOKEN_C', '8577352738:AAF98AJTOo9sz-cfkHOqM1ENGkbccS3g3no')
    CHANNEL_USERNAME = os.getenv('TELEGRAM_CHANNEL', '@chanelxmladmin')
    PORT = int(os.getenv('PORT', 10000))
    HOST = os.getenv('HOST', '0.0.0.0')
    TMP_DIR = Path(os.getenv('TMP_DIR', '/tmp/telegram_uploads'))
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    @classmethod
    def validate(cls):
        return True

class UploadSession:
    def __init__(self, session_id: str, file_name: str, file_size: int, bot_token: str):
        self.session_id = session_id
        self.file_name = file_name
        self.file_size = file_size
        self.bot_token = bot_token
        self.chunks: Dict[int, bytes] = {}
        self.total_chunks = (file_size + RENDER['chunk_size'] - 1) // RENDER['chunk_size']
        self.uploaded_chunks = set()
        self.created_at = datetime.now()
        self.status = 'initialized'
        self.file_path = None

    def add_chunk(self, chunk_index: int, chunk_data: bytes) -> bool:
        self.chunks[chunk_index] = chunk_data
        self.uploaded_chunks.add(chunk_index)
        if len(self.uploaded_chunks) == self.total_chunks:
            self._reconstruct_file()
            self.status = 'ready_to_upload'
        return True

    def _reconstruct_file(self):
        tmp_file = Config.TMP_DIR / f"{self.session_id}_{self.file_name}"
        with open(tmp_file, 'wb') as f:
            for idx in sorted(self.chunks.keys()):
                f.write(self.chunks[idx])
        self.file_path = tmp_file
        self.chunks.clear()

    def cleanup(self):
        if self.file_path and self.file_path.exists():
            self.file_path.unlink()

class TelegramUploader:
    def __init__(self, bot_token: str):
        self.bot_token = bot_token
        self.client = None
        self.is_connected = False

    async def connect(self):
        api_id = int(self.bot_token.split(':')[0]) if ':' in self.bot_token else Config.API_ID
        self.client = TelegramClient(f'session_{api_id}', api_id, Config.API_HASH)
        await self.client.start(bot_token=self.bot_token)
        self.is_connected = True
        self.channel = await self.client.get_entity(Config.CHANNEL_USERNAME)
        return True

    async def upload_file(self, file_path: Path, caption: str = "") -> Dict:
        if not self.is_connected: await self.connect()
        try:
            file = await self.client.upload_file(file=file_path, part_size_kb=512)
            message = await self.client.send_file(entity=self.channel, file=file, caption=caption)
            return {'success': True, 'message_id': message.id, 'telegram_link': f"https://t.me/{Config.CHANNEL_USERNAME.replace('@','')}/{message.id}"}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    async def disconnect(self):
        if self.client: await self.client.disconnect()

class TelegramBridgeServer:
    def __init__(self):
        # Corregida la lista de middlewares para evitar el error de despliegue
        self.app = web.Application(
            client_max_size=RENDER['max_file_size'],
            middlewares=[
                self.cors_middleware,
                self.error_middleware,
                self.auth_middleware
            ]
        )
        self.sessions: Dict[str, UploadSession] = {}
        self.uploaders: Dict[str, TelegramUploader] = {}
        self.setup_routes()
        self.init_uploaders()

    def init_uploaders(self):
        for token, name in [(Config.BOT_TOKEN_A, 'bot_a'), (Config.BOT_TOKEN_B, 'bot_b'), (Config.BOT_TOKEN_C, 'bot_c')]:
            if token and len(token) > 10:
                self.uploaders[name] = TelegramUploader(token)

    def setup_routes(self):
        self.app.router.add_post('/init-upload', self.handle_init_upload)
        self.app.router.add_post('/upload-chunk', self.handle_upload_chunk)
        self.app.router.add_post('/finalize-upload', self.handle_finalize)
        self.app.router.add_get('/health', self.handle_health)
        self.app.router.add_get('/', self.handle_root)

    # --- MIDDLEWARES CORREGIDOS ---
    @web.middleware
    async def cors_middleware(self, request, handler):
        if request.method == "OPTIONS":
            resp = web.Response(status=204)
        else:
            resp = await handler(request)
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Bot-Token, Authorization'
        return resp

    @web.middleware
    async def error_middleware(self, request, handler):
        try:
            return await handler(request)
        except Exception as e:
            logger.error(f"Error: {e}")
            return web.json_response({'success': False, 'error': str(e)}, status=500)

    @web.middleware
    async def auth_middleware(self, request, handler):
        """Middleware de autenticación simplificado"""
        # Si es salud o raíz, dejar pasar
        if request.path in ['/health', '/']: 
            return await handler(request)
            
        # Intentar obtener el token de varias formas
        token = request.headers.get('X-Bot-Token') or request.headers.get('Authorization')
        
        # LISTA DE TOKENS VÁLIDOS (Asegúrate que coincidan con tus variables)
        valid_tokens = [Config.BOT_TOKEN_A, Config.BOT_TOKEN_B, Config.BOT_TOKEN_C]
        
        # DEBUG: Si quieres que funcione SI O SI mientras pruebas, 
        # puedes comentar las siguientes 3 líneas añadiendo un # al inicio:
        if not token or token not in valid_tokens:
             return web.json_response({'error': 'Token no reconocido', 'sent': str(token)}, status=401)
        
        return await handler(request)

    # --- HANDLERS ---
    async def handle_root(self, request):
        return web.json_response({'status': 'online', 'bridge': 'active'})

    async def handle_health(self, request):
        return web.json_response({'status': 'healthy'})

    async def handle_init_upload(self, request):
        data = await request.json()
        session = UploadSession(data['upload_id'], data['file_name'], int(data['file_size']), request.headers.get('X-Bot-Token'))
        self.sessions[data['upload_id']] = session
        return web.json_response({'success': True, 'session_id': data['upload_id'], 'total_chunks': session.total_chunks})

    async def handle_upload_chunk(self, request):
        reader = await request.multipart()
        session_id, chunk_index, chunk_data = None, None, None
        async for field in reader:
            if field.name == 'session_id': session_id = (await field.read(decode=True)).decode()
            if field.name == 'chunk_index': chunk_index = int(await field.read(decode=True))
            if field.name == 'chunk_data': chunk_data = await field.read()
        
        if session_id in self.sessions:
            self.sessions[session_id].add_chunk(chunk_index, chunk_data)
            return web.json_response({'success': True})
        return web.json_response({'error': 'Sesion no encontrada'}, status=404)

    async def handle_finalize(self, request):
        data = await request.json()
        session = self.sessions.get(data.get('session_id'))
        if session and session.status == 'ready_to_upload':
            uploader = next((u for u in self.uploaders.values() if u.bot_token == session.bot_token), None)
            if not uploader:
                uploader = TelegramUploader(session.bot_token)
                await uploader.connect()
            
            res = await uploader.upload_file(session.file_path, f"Archivo: {session.file_name}")
            session.cleanup()
            del self.sessions[data['session_id']]
            return web.json_response(res)
        return web.json_response({'error': 'No listo'}, status=400)

    async def start(self):
        runner = web.AppRunner(self.app)
        await runner.setup()
        await web.TCPSite(runner, Config.HOST, Config.PORT).start()
        logger.info(f"🚀 Puente en puerto {Config.PORT}")
        return runner

async def main():
    server = TelegramBridgeServer()
    runner = await server.start()
    await asyncio.Event().wait()

if __name__ == '__main__':
    asyncio.run(main())
