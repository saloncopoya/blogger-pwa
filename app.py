import os
import logging
import asyncio
from pathlib import Path
from aiohttp import web
from telethon import TelegramClient

# --- CONFIGURACIÓN DE LOGS ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- TUS CREDENCIALES REALES ---
API_ID = 38389812
API_HASH = 'a97923c7c5c6e351f69fe9619965e85e'
CHANNEL_USERNAME = os.getenv('TELEGRAM_CHANNEL', '@chanelxmladmin')
TMP_DIR = Path("temp_uploads")
TMP_DIR.mkdir(exist_ok=True)

# Encabezados CORS universales para que Blogger no bloquee la petición
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Bot-Token, Authorization',
    'Access-Control-Max-Age': '86400',
}

async def handle_options(request):
    return web.Response(status=204, headers=CORS_HEADERS)

class BridgeApp:
    def __init__(self):
        # Soporta hasta 2GB de archivo
        self.app = web.Application(client_max_size=2000*1024*1024)
        self.sessions = {}
        self.setup_routes()

    def setup_routes(self):
        self.app.router.add_route('OPTIONS', '/{tail:.*}', handle_options)
        self.app.router.add_post('/init-upload', self.handle_init)
        self.app.router.add_post('/upload-chunk', self.handle_chunk)
        self.app.router.add_post('/finalize-upload', self.handle_finalize)
        self.app.router.add_get('/', self.handle_health)

    async def handle_health(self, request):
        return web.Response(text="🚀 Puente de Gallos Online", headers=CORS_HEADERS)

    async def handle_init(self, request):
        try:
            data = await request.json()
            sid = data.get('upload_id')
            file_name = data.get('file_name', 'archivo.dat')
            token = request.headers.get('X-Bot-Token')
            
            file_path = TMP_DIR / f"{sid}_{file_name}"
            # Guardamos la sesión
            self.sessions[sid] = {'path': file_path, 'token': token, 'name': file_name}
            
            logger.info(f"🆕 Sesión iniciada: {sid}")
            return web.json_response({'success': True, 'session_id': sid}, headers=CORS_HEADERS)
        except Exception as e:
            logger.error(f"Error en init: {e}")
            return web.json_response({'error': str(e)}, status=400, headers=CORS_HEADERS)

    async def handle_chunk(self, request):
        try:
            data = await request.post()
            sid = data.get('session_id')
            chunk_data = data.get('chunk_data').file.read()
            
            if sid in self.sessions:
                # Escribir chunk al disco
                with open(self.sessions[sid]['path'], 'ab') as f:
                    f.write(chunk_data)
                return web.json_response({'success': True}, headers=CORS_HEADERS)
            return web.json_response({'error': 'Sesión no encontrada'}, status=404, headers=CORS_HEADERS)
        except Exception as e:
            return web.json_response({'error': str(e)}, status=500, headers=CORS_HEADERS)

    async def handle_finalize(self, request):
        try:
            data = await request.json()
            sid = data.get('session_id')
            session = self.sessions.get(sid)
            
            if not session:
                return web.json_response({'error': 'Sesión inválida'}, status=404, headers=CORS_HEADERS)

            # Conectar a Telegram con TUS credenciales
            client = TelegramClient(None, API_ID, API_HASH)
            await client.start(bot_token=session['token'])
            
            logger.info(f"📤 Subiendo a Telegram: {session['name']}")
            
            # Enviar el archivo reconstruido
            message = await client.send_file(
                CHANNEL_USERNAME,
                file=session['path'],
                caption=f"✅ {session['name']}"
            )
            await client.disconnect()

            # Limpiar disco y memoria
            if session['path'].exists(): session['path'].unlink()
            del self.sessions[sid]

            # Responder con el link real de Telegram
            clean_channel = CHANNEL_USERNAME.replace('@','')
            return web.json_response({
                'success': True,
                'message_id': message.id,
                'telegram_link': f"https://t.me/{clean_channel}/{message.id}"
            }, headers=CORS_HEADERS)
            
        except Exception as e:
            logger.error(f"❌ Error finalizando: {e}")
            return web.json_response({'success': False, 'error': str(e)}, status=500, headers=CORS_HEADERS)

if __name__ == '__main__':
    port = int(os.getenv('PORT', 10000))
    bridge = BridgeApp()
    web.run_app(bridge.app, port=port)
