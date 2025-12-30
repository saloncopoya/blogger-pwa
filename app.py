import os
import logging
import json
from pathlib import Path
from aiohttp import web
from telethon import TelegramClient
from telethon.tl.types import DocumentAttributeVideo, DocumentAttributeFilename

# --- CONFIGURACIÓN DE LOGS ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- CREDENCIALES ---
API_ID = 38389812
API_HASH = 'a97923c7c5c6e351f69fe9619965e85e'
CHANNEL_ID = -1003492688553  # Tu canal de destino
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
        self.app.router.add_get('/get-file/{file_id}', self.handle_get_file)  # NUEVO

    async def handle_health(self, request):
        return web.Response(text="🚀 Puente Telegram Online", headers=CORS_HEADERS)

    async def handle_init(self, request):
        try:
            data = await request.json()
            sid = data.get('upload_id')
            file_name = data.get('file_name', 'archivo.dat')
            file_type = data.get('file_type', '')
            token = request.headers.get('X-Bot-Token')
            
            file_path = TMP_DIR / f"{sid}_{file_name}"
            self.sessions[sid] = {
                'path': file_path, 
                'token': token, 
                'name': file_name,
                'type': file_type
            }
            
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
            client = TelegramClient(f'session_{sid}', API_ID, API_HASH)
            await client.start(bot_token=session['token'])
            
            logger.info(f"📤 Enviando archivo: {session['name']}")
            
            # Subir archivo a Telegram
            message = await client.send_file(
                CHANNEL_ID,
                file=session['path'],
                caption=f"📁 {session['name']}",
                supports_streaming=True
            )
            
            # Obtener el File ID y access_hash
            media = message.media
            file_id = None
            access_hash = None
            file_reference = None
            
            if hasattr(media, 'document'):
                # Es un documento (video, documento, etc.)
                file_id = media.document.id
                access_hash = media.document.access_hash
                file_reference = media.document.file_reference
                
                # Determinar si es video o imagen
                for attr in media.document.attributes:
                    if isinstance(attr, DocumentAttributeVideo):
                        file_type = 'video'
                        break
                    elif hasattr(attr, 'file_name'):
                        if attr.file_name.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')):
                            file_type = 'image'
                        else:
                            file_type = 'document'
            elif hasattr(media, 'photo'):
                # Es una foto
                file_id = media.photo.id
                access_hash = media.photo.access_hash
                file_reference = media.photo.file_reference
                file_type = 'image'
            
            await client.disconnect()

            # Limpieza
            if session['path'].exists():
                session['path'].unlink()
            del self.sessions[sid]

            # Construir respuesta con todos los datos necesarios
            response_data = {
                'success': True,
                'message_id': message.id,
                'file_id': str(file_id),
                'access_hash': str(access_hash),
                'file_reference': file_reference.hex() if file_reference else '',
                'file_type': file_type,
                'file_name': session['name'],
                'telegram_link': f"https://t.me/{PUBLIC_NAME}/{message.id}",
                'direct_link': f"/get-file/{file_id}"  # NUEVO: Link para servir el archivo
            }
            
            logger.info(f"✅ Subida completada: {response_data}")
            return web.json_response(response_data, headers=CORS_HEADERS)
            
        except Exception as e:
            logger.error(f"❌ Error en Telegram: {e}")
            return web.json_response({'success': False, 'error': str(e)}, status=500, headers=CORS_HEADERS)

    async def handle_get_file(self, request):
        """NUEVO: Servir archivos directamente desde Telegram"""
        try:
            file_id = request.match_info.get('file_id')
            token = request.headers.get('X-Bot-Token')
            
            if not file_id or not token:
                return web.Response(status=400, text='Faltan parámetros')
            
            # Conectar a Telegram
            client = TelegramClient(f'download_{file_id}', API_ID, API_HASH)
            await client.start(bot_token=token)
            
            # Descargar el archivo
            message = await client.get_messages(CHANNEL_ID, ids=int(file_id))
            
            if not message or not message.media:
                return web.Response(status=404, text='Archivo no encontrado')
            
            # Descargar a memoria
            file_data = await client.download_media(message.media, file=bytes)
            
            await client.disconnect()
            
            # Determinar content-type
            if hasattr(message.media, 'document'):
                mime_type = message.media.document.mime_type
            else:
                # Inferir del nombre o tipo
                mime_type = 'application/octet-stream'
                if hasattr(message, 'text'):
                    if '.jpg' in message.text.lower() or '.jpeg' in message.text.lower():
                        mime_type = 'image/jpeg'
                    elif '.png' in message.text.lower():
                        mime_type = 'image/png'
                    elif '.mp4' in message.text.lower() or '.mov' in message.text.lower():
                        mime_type = 'video/mp4'
                    elif '.gif' in message.text.lower():
                        mime_type = 'image/gif'
            
            # Devolver el archivo
            return web.Response(
                body=file_data,
                headers={
                    **CORS_HEADERS,
                    'Content-Type': mime_type,
                    'Content-Disposition': f'inline; filename="{file_id}"'
                }
            )
            
        except Exception as e:
            logger.error(f"❌ Error descargando archivo: {e}")
            return web.Response(status=500, text=str(e))

async def cleanup_sessions(app):
    """Limpiar archivos temporales al cerrar"""
    for file in TMP_DIR.glob("*"):
        try:
            file.unlink()
        except:
            pass

if __name__ == '__main__':
    port = int(os.getenv('PORT', 10000))
    bridge = BridgeApp()
    bridge.app.on_cleanup.append(cleanup_sessions)
    
    logger.info(f"🚀 Iniciando servidor en puerto {port}")
    web.run_app(bridge.app, port=port, host='0.0.0.0')
