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
    'max_memory': 512 * 1024 * 1024,  # 512MB límite de Render gratuito
    'timeout': 60,  # 60 segundos timeout
    'chunk_size': 512 * 1024,  # 512KB por chunk
    'max_file_size': 2 * 1024 * 1024 * 1024,  # 2GB máximo
}

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==============================================
# IMPORTS ASÍNCRONOS (optimizados para Render)
# ==============================================
try:
    import aiohttp
    from aiohttp import web
    import telethon
    from telethon import TelegramClient, utils
    from telethon.tl.types import InputFile, InputFileBig
    from telethon.tl.functions.messages import UploadMediaRequest
    from telethon.tl.functions.channels import GetMessagesRequest
    import pyrogram
    from pyrogram import Client, filters
    from pyrogram.types import Message
    import redis
    import psutil
except ImportError as e:
    logger.error(f"❌ Error de importación: {e}")
    logger.info("Instala con: pip install aiohttp telethon pyrogram redis psutil")
    raise

# ==============================================
# CONFIGURACIÓN DESDE VARIABLES DE ENTORNO
# ==============================================
class Config:
    """Configuración desde variables de entorno de Render"""
    
    # Telegram API (desde my.telegram.org)
    API_ID = int(os.getenv('TELEGRAM_API_ID', '38389812'))  # REEMPLAZAR
    API_HASH = os.getenv('TELEGRAM_API_HASH', 'a97923c7c5c6e351f69fe9619965e85e')  # REEMPLAZAR
    
    # Bot Tokens (uno por puente)
    BOT_TOKEN_A = os.getenv('BOT_TOKEN_A', '8332459195:AAFKivFrdCQMTZPFo58Zj1DVyZHGadctORA')  # REEMPLAZAR
    BOT_TOKEN_B = os.getenv('BOT_TOKEN_B', '8518953606:AAF6hnzn1uKx3UWlYhGCkWx7CnLNpsM-l_U')  # REEMPLAZAR
    BOT_TOKEN_C = os.getenv('BOT_TOKEN_C', '8577352738:AAF98AJTOo9sz-cfkHOqM1ENGkbccS3g3no')  # REEMPLAZAR
    
    # Canal destino
    CHANNEL_USERNAME = os.getenv('TELEGRAM_CHANNEL', '@chanelxmladmin')
    
    # Render config
    PORT = int(os.getenv('PORT', 10000))
    HOST = os.getenv('HOST', '0.0.0.0')
    
    # Redis para sesiones (opcional, mejora rendimiento)
    REDIS_URL = os.getenv('REDIS_URL', None)
    
    # Directorio temporal para chunks
    TMP_DIR = Path(os.getenv('TMP_DIR', '/tmp/telegram_uploads'))
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    
    @classmethod
    def validate(cls):
        """Validar configuración mínima"""
        required = ['API_ID', 'API_HASH', 'CHANNEL_USERNAME']
        for var in required:
            if not getattr(cls, var):
                raise ValueError(f"❌ {var} no configurado")
        
        # Validar que al menos un bot token exista
        bots = [cls.BOT_TOKEN_A, cls.BOT_TOKEN_B, cls.BOT_TOKEN_C]
        if not any(bots):
            raise ValueError("❌ Al menos un BOT_TOKEN debe estar configurado")
        
        logger.info("✅ Configuración validada")
        return True

# ==============================================
# MANEJADOR DE SESIONES DE SUBIDA
# ==============================================
class UploadSession:
    """Maneja sesiones de subida por chunks"""
    
    def __init__(self, session_id: str, file_name: str, file_size: int, bot_token: str):
        self.session_id = session_id
        self.file_name = file_name
        self.file_size = file_size
        self.bot_token = bot_token
        self.chunks: Dict[int, bytes] = {}
        self.total_chunks = (file_size + RENDER['chunk_size'] - 1) // RENDER['chunk_size']
        self.uploaded_chunks = set()
        self.created_at = datetime.now()
        self.status = 'initialized'  # initialized, uploading, completed, failed
        self.file_path = None
        self.message_id = None
        
        logger.info(f"📁 Nueva sesión {session_id}: {file_name} ({file_size} bytes)")
    
    def add_chunk(self, chunk_index: int, chunk_data: bytes) -> bool:
        """Agregar un chunk a la sesión"""
        try:
            if chunk_index in self.chunks:
                logger.warning(f"⚠️ Chunk {chunk_index} ya existe, sobrescribiendo")
            
            self.chunks[chunk_index] = chunk_data
            self.uploaded_chunks.add(chunk_index)
            
            # Verificar si todos los chunks están recibidos
            if len(self.uploaded_chunks) == self.total_chunks:
                self._reconstruct_file()
                self.status = 'ready_to_upload'
                logger.info(f"✅ Todos los chunks recibidos para {self.session_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error agregando chunk {chunk_index}: {e}")
            return False
    
    def _reconstruct_file(self):
        """Reconstruir archivo a partir de chunks"""
        try:
            # Ordenar chunks por índice
            sorted_indices = sorted(self.chunks.keys())
            
            # Crear archivo temporal
            tmp_file = Config.TMP_DIR / f"{self.session_id}_{self.file_name}"
            
            with open(tmp_file, 'wb') as f:
                for idx in sorted_indices:
                    f.write(self.chunks[idx])
            
            self.file_path = tmp_file
            logger.info(f"📦 Archivo reconstruido: {tmp_file} ({tmp_file.stat().st_size} bytes)")
            
            # Liberar memoria de chunks
            self.chunks.clear()
            
        except Exception as e:
            logger.error(f"❌ Error reconstruyendo archivo: {e}")
            self.status = 'failed'
            raise
    
    def cleanup(self):
        """Limpiar archivos temporales"""
        try:
            if self.file_path and self.file_path.exists():
                self.file_path.unlink()
                logger.info(f"🧹 Archivo temporal eliminado: {self.file_path}")
        except Exception as e:
            logger.warning(f"⚠️ Error limpiando archivo temporal: {e}")

# ==============================================
# CLIENTE TELEGRAM ASÍNCRONO
# ==============================================
class TelegramUploader:
    """Cliente para subir archivos a Telegram usando MTProto"""
    
    def __init__(self, bot_token: str):
        self.bot_token = bot_token
        self.client = None
        self.is_connected = False
        self.channel = None
        
        # Estadísticas
        self.uploads_completed = 0
        self.total_bytes_uploaded = 0
    
    async def connect(self):
        """Conectar a Telegram"""
        try:
            # Extraer API ID del token (primeros números antes de ':')
            api_id = int(self.bot_token.split(':')[0]) if ':' in self.bot_token else Config.API_ID
            
            self.client = TelegramClient(
                session=f'session_{api_id}',
                api_id=api_id,
                api_hash=Config.API_HASH,
                device_model='Telegram Bridge',
                system_version='Render.com',
                app_version='2.0',
                lang_code='es',
                system_lang_code='es'
            )
            
            await self.client.start(bot_token=self.bot_token)
            self.is_connected = True
            
            # Obtener el canal
            self.channel = await self.client.get_entity(Config.CHANNEL_USERNAME)
            
            logger.info(f"✅ Conectado a Telegram como bot. Canal: {self.channel.title}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error conectando a Telegram: {e}")
            self.is_connected = False
            return False
    
    async def upload_file(self, file_path: Path, caption: str = "") -> Dict:
        """Subir archivo a Telegram usando MTProto (soporta +2GB)"""
        if not self.is_connected:
            await self.connect()
        
        try:
            file_size = file_path.stat().st_size
            file_name = file_path.name
            
            logger.info(f"⏫ Subiendo {file_name} ({file_size} bytes) a Telegram...")
            
            # Determinar si usar InputFile o InputFileBig (>10MB)
            if file_size > 10 * 1024 * 1024:
                file_type = InputFileBig
                logger.info("📦 Archivo grande, usando InputFileBig")
            else:
                file_type = InputFile
            
            # Subir archivo usando MTProto directamente
            start_time = datetime.now()
            
            # Para archivos grandes, usar upload_file con manejo de progreso
            file = await self.client.upload_file(
                file=file_path,
                part_size_kb=512,  # 512KB chunks para Telegram
                file_size=file_size
            )
            
            # Determinar tipo de medio
            mime_type = 'video/mp4' if file_name.lower().endswith(('.mp4', '.mov', '.avi')) else 'document'
            
            # Enviar al canal
            message = await self.client.send_file(
                entity=self.channel,
                file=file,
                caption=caption,
                supports_streaming=True if mime_type.startswith('video') else False,
                part_size_kb=512,
                force_document=mime_type == 'document',
                attributes=None
            )
            
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            # Obtener enlace directo
            if hasattr(message, 'id'):
                message_link = f"https://t.me/{Config.CHANNEL_USERNAME.replace('@', '')}/{message.id}"
                file_id = message.file.id if hasattr(message, 'file') else message.id
            else:
                message_link = f"https://t.me/{Config.CHANNEL_USERNAME.replace('@', '')}"
                file_id = message.id
            
            # Actualizar estadísticas
            self.uploads_completed += 1
            self.total_bytes_uploaded += file_size
            
            logger.info(f"✅ Subida completada en {duration:.2f}s. ID: {message.id}")
            
            return {
                'success': True,
                'message_id': message.id,
                'file_id': file_id,
                'file_size': file_size,
                'duration': duration,
                'telegram_link': message_link,
                'direct_link': f"https://api.telegram.org/file/bot{self.bot_token}/{file_id}",
                'channel': Config.CHANNEL_USERNAME
            }
            
        except Exception as e:
            logger.error(f"❌ Error subiendo archivo: {e}")
            return {
                'success': False,
                'error': str(e),
                'file_name': file_path.name
            }
    
    async def disconnect(self):
        """Desconectar de Telegram"""
        if self.client and self.is_connected:
            await self.client.disconnect()
            self.is_connected = False
            logger.info("🔌 Desconectado de Telegram")

# ==============================================
# SERVIDOR WEB AIOHTTP
# ==============================================
class TelegramBridgeServer:
    def __init__(self):
        self.app = web.Application(
            client_max_size=RENDER['max_file_size'],
            middlewares=[
                self.error_middleware,
                self.auth_middleware,
            ]
        )
        
        self.sessions: Dict[str, UploadSession] = {}
        self.uploaders: Dict[str, TelegramUploader] = {}
        self.setup_routes()
        
        # Inicializar uploaders para cada bot token
        self.init_uploaders()
    
    def init_uploaders(self):
        """Inicializar uploaders para todos los bot tokens configurados"""
        bot_tokens = [
            (Config.BOT_TOKEN_A, 'bot_a'),
            (Config.BOT_TOKEN_B, 'bot_b'),
            (Config.BOT_TOKEN_C, 'bot_c')
        ]
        
        for token, name in bot_tokens:
            if token and token != 'token_puente_x':
                uploader = TelegramUploader(token)
                self.uploaders[name] = uploader
                logger.info(f"🤖 Uploader inicializado: {name}")
    
    async def start_uploaders(self):
        """Conectar todos los uploaders al inicio"""
        for name, uploader in self.uploaders.items():
            try:
                await uploader.connect()
            except Exception as e:
                logger.error(f"❌ Error conectando {name}: {e}")
    
    def setup_routes(self):
        """Configurar rutas del servidor"""
        self.app.router.add_post('/init-upload', self.handle_init_upload)
        self.app.router.add_post('/upload-chunk', self.handle_upload_chunk)
        self.app.router.add_post('/finalize-upload', self.handle_finalize)
        self.app.router.add_post('/cancel-upload', self.handle_cancel)
        self.app.router.add_get('/status/{session_id}', self.handle_status)
        self.app.router.add_get('/health', self.handle_health)
        self.app.router.add_get('/', self.handle_root)
    
    # ==============================================
    # MIDDLEWARES
    # ==============================================
    
  
    @web.middleware
    async def auth_middleware(self, request, handler):
        """Middleware de autenticación por bot token"""
        # Rutas que no requieren autenticación
        if request.path in ['/health', '/']:
            return await handler(request)
        
        # Verificar token
        token = request.headers.get('X-Bot-Token') or request.headers.get('Authorization')
        if not token:
            return web.json_response({
                'success': False,
                'error': 'Token de autenticación requerido'
            }, status=401)
        
        # Validar token
        valid_tokens = [Config.BOT_TOKEN_A, Config.BOT_TOKEN_B, Config.BOT_TOKEN_C]
        if token not in valid_tokens:
            return web.json_response({
                'success': False,
                'error': 'Token inválido'
            }, status=403)
        
        return await handler(request)

    @web.middleware
    async def cors_middleware(self, request, handler):
        """Middleware para permitir que Blogger se conecte"""
        if request.method == 'OPTIONS':
            response = web.Response(status=204)
        else:
            response = await handler(request)
        
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Bot-Token, Authorization'
        return response
        
    # ==============================================
    # HANDLERS
    # ==============================================
    
    async def handle_root(self, request):
        """Página principal"""
        return web.json_response({
            'service': 'Telegram Bridge +300MB',
            'status': 'online',
            'version': '2.0',
            'max_file_size': f"{RENDER['max_file_size'] / 1024 / 1024 / 1024:.1f}GB",
            'chunk_size': f"{RENDER['chunk_size'] / 1024}KB",
            'supported_bots': len(self.uploaders),
            'active_sessions': len(self.sessions)
        })
    
    async def handle_health(self, request):
        """Endpoint de salud"""
        memory = psutil.virtual_memory()
        return web.json_response({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'memory': {
                'total': memory.total,
                'available': memory.available,
                'percent': memory.percent
            },
            'sessions': len(self.sessions)
        })
    
    async def handle_init_upload(self, request):
        """Iniciar una nueva sesión de subida"""
        try:
            data = await request.json()
            
            # Validar datos
            required = ['file_name', 'file_size', 'upload_id', 'channel']
            for field in required:
                if field not in data:
                    return web.json_response({
                        'success': False,
                        'error': f'Campo requerido faltante: {field}'
                    }, status=400)
            
            file_name = data['file_name']
            file_size = int(data['file_size'])
            upload_id = data['upload_id']
            channel = data.get('channel', Config.CHANNEL_USERNAME)
            bot_token = request.headers.get('X-Bot-Token')
            
            # Validar tamaño máximo
            if file_size > RENDER['max_file_size']:
                return web.json_response({
                    'success': False,
                    'error': f'Archivo demasiado grande. Máximo: {RENDER["max_file_size"] / 1024 / 1024 / 1024:.1f}GB'
                }, status=413)
            
            # Crear nueva sesión
            session = UploadSession(
                session_id=upload_id,
                file_name=file_name,
                file_size=file_size,
                bot_token=bot_token
            )
            
            self.sessions[upload_id] = session
            
            logger.info(f"📁 Sesión iniciada: {upload_id} para {file_name}")
            
            return web.json_response({
                'success': True,
                'session_id': upload_id,
                'chunk_size': RENDER['chunk_size'],
                'total_chunks': session.total_chunks,
                'max_chunks_per_request': 1
            })
            
        except Exception as e:
            logger.error(f"❌ Error iniciando upload: {e}")
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)
    
    async def handle_upload_chunk(self, request):
        """Subir un chunk de archivo"""
        try:
            # Leer datos multipart
            reader = await request.multipart()
            
            session_id = None
            chunk_index = None
            chunk_data = None
            
            async for field in reader:
                if field.name == 'session_id':
                    session_id = await field.read(decode=True)
                    session_id = session_id.decode('utf-8')
                elif field.name == 'chunk_index':
                    chunk_index = int(await field.read(decode=True))
                elif field.name == 'chunk_data':
                    chunk_data = await field.read()
            
            if not all([session_id, chunk_index is not None, chunk_data]):
                return web.json_response({
                    'success': False,
                    'error': 'Datos incompletos'
                }, status=400)
            
            # Verificar sesión
            if session_id not in self.sessions:
                return web.json_response({
                    'success': False,
                    'error': 'Sesión no encontrada'
                }, status=404)
            
            session = self.sessions[session_id]
            
            # Agregar chunk
            success = session.add_chunk(chunk_index, chunk_data)
            
            if not success:
                return web.json_response({
                    'success': False,
                    'error': 'Error procesando chunk'
                }, status=500)
            
            # Liberar memoria del chunk
            del chunk_data
            
            return web.json_response({
                'success': True,
                'session_id': session_id,
                'chunk_index': chunk_index,
                'uploaded_chunks': len(session.uploaded_chunks),
                'total_chunks': session.total_chunks,
                'status': session.status
            })
            
        except Exception as e:
            logger.error(f"❌ Error subiendo chunk: {e}")
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)
    
    async def handle_finalize(self, request):
        """Finalizar subida y enviar a Telegram"""
        try:
            data = await request.json()
            
            session_id = data.get('session_id')
            upload_id = data.get('upload_id')
            channel = data.get('channel', Config.CHANNEL_USERNAME)
            bot_token = request.headers.get('X-Bot-Token')
            
            if not session_id:
                return web.json_response({
                    'success': False,
                    'error': 'session_id requerido'
                }, status=400)
            
            # Verificar sesión
            if session_id not in self.sessions:
                return web.json_response({
                    'success': False,
                    'error': 'Sesión no encontrada'
                }, status=404)
            
            session = self.sessions[session_id]
            
            # Verificar que todos los chunks estén recibidos
            if session.status != 'ready_to_upload':
                return web.json_response({
                    'success': False,
                    'error': 'No todos los chunks han sido recibidos',
                    'received': len(session.uploaded_chunks),
                    'expected': session.total_chunks
                }, status=400)
            
            # Determinar qué uploader usar basado en el bot token
            uploader_name = None
            for name, uploader in self.uploaders.items():
                if uploader.bot_token == bot_token:
                    uploader_name = name
                    break
            
            if not uploader_name:
                # Crear uploader temporal para este bot token
                uploader = TelegramUploader(bot_token)
                await uploader.connect()
                uploader_name = 'temp_uploader'
                self.uploaders[uploader_name] = uploader
            
            # Subir a Telegram
            uploader = self.uploaders[uploader_name]
            result = await uploader.upload_file(
                file_path=session.file_path,
                caption=f"Subido via Telegram Bridge\nArchivo: {session.file_name}"
            )
            
            # Limpiar sesión
            session.cleanup()
            if session_id in self.sessions:
                del self.sessions[session_id]
            
            if result['success']:
                logger.info(f"✅ Upload finalizado: {session_id}")
                return web.json_response(result)
            else:
                return web.json_response(result, status=500)
            
        except Exception as e:
            logger.error(f"❌ Error finalizando upload: {e}")
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)
    
    async def handle_cancel(self, request):
        """Cancelar una subida en progreso"""
        try:
            data = await request.json()
            session_id = data.get('session_id')
            
            if not session_id:
                return web.json_response({
                    'success': False,
                    'error': 'session_id requerido'
                }, status=400)
            
            if session_id in self.sessions:
                session = self.sessions[session_id]
                session.cleanup()
                del self.sessions[session_id]
                
                logger.info(f"❌ Sesión cancelada: {session_id}")
                
                return web.json_response({
                    'success': True,
                    'message': 'Sesión cancelada'
                })
            else:
                return web.json_response({
                    'success': False,
                    'error': 'Sesión no encontrada'
                }, status=404)
            
        except Exception as e:
            logger.error(f"❌ Error cancelando upload: {e}")
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)
    
    async def handle_status(self, request):
        """Obtener estado de una sesión"""
        session_id = request.match_info.get('session_id')
        
        if session_id in self.sessions:
            session = self.sessions[session_id]
            
            return web.json_response({
                'success': True,
                'session_id': session.session_id,
                'file_name': session.file_name,
                'file_size': session.file_size,
                'status': session.status,
                'uploaded_chunks': len(session.uploaded_chunks),
                'total_chunks': session.total_chunks,
                'created_at': session.created_at.isoformat(),
                'age_seconds': (datetime.now() - session.created_at).total_seconds()
            })
        else:
            return web.json_response({
                'success': False,
                'error': 'Sesión no encontrada'
            }, status=404)
    
    # ==============================================
    # INICIALIZACIÓN Y EJECUCIÓN
    # ==============================================
    
    async def start(self):
        """Iniciar el servidor"""
        # Validar configuración
        Config.validate()
        
        # Conectar uploaders
        await self.start_uploaders()
        
        # Configurar runner
        runner = web.AppRunner(self.app)
        await runner.setup()
        
        site = web.TCPSite(runner, Config.HOST, Config.PORT)
        await site.start()
        
        logger.info(f"🚀 Servidor iniciado en http://{Config.HOST}:{Config.PORT}")
        logger.info(f"📁 Temp dir: {Config.TMP_DIR}")
        logger.info(f"🤖 Uploaders activos: {len(self.uploaders)}")
        logger.info(f"💾 Memoria máxima por archivo: {RENDER['max_file_size'] / 1024 / 1024}MB")
        
        return runner
    
    async def cleanup(self):
        """Limpieza al cerrar"""
        logger.info("🧹 Limpiando recursos...")
        
        # Limpiar sesiones
        for session_id, session in list(self.sessions.items()):
            session.cleanup()
            del self.sessions[session_id]
        
        # Desconectar uploaders
        for name, uploader in self.uploaders.items():
            await uploader.disconnect()
        
        logger.info("✅ Limpieza completada")

# ==============================================
# EJECUCIÓN PRINCIPAL
# ==============================================
async def main():
    """Función principal"""
    server = TelegramBridgeServer()
    runner = None
    
    try:
        runner = await server.start()
        
        # Mantener el servidor corriendo
        await asyncio.Event().wait()
        
    except KeyboardInterrupt:
        logger.info("👋 Recibido Ctrl+C, cerrando...")
    except Exception as e:
        logger.error(f"❌ Error fatal: {e}")
    finally:
        if runner:
            await runner.cleanup()
        await server.cleanup()
        logger.info("🔚 Servidor detenido")

if __name__ == '__main__':
    # Configurar asyncio para Render
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    # Ejecutar
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Servidor detenido")
