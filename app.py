import os
import logging
import asyncio
from pathlib import Path
from aiohttp import web
from telethon import TelegramClient
from telethon.sessions import StringSession
import json

# --- CONFIGURACIÓN DE LOGS ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- CONFIGURACIÓN TELEGRAM ---
# CREDENCIALES MÚLTIPLES PARA EVITAR RATE LIMITING
TELEGRAM_CREDENTIALS = [
    {
        'name': 'Cuenta 1',
        'api_id': 38389812,
        'api_hash': 'a97923c7c5c6e351f69fe9619965e85e',
        'bot_token': '8332459195:AAFKivFrdCQMTZPFo58Zj1DVyZHGadctORA'
    },
    {
        'name': 'Cuenta 2', 
        'api_id': 38389812,
        'api_hash': 'a97923c7c5c6e351f69fe9619965e85e',
        'bot_token': '8518953606:AAF6hnzn1uKx3UWlYhGCkWx7CnLNpsM-l_U'
    },
    {
        'name': 'Cuenta 3',
        'api_id': 38389812,
        'api_hash': 'a97923c7c5c6e351f69fe9619965e85e',
        'bot_token': '8577352738:AAF98AJTOo9sz-cfkHOqM1ENGkbccS3g3no'
    }
]

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

# Diccionario para almacenar sesiones de clientes
telegram_clients = {}

async def get_telegram_client(bot_token):
    """Obtener o crear cliente Telegram para un bot token específico"""
    if bot_token in telegram_clients:
        return telegram_clients[bot_token]
    
    # Encontrar las credenciales correspondientes
    credentials = None
    for cred in TELEGRAM_CREDENTIALS:
        if cred['bot_token'] == bot_token:
            credentials = cred
            break
    
    if not credentials:
        raise ValueError(f"No se encontraron credenciales para el bot token: {bot_token}")
    
    # Crear nuevo cliente
    session_name = f"session_{bot_token[-10:]}"
    client = TelegramClient(
        StringSession(),  # Usar sesión en memoria
        credentials['api_id'],
        credentials['api_hash']
    )
    
    # Iniciar sesión con bot token
    await client.start(bot_token=bot_token)
    
    # Verificar conexión
    me = await client.get_me()
    logger.info(f"✅ Cliente Telegram creado para: @{me.username}")
    
    # Almacenar cliente
    telegram_clients[bot_token] = client
    return client

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
        return web.Response(text="🚀 Puente Telegram Mejorado Online", headers=CORS_HEADERS)

    async def handle_init(self, request):
        try:
            data = await request.json()
            sid = data.get('upload_id')
            file_name = data.get('file_name', 'archivo.dat')
            token = request.headers.get('X-Bot-Token')
            
            if not token:
                return web.json_response({'error': 'Token de bot requerido'}, status=400, headers=CORS_HEADERS)
            
            file_path = TMP_DIR / f"{sid}_{file_name}"
            self.sessions[sid] = {
                'path': file_path, 
                'token': token, 
                'name': file_name,
                'chunks_uploaded': 0,
                'total_chunks': 0,
                'file_size': 0
            }
            
            logger.info(f"🆕 Sesión iniciada: {sid} para {file_name}")
            return web.json_response({'success': True, 'session_id': sid}, headers=CORS_HEADERS)
        except Exception as e:
            logger.error(f"❌ Error en init: {e}")
            return web.json_response({'error': str(e)}, status=400, headers=CORS_HEADERS)

    async def handle_chunk(self, request):
        try:
            data = await request.post()
            sid = data.get('session_id')
            chunk = data.get('chunk_data').file.read()
            
            if sid not in self.sessions:
                return web.json_response({'error': 'Sesión no encontrada'}, status=404, headers=CORS_HEADERS)
            
            session = self.sessions[sid]
            
            # Guardar chunk
            with open(session['path'], 'ab') as f:
                f.write(chunk)
            
            session['chunks_uploaded'] += 1
            session['file_size'] += len(chunk)
            
            logger.info(f"📦 Chunk recibido para {sid}: {len(chunk)} bytes")
            return web.json_response({
                'success': True,
                'chunks_uploaded': session['chunks_uploaded'],
                'file_size': session['file_size']
            }, headers=CORS_HEADERS)
            
        except Exception as e:
            logger.error(f"❌ Error en chunk: {e}")
            return web.json_response({'error': str(e)}, status=500, headers=CORS_HEADERS)

    async def handle_finalize(self, request):
        try:
            data = await request.json()
            sid = data.get('session_id')
            
            if sid not in self.sessions:
                return web.json_response({'error': 'Sesión inválida'}, status=404, headers=CORS_HEADERS)

            session = self.sessions[sid]
            
            # Validar que el archivo existe
            if not session['path'].exists():
                return web.json_response({'error': 'Archivo no encontrado'}, status=404, headers=CORS_HEADERS)
            
            file_size = os.path.getsize(session['path'])
            if file_size == 0:
                return web.json_response({'error': 'Archivo vacío'}, status=400, headers=CORS_HEADERS)
            
            logger.info(f"📤 Enviando archivo a Telegram: {session['name']} ({file_size} bytes)")
            
            # Obtener cliente Telegram
            try:
                client = await get_telegram_client(session['token'])
            except Exception as e:
                logger.error(f"❌ Error obteniendo cliente Telegram: {e}")
                return web.json_response({
                    'success': False, 
                    'error': f'Error de autenticación con Telegram: {str(e)}'
                }, status=500, headers=CORS_HEADERS)
            
            # Subir archivo a Telegram
            try:
                message = await client.send_file(
                    CHANNEL_ID,
                    file=str(session['path']),
                    caption=f"📁 {session['name']}\n📦 Tamaño: {file_size:,} bytes",
                    force_document=False,
                    progress_callback=self.upload_progress
                )
                
                logger.info(f"✅ Archivo subido. Message ID: {message.id}")
                
                # Obtener información del archivo
                file_info = None
                if message.media:
                    if hasattr(message.media, 'photo'):
                        file_info = message.media.photo
                    elif hasattr(message.media, 'document'):
                        file_info = message.media.document
                
                # Crear respuesta
                response_data = {
                    'success': True,
                    'message_id': message.id,
                    'telegram_link': f"https://t.me/{PUBLIC_NAME}/{message.id}",
                    'file_name': session['name'],
                    'file_size': file_size,
                    'file_id': str(file_info.id) if file_info else None,
                    'channel_id': CHANNEL_ID
                }
                
                return web.json_response(response_data, headers=CORS_HEADERS)
                
            except Exception as e:
                logger.error(f"❌ Error subiendo a Telegram: {e}")
                return web.json_response({
                    'success': False, 
                    'error': f'Error subiendo a Telegram: {str(e)}'
                }, status=500, headers=CORS_HEADERS)
            
        except Exception as e:
            logger.error(f"❌ Error en finalize: {e}")
            return web.json_response({'error': str(e)}, status=500, headers=CORS_HEADERS)
    
    def upload_progress(self, current, total):
        """Callback de progreso para Telegram"""
        progress = (current / total) * 100
        logger.info(f"📤 Progreso Telegram: {progress:.1f}% ({current}/{total})")

    async def handle_get_file(self, request):
        """Servir archivo directamente (no implementado completamente)"""
        message_id = request.match_info.get('message_id')
        return web.Response(
            text="Esta funcionalidad requiere configuración adicional",
            status=501,
            headers=CORS_HEADERS
        )

async def cleanup():
    """Limpiar clientes Telegram al cerrar"""
    for bot_token, client in telegram_clients.items():
        try:
            await client.disconnect()
            logger.info(f"🔌 Cliente desconectado: {bot_token[-10:]}")
        except:
            pass

if __name__ == '__main__':
    port = int(os.getenv('PORT', 10000))
    bridge = BridgeApp()
    
    # Configurar limpieza al cerrar
    import signal
    import sys
    
    async def shutdown(app):
        await cleanup()
    
    bridge.app.on_shutdown.append(shutdown)
    
    # Manejar señales de terminación
    def signal_handler():
        print("\n🛑 Recibida señal de terminación...")
        asyncio.create_task(cleanup())
        sys.exit(0)
    
    signal.signal(signal.SIGINT, lambda s, f: signal_handler())
    signal.signal(signal.SIGTERM, lambda s, f: signal_handler())
    
    print(f"🚀 Servidor iniciado en puerto {port}")
    print(f"📁 Directorio temporal: {TMP_DIR.absolute()}")
    print(f"🤖 Credenciales configuradas: {len(TELEGRAM_CREDENTIALS)} bots")
    
    web.run_app(bridge.app, port=port, access_log=None)
