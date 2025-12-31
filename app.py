import os
import logging
import asyncio
from pathlib import Path
from aiohttp import web
from telethon import TelegramClient
from telethon.sessions import StringSession
import json
from datetime import datetime

# --- CONFIGURACIÓN DE LOGS ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('telegram_bridge.log')
    ]
)
logger = logging.getLogger(__name__)

# --- CONFIGURACIÓN TELEGRAM ---
TELEGRAM_CREDENTIALS = [
    {
        'name': 'Puente A',
        'api_id': 38389812,
        'api_hash': 'a97923c7c5c6e351f69fe9619965e85e',
        'bot_token': '8332459195:AAFKivFrdCQMTZPFo58Zj1DVyZHGadctORA'
    },
    {
        'name': 'Puente B', 
        'api_id': 38389812,
        'api_hash': 'a97923c7c5c6e351f69fe9619965e85e',
        'bot_token': '8518953606:AAF6hnzn1uKx3UWlYhGCkWx7CnLNpsM-l_U'
    },
    {
        'name': 'Puente C',
        'api_id': 38389812,
        'api_hash': 'a97923c7c5c6e351f69fe9619965e85e',
        'bot_token': '8577352738:AAF98AJTOo9sz-cfkHOqM1ENGkbccS3g3no'
    }
]

CHANNEL_ID = -1003492688553
PUBLIC_NAME = "chanelxmladmin"

TMP_DIR = Path("telegram_cache")
TMP_DIR.mkdir(exist_ok=True)

# Encabezados CORS completos
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, X-Bot-Token, Authorization, X-Requested-With, X-File-Name, X-Session-ID',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': 'Content-Type, Content-Length, X-File-ID, X-Message-ID'
}

# Diccionario para almacenar clientes Telegram
telegram_clients = {}
upload_sessions = {}

async def handle_options(request):
    """Manejar solicitudes OPTIONS para CORS"""
    return web.Response(
        status=204,
        headers=CORS_HEADERS
    )

async def get_telegram_client(bot_token):
    """Obtener o crear cliente Telegram"""
    if bot_token in telegram_clients:
        client = telegram_clients[bot_token]
        if client.is_connected():
            return client
    
    # Buscar credenciales
    credentials = None
    for cred in TELEGRAM_CREDENTIALS:
        if cred['bot_token'] == bot_token:
            credentials = cred
            break
    
    if not credentials:
        raise ValueError(f"No credentials found for bot token: {bot_token}")
    
    # Crear nuevo cliente
    client_name = f"client_{bot_token[-8:]}"
    client = TelegramClient(
        StringSession(),
        credentials['api_id'],
        credentials['api_hash']
    )
    
    try:
        await client.start(bot_token=bot_token)
        me = await client.get_me()
        logger.info(f"✅ Telegram client created: @{me.username} ({credentials['name']})")
        
        telegram_clients[bot_token] = client
        return client
    except Exception as e:
        logger.error(f"❌ Failed to create Telegram client: {e}")
        raise

def get_mime_type(filename):
    """Obtener tipo MIME basado en extensión"""
    ext = Path(filename).suffix.lower()
    mime_map = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
        '.webm': 'video/webm',
        '.pdf': 'application/pdf',
        '.zip': 'application/zip',
        '.txt': 'text/plain'
    }
    return mime_map.get(ext, 'application/octet-stream')

class TelegramBridge:
    def __init__(self):
        self.app = web.Application(client_max_size=2 * 1024 * 1024 * 1024)  # 2GB
        self.setup_routes()
        self.cleanup_task = None

    def setup_routes(self):
        """Configurar todas las rutas"""
        self.app.router.add_route('*', '/{tail:.*}', handle_options)  # Para todas las rutas OPTIONS
        
        # Rutas principales
        self.app.router.add_post('/init-upload', self.handle_init_upload)
        self.app.router.add_post('/upload-chunk', self.handle_upload_chunk)
        self.app.router.add_post('/finalize-upload', self.handle_finalize_upload)
        self.app.router.add_get('/get-file/{message_id}', self.handle_get_file)
        self.app.router.add_get('/file-info/{message_id}', self.handle_file_info)
        self.app.router.add_get('/health', self.handle_health)
        self.app.router.add_get('/stats', self.handle_stats)
        self.app.router.add_get('/', self.handle_root)

    async def handle_root(self, request):
        """Página principal"""
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>🚀 Telegram Bridge</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                h1 { color: #007bff; }
                .endpoint { background: #f8f9fa; padding: 15px; margin: 10px 0; border-left: 4px solid #007bff; }
                code { background: #e9ecef; padding: 2px 6px; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 Telegram Bridge Server</h1>
                <p>Servidor para subida de archivos a Telegram con soporte CORS</p>
                
                <h2>📡 Endpoints disponibles:</h2>
                
                <div class="endpoint">
                    <strong>POST /init-upload</strong><br>
                    Inicia una sesión de subida. Headers requeridos: <code>X-Bot-Token</code>
                </div>
                
                <div class="endpoint">
                    <strong>POST /upload-chunk</strong><br>
                    Sube un chunk del archivo. Headers requeridos: <code>X-Bot-Token</code>, <code>X-Session-ID</code>
                </div>
                
                <div class="endpoint">
                    <strong>POST /finalize-upload</strong><br>
                    Finaliza la subida y envía a Telegram.
                </div>
                
                <div class="endpoint">
                    <strong>GET /get-file/{message_id}</strong><br>
                    Obtiene un archivo subido previamente.
                </div>
                
                <div class="endpoint">
                    <strong>GET /health</strong><br>
                    Verifica el estado del servidor.
                </div>
                
                <div class="endpoint">
                    <strong>GET /stats</strong><br>
                    Estadísticas del servidor.
                </div>
                
                <h2>🔧 Configuración:</h2>
                <ul>
                    <li><strong>Puertos:</strong> {port}</li>
                    <li><strong>CORS:</strong> Habilitado completamente</li>
                    <li><strong>Límite de archivo:</strong> 2GB</li>
                    <li><strong>Bots configurados:</strong> {bot_count}</li>
                </ul>
                
                <p style="margin-top: 30px; color: #666; font-size: 12px;">
                    Server time: {time} | PID: {pid}
                </p>
            </div>
        </body>
        </html>
        """.format(
            port=os.getenv('PORT', 10000),
            bot_count=len(TELEGRAM_CREDENTIALS),
            time=datetime.now().isoformat(),
            pid=os.getpid()
        )
        
        return web.Response(text=html, content_type='text/html', headers=CORS_HEADERS)

    async def handle_health(self, request):
        """Verificar salud del servidor"""
        status = {
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'version': '2.0.0',
            'bots_configured': len(TELEGRAM_CREDENTIALS),
            'active_sessions': len(upload_sessions),
            'cache_files': len(list(TMP_DIR.glob('*'))),
            'memory_usage': '{} MB'.format(os.sys.getsizeof(upload_sessions) // 1024 // 1024)
        }
        
        return web.json_response(status, headers=CORS_HEADERS)

    async def handle_stats(self, request):
        """Estadísticas del servidor"""
        cache_files = list(TMP_DIR.glob('*'))
        file_stats = []
        
        for f in cache_files[:20]:  # Solo primeros 20
            if f.is_file():
                file_stats.append({
                    'name': f.name,
                    'size': f.stat().st_size,
                    'modified': datetime.fromtimestamp(f.stat().st_mtime).isoformat()
                })
        
        stats = {
            'server_start': datetime.now().isoformat(),
            'total_requests': getattr(self, 'request_count', 0),
            'upload_sessions': len(upload_sessions),
            'telegram_clients': len(telegram_clients),
            'cache_files': {
                'total': len(cache_files),
                'total_size': sum(f.stat().st_size for f in cache_files if f.is_file()),
                'recent_files': file_stats
            },
            'system': {
                'pid': os.getpid(),
                'cwd': os.getcwd(),
                'temp_dir': str(TMP_DIR.absolute())
            }
        }
        
        return web.json_response(stats, headers=CORS_HEADERS)

    async def handle_init_upload(self, request):
        """Iniciar una nueva sesión de subida"""
        try:
            # Verificar token
            bot_token = request.headers.get('X-Bot-Token')
            if not bot_token:
                return web.json_response(
                    {'error': 'X-Bot-Token header required'},
                    status=400,
                    headers=CORS_HEADERS
                )
            
            # Validar token
            valid_token = False
            for cred in TELEGRAM_CREDENTIALS:
                if cred['bot_token'] == bot_token:
                    valid_token = True
                    break
            
            if not valid_token:
                return web.json_response(
                    {'error': 'Invalid bot token'},
                    status=401,
                    headers=CORS_HEADERS
                )
            
            # Leer datos JSON
            data = await request.json()
            upload_id = data.get('upload_id', f"upload_{int(datetime.now().timestamp())}_{os.urandom(4).hex()}")
            file_name = data.get('file_name', 'unnamed_file')
            file_size = data.get('file_size', 0)
            
            # Crear archivo temporal
            file_path = TMP_DIR / f"{upload_id}_{file_name.replace('/', '_')}"
            
            # Inicializar sesión
            upload_sessions[upload_id] = {
                'file_path': file_path,
                'file_name': file_name,
                'file_size': file_size,
                'bot_token': bot_token,
                'chunks_received': 0,
                'total_size': 0,
                'start_time': datetime.now().isoformat(),
                'status': 'initialized'
            }
            
            logger.info(f"📤 Upload session started: {upload_id} for {file_name} ({file_size} bytes)")
            
            return web.json_response({
                'success': True,
                'session_id': upload_id,
                'file_path': str(file_path),
                'max_chunk_size': 1024 * 1024,  # 1MB
                'message': 'Upload session initialized'
            }, headers=CORS_HEADERS)
            
        except json.JSONDecodeError:
            return web.json_response(
                {'error': 'Invalid JSON'},
                status=400,
                headers=CORS_HEADERS
            )
        except Exception as e:
            logger.error(f"❌ Init upload error: {e}")
            return web.json_response(
                {'error': f'Server error: {str(e)}'},
                status=500,
                headers=CORS_HEADERS
            )

    async def handle_upload_chunk(self, request):
        """Subir un chunk del archivo"""
        try:
            # Verificar headers
            session_id = request.headers.get('X-Session-ID')
            bot_token = request.headers.get('X-Bot-Token')
            
            if not session_id or not bot_token:
                return web.json_response(
                    {'error': 'X-Session-ID and X-Bot-Token headers required'},
                    status=400,
                    headers=CORS_HEADERS
                )
            
            # Verificar sesión
            if session_id not in upload_sessions:
                return web.json_response(
                    {'error': 'Session not found or expired'},
                    status=404,
                    headers=CORS_HEADERS
                )
            
            session = upload_sessions[session_id]
            
            # Verificar token
            if session['bot_token'] != bot_token:
                return web.json_response(
                    {'error': 'Token mismatch for session'},
                    status=403,
                    headers=CORS_HEADERS
                )
            
            # Leer chunk
            reader = await request.multipart()
            chunk_field = await reader.next()
            
            if not chunk_field or chunk_field.name != 'chunk_data':
                return web.json_response(
                    {'error': 'No chunk data found'},
                    status=400,
                    headers=CORS_HEADERS
                )
            
            chunk_data = await chunk_field.read()
            chunk_size = len(chunk_data)
            
            # Guardar chunk
            with open(session['file_path'], 'ab') as f:
                f.write(chunk_data)
            
            # Actualizar sesión
            session['chunks_received'] += 1
            session['total_size'] += chunk_size
            session['last_chunk_time'] = datetime.now().isoformat()
            
            logger.debug(f"📦 Chunk received for {session_id}: {chunk_size} bytes (total: {session['total_size']})")
            
            return web.json_response({
                'success': True,
                'session_id': session_id,
                'chunks_received': session['chunks_received'],
                'total_size': session['total_size'],
                'chunk_size': chunk_size,
                'progress': (session['total_size'] / session['file_size']) * 100 if session['file_size'] > 0 else 0
            }, headers=CORS_HEADERS)
            
        except Exception as e:
            logger.error(f"❌ Upload chunk error: {e}")
            return web.json_response(
                {'error': f'Chunk upload failed: {str(e)}'},
                status=500,
                headers=CORS_HEADERS
            )

    async def handle_finalize_upload(self, request):
        """Finalizar subida y enviar a Telegram"""
        try:
            # Leer datos
            data = await request.json()
            session_id = data.get('session_id')
            bot_token = request.headers.get('X-Bot-Token')
            
            if not session_id:
                return web.json_response(
                    {'error': 'session_id required'},
                    status=400,
                    headers=CORS_HEADERS
                )
            
            # Verificar sesión
            if session_id not in upload_sessions:
                return web.json_response(
                    {'error': 'Upload session not found'},
                    status=404,
                    headers=CORS_HEADERS
                )
            
            session = upload_sessions[session_id]
            file_path = session['file_path']
            
            # Verificar que el archivo existe
            if not file_path.exists():
                return web.json_response(
                    {'error': 'File not found on server'},
                    status=404,
                    headers=CORS_HEADERS
                )
            
            file_size = file_path.stat().st_size
            
            if file_size == 0:
                return web.json_response(
                    {'error': 'File is empty'},
                    status=400,
                    headers=CORS_HEADERS
                )
            
            logger.info(f"🚀 Finalizing upload: {session['file_name']} ({file_size} bytes)")
            
            # Obtener cliente Telegram
            try:
                client = await get_telegram_client(session['bot_token'])
            except Exception as e:
                logger.error(f"❌ Telegram client error: {e}")
                return web.json_response(
                    {'error': f'Telegram connection failed: {str(e)}'},
                    status=500,
                    headers=CORS_HEADERS
                )
            
            # Determinar tipo de archivo
            is_image = session['file_name'].lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp'))
            is_video = session['file_name'].lower().endswith(('.mp4', '.mov', '.avi', '.mkv', '.webm'))
            
            # Subir a Telegram
            try:
                message = await client.send_file(
                    entity=CHANNEL_ID,
                    file=str(file_path),
                    caption=f"📁 {session['file_name']}\n📦 {file_size:,} bytes\n⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                    force_document=not (is_image or is_video),
                    progress_callback=lambda c, t: logger.debug(f"📤 Telegram upload: {c}/{t} bytes")
                )
                
                logger.info(f"✅ File uploaded to Telegram: Message ID {message.id}")
                
                # Obtener información del archivo
                file_info = await client.get_messages(CHANNEL_ID, ids=message.id)
                
                # Crear nombre de cache para el archivo
                cache_filename = f"file_{message.id}_{session['file_name'].replace('/', '_')}"
                cache_path = TMP_DIR / cache_filename
                
                # Mover archivo a cache
                file_path.rename(cache_path)
                
                # Determinar URLs
                telegram_link = f"https://t.me/{PUBLIC_NAME}/{message.id}"
                
                # Crear URL directa
                base_url = str(request.url).split('/finalize-upload')[0]
                direct_link = f"{base_url}/get-file/{message.id}"
                
                # Preparar metadata
                media_type = 'image' if is_image else 'video' if is_video else 'document'
                mime_type = get_mime_type(session['file_name'])
                
                response_data = {
                    'success': True,
                    'message_id': message.id,
                    'telegram_link': telegram_link,
                    'direct_link': direct_link,
                    'cache_url': direct_link,
                    'media_type': media_type,
                    'mime_type': mime_type,
                    'file_name': session['file_name'],
                    'file_size': file_size,
                    'file_id': str(message.id),
                    'has_direct_link': True,
                    'cache_filename': cache_filename,
                    'upload_duration': (datetime.now() - datetime.fromisoformat(session['start_time'])).total_seconds(),
                    'channel_id': CHANNEL_ID,
                    'channel_name': PUBLIC_NAME
                }
                
                # Limpiar sesión
                if session_id in upload_sessions:
                    del upload_sessions[session_id]
                
                logger.info(f"📊 Upload completed: {response_data}")
                
                return web.json_response(response_data, headers=CORS_HEADERS)
                
            except Exception as e:
                logger.error(f"❌ Telegram upload error: {e}")
                return web.json_response(
                    {'error': f'Telegram upload failed: {str(e)}'},
                    status=500,
                    headers=CORS_HEADERS
                )
            
        except json.JSONDecodeError:
            return web.json_response(
                {'error': 'Invalid JSON'},
                status=400,
                headers=CORS_HEADERS
            )
        except Exception as e:
            logger.error(f"❌ Finalize error: {e}")
            return web.json_response(
                {'error': f'Finalization failed: {str(e)}'},
                status=500,
                headers=CORS_HEADERS
            )

    async def handle_get_file(self, request):
        """Servir archivo desde cache"""
        try:
            message_id = request.match_info.get('message_id')
            
            if not message_id or not message_id.isdigit():
                return web.json_response(
                    {'error': 'Invalid message ID'},
                    status=400,
                    headers=CORS_HEADERS
                )
            
            # Buscar archivo en cache
            cache_files = list(TMP_DIR.glob(f"*{message_id}*"))
            
            if not cache_files:
                # Redirigir a Telegram
                return web.Response(
                    status=302,
                    headers={
                        **CORS_HEADERS,
                        'Location': f'https://t.me/{PUBLIC_NAME}/{message_id}'
                    }
                )
            
            cache_file = cache_files[0]
            
            if not cache_file.exists():
                return web.json_response(
                    {'error': 'File not found in cache'},
                    status=404,
                    headers=CORS_HEADERS
                )
            
            # Obtener tipo MIME
            mime_type = get_mime_type(str(cache_file))
            file_size = cache_file.stat().st_size
            
            # Configurar headers
            headers = {
                **CORS_HEADERS,
                'Content-Type': mime_type,
                'Content-Length': str(file_size),
                'Content-Disposition': f'inline; filename="{cache_file.name}"',
                'Cache-Control': 'public, max-age=31536000, immutable',
                'X-File-ID': message_id,
                'X-File-Size': str(file_size),
                'X-File-Type': mime_type
            }
            
            # Servir archivo
            return web.Response(
                body=cache_file.read_bytes(),
                headers=headers
            )
            
        except Exception as e:
            logger.error(f"❌ Get file error: {e}")
            return web.json_response(
                {'error': f'File serving failed: {str(e)}'},
                status=500,
                headers=CORS_HEADERS
            )

    async def handle_file_info(self, request):
        """Obtener información de archivo"""
        try:
            message_id = request.match_info.get('message_id')
            
            if not message_id or not message_id.isdigit():
                return web.json_response(
                    {'error': 'Invalid message ID'},
                    status=400,
                    headers=CORS_HEADERS
                )
            
            # Buscar archivo en cache
            cache_files = list(TMP_DIR.glob(f"*{message_id}*"))
            
            if not cache_files:
                return web.json_response({
                    'exists': False,
                    'message_id': message_id,
                    'telegram_link': f'https://t.me/{PUBLIC_NAME}/{message_id}',
                    'available_in_cache': False
                }, headers=CORS_HEADERS)
            
            cache_file = cache_files[0]
            
            if cache_file.exists():
                return web.json_response({
                    'exists': True,
                    'message_id': message_id,
                    'file_name': cache_file.name,
                    'file_size': cache_file.stat().st_size,
                    'file_type': get_mime_type(str(cache_file)),
                    'modified': datetime.fromtimestamp(cache_file.stat().st_mtime).isoformat(),
                    'available_in_cache': True,
                    'direct_url': f"{request.url.scheme}://{request.url.host}:{request.url.port}/get-file/{message_id}",
                    'telegram_link': f'https://t.me/{PUBLIC_NAME}/{message_id}'
                }, headers=CORS_HEADERS)
            else:
                return web.json_response({
                    'exists': False,
                    'message_id': message_id,
                    'available_in_cache': False,
                    'telegram_link': f'https://t.me/{PUBLIC_NAME}/{message_id}'
                }, headers=CORS_HEADERS)
                
        except Exception as e:
            logger.error(f"❌ File info error: {e}")
            return web.json_response(
                {'error': f'File info failed: {str(e)}'},
                status=500,
                headers=CORS_HEADERS
            )

    async def cleanup_old_files(self):
        """Limpiar archivos viejos del cache"""
        while True:
            try:
                now = datetime.now()
                for file_path in TMP_DIR.glob("*"):
                    if file_path.is_file():
                        mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                        age_hours = (now - mtime).total_seconds() / 3600
                        
                        # Eliminar archivos con más de 24 horas
                        if age_hours > 24:
                            try:
                                file_path.unlink()
                                logger.info(f"🧹 Cleaned old file: {file_path.name}")
                            except Exception as e:
                                logger.warning(f"⚠️ Could not delete {file_path}: {e}")
            except Exception as e:
                logger.error(f"❌ Cleanup error: {e}")
            
            await asyncio.sleep(3600)  # Ejecutar cada hora

    async def start_background_tasks(self, app):
        """Iniciar tareas en segundo plano"""
        self.cleanup_task = asyncio.create_task(self.cleanup_old_files())

    async def cleanup_background_tasks(self, app):
        """Limpiar tareas en segundo plano"""
        if self.cleanup_task:
            self.cleanup_task.cancel()
            try:
                await self.cleanup_task
            except asyncio.CancelledError:
                pass

async def close_telegram_clients():
    """Cerrar todos los clientes Telegram"""
    logger.info("🔌 Closing Telegram clients...")
    for token, client in telegram_clients.items():
        try:
            if client.is_connected():
                await client.disconnect()
                logger.info(f"  Disconnected client for token: {token[-8:]}")
        except Exception as e:
            logger.error(f"  Error disconnecting client: {e}")

if __name__ == '__main__':
    # Configurar puerto
    port = int(os.getenv('PORT', 10000))
    
    # Crear aplicación
    bridge = TelegramBridge()
    
    # Configurar eventos
    bridge.app.on_startup.append(bridge.start_background_tasks)
    bridge.app.on_cleanup.append(bridge.cleanup_background_tasks)
    bridge.app.on_shutdown.append(close_telegram_clients)
    
    # Manejar señales
    import signal
    import sys
    
    def signal_handler(signum, frame):
        print(f"\n🛑 Received signal {signum}, shutting down...")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Información de inicio
    print("=" * 60)
    print("🚀 TELEGRAM BRIDGE SERVER v2.0")
    print("=" * 60)
    print(f"📡 Port: {port}")
    print(f"🤖 Bots configured: {len(TELEGRAM_CREDENTIALS)}")
    print(f"📁 Cache directory: {TMP_DIR.absolute()}")
    print(f"🔗 Channel: @{PUBLIC_NAME}")
    print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print(f"🌐 Server URL: http://localhost:{port}")
    print(f"📊 Health check: http://localhost:{port}/health")
    print(f"📈 Statistics: http://localhost:{port}/stats")
    print("=" * 60)
    
    # Iniciar servidor
    web.run_app(
        bridge.app,
        port=port,
        host='0.0.0.0',
        access_log=None,
        print=None
    )
