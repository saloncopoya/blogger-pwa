import os
import logging
import asyncio
from pathlib import Path
from aiohttp import web
from telethon import TelegramClient
import json

# --- CONFIGURACIÓN DE LOGS ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- CREDENCIALES ---
API_ID = 38389812
API_HASH = 'a97923c7c5c6e351f69fe9619965e85e'
CHANNEL_ID = -1003492688553
PUBLIC_NAME = "chanelxmladmin"

TMP_DIR = Path("temp_uploads")
TMP_DIR.mkdir(exist_ok=True)

# Encabezados CORS
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
        self.app = web.Application(client_max_size=2000*1024*1024)
        self.sessions = {}
        self.setup_routes()

    def setup_routes(self):
        self.app.router.add_route('OPTIONS', '/{tail:.*}', handle_options)
        self.app.router.add_post('/init-upload', self.handle_init)
        self.app.router.add_post('/upload-chunk', self.handle_chunk)
        self.app.router.add_post('/finalize-upload', self.handle_finalize)
        self.app.router.add_get('/', self.handle_health)
        self.app.router.add_get('/get-file/{message_id}', self.handle_get_file)

    async def handle_health(self, request):
        return web.Response(text="🚀 Puente con ID Numérico Online", headers=CORS_HEADERS)

    async def handle_init(self, request):
        try:
            data = await request.json()
            sid = data.get('upload_id')
            file_name = data.get('file_name', 'archivo.dat')
            token = request.headers.get('X-Bot-Token')
            
            file_path = TMP_DIR / f"{sid}_{file_name}"
            self.sessions[sid] = {'path': file_path, 'token': token, 'name': file_name}
            
            logger.info(f"🆕 Sesión iniciada: {sid}")
            return web.json_response({'success': True, 'session_id': sid}, headers=CORS_HEADERS)
        except Exception as e:
            return web.json_response({'error': str(e)}, status=400, headers=CORS_HEADERS)

    async def handle_chunk(self, request):
        try:
            data = await request.post()
            sid = data.get('session_id')
            chunk_data = data.get('chunk_data').file.read()
            
            if sid in self.sessions:
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

            # Iniciar cliente Telethon
            client = TelegramClient(None, API_ID, API_HASH)
            await client.start(bot_token=session['token'])
            
            logger.info(f"📤 Enviando archivo a ID: {CHANNEL_ID}")
            
            # Subir archivo a Telegram
            message = await client.send_file(
                CHANNEL_ID,
                file=session['path'],
                caption=f"✅ {session['name']}",
                force_document=False  # Esto es importante para que Telegram genere vista previa
            )
            
            # OBTENER ENLACE DIRECTO DEL ARCHIVO
            file_info = None
            direct_url = None
            
            if message.media:
                if hasattr(message.media, 'photo'):
                    # Es una imagen
                    file_info = message.media.photo
                elif hasattr(message.media, 'document'):
                    # Es un documento (video/archivo)
                    file_info = message.media.document
                
                if file_info:
                    # Obtener el archivo de Telegram
                    file = await client.download_file(file_info, bytes)
                    
                    # Guardar temporalmente para servir
                    file_ext = '.jpg' if hasattr(message.media, 'photo') else '.mp4'
                    temp_file = TMP_DIR / f"file_{message.id}{file_ext}"
                    with open(temp_file, 'wb') as f:
                        f.write(file)
                    
                    # Crear URL pública para el archivo
                    # En producción, esto debería apuntar a tu dominio
                    base_url = request.url.scheme + "://" + request.url.host
                    if request.url.port:
                        base_url += f":{request.url.port}"
                    
                    direct_url = f"{base_url}/get-file/{message.id}"
            
            await client.disconnect()

            # Limpieza de archivo temporal original
            if session['path'].exists():
                session['path'].unlink()
            del self.sessions[sid]

            # Retornar ambos enlaces
            response_data = {
                'success': True,
                'message_id': message.id,
                'telegram_link': f"https://t.me/{PUBLIC_NAME}/{message.id}",
                'direct_link': direct_url,  # URL directa al archivo
                'file_id': str(file_info.id) if file_info else None
            }
            
            return web.json_response(response_data, headers=CORS_HEADERS)
            
        except Exception as e:
            logger.error(f"❌ Error en Telegram: {e}")
            return web.json_response({'success': False, 'error': str(e)}, status=500, headers=CORS_HEADERS)

    async def handle_get_file(self, request):
        """Servir archivo directamente"""
        message_id = request.match_info.get('message_id')
        
        # Buscar archivos que coincidan con el message_id
        for file_path in TMP_DIR.glob(f"file_{message_id}.*"):
            if file_path.exists():
                # Determinar tipo de contenido
                if file_path.suffix.lower() in ['.jpg', '.jpeg', '.png', '.gif']:
                    content_type = 'image/jpeg'
                elif file_path.suffix.lower() in ['.mp4', '.webm', '.mov']:
                    content_type = 'video/mp4'
                else:
                    content_type = 'application/octet-stream'
                
                # Servir el archivo
                return web.Response(
                    body=file_path.read_bytes(),
                    content_type=content_type,
                    headers={
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=31536000'  # Cache por 1 año
                    }
                )
        
        return web.Response(status=404, text="Archivo no encontrado")

if __name__ == '__main__':
    port = int(os.getenv('PORT', 10000))
    bridge = BridgeApp()
    web.run_app(bridge.app, port=port)
