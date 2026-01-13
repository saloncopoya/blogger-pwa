const firebasePedigriConfig = {
  apiKey: "AIzaSyBwL9DPiT5SHR9PX3eRmhGte__hyVzjYz4",
  authDomain: "galleros-main.firebaseapp.com",
  databaseURL: "https://galleros-main-default-rtdb.firebaseio.com",
  projectId: "galleros-main",
  storageBucket: "galleros-main.firebasestorage.app",
  messagingSenderId: "715633476548",
  appId: "1:715633476548:web:9e33ccb872e634506b5a91"
};

// Inicializar Firebase Pedigri (si no existe)
let databasePedigri;
try {
  const secondaryApp = firebase.initializeApp(firebasePedigriConfig, "PedigriApp");
  databasePedigri = secondaryApp.database();
} catch (error) {
  // Si ya está inicializado, usar la instancia existente
  databasePedigri = firebase.app("PedigriApp").database();
}

// Variables globales para pedigree
let currentGallos = [];
let selectedGallo = null;
let currentBreederId = null;
let currentViewMode = 'grid';
let currentSortMode = 'nuevos';
let currentFilters = {};





// Cargar librerías dinámicamente si no están disponibles
function cargarLibrerias() {
  return new Promise((resolve) => {
    const libreriasCargadas = [];
    
    // Verificar si html2pdf está cargado
    if (typeof html2pdf === 'undefined') {
      const script1 = document.createElement('script');
      script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script1.onload = () => libreriasCargadas.push('html2pdf');
      document.head.appendChild(script1);
    } else {
      libreriasCargadas.push('html2pdf');
    }
    
    // Verificar si QRCode está cargado
    if (typeof QRCode === 'undefined') {
      const script2 = document.createElement('script');
      script2.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
      script2.onload = () => libreriasCargadas.push('qrcode');
      document.head.appendChild(script2);
    } else {
      libreriasCargadas.push('qrcode');
    }
    
    // Esperar a que carguen
    const checkInterval = setInterval(() => {
      if (libreriasCargadas.includes('html2pdf') && libreriasCargadas.includes('qrcode')) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);
  });
}


// Función para mostrar loading
function showLoading(mensaje = "Cargando...") {
  let loading = document.getElementById('globalLoading');
  if (!loading) {
    loading = document.createElement('div');
    loading.id = 'globalLoading';
    loading.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      color: white;
      font-size: 18px;
    `;
    document.body.appendChild(loading);
  }
  
  loading.innerHTML = `
    <div style="text-align: center;">
      <div style="font-size: 40px; margin-bottom: 20px;">⏳</div>
      <div>${mensaje}</div>
    </div>
  `;
  loading.style.display = 'flex';
}

// Función para ocultar loading
function hideLoading() {
  const loading = document.getElementById('globalLoading');
  if (loading) {
    loading.style.display = 'none';
  }
}



// Opciones predefinidas
const COLOR_OPTIONS = [
  "Rojo", "Negro", "Blanco", "Amarillo", "Azul", "Gris", "Marrón", 
  "Verde", "Naranja", "Púrpura", "Rosado", "Dorado", "Plateado", "Beige"
];

const PLUMA_OPTIONS = [
  "Amarillo", "Blackbeasted", "Blanco", "Blue", "Brown red", "Canelo", 
  "Cenizo", "Dominique", "Gallino", "Giro", "Golden", "Jubileo", "Moteado", "Negro"
];

const CRESTA_OPTIONS = [
  "Moton", "Pava", "Peine", "Rosa", "Single pea", "Rose", "V-Shape", "Coronilla"
];

const ESTADO_OPTIONS = ["Activo", "Regalado", "Muerto", "Vendido"];
const SEXO_OPTIONS = ["Macho", "Hembra"];

// Variables para nuevo registro en línea
let nuevoRegistroParentesco = null;

function renderProductsScreen() {
  // CARGAR GALLOS INMEDIATAMENTE
  setTimeout(() => {
    cargarGallosUsuario();
  }, 100);
  return `
    ${renderHeader()}
    <div class="pedigri-screen">


      <!-- Encabezado de pedigree -->
      <div class="pedigri-header">


        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">

</br></br></br>


          <button class="btn-primary" onclick="openRegistroGalloModal()" 
                  style="display: flex; align-items: center; gap: 8px; padding: 10px 20px;">
            <span>➕</span> Registrar Gallo
          </button>
          
<h1 style="color: #050505; margin: 0;">🐓 Sistema de Pedigree</h1>

        </div>
        
        <!-- Buscador y controles superiores -->
        <div style="margin-bottom: 20px;">
          <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
            <!-- Buscador por placa -->
            <div style="flex: 1; min-width: 250px; position: relative;">
              <input type="text" 
                     id="buscarGalloInput" 
                     placeholder=" Buscar por número de placa..."
                     style="width: 100%; padding: 12px 16px 12px 45px; border: 2px solid #667eea; border-radius: 24px; font-size: 14px;"
                     onkeyup="buscarGallos()" />
              <div style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #667eea; font-size: 18px;">
                🔍
              </div>
            </div>
            
            <!-- Botón de filtros -->
            <button onclick="toggleFiltros()" 
                    style="padding: 12px 20px; background: #f0f8ff; color: #667eea; border: 2px solid #667eea; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 8px;">
              <span>⚙️</span> Filtros
            </button>
            
            <!-- Botón limpiar filtros -->
            <button onclick="limpiarFiltros()" 
                    style="padding: 12px 20px; background: #fff0f0; color: #ff4444; border: 2px solid #ff4444; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 8px;">
              <span>🔄</span> Limpiar
            </button>
          </div>
          
          <!-- Controles de vista y orden -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
            <!-- Selector de vista -->
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-weight: 600; color: #050505;">Vista:</span>
              <div style="display: flex; gap: 5px;">
                <button onclick="cambiarVista('grid-small')" 
                        style="padding: 8px 12px; border: 2px solid ${currentViewMode === 'grid-small' ? '#667eea' : '#e4e6eb'}; border-radius: 6px; background: ${currentViewMode === 'grid-small' ? '#f0f8ff' : 'white'}; cursor: pointer; font-size: 18px;">
                  ⬜⬜
                </button>
                <button onclick="cambiarVista('grid')" 
                        style="padding: 8px 12px; border: 2px solid ${currentViewMode === 'grid' ? '#667eea' : '#e4e6eb'}; border-radius: 6px; background: ${currentViewMode === 'grid' ? '#f0f8ff' : 'white'}; cursor: pointer; font-size: 18px;">
                  ⬜
                </button>
                <button onclick="cambiarVista('list')" 
                        style="padding: 8px 12px; border: 2px solid ${currentViewMode === 'list' ? '#667eea' : '#e4e6eb'}; border-radius: 6px; background: ${currentViewMode === 'list' ? '#f0f8ff' : 'white'}; cursor: pointer; font-size: 18px;">
                  ☰
                </button>
              </div>
            </div>
            
            <!-- Selector de orden -->
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-weight: 600; color: #050505;">Ordenar:</span>
              <select id="ordenarSelect" onchange="cambiarOrden(this.value)" 
                      style="padding: 8px 12px; border: 2px solid #e4e6eb; border-radius: 6px; background: white; cursor: pointer; font-size: 14px;">
                <option value="nuevos" ${currentSortMode === 'nuevos' ? 'selected' : ''}>Más nuevos primero</option>
                <option value="antiguos" ${currentSortMode === 'antiguos' ? 'selected' : ''}>Más antiguos primero</option>
                <option value="placa_asc" ${currentSortMode === 'placa_asc' ? 'selected' : ''}>Placa (A-Z)</option>
                <option value="placa_desc" ${currentSortMode === 'placa_desc' ? 'selected' : ''}>Placa (Z-A)</option>
                <option value="estado" ${currentSortMode === 'estado' ? 'selected' : ''}>Por estado</option>
              </select>
            </div>
          </div>
          
          <!-- Panel de filtros -->
          <div id="filtrosPanel" style="display: none; margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px;">
              <!-- Color -->
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Color</label>
                <select id="filtroColor" onchange="aplicarFiltros()" style="width: 100%; padding: 8px; border: 1px solid #e4e6eb; border-radius: 6px;">
                  <option value="">Todos los colores</option>
                  ${COLOR_OPTIONS.map(color => `<option value="${color}">${color}</option>`).join('')}
                </select>
              </div>
              
              <!-- Estado -->
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Estado</label>
                <select id="filtroEstado" onchange="aplicarFiltros()" style="width: 100%; padding: 8px; border: 1px solid #e4e6eb; border-radius: 6px;">
                  <option value="">Todos los estados</option>
                  ${ESTADO_OPTIONS.map(estado => `<option value="${estado}">${estado}</option>`).join('')}
                </select>
              </div>
              
              <!-- Sexo -->
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Sexo</label>
                <select id="filtroSexo" onchange="aplicarFiltros()" style="width: 100%; padding: 8px; border: 1px solid #e4e6eb; border-radius: 6px;">
                  <option value="">Todos</option>
                  ${SEXO_OPTIONS.map(sexo => `<option value="${sexo}">${sexo}</option>`).join('')}
                </select>
              </div>
              
              <!-- Criador -->
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Criador</label>
                <input type="text" id="filtroCriador" onkeyup="aplicarFiltros()" 
                       placeholder="Buscar criador..." style="width: 100%; padding: 8px; border: 1px solid #e4e6eb; border-radius: 6px;" />
              </div>
              
              <!-- Grupo -->
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Grupo</label>
                <input type="text" id="filtroGrupo" onkeyup="aplicarFiltros()" 
                       placeholder="Buscar grupo..." style="width: 100%; padding: 8px; border: 1px solid #e4e6eb; border-radius: 6px;" />
              </div>
              
              <!-- Pluma -->
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Pluma</label>
                <select id="filtroPluma" onchange="aplicarFiltros()" style="width: 100%; padding: 8px; border: 1px solid #e4e6eb; border-radius: 6px;">
                  <option value="">Todas las plumas</option>
                  ${PLUMA_OPTIONS.map(pluma => `<option value="${pluma}">${pluma}</option>`).join('')}
                </select>
              </div>
              
              <!-- Cresta -->
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Cresta</label>
                <select id="filtroCresta" onchange="aplicarFiltros()" style="width: 100%; padding: 8px; border: 1px solid #e4e6eb; border-radius: 6px;">
                  <option value="">Todas las crestas</option>
                  ${CRESTA_OPTIONS.map(cresta => `<option value="${cresta}">${cresta}</option>`).join('')}
                </select>
              </div>
              
              <!-- Edad -->
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Edad (meses)</label>
                <select id="filtroEdad" onchange="aplicarFiltros()" style="width: 100%; padding: 8px; border: 1px solid #e4e6eb; border-radius: 6px;">
                  <option value="">Todas las edades</option>
                  <option value="0-6">0-6 meses</option>
                  <option value="7-12">7-12 meses</option>
                  <option value="13-24">13-24 meses</option>
                  <option value="25+">Más de 25 meses</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Estadísticas -->
      <div class="pedigri-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 25px;">
        <div class="stat-card" style="background: #e6f7ff; border-left: 4px solid #1890ff;">
          <div class="stat-value" id="totalGallos">0</div>
          <div class="stat-label">Total Gallos</div>
        </div>
        <div class="stat-card" style="background: #f0f8ff; border-left: 4px solid #667eea;">
          <div class="stat-value" id="gallosActivos">0</div>
          <div class="stat-label">Activos</div>
        </div>
        <div class="stat-card" style="background: #fff7e6; border-left: 4px solid #ff9800;">
          <div class="stat-value" id="gallosMachos">0</div>
          <div class="stat-label">Machos</div>
        </div>
        <div class="stat-card" style="background: #f6ffed; border-left: 4px solid #42b72a;">
          <div class="stat-value" id="gallosHembras">0</div>
          <div class="stat-label">Hembras</div>
        </div>
        <div class="stat-card" style="background: #f9f0ff; border-left: 4px solid #9254de;">
          <div class="stat-value" id="gallosFiltrados">0</div>
          <div class="stat-label">Mostrando</div>
        </div>
      </div>
      
      <!-- Grid de gallos -->
      <div class="gallos-grid" id="gallosGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
        <div class="loading">Cargando gallos...</div>
      </div>
      
      <!-- Controles responsive -->
      <div class="mobile-controls" style="display: none; position: fixed; bottom: 20px; right: 20px; z-index: 1000;">
        <button onclick="openRegistroGalloModal()" style="width: 60px; height: 60px; border-radius: 50%; background: #667eea; color: white; border: none; font-size: 24px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); cursor: pointer;">
          ➕
        </button>
      </div>
    </div>
    
    <!-- Modal de registro -->
    ${renderRegistroGalloModal()}
    
    <!-- Modal de detalle -->
    <div id="galloDetailModal"></div>
    
    <!-- Modal para registro rápido de padre/madre -->
    <div id="quickRegistroModal"></div>
    
    <!-- Modal para árbol genealógico -->
    <div id="arbolGenealogicoModal"></div>
  `;
}

// Modal de registro de gallo MEJORADO
function renderRegistroGalloModal() {
  return `
    <div class="modal-overlay" id="registroGalloModal">
<div class="modal" style="width: 95vw; height: 95vh; max-width: none; max-height: none; margin: 0; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); overflow-y: auto;">
        <div class="modal-header">
          <div class="modal-title">➕ Registrar Nuevo Animal</div>
          <button class="modal-close" onclick="closeRegistroGalloModal()">✕</button>
        </div>
        
        <div class="modal-body">
          <div style="display: flex; flex-direction: column; gap: 20px;">
            <!-- Sección de fotos (MEJORADA: Ahora permite más fotos) -->
            <div class="photo-section">
              <h4 style="color: #050505; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                <span>📷 Fotos del Animal</span>
                <button type="button" onclick="agregarMasFotos()" 
                        style="padding: 6px 12px; background: #f0f8ff; color: #667eea; border: 1px solid #667eea; border-radius: 6px; font-size: 12px; cursor: pointer;">
                  + Agregar más fotos
                </button>
              </h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 15px;" id="fotosContainer">
                <!-- Fotos dinámicas se agregarán aquí -->
                <div class="photo-upload" onclick="document.getElementById('foto1').click()" 
                     style="border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; height: 180px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                  <div id="foto1Preview" style="font-size: 30px; color: #667eea;">📷</div>
                  <div style="font-size: 12px; color: #65676b; margin-top: 8px;">Frente</div>
                  <input type="file" id="foto1" accept="image/*" style="display: none;" onchange="previewPhoto('1', event)" />
                </div>
                
                <div class="photo-upload" onclick="document.getElementById('foto2').click()"
                     style="border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; height: 180px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                  <div id="foto2Preview" style="font-size: 30px; color: #667eea;">📷</div>
                  <div style="font-size: 12px; color: #65676b; margin-top: 8px;">Lado</div>
                  <input type="file" id="foto2" accept="image/*" style="display: none;" onchange="previewPhoto('2', event)" />
                </div>
                
                <div class="photo-upload" onclick="document.getElementById('foto3').click()"
                     style="border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; height: 180px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                  <div id="foto3Preview" style="font-size: 30px; color: #667eea;">📷</div>
                  <div style="font-size: 12px; color: #65676b; margin-top: 8px;">Detalle</div>
                  <input type="file" id="foto3" accept="image/*" style="display: none;" onchange="previewPhoto('3', event)" />
                </div>
              </div>
            </div>
            
            <!-- Información básica -->
            <div class="form-section">
              <h4 style="color: #050505; margin-bottom: 15px;">📋 Información Básica</h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div>
                  <label style="display: block; margin-bottom: 8px; font-weight: 600;">Número de Placa *</label>
                  <input type="text" id="placa" placeholder="Ej: GLL-001" 
                         style="width: 100%; padding: 12px; border: 1px solid #e4e6eb; border-radius: 8px;" />
                </div>
                
                <div>
                  <label style="display: block; margin-bottom: 8px; font-weight: 600;">Color *</label>
                  <div style="display: flex; gap: 10px;">
                    <select id="color" style="flex: 1; padding: 12px; border: 1px solid #e4e6eb; border-radius: 8px;">
                      <option value="">Seleccionar color</option>
                      ${COLOR_OPTIONS.map(color => `<option value="${color}">${color}</option>`).join('')}
                    </select>
                    <button type="button" onclick="agregarNuevaOpcion('color')" 
                            style="padding: 12px; background: #f0f8ff; color: #667eea; border: 1px solid #667eea; border-radius: 8px; cursor: pointer;">
                      ➕
                    </button>
                  </div>
                </div>
                
                <div>
                  <label style="display: block; margin-bottom: 8px; font-weight: 600;">Sexo *</label>
                  <select id="sexo" style="width: 100%; padding: 12px; border: 1px solid #e4e6eb; border-radius: 8px;">
                    <option value="">Seleccionar sexo</option>
                    ${SEXO_OPTIONS.map(sexo => `<option value="${sexo}">${sexo}</option>`).join('')}
                  </select>
                </div>
                
                <div>
                  <label style="display: block; margin-bottom: 8px; font-weight: 600;">Estado *</label>
                  <div style="display: flex; gap: 10px;">
                    <select id="estado" style="flex: 1; padding: 12px; border: 1px solid #e4e6eb; border-radius: 8px;">
                      <option value="">Seleccionar estado</option>
                      ${ESTADO_OPTIONS.map(estado => `<option value="${estado}">${estado}</option>`).join('')}
                    </select>
                    <button type="button" onclick="agregarNuevaOpcion('estado')" 
                            style="padding: 12px; background: #f0f8ff; color: #667eea; border: 1px solid #667eea; border-radius: 8px; cursor: pointer;">
                      ➕
                    </button>
                  </div>
                </div>
              </div>
            </div>
            



            <!-- Información adicional -->
            <div class="form-section">
              <h4 style="color: #050505; margin-bottom: 15px;">📝 Información Adicional</h4>
              
              <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Criador *</label>
                <div style="display: flex; gap: 10px;">
                  <input type="text" id="criadorInput" placeholder="Buscar o crear criador" 
                         list="criadoresList"
                         style="flex: 1; padding: 12px; border: 1px solid #e4e6eb; border-radius: 8px;" />
                  <datalist id="criadoresList"></datalist>
                  <button type="button" onclick="agregarCriador()" 
                          style="padding: 12px 20px; background: #42b72a; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    ➕ Nuevo
                  </button>
                </div>
              </div>
              
              <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Fecha de Nacimiento *</label>
                <input type="date" id="fechaNacimiento" 
                       style="width: 100%; padding: 12px; border: 1px solid #e4e6eb; border-radius: 8px;" />
              </div>
              
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 15px;">
                <div>
                  <label style="display: block; margin-bottom: 8px; font-weight: 600;">Pluma</label>
                  <div style="display: flex; gap: 10px;">
                    <select id="pluma" style="flex: 1; padding: 12px; border: 1px solid #e4e6eb; border-radius: 8px;">
                      <option value="">Seleccionar pluma</option>
                      ${PLUMA_OPTIONS.map(pluma => `<option value="${pluma}">${pluma}</option>`).join('')}
                    </select>
                    <button type="button" onclick="agregarNuevaOpcion('pluma')" 
                            style="padding: 12px; background: #f0f8ff; color: #667eea; border: 1px solid #667eea; border-radius: 8px; cursor: pointer;">
                      ➕
                    </button>
                  </div>
                </div>
                
                <div>
                  <label style="display: block; margin-bottom: 8px; font-weight: 600;">Cresta</label>
                  <div style="display: flex; gap: 10px;">
                    <select id="cresta" style="flex: 1; padding: 12px; border: 1px solid #e4e6eb; border-radius: 8px;">
                      <option value="">Seleccionar cresta</option>
                      ${CRESTA_OPTIONS.map(cresta => `<option value="${cresta}">${cresta}</option>`).join('')}
                    </select>
                    <button type="button" onclick="agregarNuevaOpcion('cresta')" 
                            style="padding: 12px; background: #f0f8ff; color: #667eea; border: 1px solid #667eea; border-radius: 8px; cursor: pointer;">
                      ➕
                    </button>
                  </div>
                </div>
              </div>
              
              <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Grupo</label>
                <div style="display: flex; gap: 10px;">
                  <input type="text" id="grupo" placeholder="Nombre del grupo" 
                         list="gruposList"
                         style="flex: 1; padding: 12px; border: 1px solid #e4e6eb; border-radius: 8px;" />
                  <datalist id="gruposList"></datalist>
                  <button type="button" onclick="agregarNuevaOpcion('grupo')" 
                          style="padding: 12px; background: #f0f8ff; color: #667eea; border: 1px solid #667eea; border-radius: 8px; cursor: pointer;">
                    ➕
                  </button>
                </div>
              </div>
              
              <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Notas/ Vacunas / Enfermedades / Observaciones</label>
                <textarea id="notas" placeholder="Notas adicionales sobre el animal..." 
                          style="width: 100%; padding: 12px; border: 1px solid #e4e6eb; border-radius: 8px; min-height: 80px; resize: vertical;"></textarea>
              </div>
            </div>
            





            <!-- Información de padres (MEJORADA) -->
            <div class="parents-section" style="background: #f0f8ff; padding: 20px; border-radius: 8px;">
              <h3 style="color: #050505; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                <span>👨‍👩‍👦 Información de Familia</span>
               
              </h3>
               <button type="button" onclick="registroRapidoParentesco('madre')" 
                        style="margin-left: auto; padding: 6px 12px; background: #9254de; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">
                  + Registrar madre
                </button>
                <button type="button" onclick="registroRapidoParentesco('padre')" 
                        style="padding: 6px 12px; background: #9254de; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">
                  + Registrar padre
                </button>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                <!-- Madre -->
                <div>
                  <label style="display: block; margin-bottom: 8px; font-weight: 600;">Madre (Hembra)</label>
                  <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <input type="text" id="madreInput" placeholder="Buscar madre por placa o nombre" 
                           style="flex: 1; padding: 4px; border: 1px solid #e4e6eb; border-radius: 8px;" />
                    <button type="button" onclick="buscarParentesco('madre')" 
                            style="padding: 4px 8px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                      🔍 Buscar
                    </button>
                  </div>
                  <div id="madreInfo" style="margin-top: 10px; min-height: 60px;">
                    <!-- Información de madre se mostrará aquí -->
                  </div>
                </div>
                
                <!-- Padre -->
                <div>
                  <label style="display: block; margin-bottom: 8px; font-weight: 600;">Padre (Macho)</label>
                  <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <input type="text" id="padreInput" placeholder="Buscar padre por placa o nombre" 
                           style="flex: 1; padding: 4px; border: 1px solid #e4e6eb; border-radius: 8px;" />
                    <button type="button" onclick="buscarParentesco('padre')" 
                            style="padding: 4px 8px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                      🔍 Buscar
                    </button>
                  </div>
                  <div id="padreInfo" style="margin-top: 10px; min-height: 60px;">
                    <!-- Información de padre se mostrará aquí -->
                  </div>
                </div>
              </div>
              
              <div id="resultadosBusquedaParentesco" style="margin-top: 15px; display: none;"></div>
            </div>
          </div>
          






<!-- Sección de Edad y Peso -->
<div class="edad-peso-section" style="background: #f6ffed; padding: 20px; border-radius: 8px; margin-top: 20px; border: 2px solid #42b72a;">
  <h3 style="color: #050505; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
    <span>⚖️ Control de Peso y Edad</span>
    <button type="button" onclick="abrirGraficaPeso('${window.galloEditandoId || 'nuevo'}')" 
            style="padding: 6px 12px; background: #42b72a; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">
      📈 Ver Gráfica de Peso
    </button>
  </h3>
  
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
    <!-- Edad -->
    <div>
      <label style="display: block; margin-bottom: 8px; font-weight: 600;">Edad Calculada</label>
      <div id="edadCalculada" style="padding: 12px; background: white; border-radius: 8px; border: 1px solid #e4e6eb; font-weight: 600; color: #050505;">
        ${window.galloEditandoId ? 'Calculando...' : 'Se calculará automáticamente'}
      </div>
      <div id="categoriaEdad" style="font-size: 12px; color: #667eea; margin-top: 5px;"></div>
    </div>
    
    <!-- Último peso registrado -->
    <div>
      <label style="display: block; margin-bottom: 8px; font-weight: 600;">Último Peso Registrado</label>
      <div style="display: flex; gap: 10px;">
        <input type="number" id="ultimoPeso" placeholder="Peso en gramos" 
               style="flex: 1; padding: 12px; border: 1px solid #e4e6eb; border-radius: 8px;"
               step="1" min="0" max="5000" />
        <select id="unidadPeso" style="padding: 12px; border: 1px solid #e4e6eb; border-radius: 8px;">
          <option value="g">Gramos (g)</option>
          <option value="oz">Onzas (oz)</option>
        </select>
      </div>
      <div style="font-size: 12px; color: #65676b; margin-top: 5px;">
        <span id="pesoConvertido">0 g (0 oz)</span>
      </div>
    </div>
  </div>
  
  <!-- Sección CUIDO - Estado de Salud -->
  <div id="estadoSaludSection" style="margin-top: 15px; display: none;">
    <h4 style="color: #050505; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #e4e6eb;">🩺 Estado de Salud</h4>
    <div id="estadoSalud" style="background: white; padding: 15px; border-radius: 8px; border: 2px solid #ffc107;">
      <!-- Estado de salud se mostrará aquí -->
    </div>
    <div id="recomendacionesSalud" style="margin-top: 10px; background: #e6f7ff; padding: 10px; border-radius: 6px; font-size: 12px; color: #1890ff;">
      <!-- Recomendaciones se mostrarán aquí -->
    </div>
  </div>
</div>


<!-- 🥊 Sección de Historial de Combates -->
<div class="combates-section" style="background: #fff0f0; padding: 20px; border-radius: 8px; margin-top: 20px;">
  <h3 style="color: #050505; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
    <span>🥊 Historial</span>
    <button type="button" onclick="agregarNuevoCombate()" 
            style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">
      + Agregar
    </button>
  </h3>
  
  <!-- Estadísticas en tiempo real -->
  <div id="estadisticasCombates" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px; text-align: center;">
    <div style="background: #d4edda; padding: 10px; border-radius: 6px;">
      <div style="font-size: 24px; font-weight: bold; color: #155724;" id="contadorGanados">0</div>
      <div style="font-size: 12px; color: #155724;">✅ Ganados</div>
    </div>
    <div style="background: #f8d7da; padding: 10px; border-radius: 6px;">
      <div style="font-size: 24px; font-weight: bold; color: #721c24;" id="contadorPerdidos">0</div>
      <div style="font-size: 12px; color: #721c24;">❌ Perdidos</div>
    </div>
    <div style="background: #fff3cd; padding: 10px; border-radius: 6px;">
      <div style="font-size: 24px; font-weight: bold; color: #856404;" id="contadorTablas">0</div>
      <div style="font-size: 12px; color: #856404;">🤝 Tablas</div>
    </div>
  </div>
  
  <!-- Lista de combates -->
  <div id="listaCombates" style="display: flex; flex-direction: column; gap: 15px;">
    <!-- Los combates se agregarán aquí dinámicamente -->
  </div>
</div>


<!-- Checkbox para marcar como público (VENDER) -->
<div style="margin-bottom: 15px; padding: 10px; background: #fff7e6; border-radius: 8px; border: 2px dashed #ff9800;">
  <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
    <input type="checkbox" id="venderCheckbox" style="width: 18px; height: 18px;" />
    <div>
      <div style="font-weight: 600; color: #ff9800;">🏷️ VENDER GALLO</div>
      <div style="font-size: 12px; color: #ff9800;">
        Al marcar esta casilla, este animal será visible para todos los usuarios en la plataforma para COMPRAR.  Y podrán seleccionarlo como padre/madre mientras sea publico, das autorizacion a otros usuarios BUSCAR, VER y COPIAR toda la informacion del animal. 
      </div>
    </div>
  </label>
</div>


          <div id="registroError" style="color: #d93025; margin-top: 15px; display: none; padding: 10px; background: #fff0f0; border-radius: 6px;"></div>
        </div>
        
        <div class="modal-footer">
          <button class="file-input-btn" onclick="closeRegistroGalloModal()">
            Cancelar
          </button>
          <button class="modal-submit" onclick="guardarGallo()" id="guardarGalloBtn">
            💾 Guardar Animal
          </button>
        </div>
      </div>
    </div>
  `;
}

// Función para agregar más fotos
function agregarMasFotos() {
  const container = document.getElementById('fotosContainer');
  const fotoCount = container.querySelectorAll('.photo-upload').length + 1;
  
  if (fotoCount > 6) {
    showError("Máximo 6 fotos permitidas");
    return;
  }
  
  const newFoto = document.createElement('div');
  newFoto.className = 'photo-upload';
  newFoto.innerHTML = `
    <div onclick="document.getElementById('foto${fotoCount}').click()" 
         style="border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; height: 120px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
      <div id="foto${fotoCount}Preview" style="font-size: 30px; color: #667eea;">📷</div>
      <div style="font-size: 12px; color: #65676b; margin-top: 8px;">Extra ${fotoCount-3}</div>
      <input type="file" id="foto${fotoCount}" accept="image/*" style="display: none;" onchange="previewPhoto('${fotoCount}', event)" />
    </div>
    <button onclick="eliminarFoto(this)" 
            style="margin-top: 5px; padding: 4px 8px; background: #ff4444; color: white; border: none; border-radius: 4px; font-size: 10px; cursor: pointer;">
      ✕ Eliminar
    </button>
  `;
  
  container.appendChild(newFoto);
}

function eliminarFoto(button) {
  const container = button.closest('.photo-upload');
  if (container) {
    container.remove();
  }
}



// Variables globales para combates
let combatesActuales = [];
let contadorCombates = 0;

// Función para agregar nuevo formulario de combate
function agregarNuevoCombate() {
  contadorCombates++;
  const combateId = 'combate_' + Date.now() + '_' + contadorCombates;
  
  const nuevoCombateHTML = `
    <div id="${combateId}" class="combate-form" 
         style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e4e6eb; position: relative;">
      <button onclick="eliminarCombate('${combateId}')" 
              style="position: absolute; top: 5px; right: 5px; background: #dc3545; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 10px;">
        ✕
      </button>
      
      <h5 style="color: #050505; margin-bottom: 10px;">Combate #${contadorCombates}</h5>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
        <!-- Resultado -->
        <div>
          <label style="display: block; margin-bottom: 5px; font-size: 12px; font-weight: 600;">Resultado *</label>
          <select class="combate-resultado" onchange="actualizarEstadisticas()" 
                  style="width: 100%; padding: 8px; border: 1px solid #e4e6eb; border-radius: 6px; font-size: 12px;">
            <option value="">Seleccionar</option>
            <option value="ganado">✅ Ganado</option>
            <option value="perdido">❌ Perdido</option>
            <option value="tabla">🤝 Tabla</option>
          </select>
        </div>
        
        <!-- Tiempo -->
        <div>
          <label style="display: block; margin-bottom: 5px; font-size: 12px; font-weight: 600;">Tiempo (mm:ss) *</label>
          <input type="text" class="combate-tiempo" placeholder="Ej: 05:30" 
                 oninput="validarTiempo(this)"
                 style="width: 100%; padding: 8px; border: 1px solid #e4e6eb; border-radius: 6px; font-size: 12px;" />
        </div>
        
        <!-- Fecha -->
        <div>
          <label style="display: block; margin-bottom: 5px; font-size: 12px; font-weight: 600;">Fecha *</label>
          <input type="date" class="combate-fecha" 
                 style="width: 100%; padding: 8px; border: 1px solid #e4e6eb; border-radius: 6px; font-size: 12px;" />
        </div>
        
        <!-- Torneo -->
        <div>
          <label style="display: block; margin-bottom: 5px; font-size: 12px; font-weight: 600;">Torneo/Evento *</label>
          <input type="text" class="combate-torneo" placeholder="Nombre del torneo" 
                 style="width: 100%; padding: 8px; border: 1px solid #e4e6eb; border-radius: 6px; font-size: 12px;" />
        </div>
      </div>
      
      <!-- Observaciones -->
      <div style="margin-top: 10px;">
        <label style="display: block; margin-bottom: 5px; font-size: 12px; font-weight: 600;">Observaciones</label>
        <textarea class="combate-observaciones" placeholder="Detalles adicionales del combate..." 
                  style="width: 100%; padding: 8px; border: 1px solid #e4e6eb; border-radius: 6px; font-size: 12px; min-height: 60px; resize: vertical;"></textarea>
      </div>
    </div>
  `;
  
  document.getElementById('listaCombates').insertAdjacentHTML('beforeend', nuevoCombateHTML);
  actualizarEstadisticas();
}

// Función para eliminar combate
function eliminarCombate(combateId) {
  const combate = document.getElementById(combateId);
  if (combate) {
    combate.remove();
    contadorCombates--;
    actualizarEstadisticas();
  }
}

// Función para validar formato de tiempo
function validarTiempo(input) {
  const tiempo = input.value.replace(/[^\d:]/g, '');
  if (tiempo.length === 2 && !tiempo.includes(':')) {
    input.value = tiempo + ':';
  } else if (tiempo.length > 5) {
    input.value = tiempo.substring(0, 5);
  } else {
    input.value = tiempo;
  }
}

// Función para actualizar estadísticas
function actualizarEstadisticas() {
  const combates = document.querySelectorAll('.combate-form');
  let ganados = 0, perdidos = 0, tablas = 0;
  
  combates.forEach(combate => {
    const resultado = combate.querySelector('.combate-resultado').value;
    if (resultado === 'ganado') ganados++;
    else if (resultado === 'perdido') perdidos++;
    else if (resultado === 'tabla') tablas++;
  });
  
  document.getElementById('contadorGanados').textContent = ganados;
  document.getElementById('contadorPerdidos').textContent = perdidos;
  document.getElementById('contadorTablas').textContent = tablas;
}

// Función para recopilar datos de combates
function recopilarCombates() {
  const combates = [];
  const combatesForms = document.querySelectorAll('.combate-form');
  
  combatesForms.forEach(form => {
    const resultado = form.querySelector('.combate-resultado').value;
    const tiempo = form.querySelector('.combate-tiempo').value;
    const fecha = form.querySelector('.combate-fecha').value;
    const torneo = form.querySelector('.combate-torneo').value;
    const observaciones = form.querySelector('.combate-observaciones').value;
    
    // Validar campos obligatorios
    if (resultado && tiempo && fecha && torneo) {
      combates.push({
        id: generateUniqueId(),
        resultado: resultado,
        tiempo: tiempo,
        fecha: fecha,
        torneo: torneo,
        observaciones: observaciones,
        createdAt: Date.now()
      });
    }
  });
  
  return combates;
}

// Función para agregar nuevas opciones a los selects
function agregarNuevaOpcion(tipo) {
  const nuevaOpcion = prompt(`Ingresa el nuevo valor para ${tipo}:`);
  if (nuevaOpcion && nuevaOpcion.trim() !== '') {
    const select = document.getElementById(tipo);
    if (select) {
      // Verificar si ya existe
      let existe = false;
      for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === nuevaOpcion.trim()) {
          existe = true;
          break;
        }
      }
      
      if (!existe) {
        const option = document.createElement('option');
        option.value = nuevaOpcion.trim();
        option.textContent = nuevaOpcion.trim();
        select.appendChild(option);
        select.value = nuevaOpcion.trim();
        showSuccess(`Nueva opción "${nuevaOpcion}" agregada`);
      } else {
        select.value = nuevaOpcion.trim();
      }
    }
  }
}

// Función para abrir modal de registro
function openRegistroGalloModal(galloId = null) {
  if (!currentUser) {
    showError("Debes iniciar sesión para registrar gallos");
    return;
  }
  
  // Si se pasa un ID, estamos editando
  if (galloId) {
    window.galloEditandoId = galloId;
  }
  
  const modal = document.getElementById('registroGalloModal');
  if (!modal) {
    document.getElementById('social-app').insertAdjacentHTML('beforeend', renderRegistroGalloModal());
  }
  
  document.getElementById('registroGalloModal').classList.add('show');
  cargarCriadores();
  cargarGrupos();
  
  // Si estamos editando, cargar datos del gallo
  if (galloId) {
    editarGallo(galloId);
  }
}

function closeRegistroGalloModal() {
  const modal = document.getElementById('registroGalloModal');
  if (modal) modal.classList.remove('show');
  
  // Resetear TODAS las variables
  window.madreSeleccionada = null;
  window.padreSeleccionada = null;
  window.galloEditandoId = null;
  nuevoRegistroParentesco = null;
  window.madreEsPublica = false;
  window.padreEsPublica = false;
  contadorCombates = 0;
  
  // Limpiar formulario
  limpiarFormularioRegistro();
  
  // Limpiar paneles de resultados de búsqueda
  const resultadosDiv = document.getElementById('resultadosBusquedaParentesco');
  if (resultadosDiv) resultadosDiv.style.display = 'none';
  
  // Restaurar título y botón original
  setTimeout(() => {
    const modalTitle = document.querySelector('#registroGalloModal .modal-title');
    if (modalTitle) {
      modalTitle.textContent = '➕ Registrar Nuevo Animal';
    }
    
    const guardarBtn = document.getElementById('guardarGalloBtn');
    if (guardarBtn) {
      guardarBtn.innerHTML = '💾 Guardar Animal';
      guardarBtn.setAttribute('onclick', 'guardarGallo()');
      guardarBtn.disabled = false;
    }
  }, 100);
}


// Cargar grupos desde Firebase
async function cargarGrupos() {
  if (!currentUser) return;
  
  try {
const snapshot = await databasePedigri.ref(`users/${currentUser.uid}/grupos`).once('value');
    const grupos = snapshot.val();
    const datalist = document.getElementById('gruposList');
    
    if (datalist && grupos) {
      datalist.innerHTML = Object.values(grupos).map(grupo => 
        `<option value="${grupo.nombre}">${grupo.nombre}</option>`
      ).join('');
    }
  } catch (error) {
    console.log("No hay grupos registrados aún");
  }
}

// Función para buscar parentesco
async function buscarParentesco(tipo) {
  const input = document.getElementById(`${tipo}Input`).value.trim();
  if (!input) {
    showError(`Ingresa una placa o nombre para buscar ${tipo}`);
    return;
  }
  
  showLoading(`Buscando ${tipo}...`);
  
  try {
    // 1. Buscar en gallos del usuario
    const snapshotUsuario = await databasePedigri.ref(`users/${currentUser.uid}/gallos`)
      .orderByChild('placa')
      .equalTo(input)
      .once('value');
    
    let resultados = [];
    
    // Procesar resultados del usuario
    if (snapshotUsuario.exists()) {
      const gallosUsuario = snapshotUsuario.val();
      Object.values(gallosUsuario).forEach(gallo => {
        // Verificar que el sexo coincida
        if ((tipo === 'madre' && gallo.sexo === 'Hembra') || 
            (tipo === 'padre' && gallo.sexo === 'Macho')) {
          resultados.push({
            ...gallo,
            fuente: 'usuario',
            seleccionable: true
          });
        }
      });
    }
    
    // 2. Buscar en gallos públicos (si no hay suficientes resultados)
    if (resultados.length < 3) {
      try {
        const snapshotPublicos = await databasePedigri.ref('public/gallos')
          .orderByChild('placa')
          .equalTo(input)
          .once('value');
        
        if (snapshotPublicos.exists()) {
          const gallosPublicos = snapshotPublicos.val();
          Object.values(gallosPublicos).forEach(gallo => {
            // Verificar sexo y que no sea del propio usuario
            if (((tipo === 'madre' && gallo.sexo === 'Hembra') || 
                 (tipo === 'padre' && gallo.sexo === 'Macho')) &&
                gallo.propietarioOriginal !== currentUser.uid) {
              resultados.push({
                ...gallo,
                fuente: 'publico',
                seleccionable: true,
                esPublico: true
              });
            }
          });
        }
      } catch (error) {
        console.log("No hay resultados en públicos");
      }
    }
    
    // 3. Buscar por coincidencia parcial (si no hay resultados exactos)
    if (resultados.length === 0) {
      // Buscar por criador o color
      const allSnapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos`).once('value');
      const allGallos = allSnapshot.val();
      
      if (allGallos) {
        Object.values(allGallos).forEach(gallo => {
          const coincideCriador = gallo.criador && gallo.criador.toLowerCase().includes(input.toLowerCase());
          const coincideColor = gallo.color && gallo.color.toLowerCase().includes(input.toLowerCase());
          
          if ((coincideCriador || coincideColor) &&
              ((tipo === 'madre' && gallo.sexo === 'Hembra') || 
               (tipo === 'padre' && gallo.sexo === 'Macho'))) {
            resultados.push({
              ...gallo,
              fuente: 'usuario',
              seleccionable: true
            });
          }
        });
      }
    }
    
    // Mostrar resultados
    const resultadosDiv = document.getElementById('resultadosBusquedaParentesco');
    if (resultados.length > 0) {
      let resultadosHTML = '<div style="margin-top: 15px; padding: 15px; background: white; border-radius: 8px; border: 1px solid #e4e6eb;">';
      resultadosHTML += `<h5 style="margin-bottom: 10px; color: #050505;">Resultados (${resultados.length}):</h5>`;
      
      resultados.forEach(gallo => {
        const esPublico = gallo.fuente === 'publico';
        const badgeColor = esPublico ? '#ff9800' : '#42b72a';
        const badgeText = esPublico ? 'PÚBLICO' : 'TUYO';
        
        resultadosHTML += `
          <div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-bottom: 1px solid #f0f2f5; background: ${esPublico ? '#fff7e6' : '#f6ffed'};">
            <div style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden; flex-shrink: 0; border: 2px solid ${badgeColor};">
              ${gallo.fotos && Object.values(gallo.fotos)[0] ? 
                `<img src="${Object.values(gallo.fotos)[0]}" style="width:100%;height:100%;object-fit:cover;" />` : 
                `<div style="width:100%;height:100%;background:#f0f2f5;display:flex;align-items:center;justify-content:center;color:#667eea;">
                  ${gallo.sexo === 'Macho' ? '🐓' : '🐔'}
                </div>`
              }
            </div>
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 600; color: #050505;">${gallo.placa}</span>
                <span style="font-size: 10px; padding: 2px 6px; background: ${badgeColor}; color: white; border-radius: 10px;">
                  ${badgeText}
                </span>
              </div>
              <div style="font-size: 12px; color: #65676b;">
                ${gallo.color} • ${gallo.estado} • ${gallo.criador}
              </div>
              ${esPublico ? '<div style="font-size: 10px; color: #ff9800;">Otro usuario</div>' : ''}
            </div>
            <button onclick="seleccionar${tipo.charAt(0).toUpperCase() + tipo.slice(1)}('${gallo.id}', ${esPublico})" 
                    style="padding: 6px 12px; background: ${esPublico ? '#ff9800' : '#42b72a'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
              Seleccionar
            </button>
          </div>
        `;
      });
      
      resultadosHTML += `
        <div style="margin-top: 10px; text-align: center;">
          <button onclick="registroRapidoParentesco('${tipo}')" 
                  style="padding: 8px 16px; background: #9254de; color: white; border: none; border-radius: 6px; cursor: pointer;">
            + Registrar nuevo ${tipo}
          </button>
        </div>
      `;
      resultadosHTML += '</div>';
      
      resultadosDiv.innerHTML = resultadosHTML;
      resultadosDiv.style.display = 'block';
    } else {
      resultadosDiv.innerHTML = `
        <div style="margin-top: 15px; padding: 15px; background: white; border-radius: 8px; border: 1px solid #e4e6eb; text-align: center;">
          <p style="color: #65676b; margin-bottom: 10px;">No se encontraron ${tipo}s con "${input}"</p>
          <button onclick="registroRapidoParentesco('${tipo}')" 
                  style="padding: 10px 20px; background: #9254de; color: white; border: none; border-radius: 6px; cursor: pointer;">
            + Registrar nuevo ${tipo}
          </button>
        </div>
      `;
      resultadosDiv.style.display = 'block';
    }
    
  } catch (error) {
    console.error(`Error buscando ${tipo}:`, error);
    showError("Error en la búsqueda");
  } finally {
    hideLoading();
  }
}


// Función para registro rápido de padre/madre
async function registroRapidoParentesco(tipo) {
  // Guardar el tipo de parentesco para después
  window.tipoParentescoPendiente = tipo;
  
  // Crear modal específico para registro rápido
  const modalHTML = `
    <div class="modal-overlay show" id="registroRapidoModal">
      <div class="modal" style="max-width: 600px;">
        <div class="modal-header">
          <div class="modal-title">➕ Registrar ${tipo === 'madre' ? 'Madre' : 'Padre'}</div>
          <button class="modal-close" onclick="cerrarRegistroRapido()">✕</button>
        </div>
        
        <div class="modal-body">
          <p style="color: #65676b; margin-bottom: 20px;">
            Completa la información del ${tipo}. Después podrás buscarlo, editarlo y terminar el registro completo del  ${tipo}.
          </p>
          
          <div style="display: flex; flex-direction: column; gap: 15px;">
            <div>
              <label style="display: block; margin-bottom: 8px; font-weight: 600;">Placa *</label>
             <input type="text" id="placaRapida" 
       value="${tipo === 'madre' ? 'M' : 'P'}-${Date.now().toString().slice(-4)}"
       style="width: 100%; padding: 12px; border: 1px solid #e4e6eb; border-radius: 8px;" />

            </div>
            
            <div>
              <label style="display: block; margin-bottom: 8px; font-weight: 600;">Sexo *</label>
              <select id="sexoRapido" style="width: 100%; padding: 12px; border: 1px solid #e4e6eb; border-radius: 8px;" disabled>
                <option value="${tipo === 'madre' ? 'Hembra' : 'Macho'}">
                  ${tipo === 'madre' ? 'Hembra (Madre)' : 'Macho (Padre)'}
                </option>
              </select>
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 8px; font-weight: 600;">Color *</label>
              <select id="colorRapido" style="width: 100%; padding: 12px; border: 1px solid #e4e6eb; border-radius: 8px;">
                <option value="">Seleccionar color</option>
                ${COLOR_OPTIONS.map(color => `<option value="${color}">${color}</option>`).join('')}
              </select>
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 8px; font-weight: 600;">Criador *</label>
              <input type="text" id="criadorRapido" placeholder="Nombre del criador" 
                     style="width: 100%; padding: 12px; border: 1px solid #e4e6eb; border-radius: 8px;" />
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 8px; font-weight: 600;">Fecha Nacimiento *</label>
              <input type="date" id="fechaRapida" 
                     style="width: 100%; padding: 12px; border: 1px solid #e4e6eb; border-radius: 8px;" />
            </div>
          </div>
          
          <div id="errorRapido" style="color: #d93025; margin-top: 15px; display: none;"></div>
        </div>
        
        <div class="modal-footer">
          <button class="file-input-btn" onclick="cerrarRegistroRapido()">
            Cancelar
          </button>
          <button class="modal-submit" onclick="guardarRegistroRapido()">
            💾 Guardar y Buscar
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Cerrar modal de registro principal si está abierto
  //closeRegistroGalloModal();
  
  // Agregar modal al DOM
  document.getElementById('social-app').insertAdjacentHTML('beforeend', modalHTML);
}

// Función para cerrar modal rápido
function cerrarRegistroRapido() {
  const modal = document.getElementById('registroRapidoModal');
  if (modal) modal.remove();
  window.tipoParentescoPendiente = null;
}

// Función para guardar registro rápido
async function guardarRegistroRapido() {
  const tipo = window.tipoParentescoPendiente;
  if (!tipo) return;
  
  const btn = document.querySelector('#registroRapidoModal .modal-submit');
  const errorDiv = document.getElementById('errorRapido');
  
  // Validar campos
  const placa = document.getElementById('placaRapida').value.trim();
  const color = document.getElementById('colorRapido').value;
  const criador = document.getElementById('criadorRapido').value.trim();
  const fechaNacimiento = document.getElementById('fechaRapida').value;
  const sexo = tipo === 'madre' ? 'Hembra' : 'Macho';
  
  if (!placa || !color || !criador || !fechaNacimiento) {
    errorDiv.textContent = "Todos los campos marcados con * son obligatorios";
    errorDiv.style.display = "block";
    return;
  }
  
  btn.disabled = true;
  btn.textContent = "Guardando...";
  
  try {
    // Validar placa duplicada
 const snapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos`)
  .orderByChild('placa')
  .equalTo(placa)
  .once('value');
    
    if (snapshot.exists()) {
      errorDiv.textContent = "Ya existe un animal con esta placa";
      errorDiv.style.display = "block";
      btn.disabled = false;
      btn.textContent = "💾 Guardar y Buscar";
      return;
    }
    
    // Crear objeto gallo
    const galloData = {
      id: generateUniqueId(),
      placa: placa,
      color: color,
      sexo: sexo,
      estado: 'Activo',
      criador: criador,
      fechaNacimiento: fechaNacimiento,
      pluma: '',
      cresta: '',
      grupo: '',
      notas: `Registrado como ${tipo}`,
      fotos: {},
      userId: currentUser.uid,
      madreId: '',
      padreId: '',
      hijos: [],
      hermanos: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    // Guardar en Firebase
await databasePedigri.ref(`users/${currentUser.uid}/gallos/${galloData.id}`).set(galloData);
    
    showSuccess(`✅ ${tipo === 'madre' ? 'Madre' : 'Padre'} registrado correctamente`);
    
    // Cerrar modal rápido
    cerrarRegistroRapido();
    
    // Abrir modal principal y buscar automáticamente
    setTimeout(() => {
      openRegistroGalloModal();
      // Poner la placa en el buscador correspondiente
      document.getElementById(`${tipo}Input`).value = placa;
      // Ejecutar búsqueda automáticamente
      buscarParentesco(tipo);
    }, 500);
    
  } catch (error) {
    console.error("Error guardando registro rápido:", error);
    errorDiv.textContent = "Error al guardar: " + error.message;
    errorDiv.style.display = "block";
    btn.disabled = false;
    btn.textContent = "💾 Guardar y Buscar";
  }
}

// Modificar guardarGallo para manejar registro rápido
async function guardarGallo() {
  const btn = document.getElementById('guardarGalloBtn');
  const errorDiv = document.getElementById('registroError');
  
  // Validaciones básicas
  const placa = document.getElementById('placa').value.trim();
  const color = document.getElementById('color').value;
  const sexo = document.getElementById('sexo').value;
  const estado = document.getElementById('estado').value;
  const criador = document.getElementById('criadorInput').value.trim();
  const fechaNacimiento = document.getElementById('fechaNacimiento').value;
  
// ✅ NUEVA VALIDACIÓN: Verificar placa duplicada ANTES de continuar
  if (!await validarPlacaUnica(placa, null)) {
    errorDiv.textContent = `⚠️ Ya tienes un animal registrado con la placa "${placa}". Usa una placa diferente.`;
    errorDiv.style.display = "block";
    document.getElementById('placa').focus();
    return;
  }

  if (!placa) {
    errorDiv.textContent = "El número de placa es requerido";
    errorDiv.style.display = "block";
    return;
  }
  
  if (!color) {
    errorDiv.textContent = "Selecciona un color";
    errorDiv.style.display = "block";
    return;
  }
  
  if (!sexo) {
    errorDiv.textContent = "Selecciona el sexo";
    errorDiv.style.display = "block";
    return;
  }
  
  if (!estado) {
    errorDiv.textContent = "Selecciona el estado";
    errorDiv.style.display = "block";
    return;
  }
  
  if (!criador) {
    errorDiv.textContent = "El criador es requerido";
    errorDiv.style.display = "block";
    return;
  }
  
  if (!fechaNacimiento) {
    errorDiv.textContent = "La fecha de nacimiento es requerida";
    errorDiv.style.display = "block";
    return;
  }
  
  // Validar combates
  const combates = recopilarCombates();
  combates.forEach(combate => {
    if (!combate.resultado || !combate.tiempo || !combate.fecha || !combate.torneo) {
      errorDiv.textContent = "⚠️ Todos los combates deben tener resultado, tiempo, fecha y torneo completos";
      errorDiv.style.display = "block";
      throw new Error("Combates incompletos");
    }
  });

  // ... resto del código de validación ...

  btn.disabled = true;
  btn.textContent = "Guardando...";
  errorDiv.style.display = "none";
  
  try {
    // Subir fotos a Cloudinary
    const fotos = {};
    const fotoCount = document.querySelectorAll('#fotosContainer .photo-upload').length;
    
    for (let i = 1; i <= fotoCount; i++) {
      const fileInput = document.getElementById(`foto${i}`);
      if (fileInput && fileInput.files[0]) {
        const file = fileInput.files[0];
        const uploadResult = await uploadToCloudinary(file);
        if (uploadResult.success && uploadResult.url) {
          fotos[`foto${i}`] = uploadResult.url;
        }
      }
    }
    
    // Guardar grupo si es nuevo
    const grupoInput = document.getElementById('grupo').value.trim();
    if (grupoInput) {
      await guardarGrupo(grupoInput);
    }
    
    // Crear objeto gallo
    const galloData = {
      id: generateUniqueId(),
      placa: placa,
      color: color,
      sexo: sexo,
      estado: estado,
      criador: criador,
      fechaNacimiento: fechaNacimiento,
      pluma: document.getElementById('pluma').value || '',
      cresta: document.getElementById('cresta').value || '',
      grupo: grupoInput || '',
      notas: document.getElementById('notas').value.trim() || '',
      marcaje: document.getElementById('marcaje') ? document.getElementById('marcaje').value.trim() : '',
      origenMarcaje: document.getElementById('origenMarcaje') ? document.getElementById('origenMarcaje').value.trim() : '',
      // ⬇️ AGREGAR COMBATES ⬇️
      combates: combates,
      // ⬆️ AGREGAR COMBATES ⬆️
      fotos: fotos,
      userId: currentUser.uid,
      madreId: window.madreSeleccionada || '',
      padreId: window.padreSeleccionada || '',
      hijos: [],
      hermanos: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
  ultimoPeso: parseFloat(document.getElementById('ultimoPeso').value) || 0,
ultimoPesoUnidad: document.getElementById('unidadPeso') ? document.getElementById('unidadPeso').value : 'g',
ultimoPesoFecha: Date.now()

    };
    
    // Guardar en Firebase Pedigri
// Guardar en Firebase Pedigri - EN LA BASE DEL USUARIO
await databasePedigri.ref(`users/${currentUser.uid}/gallos/${galloData.id}`).set(galloData);

// Si está marcado para vender, guardar también en público
if (document.getElementById('venderCheckbox') && document.getElementById('venderCheckbox').checked) {
  await databasePedigri.ref(`public/gallos/${galloData.id}`).set({
    ...galloData,
    esPublico: true,
    propietarioOriginal: currentUser.uid,
    fechaPublicacion: Date.now()
  });
}
    
    
    // Si es un registro rápido de parentesco, actualizar el input correspondiente
 if (nuevoRegistroParentesco) {
  const tipoParentesco = nuevoRegistroParentesco; // Guardamos en variable
  const tipoTexto = tipoParentesco === 'madre' ? 'madre' : 'padre';
  
  if (tipoParentesco === 'madre') {
    window.madreSeleccionada = galloData.id;
    document.getElementById('madreInput').value = placa;
    mostrarInfoParentesco('madre', galloData);
  } else if (tipoParentesco === 'padre') {
    window.padreSeleccionada = galloData.id;
    document.getElementById('padreInput').value = placa;
    mostrarInfoParentesco('padre', galloData);
  }
  
  showSuccess(`✅ ${sexo} registrado correctamente. Ahora está seleccionado como ${tipoTexto}.`);
  nuevoRegistroParentesco = null; // Ahora sí lo resetemos
} else {
  showSuccess("✅ Animal registrado correctamente");
}


btn.disabled = true;
btn.textContent = "✅ Guardado";

    limpiarFormularioRegistro();

// Esperar 1 segundo y cerrar
setTimeout(() => {

 


  closeRegistroGalloModal();
  cargarGallosUsuario();
  limpiarFormularioRegistro();
  
  // Resetear estado del botón
  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = "💾 Guardar Animal";
  }, 2000);
}, 1000);

   
    
    // Actualizar relaciones familiares si hay padres seleccionados
    await actualizarRelacionesFamiliares(galloData);
    
    // Actualizar estadísticas del criador
    await actualizarEstadisticasCriador(criador);
    
  } catch (error) {
    console.error("Error guardando gallo:", error);
    errorDiv.textContent = "Error al guardar el animal: " + error.message;
    errorDiv.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = "💾 Guardar Animal";
  }
}


// Función para validar placa única (solo en gallos del usuario)
async function validarPlacaUnica(placa, excluirGalloId = null) {
  if (!currentUser || !placa) return true;
  
  try {
    // Buscar en gallos del usuario
    const snapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos`)
      .orderByChild('placa')
      .equalTo(placa)
      .once('value');
    
    if (!snapshot.exists()) {
      return true; // Placa disponible
    }
    
    const gallos = snapshot.val();
    const ids = Object.keys(gallos);
    
    // Si se está excluyendo un gallo (al editar), verificar
    if (excluirGalloId) {
      // Si solo encuentra el mismo gallo que estamos editando, está bien
      if (ids.length === 1 && ids[0] === excluirGalloId) {
        return true;
      }
      // Si encuentra otros gallos con la misma placa, está mal
      const otrosGallos = ids.filter(id => id !== excluirGalloId);
      return otrosGallos.length === 0;
    }
    
    // Para nuevo registro, cualquier coincidencia es mala
    return false;
    
  } catch (error) {
    console.error("Error validando placa:", error);
    return true; // En caso de error, permitir
  }
}

// Función para actualizar relaciones familiares


// Función auxiliar para actualizar hermanos
async function actualizarHermanos(gallo) {
  if (!gallo.madreId && !gallo.padreId) return;
  
  try {
    // Buscar todos los gallos del usuario
    const snapshot = await databasePedigri.ref('gallos')
      .orderByChild('userId')
      .equalTo(currentUser.uid)
      .once('value');
    
    if (!snapshot.exists()) return;
    
    const allGallos = snapshot.val();
    const hermanosIds = [];
    
    // Encontrar hermanos (comparten madre o padre)
    Object.values(allGallos).forEach(otherGallo => {
      if (otherGallo.id !== gallo.id) { // Excluir al gallo actual
        if ((gallo.madreId && otherGallo.madreId === gallo.madreId) ||
            (gallo.padreId && otherGallo.padreId === gallo.padreId)) {
          hermanosIds.push(otherGallo.id);
        }
      }
    });
    
    // Actualizar hermanos del nuevo gallo
    await databasePedigri.ref('gallos/' + gallo.id).update({ 
      hermanos: hermanosIds,
      updatedAt: Date.now()
    });
    
    console.log(`✅ Actualizados hermanos de ${gallo.placa}: ${hermanosIds.length} hermanos`);
    
  } catch (error) {
    console.error("Error actualizando hermanos:", error);
  }
}

// Función auxiliar para actualizar hermanos de los hermanos existentes
async function actualizarHermanosDeHermanos(gallo) {
  if (!gallo.madreId && !gallo.padreId) return;
  
  try {
    // Buscar todos los gallos del usuario
    const snapshot = await databasePedigri.ref('gallos')
      .orderByChild('userId')
      .equalTo(currentUser.uid)
      .once('value');
    
    if (!snapshot.exists()) return;
    
    const allGallos = snapshot.val();
    
    // Para cada gallo que sea hermano del nuevo, actualizar su lista de hermanos
    const updates = {};
    
    Object.values(allGallos).forEach(otherGallo => {
      if (otherGallo.id !== gallo.id) { // Excluir al gallo actual
        let esHermano = false;
        
        // Verificar si son hermanos
        if ((gallo.madreId && otherGallo.madreId === gallo.madreId) ||
            (gallo.padreId && otherGallo.padreId === gallo.padreId)) {
          esHermano = true;
        }
        
        if (esHermano) {
          // Obtener hermanos actuales del hermano
          let hermanosActuales = otherGallo.hermanos || [];
          
          // Agregar el nuevo gallo si no está ya
          if (!hermanosActuales.includes(gallo.id)) {
            hermanosActuales.push(gallo.id);
            
            // Preparar update
            updates[`gallos/${otherGallo.id}/hermanos`] = hermanosActuales;
            updates[`gallos/${otherGallo.id}/updatedAt`] = Date.now();
          }
        }
      }
    });
    
    // Ejecutar todas las actualizaciones
    if (Object.keys(updates).length > 0) {
      await databasePedigri.ref().update(updates);
      console.log(`✅ Actualizados ${Object.keys(updates).length / 2} hermanos existentes`);
    }
    
  } catch (error) {
    console.error("Error actualizando hermanos de hermanos:", error);
  }
}


// Función para actualizar estadísticas del criador
async function actualizarEstadisticasCriador(nombreCriador) {
  if (!currentUser || !nombreCriador) return;
  
  try {
    // 1. Buscar el criador por nombre
    const snapshot = await databasePedigri.ref('criadores')
      .orderByChild('nombre')
      .equalTo(nombreCriador)
      .once('value');
    
    let criadorId;
    let criadorData = {};
    
    if (snapshot.exists()) {
      // Criador existe, obtener sus datos
      const criadores = snapshot.val();
      criadorId = Object.keys(criadores)[0];
      criadorData = criadores[criadorId];
    } else {
      // Criador no existe, crear nuevo
      const newCriadorRef = databasePedigri.ref('criadores').push();
      criadorId = newCriadorRef.key;
      criadorData = {
        id: criadorId,
        nombre: nombreCriador,
        userId: currentUser.uid,
        totalGallos: 0,
        gallosActivos: 0,
        gallosMachos: 0,
        gallosHembras: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }
    
    // 2. Contar estadísticas actuales de gallos de este criador
    const gallosSnapshot = await databasePedigri.ref('gallos')
      .orderByChild('userId')
      .equalTo(currentUser.uid)
      .once('value');
    
    let totalGallos = 0;
    let gallosActivos = 0;
    let gallosMachos = 0;
    let gallosHembras = 0;
    
    if (gallosSnapshot.exists()) {
      const todosGallos = gallosSnapshot.val();
      
      Object.values(todosGallos).forEach(gallo => {
        if (gallo.criador === nombreCriador) {
          totalGallos++;
          
          if (gallo.estado === 'Activo') gallosActivos++;
          if (gallo.sexo === 'Macho') gallosMachos++;
          if (gallo.sexo === 'Hembra') gallosHembras++;
        }
      });
    }
    
    // 3. Actualizar estadísticas del criador
    const datosActualizados = {
      ...criadorData,
      totalGallos: totalGallos,
      gallosActivos: gallosActivos,
      gallosMachos: gallosMachos,
      gallosHembras: gallosHembras,
      updatedAt: Date.now()
    };
    
    await databasePedigri.ref('criadores/' + criadorId).set(datosActualizados);
    
    console.log(`✅ Estadísticas actualizadas para criador: ${nombreCriador}`);
    console.log(`   Total: ${totalGallos}, Activos: ${gallosActivos}, Machos: ${gallosMachos}, Hembras: ${gallosHembras}`);
    
  } catch (error) {
    console.error("❌ Error actualizando estadísticas del criador:", error);
    // No mostramos error al usuario
  }
}









// Función para mostrar información de parentesco seleccionado
function mostrarInfoParentesco(tipo, gallo, esPublico = false) {
  const infoDiv = document.getElementById(`${tipo}Info`);
  if (!infoDiv) return; // Asegurar que el elemento existe
  
  const badgeColor = esPublico ? '#ff9800' : '#42b72a';
  const badgeText = esPublico ? 'PÚBLICO' : 'TUYO';
  
  infoDiv.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px; background: white; padding: 10px; border-radius: 6px; border: 2px solid ${badgeColor}; position: relative;">
      <div style="position: absolute; top: 5px; right: 5px; font-size: 10px; padding: 2px 6px; background: ${badgeColor}; color: white; border-radius: 10px;">
        ${badgeText}
      </div>
      <div style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden; flex-shrink: 0; border: 2px solid ${badgeColor};">
        ${gallo.fotos && Object.values(gallo.fotos)[0] ? 
          `<img src="${Object.values(gallo.fotos)[0]}" style="width:100%;height:100%;object-fit:cover;" />` : 
          `<div style="width:100%;height:100%;background:#f0f2f5;display:flex;align-items:center;justify-content:center;color:#667eea;">
            ${gallo.sexo === 'Macho' ? '🐓' : '🐔'}
          </div>`
        }
      </div>
      <div style="flex: 1;">
        <div style="font-weight: 600; color: #050505;">#${gallo.placa}</div>
        <div style="font-size: 12px; color: #65676b;">${gallo.color} • ${gallo.estado}</div>
        ${esPublico ? '<div style="font-size: 10px; color: #ff9800;">Referencia externa</div>' : ''}
      </div>
      <button onclick="deseleccionar${tipo.charAt(0).toUpperCase() + tipo.slice(1)}()" 
              style="padding: 6px 12px; background: #ff4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
        ✕
      </button>
    </div>
  `;
  infoDiv.style.display = 'block';
  
  // Ocultar resultados de búsqueda si están visibles
  const resultadosDiv = document.getElementById('resultadosBusquedaParentesco');
  if (resultadosDiv) resultadosDiv.style.display = 'none';
}


// Función para guardar grupo
async function guardarGrupo(nombre) {
  try {
const snapshot = await databasePedigri.ref(`users/${currentUser.uid}/grupos`)
  .orderByChild('nombre')
  .equalTo(nombre)
  .once('value');

    if (!snapshot.exists()) {
const newGrupoRef = databasePedigri.ref(`users/${currentUser.uid}/grupos`).push();

      await newGrupoRef.set({
        id: newGrupoRef.key,
        nombre: nombre,
        userId: currentUser.uid,
        createdAt: Date.now()
      });
      cargarGrupos();
    }
  } catch (error) {
    console.error("Error guardando grupo:", error);
  }
}

// Función para guardar grupo
async function guardarGrupo(nombreGrupo) {
  if (!currentUser || !nombreGrupo.trim()) return;
  
  const nombre = nombreGrupo.trim();
  
  try {
    // Verificar si el grupo ya existe
    const snapshot = await databasePedigri.ref('grupos')
      .orderByChild('nombre')
      .equalTo(nombre)
      .once('value');
    
    if (!snapshot.exists()) {
      // Grupo no existe, crear nuevo
      const newGrupoRef = databasePedigri.ref('grupos').push();
      await newGrupoRef.set({
        id: newGrupoRef.key,
        nombre: nombre,
        userId: currentUser.uid,
        totalGallos: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      
      console.log(`✅ Grupo creado: ${nombre}`);
      
      // Actualizar datalist de grupos
      cargarGrupos();
    }
    
  } catch (error) {
    console.error("Error guardando grupo:", error);
  }
}



// Cargar gallos del usuario
async function cargarGallosUsuario() {
  if (!currentUser) return;
  
  try {
   

   const snapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos`).once('value');

    const gallosData = snapshot.val();
    
    currentGallos = [];
    if (gallosData) {
      currentGallos = Object.values(gallosData);
      aplicarOrdenYFiltros();
    }
    
   const grid = document.getElementById('gallosGrid');
    if (grid) {
      actualizarEstadisticas();
      renderGallosGrid();
    }
    
  } catch (error) {
    console.error("Error cargando gallos:", error);
  }
}

// Función para aplicar orden y filtros
function aplicarOrdenYFiltros() {
  let gallosFiltrados = [...currentGallos];
  
  // Aplicar filtros
  if (Object.keys(currentFilters).length > 0) {
    gallosFiltrados = gallosFiltrados.filter(gallo => {
      for (const [key, value] of Object.entries(currentFilters)) {
        if (value && value !== '') {
          switch(key) {
            case 'color':
              if (gallo.color !== value) return false;
              break;
            case 'estado':
              if (gallo.estado !== value) return false;
              break;
            case 'sexo':
              if (gallo.sexo !== value) return false;
              break;
            case 'criador':
              if (!gallo.criador.toLowerCase().includes(value.toLowerCase())) return false;
              break;
            case 'grupo':
              if (!gallo.grupo || !gallo.grupo.toLowerCase().includes(value.toLowerCase())) return false;
              break;
            case 'pluma':
              if (gallo.pluma !== value) return false;
              break;
            case 'cresta':
              if (gallo.cresta !== value) return false;
              break;
            case 'edad':
              const edadMeses = calcularEdadMeses(gallo.fechaNacimiento);
              switch(value) {
                case '0-6': if (edadMeses > 6) return false; break;
                case '7-12': if (edadMeses < 7 || edadMeses > 12) return false; break;
                case '13-24': if (edadMeses < 13 || edadMeses > 24) return false; break;
                case '25+': if (edadMeses < 25) return false; break;
              }
              break;
          }
        }
      }
      return true;
    });
  }
  
  // Aplicar orden
  switch(currentSortMode) {
    case 'nuevos':
      gallosFiltrados.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case 'antiguos':
      gallosFiltrados.sort((a, b) => a.createdAt - b.createdAt);
      break;
    case 'placa_asc':
      gallosFiltrados.sort((a, b) => a.placa.localeCompare(b.placa));
      break;
    case 'placa_desc':
      gallosFiltrados.sort((a, b) => b.placa.localeCompare(a.placa));
      break;
    case 'estado':
      gallosFiltrados.sort((a, b) => a.estado.localeCompare(b.estado));
      break;
  }
  
  currentGallos = gallosFiltrados;
 const gallosFiltradosElement = document.getElementById('gallosFiltrados');
  if (gallosFiltradosElement) {
    gallosFiltradosElement.textContent = gallosFiltrados.length;
  }
}

function calcularEdadMeses(fechaNacimiento) {
  const nacimiento = new Date(fechaNacimiento);
  const hoy = new Date();
  const diferenciaMs = hoy - nacimiento;
  return Math.floor(diferenciaMs / (1000 * 60 * 60 * 24 * 30.44));
}

// Funciones de vista y orden
function cambiarVista(modo) {
  currentViewMode = modo;
  renderGallosGrid();
}

function cambiarOrden(modo) {
  currentSortMode = modo;
  aplicarOrdenYFiltros();
  renderGallosGrid();
}

function toggleFiltros() {
  const panel = document.getElementById('filtrosPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function aplicarFiltros() {
  currentFilters = {
    color: document.getElementById('filtroColor').value,
    estado: document.getElementById('filtroEstado').value,
    sexo: document.getElementById('filtroSexo').value,
    criador: document.getElementById('filtroCriador').value,
    grupo: document.getElementById('filtroGrupo').value,
    pluma: document.getElementById('filtroPluma').value,
    cresta: document.getElementById('filtroCresta').value,
    edad: document.getElementById('filtroEdad').value
  };
  
  aplicarOrdenYFiltros();
  renderGallosGrid();
}

function limpiarFiltros() {
  // Limpiar controles de filtro
  document.querySelectorAll('#filtrosPanel select, #filtrosPanel input').forEach(el => {
    if (el.tagName === 'SELECT') el.selectedIndex = 0;
    if (el.tagName === 'INPUT') el.value = '';
  });
  
  // Limpiar campo de búsqueda principal
  const buscarInput = document.getElementById('buscarGalloInput');
  if (buscarInput) buscarInput.value = '';
  
  // Resetear filtros
  currentFilters = {};
  
  // Recargar TODOS los gallos del usuario
  cargarGallosUsuario();
  
  showSuccess("Filtros limpiados");
}

// Renderizar grid de gallos según vista
function renderGallosGrid() {
  const grid = document.getElementById('gallosGrid');
  if (!grid) return;
  
  if (currentGallos.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #65676b;">
        <div style="font-size: 60px; margin-bottom: 20px;">🐔</div>
        <h3 style="color: #050505; margin-bottom: 10px;">No hay gallos registrados</h3>
        <p style="color: #8a8d91;">Comienza registrando tu primer animal</p>
        <button onclick="openRegistroGalloModal()" 
                style="margin-top: 20px; padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
          ➕ Registrar Primer Animal
        </button>
      </div>
    `;
    return;
  }
  
  // Determinar template según vista
  let gridTemplate = '';
  switch(currentViewMode) {
    case 'grid-small':
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
      grid.innerHTML = currentGallos.map(gallo => renderGalloCardPequeño(gallo)).join('');
      break;
    case 'list':
      grid.style.gridTemplateColumns = '1fr';
      grid.innerHTML = currentGallos.map(gallo => renderGalloCardLista(gallo)).join('');
      break;
    default:
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
      grid.innerHTML = currentGallos.map(gallo => renderGalloCard(gallo)).join('');
  }
}

// Diferentes estilos de tarjetas
function renderGalloCard(gallo) {
  const fotoPrincipal = gallo.fotos && Object.values(gallo.fotos)[0] ? Object.values(gallo.fotos)[0] : '';
  const colorBorde = gallo.color;
  
  return `
    <div class="gallo-card" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s; border: 3px solid ${colorBorde}; position: relative;">
      
      <!-- Botones de acción (esquina superior derecha) -->
      <div class="gallo-actions" style="position: absolute; top: 10px; right: 10px; display: flex; gap: 5px; z-index: 10;">
        <button onclick="editarGallo('${gallo.id}'); event.stopPropagation();" 
                style="width: 30px; height: 30px; border-radius: 50%; background: rgba(255, 193, 7, 0.9); color: white; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px; transition: all 0.3s;"
                onmouseover="this.style.transform='scale(1.2)'" 
                onmouseout="this.style.transform='scale(1)'"
                title="Editar">
          ✏️
        </button>
        <button onclick="confirmarEliminarGallo('${gallo.id}', '${gallo.placa}'); event.stopPropagation();" 
                style="width: 30px; height: 30px; border-radius: 50%; background: rgba(220, 53, 69, 0.9); color: white; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px; transition: all 0.3s;"
                onmouseover="this.style.transform='scale(1.2)'" 
                onmouseout="this.style.transform='scale(1)'"
                title="Eliminar">
          🗑️
        </button>
      </div>
      
      <!-- Contenido principal (click para ver detalle) -->
      <div onclick="verDetalleGallo('${gallo.id}')" style="cursor: pointer;">
        <!-- Foto con borde de color -->
        <div style="position: relative; height: 200px; background: #f0f2f5;">
          ${fotoPrincipal ? 
            `<img src="${fotoPrincipal}" style="width:100%;height:100%;object-fit:cover;" />` :
            `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:60px;color:#65676b;">
              ${gallo.sexo === 'Macho' ? '🐓' : '🐔'}
            </div>`
          }
          
          <!-- Estado -->
          <div style="position:absolute; top:10px; left:10px; background:${getEstadoColor(gallo.estado)}; color:white; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600;">
            ${gallo.estado}
          </div>
          
          <!-- Color -->
          <div style="position:absolute; bottom:10px; left:10px; background:${colorBorde}; color:white; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600;">
            ${gallo.color}
          </div>
        </div>
        
        <!-- Información -->
        <div style="padding: 15px;">
          <div style="font-size: 18px; font-weight: 600; color: #050505; margin-bottom: 5px;">
            #${gallo.placa}
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="font-size: 14px; color: #65676b;">
              ${gallo.sexo} • ${gallo.grupo || 'Sin grupo'}
            </span>
            <span style="font-size: 14px; color: #667eea; font-weight: 600;">
              ${gallo.criador}
            </span>
          </div>
          
          <div style="font-size: 12px; color: #8a8d91; display: flex; justify-content: space-between;">
            <span>Nac: ${new Date(gallo.fechaNacimiento).toLocaleDateString()}</span>
            <span>${gallo.pluma || 'Sin pluma'}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}


function renderGalloCardPequeño(gallo) {
  const fotoPrincipal = gallo.fotos && Object.values(gallo.fotos)[0] ? Object.values(gallo.fotos)[0] : '';
  
  return `
    <div class="gallo-card" onclick="verDetalleGallo('${gallo.id}')" 
         style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.1); cursor: pointer; transition: transform 0.2s; border: 2px solid ${gallo.color};">
      
      <div style="position: relative; height: 450px; background: #f0f2f5;">
        ${fotoPrincipal ? 
          `<img src="${fotoPrincipal}" style="width:100%;height:100%;object-fit:cover;" />` :
          `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:30px;color:#65676b;">
            ${gallo.sexo === 'Macho' ? '🐓' : '🐔'}
          </div>`
        }
        
        <div style="position:absolute; top:5px; right:5px; background:${getEstadoColor(gallo.estado)}; color:white; padding:2px 6px; border-radius:10px; font-size:10px;">
          ${gallo.estado.charAt(0)}
        </div>
      </div>
      
      <div style="padding: 8px;">
        <div style="font-size: 14px; font-weight: 600; color: #050505; margin-bottom: 3px; text-align: center;">
          #${gallo.placa}
        </div>
        
        <div style="font-size: 10px; color: #65676b; text-align: center;">
          ${gallo.sexo} • ${gallo.color}
        </div>
      </div>
    </div>
  `;
}

function renderGalloCardLista(gallo) {
  const fotoPrincipal = gallo.fotos && Object.values(gallo.fotos)[0] ? Object.values(gallo.fotos)[0] : '';
  
  return `
    <div class="gallo-card" onclick="verDetalleGallo('${gallo.id}')" 
         style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.1); cursor: pointer; transition: transform 0.2s; border-left: 4px solid ${gallo.color}; margin-bottom: 10px;">
      
      <div style="display: flex; align-items: center; padding: 10px;">
        <div style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden; flex-shrink: 0; margin-right: 15px; border: 2px solid ${gallo.color};">
          ${fotoPrincipal ? 
            `<img src="${fotoPrincipal}" style="width:100%;height:100%;object-fit:cover;" />` :
            `<div style="width:100%;height:100%;background:#f0f2f5;display:flex;align-items:center;justify-content:center;color:#65676b;">
              ${gallo.sexo === 'Macho' ? '🐓' : '🐔'}
            </div>`
          }
        </div>
        
        <div style="flex: 1;">
          <div style="font-size: 16px; font-weight: 600; color: #050505;">
            #${gallo.placa}
          </div>
          <div style="font-size: 12px; color: #65676b;">
            ${gallo.sexo} • ${gallo.color} • ${gallo.estado}
          </div>
          <div style="font-size: 12px; color: #667eea;">
            ${gallo.criador}
          </div>
        </div>
        
        <div style="text-align: right;">
          <div style="font-size: 12px; color: #8a8d91;">
            ${new Date(gallo.fechaNacimiento).toLocaleDateString()}
          </div>
          <div style="font-size: 10px; color: #42b72a; background: #f6ffed; padding: 2px 6px; border-radius: 10px; margin-top: 5px;">
            ${gallo.grupo || 'Sin grupo'}
          </div>
        </div>
      </div>
    </div>
  `;
}

// Ver detalle de gallo (MEJORADO)

async function verDetalleGallo(galloId) {
  try {
    // Primero buscar en los gallos del usuario
    let snapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos/${galloId}`).once('value');
    let gallo = snapshot.val();
    let esPublico = false;
    

// Cargar datos de peso
 cargarDatosPesoEnDetalle(galloId);

    // Si no está en usuario, buscar en públicos
    if (!gallo) {
      snapshot = await databasePedigri.ref(`public/gallos/${galloId}`).once('value');
      gallo = snapshot.val();
      if (gallo) {
        gallo.esPublico = true;
        gallo.esComprable = gallo.propietarioOriginal !== currentUser.uid;
        esPublico = true;
      }
    }
    
    if (!gallo) {
      showError("Gallo no encontrado");
      return;
    }
    
    selectedGallo = gallo;
    

    // Asegurar que combates exista
    if (!selectedGallo.combates) {
      selectedGallo.combates = [];
    }
    
    // Cargar información de familia SOLO SI ES DEL USUARIO
    // Para gallos públicos, no cargar familia (puede no tener acceso)
    if (!esPublico || gallo.propietarioOriginal === currentUser.uid) {
      const [madreInfo, padreInfo, hijosInfo, hermanosInfo] = await Promise.all([
        gallo.madreId ? databasePedigri.ref(`users/${currentUser.uid}/gallos/${gallo.madreId}`).once('value') : Promise.resolve(null),
        gallo.padreId ? databasePedigri.ref(`users/${currentUser.uid}/gallos/${gallo.padreId}`).once('value') : Promise.resolve(null),
        cargarHijos(galloId),
        cargarHermanos(gallo)
      ]);
      
      selectedGallo.madre = madreInfo ? madreInfo.val() : null;
      selectedGallo.padre = padreInfo ? padreInfo.val() : null;
      selectedGallo.hijos = hijosInfo;
      selectedGallo.hermanos = hermanosInfo;
    } else {
      // Para gallos públicos de otros, no cargar familia
      selectedGallo.madre = null;
      selectedGallo.padre = null;
      selectedGallo.hijos = [];
      selectedGallo.hermanos = [];
    }
    
     
    renderDetalleGalloModal();
    
    // ✅ AGREGAR: Cargar datos de peso y evaluar salud
    setTimeout(async () => {
      try {
        // Cargar datos de peso
        const pesoSnapshot = await databasePedigri.ref(`users/${currentUser.uid}/pesoGallos/${galloId}`).once('value');
        const datosPeso = pesoSnapshot.val();
        
        if (datosPeso) {
          pesoData = datosPeso;
          // Evaluar salud dinámicamente (igual que en edición)
          evaluarSalud(galloId);
        }
      } catch (error) {
        console.log("No hay datos de peso o error cargándolos:", error);
      }
    }, 500); // Pequeño delay para que se renderice el modal primero
    
  } catch (error) {
    console.error("Error cargando detalle:", error);
    showError("Error al cargar el gallo");
  }
}



// Función para editar un gallo existente
async function editarGallo(galloId) {

  limpiarFormularioRegistro();


  try {
    // Cerrar modal de detalle si está abierto
    cerrarDetalleGallo();
    
    // Obtener datos del gallo
const snapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos/${galloId}`).once('value');
    const gallo = snapshot.val();
    
// Cargar datos de peso
setTimeout(async () => {
    await cargarDatosPesoEnDetalle(galloId);
    actualizarDisplayEdad();
    inicializarEventosPeso();
}, 600);


// AGREGAR ESTO DESPUÉS DE CARGAR LOS DATOS DEL GALLO:
// Cargar estado del checkbox "vender"
const venderCheckbox = document.getElementById('venderCheckbox');
if (venderCheckbox) {
  // Verificar si el gallo está en públicos
  try {
    const publicSnapshot = await databasePedigri.ref(`public/gallos/${galloId}`).once('value');
    venderCheckbox.checked = publicSnapshot.exists();
  } catch (error) {
    console.log("No está en públicos");
    venderCheckbox.checked = false;
  }
}

    if (!gallo) {
      showError("No se encontró el animal para editar");
      return;
    }
    
    // Guardar ID del gallo que estamos editando
    window.galloEditandoId = galloId;
    
    // Abrir modal de registro en modo edición
    openRegistroGalloModal();
    
    // Esperar a que el modal se cargue completamente
    setTimeout(async () => {
      // Cambiar título del modal
      const modalTitle = document.querySelector('#registroGalloModal .modal-title');
      if (modalTitle) {
        modalTitle.textContent = `✏️ Editar Animal #${gallo.placa}`;
      }
      
      // Cambiar texto del botón guardar
      const guardarBtn = document.getElementById('guardarGalloBtn');
      if (guardarBtn) {
        guardarBtn.innerHTML = '💾 Actualizar Animal';
        guardarBtn.setAttribute('onclick', 'actualizarGallo()');
      }
      
      // Llenar campos del formulario
      document.getElementById('placa').value = gallo.placa || '';
      document.getElementById('color').value = gallo.color || '';
      document.getElementById('sexo').value = gallo.sexo || '';
      document.getElementById('estado').value = gallo.estado || '';
      document.getElementById('criadorInput').value = gallo.criador || '';
      document.getElementById('fechaNacimiento').value = gallo.fechaNacimiento || '';
      document.getElementById('pluma').value = gallo.pluma || '';
      document.getElementById('cresta').value = gallo.cresta || '';
      document.getElementById('grupo').value = gallo.grupo || '';
      document.getElementById('notas').value = gallo.notas || '';
      
      // Limpiar combates anteriores
      const listaCombates = document.getElementById('listaCombates');
      if (listaCombates) {
        listaCombates.innerHTML = '';
        contadorCombates = 0; // Resetear contador
      }
      
      // Cargar combates existentes
      if (gallo.combates && gallo.combates.length > 0) {
        console.log(`Cargando ${gallo.combates.length} combates existentes`);



// Cargar peso si existe
if (gallo.ultimoPeso) {
    document.getElementById('ultimoPeso').value = gallo.ultimoPeso;
    if (gallo.ultimoPesoUnidad) {
        document.getElementById('unidadPeso').value = gallo.ultimoPesoUnidad;
    }
    actualizarDisplayPeso(); // Llamar a la función para mostrar conversión
}

        
        // Ordenar combates por fecha (más reciente primero)
        const combatesOrdenados = gallo.combates.sort((a, b) => {
          return new Date(b.fecha) - new Date(a.fecha);
        });
        
        // Crear formularios para cada combate
        combatesOrdenados.forEach((combate, index) => {
          agregarNuevoCombate();
          
          // Llenar datos después de un pequeño delay
          setTimeout(() => {
            const combatesForms = document.querySelectorAll('.combate-form');
            const ultimoForm = combatesForms[combatesForms.length - 1];
            
            if (ultimoForm) {
              ultimoForm.querySelector('.combate-resultado').value = combate.resultado || '';
              ultimoForm.querySelector('.combate-tiempo').value = combate.tiempo || '';
              ultimoForm.querySelector('.combate-fecha').value = combate.fecha || '';
              ultimoForm.querySelector('.combate-torneo').value = combate.torneo || '';
              ultimoForm.querySelector('.combate-observaciones').value = combate.observaciones || '';
            }
          }, 50 * index); // Delay escalonado
        });
        
        // Actualizar estadísticas
        setTimeout(() => {
          actualizarEstadisticas();
        }, combatesOrdenados.length * 50 + 100);
      }
      
      // Cargar fotos existentes
      if (gallo.fotos) {
        const fotos = Object.entries(gallo.fotos);
        fotos.forEach(([key, url], index) => {
          const fotoNum = index + 1;
          const previewId = `foto${fotoNum}Preview`;
          const fileInputId = `foto${fotoNum}`;
          
          const preview = document.getElementById(previewId);
          const fileInput = document.getElementById(fileInputId);
          
          if (preview) {
            preview.innerHTML = `<img src="${url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;" />`;
          }
          
          // Guardar URL de la foto original
          if (fileInput) {
            fileInput.dataset.originalUrl = url;
          }
        });
      }
      

      // Cargar información de padres si existen
   // Cargar información de padres si existen - BUSCAR EN LA BASE DEL USUARIO
if (gallo.madreId) {
  window.madreSeleccionada = gallo.madreId;
  
  // Buscar madre primero en usuario, luego en públicos
  try {
    // 1. Buscar en gallos del usuario
    const madreUsuarioSnapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos/${gallo.madreId}`).once('value');
    
    if (madreUsuarioSnapshot.exists()) {
      const madre = madreUsuarioSnapshot.val();
      if (madre) {
        document.getElementById('madreInput').value = madre.placa;
        mostrarInfoParentesco('madre', madre, false);
      }
    } else {
      // 2. Buscar en gallos públicos (si es un gallo comprado)
      const madrePublicoSnapshot = await databasePedigri.ref(`public/gallos/${gallo.madreId}`).once('value');
      if (madrePublicoSnapshot.exists()) {
        const madre = madrePublicoSnapshot.val();
        if (madre) {
          document.getElementById('madreInput').value = madre.placa;
          mostrarInfoParentesco('madre', madre, true);
          window.madreEsPublica = true;
        }
      }
    }
  } catch (error) {
    console.error("Error cargando madre:", error);
  }
}

if (gallo.padreId) {
  window.padreSeleccionada = gallo.padreId;
  
  // Buscar padre primero en usuario, luego en públicos
  try {
    // 1. Buscar en gallos del usuario
    const padreUsuarioSnapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos/${gallo.padreId}`).once('value');
    
    if (padreUsuarioSnapshot.exists()) {
      const padre = padreUsuarioSnapshot.val();
      if (padre) {
        document.getElementById('padreInput').value = padre.placa;
        mostrarInfoParentesco('padre', padre, false);
      }
    } else {
      // 2. Buscar en gallos públicos (si es un gallo comprado)
      const padrePublicoSnapshot = await databasePedigri.ref(`public/gallos/${gallo.padreId}`).once('value');
      if (padrePublicoSnapshot.exists()) {
        const padre = padrePublicoSnapshot.val();
        if (padre) {
          document.getElementById('padreInput').value = padre.placa;
          mostrarInfoParentesco('padre', padre, true);
          window.padreEsPublica = true;
        }
      }
    }
  } catch (error) {
    console.error("Error cargando padre:", error);
  }
}
      
    }, 500); // Esperar 500ms para que el modal se cargue
    
  } catch (error) {
    console.error("Error al cargar gallo para editar:", error);
    showError("Error al cargar los datos para editar");
  }
}

// Función para actualizar gallo (modo edición)
async function actualizarGallo() {
  const btn = document.getElementById('guardarGalloBtn');
  const errorDiv = document.getElementById('registroError');
  
  // Validaciones básicas
  const placa = document.getElementById('placa').value.trim();
  const color = document.getElementById('color').value;
  const sexo = document.getElementById('sexo').value;
  const estado = document.getElementById('estado').value;
  const criador = document.getElementById('criadorInput').value.trim();
  const fechaNacimiento = document.getElementById('fechaNacimiento').value;
  
  if (!placa || !color || !sexo || !estado || !criador || !fechaNacimiento) {
    errorDiv.textContent = "Todos los campos marcados con * son obligatorios";
    errorDiv.style.display = "block";
    return;
  }
  
  // Validar combates
  const combates = recopilarCombates();
  combates.forEach(combate => {
    if (!combate.resultado || !combate.tiempo || !combate.fecha || !combate.torneo) {
      errorDiv.textContent = "⚠️ Todos los combates deben tener resultado, tiempo, fecha y torneo completos";
      errorDiv.style.display = "block";
      throw new Error("Combates incompletos");
    }
  });
  
  btn.disabled = true;
  btn.textContent = "Actualizando...";
  errorDiv.style.display = "none";
  
  try {
    // Verificar si la placa ya existe (excluyendo el gallo actual)
   // Verificar si la placa ya existe SOLO EN LOS GALLOS DEL USUARIO ACTUAL
const snapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos`)
  .orderByChild('placa')
  .equalTo(placa)
  .once('value');
    
    let placaDuplicada = false;
    if (snapshot.exists()) {
      const gallos = snapshot.val();
      Object.keys(gallos).forEach(id => {
        if (id !== window.galloEditandoId) {
          placaDuplicada = true;
        }
      });
    }
    
    if (placaDuplicada) {
      errorDiv.textContent = "⚠️ Ya existe otro animal con esta placa";
      errorDiv.style.display = "block";
      btn.disabled = false;
      btn.textContent = "💾 Actualizar Animal";
      return;
    }
    
    // Preparar objeto con datos actualizados
    const datosActualizados = {
      placa: placa,
      color: color,
      sexo: sexo,
      estado: estado,
      criador: criador,
      fechaNacimiento: fechaNacimiento,
      pluma: document.getElementById('pluma').value || '',
      cresta: document.getElementById('cresta').value || '',
      grupo: document.getElementById('grupo').value.trim() || '',
      notas: document.getElementById('notas').value.trim() || '',
      marcaje: document.getElementById('marcaje') ? document.getElementById('marcaje').value.trim() : '',
      origenMarcaje: document.getElementById('origenMarcaje') ? document.getElementById('origenMarcaje').value.trim() : '',
      // ⬇️ AGREGAR COMBATES ⬇️
      combates: combates,
      // ⬆️ AGREGAR COMBATES ⬆️
      madreId: window.madreSeleccionada || '',
      padreId: window.padreSeleccionada || '',
      updatedAt: Date.now(),
ultimoPeso: parseFloat(document.getElementById('ultimoPeso').value) || 0,
  ultimoPesoUnidad: document.getElementById('unidadPeso').value || 'g',
  ultimoPesoFecha: Date.now()
    };
    
    // Subir nuevas fotos si se seleccionaron
    const fotoCount = document.querySelectorAll('#fotosContainer .photo-upload').length;
    const nuevasFotos = {};
    
    for (let i = 1; i <= fotoCount; i++) {
      const fileInput = document.getElementById(`foto${i}`);
      if (fileInput && fileInput.files && fileInput.files[0]) {
        // Subir nueva foto
        const file = fileInput.files[0];
        const uploadResult = await uploadToCloudinary(file);
        if (uploadResult.success && uploadResult.url) {
          nuevasFotos[`foto${i}`] = uploadResult.url;
        }
      } else if (fileInput && fileInput.dataset.originalUrl) {
        // Conservar foto original
        nuevasFotos[`foto${i}`] = fileInput.dataset.originalUrl;
      }
    }
    
    if (Object.keys(nuevasFotos).length > 0) {
      datosActualizados.fotos = nuevasFotos;
    }
    
    // Actualizar en Firebase
// Actualizar en Firebase - EN LA BASE DEL USUARIO
await databasePedigri.ref(`users/${currentUser.uid}/gallos/${window.galloEditandoId}`).update(datosActualizados);

// Si el checkbox de vender cambió, actualizar también en público
const venderCheckbox = document.getElementById('venderCheckbox');
if (venderCheckbox) {
  if (venderCheckbox.checked) {
    // Agregar a público
    await databasePedigri.ref(`public/gallos/${window.galloEditandoId}`).set({
      ...datosActualizados,
      id: window.galloEditandoId,
      esPublico: true,
      propietarioOriginal: currentUser.uid,
      fechaPublicacion: Date.now()
    });
  } else {
    // Quitar de público
    await databasePedigri.ref(`public/gallos/${window.galloEditandoId}`).remove();
  }
}

    
    // Actualizar relaciones familiares
    await actualizarRelacionesFamiliares({
      id: window.galloEditandoId,
      ...datosActualizados
    });
    
    // Actualizar estadísticas del criador
    await actualizarEstadisticasCriador(criador);
    
    // Si hubo cambio de criador, actualizar el criador anterior también
    const galloOriginal = await databasePedigri.ref('gallos/' + window.galloEditandoId).once('value');
    const criadorOriginal = galloOriginal.val()?.criador;
    if (criadorOriginal && criadorOriginal !== criador) {
      await actualizarEstadisticasCriador(criadorOriginal);
    }
    
    showSuccess("✅ Animal actualizado correctamente");
    
 // ⬇️ AGREGAR: Limpiar formulario después de actualizar
    limpiarFormularioRegistro();

    // Cerrar modal y recargar
    setTimeout(() => {
      closeRegistroGalloModal();
      cargarGallosUsuario();
      
      // Resetear variable de edición
      window.galloEditandoId = null;
      
      // Restaurar botón original
      const guardarBtn = document.getElementById('guardarGalloBtn');
      if (guardarBtn) {
        guardarBtn.innerHTML = '💾 Guardar Animal';
        guardarBtn.setAttribute('onclick', 'guardarGallo()');
      }
    }, 1000);
    
  } catch (error) {
    console.error("Error actualizando gallo:", error);
    errorDiv.textContent = "Error al actualizar: " + error.message;
    errorDiv.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = "💾 Actualizar Animal";
  }
}


// Función para verificar si un gallo está en públicos
async function esGalloPublico(galloId) {
  try {
    const snapshot = await databasePedigri.ref(`public/gallos/${galloId}`).once('value');
    return snapshot.exists();
  } catch (error) {
    return false;
  }
}

// Función para confirmar eliminación
function confirmarEliminarGallo(galloId, placa) {
  // Crear modal de confirmación
  const modalHTML = `
    <div class="modal-overlay show" id="confirmarEliminarModal">
      <div class="modal" style="max-width: 500px;">
        <div class="modal-header">
          <div class="modal-title">⚠️ Confirmar Eliminación</div>
          <button class="modal-close" onclick="cerrarConfirmarEliminar()">✕</button>
        </div>
        
        <div class="modal-body">
          <div style="text-align: center; padding: 20px;">
            <div style="font-size: 60px; color: #dc3545; margin-bottom: 20px;">
              🗑️
            </div>
            <h3 style="color: #050505; margin-bottom: 10px;">
              ¿Estás seguro de eliminar este animal?
            </h3>
            <p style="color: #65676b; margin-bottom: 20px;">
              Se eliminará permanentemente el animal <strong>#${placa}</strong>.
            </p>
            <p style="color: #ff9800; font-size: 14px; margin-bottom: 20px;">
              ⚠️ Advertencia: Esta acción no se puede deshacer.
            </p>
            
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">
              <label style="display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" id="confirmarEliminarCheckbox" />
                <span style="color: #65676b;">Sí, quiero eliminar este animal permanentemente</span>
              </label>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="file-input-btn" onclick="cerrarConfirmarEliminar()">
            Cancelar
          </button>
          <button class="modal-submit" onclick="eliminarGallo('${galloId}', '${placa}')" 
                  id="eliminarGalloBtn" 
                  style="background: #dc3545; color: white; border: none;"
                  disabled>
            🗑️ Eliminar Permanentemente
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Agregar modal al DOM
  document.getElementById('social-app').insertAdjacentHTML('beforeend', modalHTML);
  
  // Habilitar botón solo cuando se marque el checkbox
  document.getElementById('confirmarEliminarCheckbox').addEventListener('change', function() {
    document.getElementById('eliminarGalloBtn').disabled = !this.checked;
  });
}

// Función para cerrar modal de confirmación
function cerrarConfirmarEliminar() {
  const modal = document.getElementById('confirmarEliminarModal');
  if (modal) modal.remove();
}

// Función para eliminar gallo
async function eliminarGallo(galloId, placa) {
  const btn = document.getElementById('eliminarGalloBtn');
  
  if (!btn) return;
  
  btn.disabled = true;
  btn.textContent = "Eliminando...";
  
  try {
    // 1. Primero obtener datos del gallo DESDE LA BASE DEL USUARIO
    const snapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos/${galloId}`).once('value');
    const gallo = snapshot.val();
    
    if (!gallo) {
      showError("El animal no fue encontrado en tu colección");
      cerrarConfirmarEliminar();
      btn.disabled = false;
      btn.textContent = "🗑️ Eliminar Permanentemente";
      return;
    }
    
    // 2. Actualizar relaciones familiares antes de eliminar
    await actualizarRelacionesDespuesDeEliminar(gallo);
    
    // 3. Eliminar el gallo de la base del usuario
    await databasePedigri.ref(`users/${currentUser.uid}/gallos/${galloId}`).remove();
    
    // 4. También eliminar de público si existe
    try {
      await databasePedigri.ref(`public/gallos/${galloId}`).remove();
    } catch (error) {
      console.log("No estaba en públicos o error eliminando:", error);
    }
    
    // 5. Actualizar estadísticas del criador
    await actualizarEstadisticasCriador(gallo.criador);
    
    // 6. Mostrar éxito
    showSuccess(`✅ Animal #${placa} eliminado correctamente`);
    
    // 7. Cerrar modales
    cerrarConfirmarEliminar();
    cerrarDetalleGallo(); // Si estaba abierto el modal de detalle
    
    // 8. Recargar la lista de gallos
    cargarGallosUsuario();
    
  } catch (error) {
    console.error("Error eliminando gallo:", error);
    showError("❌ Error al eliminar el animal: " + error.message);
    btn.disabled = false;
    btn.textContent = "🗑️ Eliminar Permanentemente";
  }
}

// Función para actualizar relaciones después de eliminar
async function actualizarRelacionesDespuesDeEliminar(galloEliminado) {
  try {
    const updates = {};
    
    // 1. Quitar de hijos de la madre (si la madre existe en el usuario)
    if (galloEliminado.madreId) {
      try {
        const madreSnapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos/${galloEliminado.madreId}`).once('value');
        if (madreSnapshot.exists()) {
          const madre = madreSnapshot.val();
          let hijosMadre = madre.hijos || [];
          const indexMadre = hijosMadre.indexOf(galloEliminado.id);
          if (indexMadre > -1) {
            hijosMadre.splice(indexMadre, 1);
            updates[`users/${currentUser.uid}/gallos/${galloEliminado.madreId}/hijos`] = hijosMadre;
            updates[`users/${currentUser.uid}/gallos/${galloEliminado.madreId}/updatedAt`] = Date.now();
          }
        }
      } catch (error) {
        console.log("Madre no encontrada o error:", error);
      }
    }
    
    // 2. Quitar de hijos del padre (si el padre existe en el usuario)
    if (galloEliminado.padreId) {
      try {
        const padreSnapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos/${galloEliminado.padreId}`).once('value');
        if (padreSnapshot.exists()) {
          const padre = padreSnapshot.val();
          let hijosPadre = padre.hijos || [];
          const indexPadre = hijosPadre.indexOf(galloEliminado.id);
          if (indexPadre > -1) {
            hijosPadre.splice(indexPadre, 1);
            updates[`users/${currentUser.uid}/gallos/${galloEliminado.padreId}/hijos`] = hijosPadre;
            updates[`users/${currentUser.uid}/gallos/${galloEliminado.padreId}/updatedAt`] = Date.now();
          }
        }
      } catch (error) {
        console.log("Padre no encontrado o error:", error);
      }
    }
    
    // 3. Quitar de hermanos de sus hermanos (que estén en el usuario)
    if (galloEliminado.hermanos && galloEliminado.hermanos.length > 0) {
      for (const hermanoId of galloEliminado.hermanos) {
        try {
          const hermanoSnapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos/${hermanoId}`).once('value');
          if (hermanoSnapshot.exists()) {
            const hermano = hermanoSnapshot.val();
            let hermanosActuales = hermano.hermanos || [];
            const indexHermano = hermanosActuales.indexOf(galloEliminado.id);
            if (indexHermano > -1) {
              hermanosActuales.splice(indexHermano, 1);
              updates[`users/${currentUser.uid}/gallos/${hermanoId}/hermanos`] = hermanosActuales;
              updates[`users/${currentUser.uid}/gallos/${hermanoId}/updatedAt`] = Date.now();
            }
          }
        } catch (error) {
          console.log(`Hermano ${hermanoId} no encontrado:`, error);
        }
      }
    }
    
    // 4. Quitar de hijos de este gallo (si tenía hijos en el usuario)
    if (galloEliminado.hijos && galloEliminado.hijos.length > 0) {
      for (const hijoId of galloEliminado.hijos) {
        try {
          const hijoSnapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos/${hijoId}`).once('value');
          if (hijoSnapshot.exists()) {
            const hijo = hijoSnapshot.val();
            
            // Quitar referencia a este padre/madre
            if (galloEliminado.sexo === 'Hembra') {
              updates[`users/${currentUser.uid}/gallos/${hijoId}/madreId`] = '';
            } else if (galloEliminado.sexo === 'Macho') {
              updates[`users/${currentUser.uid}/gallos/${hijoId}/padreId`] = '';
            }
            
            updates[`users/${currentUser.uid}/gallos/${hijoId}/updatedAt`] = Date.now();
          }
        } catch (error) {
          console.log(`Hijo ${hijoId} no encontrado:`, error);
        }
      }
    }
    
    // Ejecutar todas las actualizaciones
    if (Object.keys(updates).length > 0) {
      await databasePedigri.ref().update(updates);
      console.log("✅ Relaciones actualizadas después de eliminar");
    }
    
  } catch (error) {
    console.error("Error actualizando relaciones después de eliminar:", error);
  }
}

// Cargar hijos
async function cargarHijos(galloId) {
  try {
    // Buscar todos los gallos del usuario
    const snapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos`).once('value');
    
    const allGallos = snapshot.val();
    if (!allGallos) return [];
    
    // Filtrar los que tienen este gallo como padre o madre
    return Object.values(allGallos).filter(gallo => 
      gallo.madreId === galloId || gallo.padreId === galloId
    );
  } catch (error) {
    console.error("Error cargando hijos:", error);
    return [];
  }
}

// Cargar hermanos
async function cargarHermanos(gallo) {
  if (!gallo.madreId && !gallo.padreId) return [];
  
  try {
    // Buscar todos los gallos del usuario
    const snapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos`).once('value');
    
    const allGallos = snapshot.val();
    if (!allGallos) return [];
    
    return Object.values(allGallos).filter(otherGallo => 
      otherGallo.id !== gallo.id && // Excluir el gallo actual
      ((gallo.madreId && otherGallo.madreId === gallo.madreId) || 
       (gallo.padreId && otherGallo.padreId === gallo.padreId))
    );
  } catch (error) {
    console.error("Error cargando hermanos:", error);
    return [];
  }
}


// Renderizar modal de detalle (MEJORADO)
function renderDetalleGalloModal() {
  if (!selectedGallo) return;
  
  const fotos = selectedGallo.fotos ? Object.values(selectedGallo.fotos) : [];
  
  const modalHTML = `
    <div class="modal-overlay show" id="galloDetailModal">
      <div class="modal" style="max-width: 1000px; max-height: 95vh; overflow-y: auto;">
        

<div class="modal-header" style="display: flex; justify-content: space-between; align-items: center;">
  <div class="modal-title">🐓 Detalle del Animal #${selectedGallo.placa}</div>
  <div style="display: flex; gap: 10px;">



    <button onclick="editarGallo('${selectedGallo.id}')" 
            style="padding: 8px 16px; background: #ffc107; color: #000; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 5px;">
      ✏️
    </button>
    <button onclick="confirmarEliminarGallo('${selectedGallo.id}', '${selectedGallo.placa}')" 
            style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 5px;">
      🗑️
    </button>
    <button class="modal-close" onclick="cerrarDetalleGallo()" style="background: transparent; border: none; font-size: 20px; cursor: pointer;">✕</button>
  </div>
</div>


 
        
        <div class="modal-body">
          <!-- Galería de fotos -->
        
          ${fotos.length > 0 ? `
    <div style="margin-bottom: 20px; position: relative; height: 450px; background: #f0f2f5; border-radius: 30px; overflow: hidden;">
        ${fotos.map((foto, index) => `
            <img id="img-car-${index}" 
                 src="${foto}" 
                 style="width:100%;height:100%;object-fit:contain;cursor:pointer;display:${index === 0 ? 'block' : 'none'};background:#f0f2f5;" 
                 onclick="ampliarFoto('${foto}')" />
        `).join('')}
        
        ${fotos.length > 1 ? `
            <div style="position:absolute; bottom:10px; left:0; right:0; text-align:center;">
                <div style="background:rgba(0,0,0,0.4); color:white; padding:4px 4px; border-radius:30px; display:inline-flex; align-items:center; gap:15px;">
                    <button onclick="let imgs=document.querySelectorAll('[id^=img-car-]'); let visible=Array.from(imgs).findIndex(img=>img.style.display==='block'); imgs[visible].style.display='none'; let prev=(visible-1+imgs.length)%imgs.length; imgs[prev].style.display='block'" 
                            style="background:white; border:none; width:35px; height:35px; border-radius:50%; cursor:pointer; font-size:18px; font-weight:bold;">←</button>
                    
                    <span style="font-size:14px; min-width:60px;">1 / ${fotos.length}</span>
                    
                    <button onclick="let imgs=document.querySelectorAll('[id^=img-car-]'); let visible=Array.from(imgs).findIndex(img=>img.style.display==='block'); imgs[visible].style.display='none'; let next=(visible+1)%imgs.length; imgs[next].style.display='block'; this.parentElement.querySelector('span').textContent=(next+1)+' / ${fotos.length}'" 
                            style="background:white; border:none; width:35px; height:35px; border-radius:50%; cursor:pointer; font-size:18px; font-weight:bold;">→</button>
                </div>
            </div>
        ` : ''}
    </div>
` : ''}


 <!-- Botón COMPRAR solo para gallos públicos de otros -->
    ${selectedGallo.esPublico && selectedGallo.propietarioOriginal !== currentUser.uid ? `
      <button onclick="comprarGallo('${selectedGallo.id}')" 
              style="padding: 12px 24px; background: linear-gradient(135deg, #42b72a, #2d9224); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 8px; min-width: 200px; order: 1;">
        <span>💰</span> COMPRAR ESTE ANIMAL
      </button>
    ` : ''}


          <!-- Información principal -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px;">





            <!-- Información básica -->
            <div>
              <h4 style="color: #050505; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid #f0f2f5;">Información Básica</h4>
              <div style="background: white; border-radius: 8px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div class="info-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f2f5;">
                  <span style="font-weight: 600; color: #65676b;">Placa:</span>
                  <span style="color: #050505; font-weight: 600;">${selectedGallo.placa}</span>
                </div>
                <div class="info-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f2f5;">
                  <span style="font-weight: 600; color: #65676b;">Color:</span>
                  <span style="color: ${selectedGallo.color}; font-weight: 600; padding: 2px 8px; background: ${selectedGallo.color}20; border-radius: 4px;">${selectedGallo.color}</span>
                </div>
                <div class="info-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f2f5;">
                  <span style="font-weight: 600; color: #65676b;">Sexo:</span>
                  <span style="color: #050505;">${selectedGallo.sexo}</span>
                </div>
                <div class="info-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f2f5;">
                  <span style="font-weight: 600; color: #65676b;">Estado:</span>
                  <span style="color: ${getEstadoColor(selectedGallo.estado)}; font-weight: 600;">${selectedGallo.estado}</span>
                </div>
                <div class="info-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f2f5;">
                  <span style="font-weight: 600; color: #65676b;">Criador:</span>
                  <span style="color: #667eea; font-weight: 600;">${selectedGallo.criador}</span>
                </div>
                <div class="info-row" style="display: flex; justify-content: space-between; padding: 8px 0;">
                  <span style="font-weight: 600; color: #65676b;">Nacimiento:</span>
                  <span style="color: #050505;">${new Date(selectedGallo.fechaNacimiento).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            

            <!-- Características -->
            <div>
              <h4 style="color: #050505; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid #f0f2f5;">Características</h4>
              <div style="background: white; border-radius: 8px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div class="info-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f2f5;">
                  <span style="font-weight: 600; color: #65676b;">Pluma:</span>
                  <span style="color: #050505;">${selectedGallo.pluma || 'No especificado'}</span>
                </div>
                <div class="info-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f2f5;">
                  <span style="font-weight: 600; color: #65676b;">Cresta:</span>
                  <span style="color: #050505;">${selectedGallo.cresta || 'No especificado'}</span>
                </div>
                <div class="info-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f2f5;">
                  <span style="font-weight: 600; color: #65676b;">Grupo:</span>
                  <span style="color: #9254de; font-weight: 600;">${selectedGallo.grupo || 'Sin grupo'}</span>
                </div>
                ${selectedGallo.marcaje ? `
                  <div class="info-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f2f5;">
                    <span style="font-weight: 600; color: #65676b;">Marcaje:</span>
                    <span style="color: #050505;">${selectedGallo.marcaje}</span>
                  </div>
                ` : ''}
                ${selectedGallo.origenMarcaje ? `
                  <div class="info-row" style="display: flex; justify-content: space-between; padding: 8px 0;">
                    <span style="font-weight: 600; color: #65676b;">Origen Marcaje:</span>
                    <span style="color: #050505;">${selectedGallo.origenMarcaje}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
          
          <!-- Notas -->
          ${selectedGallo.notas ? `
            <div style="margin-bottom: 20px;">
              <h4 style="color: #050505; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid #f0f2f5;">Notas/ Vacunas / Enfermedades / Observaciones</h4>
              <div style="background: white; border-radius: 8px; padding: 15px; color: #65676b; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                ${selectedGallo.notas}
              </div>
            </div>
          ` : ''}





        <!-- Botones de acción -->
<div style="text-align: center; margin: 20px 0;">
  <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;">
   
    

    <button onclick="generarQR()" 
            style="padding: 12px 20px; background: #17a2b8; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 8px; min-width: 160px;">
      <span>🔳</span> Generar QR
    </button>
    
    <button onclick="verArbolGenealogico('${selectedGallo.id}')" 
            style="padding: 12px 20px; background: #42b72a; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 8px; min-width: 160px;">
      <span>🌳</span> Árbol Genealógico
    </button>
  </div>
</div>
          

<!-- Control de Peso y Salud -->
<div style="margin-bottom: 20px;">
  <h4 style="color: #050505; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #f0f2f5;">
    ⚖️ Control de Peso y Salud
  </h4>
  
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">


  <!-- Información de Edad -->
<div style="background: white; border-radius: 8px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 2px solid #42b72a;">
  <h5 style="color: #050505; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
    <span>📅 Edad</span>
    <span id="edadDetalleBadge" style="font-size: 12px; padding: 2px 8px; background: #42b72a; color: white; border-radius: 10px;">
      ${calcularEdadYClasificar(selectedGallo.fechaNacimiento).categoria}
    </span>
  </h5>
  <div id="edadDetalleInfo" style="font-size: 14px; color: #65676b;">
    ${(() => {
      const edadInfo = calcularEdadYClasificar(selectedGallo.fechaNacimiento);
      return `
        <div style="margin-bottom: 5px;"><strong>Edad:</strong> ${edadInfo.edad}</div>
        <div style="margin-bottom: 5px;"><strong>Categoría:</strong> ${edadInfo.categoria}</div>
        <div><strong>Descripción:</strong> ${edadInfo.descripcion}</div>
      `;
    })()}
  </div>
</div>

   
<!-- Peso Actual -->
<div style="background: white; border-radius: 8px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 2px solid #667eea;">
  <h5 style="color: #050505; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
    <span>⚖️ Peso Actual</span>
    <span id="pesoDetalleBadge" style="font-size: 12px; padding: 2px 8px; background: #667eea; color: white; border-radius: 10px;">
      ${selectedGallo.ultimoPeso ? selectedGallo.ultimoPeso.toFixed(0) + 'g' : 'No registrado'}
    </span>
  </h5>
  <div id="pesoDetalleInfo" style="font-size: 14px; color: #65676b;">
    ${(() => {
      if (selectedGallo.ultimoPeso) {
        const pesoGramos = selectedGallo.ultimoPeso;
        const pesoOnzas = convertirPeso(pesoGramos, 'g', 'oz');
        const fecha = selectedGallo.ultimoPesoFecha ? 
          new Date(selectedGallo.ultimoPesoFecha).toLocaleDateString() : 'No disponible';
        
        return `
          <div style="margin-bottom: 5px;"><strong>Último peso:</strong> ${pesoGramos.toFixed(1)} g (${pesoOnzas.toFixed(1)} oz)</div>
          <div style="margin-bottom: 5px;"><strong>Fecha:</strong> ${fecha}</div>
          <div><strong>Unidad:</strong> ${selectedGallo.ultimoPesoUnidad || 'g'}</div>
        `;
      } else {
        return '<div>No hay registros de peso</div>';
      }
    })()}
  </div>
</div>

    
    <!-- Estado de Salud -->
    <div id="saludDetalleCard" style="background: white; border-radius: 8px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 2px solid #ffc107; grid-column: 1 / -1;">
      <h5 style="color: #050505; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
        <span>🩺 Estado de Salud (Consulte a un profesional)</span>
      </h5>
      <div id="saludDetalleInfo" style="font-size: 14px; color: #65676b;">
        <!-- Se cargará dinámicamente -->
      </div>
      <div id="recomendacionesDetalle" style="margin-top: 10px; padding: 10px; background: #f6ffed; border-radius: 6px; font-size: 13px; color: #155724;">
        <!-- Recomendaciones se cargarán aquí -->
      </div>
    </div>
  </div>
  
  <!-- Botón para gráfica -->
  <div style="text-align: center; margin-top: 15px;">
    <button onclick="abrirGraficaPeso('${selectedGallo.id}')" 
            style="padding: 12px 24px; background: linear-gradient(135deg, #9254de, #722ed1); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;">
      <span>📈</span> Ver Gráfica de Seguimiento de Peso
    </button>
  </div>
</div>




<!-- Historial de Combates -->
${selectedGallo.combates && selectedGallo.combates.length > 0 ? `
  <div style="margin-bottom: 20px;">
    <h4 style="color: #050505; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #f0f2f5;">
      🥊 Historial (${selectedGallo.combates.length})
    </h4>
    
    <!-- Estadísticas resumen -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
      <div style="background: linear-gradient(135deg, #d4edda, #c3e6cb); padding: 15px; border-radius: 10px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="font-size: 36px; font-weight: bold; color: #155724;">
          ${selectedGallo.combates.filter(c => c.resultado === 'ganado').length}
        </div>
        <div style="font-size: 14px; color: #155724; margin-top: 5px;">✅ Ganados</div>
      </div>
      <div style="background: linear-gradient(135deg, #f8d7da, #f5c6cb); padding: 15px; border-radius: 10px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="font-size: 36px; font-weight: bold; color: #721c24;">
          ${selectedGallo.combates.filter(c => c.resultado === 'perdido').length}
        </div>
        <div style="font-size: 14px; color: #721c24; margin-top: 5px;">❌ Perdidos</div>
      </div>
      <div style="background: linear-gradient(135deg, #fff3cd, #ffeaa7); padding: 15px; border-radius: 10px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="font-size: 36px; font-weight: bold; color: #856404;">
          ${selectedGallo.combates.filter(c => c.resultado === 'tabla').length}
        </div>
        <div style="font-size: 14px; color: #856404; margin-top: 5px;">🤝 Tablas</div>
      </div>
    </div>
    
    <!-- Tabla de combates -->
    <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f8f9fa;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e4e6eb; font-weight: 600; color: #050505;">Fecha</th>
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e4e6eb; font-weight: 600; color: #050505;">Resultado</th>
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e4e6eb; font-weight: 600; color: #050505;">Tiempo</th>
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e4e6eb; font-weight: 600; color: #050505;">Torneo</th>
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e4e6eb; font-weight: 600; color: #050505;">Observaciones</th>
          </tr>
        </thead>
        <tbody>
          ${selectedGallo.combates.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(combate => `
            <tr style="border-bottom: 1px solid #f0f2f5; transition: background 0.2s;" onmouseover="this.style.background='#f8f9fa'">
              <td style="padding: 12px; color: #65676b;">${new Date(combate.fecha).toLocaleDateString()}</td>
              <td style="padding: 12px;">
                <span style="display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; 
                      ${combate.resultado === 'ganado' ? 'background: #d4edda; color: #155724;' : 
                        combate.resultado === 'perdido' ? 'background: #f8d7da; color: #721c24;' : 
                        'background: #fff3cd; color: #856404;'}">
                  ${combate.resultado === 'ganado' ? '✅ Ganado' : 
                    combate.resultado === 'perdido' ? '❌ Perdido' : '🤝 Tabla'}
                </span>
              </td>
              <td style="padding: 12px; color: #050505; font-weight: 600;">${combate.tiempo}</td>
              <td style="padding: 12px; color: #667eea;">${combate.torneo}</td>
              <td style="padding: 12px; color: #65676b; font-size: 12px;">${combate.observaciones || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
` : ''}


          <!-- Información de padres -->
          <div style="margin-bottom: 20px;">
            <h4 style="color: #050505; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid #f0f2f5;">Padres</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
              <!-- Madre -->
              <div>
                <h5 style="color: #65676b; margin-bottom: 10px;">Madre</h5>
                ${selectedGallo.madre ? `
                  <div onclick="verDetalleGallo('${selectedGallo.madre.id}')" 
                       style="background: white; border-radius: 8px; padding: 15px; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 2px solid #ff85c0; transition: transform 0.2s;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <div style="width: 50px; height: 50px; border-radius: 50%; overflow: hidden; border: 2px solid #ff85c0;">
                        ${selectedGallo.madre.fotos && Object.values(selectedGallo.madre.fotos)[0] ? 
                          `<img src="${Object.values(selectedGallo.madre.fotos)[0]}" style="width:100%;height:100%;object-fit:cover;" />` : 
                          `<div style="width:100%;height:100%;background:#fff0f6;display:flex;align-items:center;justify-content:center;color:#ff85c0;">🐔</div>`
                        }
                      </div>
                      <div>
                        <div style="font-weight: 600; color: #050505;">#${selectedGallo.madre.placa}</div>
                        <div style="font-size: 12px; color: #65676b;">${selectedGallo.madre.color} • ${selectedGallo.madre.estado}</div>
                        <div style="font-size: 12px; color: #ff85c0;">Clic para ver detalles</div>
                      </div>
                    </div>
                  </div>
                ` : `
                  <div style="background: #f0f2f5; border-radius: 8px; padding: 20px; text-align: center; color: #8a8d91;">
                    <div style="font-size: 30px; margin-bottom: 10px;">👩</div>
                    <div>Sin madre registrada</div>
                  </div>
                `}
              </div>
              
              <!-- Padre -->
              <div>
                <h5 style="color: #65676b; margin-bottom: 10px;">Padre</h5>
                ${selectedGallo.padre ? `
                  <div onclick="verDetalleGallo('${selectedGallo.padre.id}')" 
                       style="background: white; border-radius: 8px; padding: 15px; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 2px solid #1890ff; transition: transform 0.2s;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <div style="width: 50px; height: 50px; border-radius: 50%; overflow: hidden; border: 2px solid #1890ff;">
                        ${selectedGallo.padre.fotos && Object.values(selectedGallo.padre.fotos)[0] ? 
                          `<img src="${Object.values(selectedGallo.padre.fotos)[0]}" style="width:100%;height:100%;object-fit:cover;" />` : 
                          `<div style="width:100%;height:100%;background:#e6f7ff;display:flex;align-items:center;justify-content:center;color:#1890ff;">🐓</div>`
                        }
                      </div>
                      <div>
                        <div style="font-weight: 600; color: #050505;">#${selectedGallo.padre.placa}</div>
                        <div style="font-size: 12px; color: #65676b;">${selectedGallo.padre.color} • ${selectedGallo.padre.estado}</div>
                        <div style="font-size: 12px; color: #1890ff;">Clic para ver detalles</div>
                      </div>
                    </div>
                  </div>
                ` : `
                  <div style="background: #f0f2f5; border-radius: 8px; padding: 20px; text-align: center; color: #8a8d91;">
                    <div style="font-size: 30px; margin-bottom: 10px;">👨</div>
                    <div>Sin padre registrado</div>
                  </div>
                `}
              </div>
            </div>
          </div>
          
          <!-- Hijos -->
          ${selectedGallo.hijos && selectedGallo.hijos.length > 0 ? `
            <div style="margin-bottom: 20px;">
              <h4 style="color: #050505; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid #f0f2f5;">
                Hijos (${selectedGallo.hijos.length})
              </h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;">
                ${selectedGallo.hijos.map(hijo => `
                  <div onclick="verDetalleGallo('${hijo.id}')" 
                       style="background: white; border-radius: 8px; padding: 10px; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: transform 0.2s; text-align: center;">
                    <div style="width: 60px; height: 60px; border-radius: 50%; overflow: hidden; margin: 0 auto 8px; border: 2px solid ${hijo.color};">
                      ${hijo.fotos && Object.values(hijo.fotos)[0] ? 
                        `<img src="${Object.values(hijo.fotos)[0]}" style="width:100%;height:100%;object-fit:cover;" />` : 
                        `<div style="width:100%;height:100%;background:#f0f2f5;display:flex;align-items:center;justify-content:center;color:#65676b;">
                          ${hijo.sexo === 'Macho' ? '🐓' : '🐔'}
                        </div>`
                      }
                    </div>
                    <div style="font-size: 12px; font-weight: 600; color: #050505;">#${hijo.placa}</div>
                    <div style="font-size: 10px; color: #65676b;">${hijo.sexo} • ${hijo.color}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          <!-- Hermanos -->
          ${selectedGallo.hermanos && selectedGallo.hermanos.length > 0 ? `
            <div style="margin-bottom: 20px;">
              <h4 style="color: #050505; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid #f0f2f5;">
                Hermanos (${selectedGallo.hermanos.length})
              </h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;">
                ${selectedGallo.hermanos.map(hermano => `
                  <div onclick="verDetalleGallo('${hermano.id}')" 
                       style="background: white; border-radius: 8px; padding: 10px; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: transform 0.2s; text-align: center;">
                    <div style="width: 60px; height: 60px; border-radius: 50%; overflow: hidden; margin: 0 auto 8px; border: 2px solid ${hermano.color};">
                      ${hermano.fotos && Object.values(hermano.fotos)[0] ? 
                        `<img src="${Object.values(hermano.fotos)[0]}" style="width:100%;height:100%;object-fit:cover;" />` : 
                        `<div style="width:100%;height:100%;background:#f0f2f5;display:flex;align-items:center;justify-content:center;color:#65676b;">
                          ${hermano.sexo === 'Macho' ? '🐓' : '🐔'}
                        </div>`
                      }
                    </div>
                    <div style="font-size: 12px; font-weight: 600; color: #050505;">#${hermano.placa}</div>
                    <div style="font-size: 10px; color: #65676b;">${hermano.sexo} • ${hermano.color}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('galloDetailModal').innerHTML = modalHTML;
}

// Función para ver árbol genealógico
async function verArbolGenealogico(galloId) {
  try {
    // Cargar datos del gallo principal
    const galloSnapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos/${galloId}`).once('value');
    let gallo = galloSnapshot.val();
    
    // Si no está en usuario, buscar en públicos (si es gallo público que compraste)
    if (!gallo) {
      const publicSnapshot = await databasePedigri.ref(`public/gallos/${galloId}`).once('value');
      gallo = publicSnapshot.val();
      if (!gallo) {
        showError("Gallo no encontrado");
        return;
      }
    }
    
    // Cargar padres (buscar en usuario primero, luego en públicos)
    let madre = null;
    let padre = null;
    
    if (gallo.madreId) {
      // Buscar madre en usuario
      const madreUsuarioSnapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos/${gallo.madreId}`).once('value');
      if (madreUsuarioSnapshot.exists()) {
        madre = madreUsuarioSnapshot.val();
      } else {
        // Buscar madre en públicos
        const madrePublicoSnapshot = await databasePedigri.ref(`public/gallos/${gallo.madreId}`).once('value');
        if (madrePublicoSnapshot.exists()) {
          madre = madrePublicoSnapshot.val();
        }
      }
    }
    
    if (gallo.padreId) {
      // Buscar padre en usuario
      const padreUsuarioSnapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos/${gallo.padreId}`).once('value');
      if (padreUsuarioSnapshot.exists()) {
        padre = padreUsuarioSnapshot.val();
      } else {
        // Buscar padre en públicos
        const padrePublicoSnapshot = await databasePedigri.ref(`public/gallos/${gallo.padreId}`).once('value');
        if (padrePublicoSnapshot.exists()) {
          padre = padrePublicoSnapshot.val();
        }
      }
    }
    
    // Cargar abuelos
    let abuelos = [];
    
    // Abuelos maternos
    if (madre) {
      if (madre.madreId) {
        const abuelaMaternaSnapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos/${madre.madreId}`).once('value');
        if (abuelaMaternaSnapshot.exists()) {
          abuelos.push(abuelaMaternaSnapshot.val());
        } else {
          const abuelaMaternaPublicSnapshot = await databasePedigri.ref(`public/gallos/${madre.madreId}`).once('value');
          if (abuelaMaternaPublicSnapshot.exists()) {
            abuelos.push(abuelaMaternaPublicSnapshot.val());
          }
        }
      }
      
      if (madre.padreId) {
        const abueloMaternoSnapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos/${madre.padreId}`).once('value');
        if (abueloMaternoSnapshot.exists()) {
          abuelos.push(abueloMaternoSnapshot.val());
        } else {
          const abueloMaternoPublicSnapshot = await databasePedigri.ref(`public/gallos/${madre.padreId}`).once('value');
          if (abueloMaternoPublicSnapshot.exists()) {
            abuelos.push(abueloMaternoPublicSnapshot.val());
          }
        }
      }
    }
    
    // Abuelos paternos
    if (padre) {
      if (padre.madreId) {
        const abuelaPaternaSnapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos/${padre.madreId}`).once('value');
        if (abuelaPaternaSnapshot.exists()) {
          abuelos.push(abuelaPaternaSnapshot.val());
        } else {
          const abuelaPaternaPublicSnapshot = await databasePedigri.ref(`public/gallos/${padre.madreId}`).once('value');
          if (abuelaPaternaPublicSnapshot.exists()) {
            abuelos.push(abuelaPaternaPublicSnapshot.val());
          }
        }
      }
      
      if (padre.padreId) {
        const abueloPaternoSnapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos/${padre.padreId}`).once('value');
        if (abueloPaternoSnapshot.exists()) {
          abuelos.push(abueloPaternoSnapshot.val());
        } else {
          const abueloPaternoPublicSnapshot = await databasePedigri.ref(`public/gallos/${padre.padreId}`).once('value');
          if (abueloPaternoPublicSnapshot.exists()) {
            abuelos.push(abueloPaternoPublicSnapshot.val());
          }
        }
      }
    }
    
    // Renderizar modal del árbol genealógico
    renderArbolGenealogicoModal(gallo, madre, padre, abuelos);
    
  } catch (error) {
    console.error("Error cargando árbol genealógico:", error);
    showError("Error al cargar el árbol genealógico");
  }
}

function renderArbolGenealogicoModal(gallo, madre, padre, abuelos) {
  const modalHTML = `
    <div class="modal-overlay show" id="arbolGenealogicoModal">
      <div class="modal" style="max-width: 1200px; max-height: 95vh; overflow-y: auto;">
        <div class="modal-header">
          <div class="modal-title">🌳 Árbol Genealógico de #${gallo.placa}</div>
          <button class="modal-close" onclick="cerrarArbolGenealogico()">✕</button>
        </div>
        
        <div class="modal-body">
          <div style="position: relative; min-height: 600px; padding: 20px; overflow: auto;">
            <!-- Líneas de conexión -->
            <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
              <!-- Líneas de padres -->
              ${madre || padre ? `
                <line x1="50%" y1="100px" x2="33%" y2="200px" stroke="#667eea" stroke-width="2" stroke-dasharray="5,5" />
                <line x1="50%" y1="100px" x2="67%" y2="200px" stroke="#667eea" stroke-width="2" stroke-dasharray="5,5" />
              ` : ''}
              
              <!-- Líneas de abuelos -->
              ${abuelos.length > 0 ? `
                ${madre ? `
                  <line x1="33%" y1="200px" x2="20%" y2="300px" stroke="#ff85c0" stroke-width="2" />
                  <line x1="33%" y1="200px" x2="40%" y2="300px" stroke="#ff85c0" stroke-width="2" />
                ` : ''}
                ${padre ? `
                  <line x1="67%" y1="200px" x2="60%" y2="300px" stroke="#1890ff" stroke-width="2" />
                  <line x1="67%" y1="200px" x2="80%" y2="300px" stroke="#1890ff" stroke-width="2" />
                ` : ''}
              ` : ''}
            </svg>
            
            <!-- Gallo principal -->
            <div style="position: absolute; top: 50px; left: 50%; transform: translateX(-50%);">
              ${renderNodoArbol(gallo, 'GALLO PRINCIPAL')}
            </div>
            
            <!-- Padres -->
            <div style="position: absolute; top: 200px; left: 33%; transform: translateX(-50%);">
              ${madre ? renderNodoArbol(madre, 'MADRE') : renderNodoVacio('MADRE')}
            </div>
            
            <div style="position: absolute; top: 200px; left: 67%; transform: translateX(-50%);">
              ${padre ? renderNodoArbol(padre, 'PADRE') : renderNodoVacio('PADRE')}
            </div>
            
            <!-- Abuelos -->
            <div style="position: absolute; top: 350px; left: 20%; transform: translateX(-50%);">
              ${abuelos[0] ? renderNodoArbol(abuelos[0], 'ABUELA MATERNA') : renderNodoVacio('ABUELA MATERNA')}
            </div>
            
            <div style="position: absolute; top: 350px; left: 40%; transform: translateX(-50%);">
              ${abuelos[1] ? renderNodoArbol(abuelos[1], 'ABUELO MATERNO') : renderNodoVacio('ABUELO MATERNO')}
            </div>
            
            <div style="position: absolute; top: 350px; left: 60%; transform: translateX(-50%);">
              ${abuelos[2] ? renderNodoArbol(abuelos[2], 'ABUELA PATERNA') : renderNodoVacio('ABUELA PATERNA')}
            </div>
            
            <div style="position: absolute; top: 350px; left: 80%; transform: translateX(-50%);">
              ${abuelos[3] ? renderNodoArbol(abuelos[3], 'ABUELO PATERNO') : renderNodoVacio('ABUELO PATERNO')}
            </div>
          </div>
          
         
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('arbolGenealogicoModal').innerHTML = modalHTML;
}

function renderNodoArbol(gallo, titulo) {
  const foto = gallo.fotos && Object.values(gallo.fotos)[0] ? Object.values(gallo.fotos)[0] : '';
  
  return `
    <div onclick="cerrarArbolGenealogico();verDetalleGallo('${gallo.id}')" 
         style="background: white; border-radius: 8px; padding: 3px; width: 100px; text-align: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.15); transition: all 0.3s; border: 2px solid ${gallo.color};"
         onmouseover="this.style.transform='scale(1.05)'" 
         onmouseout="this.style.transform='scale(1)'">
      <div style="font-size: 10px; color: #9254de; font-weight: 600; margin-bottom: 5px;">${titulo}</div>
      <div style="width: 60px; height: 60px; border-radius: 50%; overflow: hidden; margin: 0 auto 8px; border: 2px solid ${gallo.color};">
        ${foto ? 
          `<img src="${foto}" style="width:100%;height:100%;object-fit:cover;" />` : 
          `<div style="width:100%;height:100%;background:#f0f2f5;display:flex;align-items:center;justify-content:center;color:#65676b;">
            ${gallo.sexo === 'Macho' ? '🐓' : '🐔'}
          </div>`
        }
      </div>
      <div style="font-size: 11px; font-weight: 600; color: #050505;">#${gallo.placa}</div>
      <div style="font-size: 9px; color: #65676b;">${gallo.sexo} • ${gallo.color}</div>
      <div style="font-size: 8px; color: ${getEstadoColor(gallo.estado)}; margin-top: 3px;">${gallo.estado}</div>
    </div>
  `;
}

function renderNodoVacio(titulo) {
  return `
    <div style="background: #f0f2f5; border-radius: 8px; padding: 10px; width: 150px; text-align: center; border: 2px dashed #8a8d91;">
      <div style="font-size: 10px; color: #8a8d91; font-weight: 600; margin-bottom: 5px;">${titulo}</div>
      <div style="font-size: 30px; color: #8a8d91; margin: 10px 0;">?</div>
      <div style="font-size: 9px; color: #8a8d91;">No registrado</div>
    </div>
  `;
}

// Funciones auxiliares actualizadas
function getEstadoColor(estado) {
  const colores = {
    'Activo': '#42b72a',
    'Regalado': '#ff9800',
    'Muerto': '#65676b',
    'Vendido': '#667eea'
  };
  return colores[estado] || '#65676b';
}

function actualizarEstadisticas() {
  // Verificar que los elementos existan antes de actualizar
  const elementos = {
    'totalGallos': document.getElementById('totalGallos'),
    'gallosActivos': document.getElementById('gallosActivos'),
    'gallosMachos': document.getElementById('gallosMachos'),
    'gallosHembras': document.getElementById('gallosHembras'),
    'gallosFiltrados': document.getElementById('gallosFiltrados')
  };
  
  // Solo continuar si al menos uno de los elementos principales existe
  if (!elementos.totalGallos && !elementos.gallosActivos) {
    return;
  }
  
  const total = currentGallos.length;
  const activos = currentGallos.filter(g => g.estado === 'Activo').length;
  const machos = currentGallos.filter(g => g.sexo === 'Macho').length;
  const hembras = currentGallos.filter(g => g.sexo === 'Hembra').length;
  
  // Actualizar solo los elementos que existen
  if (elementos.totalGallos) elementos.totalGallos.textContent = total;
  if (elementos.gallosActivos) elementos.gallosActivos.textContent = activos;
  if (elementos.gallosMachos) elementos.gallosMachos.textContent = machos;
  if (elementos.gallosHembras) elementos.gallosHembras.textContent = hembras;
  if (elementos.gallosFiltrados) elementos.gallosFiltrados.textContent = total;
}


async function buscarGallos() {
  const termino = document.getElementById('buscarGalloInput').value.toLowerCase().trim();
  const grid = document.getElementById('gallosGrid');
  
  if (!termino) {
    renderGallosGrid();
    return;
  }
  
  showLoading("🔍 Buscando...");
  
  try {
    // Buscar en gallos del usuario actual
    const usuarioGallos = currentGallos.filter(gallo => 
      gallo.placa.toLowerCase().includes(termino) ||
      gallo.criador.toLowerCase().includes(termino) ||
      gallo.color.toLowerCase().includes(termino) ||
      (gallo.grupo && gallo.grupo.toLowerCase().includes(termino))
    );
    
    // Buscar en gallos públicos
    let publicGallos = [];
    try {
      const publicSnapshot = await databasePedigri.ref('public/gallos').once('value');
      const publicData = publicSnapshot.val();
      
      if (publicData) {
        publicGallos = Object.values(publicData).filter(gallo => 
          (gallo.placa && gallo.placa.toLowerCase().includes(termino)) ||
          (gallo.criador && gallo.criador.toLowerCase().includes(termino)) ||
          (gallo.color && gallo.color.toLowerCase().includes(termino))
        );
        
        // Marcar como públicos
        publicGallos = publicGallos.map(gallo => ({
          ...gallo,
          esPublico: true,
          esComprable: gallo.propietarioOriginal !== currentUser.uid
        }));
      }
    } catch (error) {
      console.log("No hay gallos públicos disponibles");
    }
    
    // Combinar resultados
    const todosResultados = [...usuarioGallos, ...publicGallos];
    
    if (todosResultados.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #65676b;">
          <div style="font-size: 60px; margin-bottom: 20px;">🔍</div>
          <h3 style="color: #050505; margin-bottom: 10px;">No se encontraron animales</h3>
          <p style="color: #8a8d91;">No hay animales que coincidan con "${termino}"</p>
          <button onclick="openRegistroGalloModal()" 
                  style="margin-top: 15px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
            ➕ Registrar nuevo animal
          </button>
        </div>
      `;
    } else {
      // Crear una copia temporal para mostrar
      const tempGallos = currentGallos;
      currentGallos = todosResultados;
      renderGallosGridConPublicos(usuarioGallos, publicGallos);
      currentGallos = tempGallos;
    }
    
  } catch (error) {
    console.error("Error buscando gallos:", error);
    showError("Error en la búsqueda");
  } finally {
    hideLoading();
  }
}

// Nueva función para renderizar con públicos diferenciados
function renderGallosGridConPublicos(usuarioGallos, publicGallos) {
  const grid = document.getElementById('gallosGrid');
  if (!grid) return;
  
  let html = '';
  
  // Mostrar gallos del usuario primero
  if (usuarioGallos.length > 0) {
    html += `
      <div style="grid-column: 1 / -1; margin-bottom: 10px;">
        <h3 style="color: #050505; padding: 10px; background: #f0f8ff; border-radius: 8px;">
          🏠 Tus Animales (${usuarioGallos.length})
        </h3>
      </div>
    `;
    
    usuarioGallos.forEach(gallo => {
      html += renderGalloCard(gallo);
    });
  }
  
  // Mostrar gallos públicos después
  if (publicGallos.length > 0) {
    html += `
      <div style="grid-column: 1 / -1; margin: 20px 0 10px 0;">
        <h3 style="color: #050505; padding: 10px; background: #fff7e6; border-radius: 8px;">
          🌍 Animales Públicos Disponibles (${publicGallos.length})
        </h3>
      </div>
    `;
    
    publicGallos.forEach(gallo => {
      html += renderGalloCardPublico(gallo);
    });
  }
  
  grid.innerHTML = html;
}

// Nueva función para tarjetas de gallos públicos
function renderGalloCardPublico(gallo) {
  const fotoPrincipal = gallo.fotos && Object.values(gallo.fotos)[0] ? Object.values(gallo.fotos)[0] : '';
  const colorBorde = gallo.esComprable ? '#ff9800' : '#9254de';
  
  return `
    <div class="gallo-card" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s; border: 3px solid ${colorBorde}; position: relative;">
      
      <!-- Badge Público -->
      <div style="position: absolute; top: 10px; left: 10px; background: #ff9800; color: white; padding: 4px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; z-index: 5;">
        ${gallo.esComprable ? '💰 DISPONIBLE' : '👑 TUYO'}
      </div>
      
<div onclick="verDetalleGallo('${gallo.id}')" style="cursor: pointer;">

        <!-- Foto -->
        <div style="position: relative; height: 200px; background: #f0f2f5;">
          ${fotoPrincipal ? 
            `<img src="${fotoPrincipal}" style="width:100%;height:100%;object-fit:cover;" />` :
            `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:60px;color:#65676b;">
              ${gallo.sexo === 'Macho' ? '🐓' : '🐔'}
            </div>`
          }
          
          <!-- Estado -->
          <div style="position:absolute; bottom:10px; left:10px; background:${getEstadoColor(gallo.estado)}; color:white; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600;">
            ${gallo.estado}
          </div>
        </div>
        
        <!-- Información -->
        <div style="padding: 15px;">
          <div style="font-size: 18px; font-weight: 600; color: #050505; margin-bottom: 5px;">
            #${gallo.placa}
            ${gallo.esComprable ? '<span style="font-size:12px; color:#ff9800;"> (PÚBLICO)</span>' : ''}
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="font-size: 14px; color: #65676b;">
              ${gallo.sexo} • ${gallo.color}
            </span>
            <span style="font-size: 14px; color: #667eea; font-weight: 600;">
              ${gallo.criador}
            </span>
          </div>
          
          <div style="font-size: 12px; color: #8a8d91;">
            Propietario: ${gallo.propietarioOriginal ? 'Otro usuario' : 'Sistema'}
          </div>
        </div>
      </div>
    </div>
  `;
}


function limpiarFormularioRegistro() {
  // Resetear todas las variables de edición
  window.galloEditandoId = null;
  window.madreSeleccionada = null;
  window.padreSeleccionada = null;
  window.madreEsPublica = false;
  window.padreEsPublica = false;
  nuevoRegistroParentesco = null;
  
  // Limpiar campos del formulario
 const campos = [
  'placa', 'criadorInput', 'fechaNacimiento', 'grupo', 'notas'
];

// Solo limpiar inputs de búsqueda de padres si NO estamos editando
if (!window.galloEditandoId) {
  campos.push('madreInput', 'padreInput');
}
  
  campos.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });
  
  // Limpiar selects
  const selects = ['color', 'sexo', 'estado', 'pluma', 'cresta'];
  selects.forEach(id => {
    const select = document.getElementById(id);
    if (select) select.selectedIndex = 0;
  });
  
  // Limpiar checkbox de vender
  const venderCheckbox = document.getElementById('venderCheckbox');
  if (venderCheckbox) venderCheckbox.checked = false;
  
  // Limpiar fotos
  const fotosContainer = document.getElementById('fotosContainer');
  if (fotosContainer) {
    fotosContainer.innerHTML = `
      <div class="photo-upload" onclick="document.getElementById('foto1').click()" 
           style="border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; height: 180px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <div id="foto1Preview" style="font-size: 30px; color: #667eea;">📷</div>
        <div style="font-size: 12px; color: #65676b; margin-top: 8px;">Frente</div>
        <input type="file" id="foto1" accept="image/*" style="display: none;" onchange="previewPhoto('1', event)" />
      </div>
      
      <div class="photo-upload" onclick="document.getElementById('foto2').click()"
           style="border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; height: 180px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <div id="foto2Preview" style="font-size: 30px; color: #667eea;">📷</div>
        <div style="font-size: 12px; color: #65676b; margin-top: 8px;">Lado</div>
        <input type="file" id="foto2" accept="image/*" style="display: none;" onchange="previewPhoto('2', event)" />
      </div>
      
      <div class="photo-upload" onclick="document.getElementById('foto3').click()"
           style="border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; height: 180px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <div id="foto3Preview" style="font-size: 30px; color: #667eea;">📷</div>
        <div style="font-size: 12px; color: #65676b; margin-top: 8px;">Detalle</div>
        <input type="file" id="foto3" accept="image/*" style="display: none;" onchange="previewPhoto('3', event)" />
      </div>
    `;
  }
  
  // Limpiar información de padres
  const madreInfo = document.getElementById('madreInfo');
  const padreInfo = document.getElementById('padreInfo');
  if (madreInfo) {
    madreInfo.innerHTML = '';
    madreInfo.style.display = 'none';
  }
  if (padreInfo) {
    padreInfo.innerHTML = '';
    padreInfo.style.display = 'none';
  }
  
  // Limpiar resultados de búsqueda
  const resultadosDiv = document.getElementById('resultadosBusquedaParentesco');
  if (resultadosDiv) {
    resultadosDiv.innerHTML = '';
    resultadosDiv.style.display = 'none';
  }
  
  // Limpiar combates
  const listaCombates = document.getElementById('listaCombates');
  if (listaCombates) {
    listaCombates.innerHTML = '';
    contadorCombates = 0;
  }
  
  // Resetear contadores de combates
  document.getElementById('contadorGanados').textContent = '0';
  document.getElementById('contadorPerdidos').textContent = '0';
  document.getElementById('contadorTablas').textContent = '0';
  
  // Limpiar mensajes de error
  const errorDiv = document.getElementById('registroError');
  if (errorDiv) {
    errorDiv.textContent = '';
    errorDiv.style.display = 'none';
  }
}



// Función para actualizar relaciones familiares
async function actualizarRelacionesFamiliares(gallo) {
  try {
    // 1. Actualizar hijos de la madre (si existe)
    if (gallo.madreId) {
      const madreSnapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos/${gallo.madreId}`).once('value');
      if (madreSnapshot.exists()) {
        const madre = madreSnapshot.val();
        let hijosMadre = madre.hijos || [];
        
        // Agregar el nuevo gallo a los hijos de la madre si no está ya
        if (!hijosMadre.includes(gallo.id)) {
          hijosMadre.push(gallo.id);
          await databasePedigri.ref(`users/${currentUser.uid}/gallos/${gallo.madreId}`).update({ 
            hijos: hijosMadre,
            updatedAt: Date.now()
          });
        }
      }
    }
    
    // 2. Actualizar hijos del padre (si existe)
    if (gallo.padreId) {
      const padreSnapshot = await databasePedigri.ref(`users/${currentUser.uid}/gallos/${gallo.padreId}`).once('value');
      if (padreSnapshot.exists()) {
        const padre = padreSnapshot.val();
        let hijosPadre = padre.hijos || [];
        
        // Agregar el nuevo gallo a los hijos del padre si no está ya
        if (!hijosPadre.includes(gallo.id)) {
          hijosPadre.push(gallo.id);
          await databasePedigri.ref(`users/${currentUser.uid}/gallos/${gallo.padreId}`).update({ 
            hijos: hijosPadre,
            updatedAt: Date.now()
          });
        }
      }
    }
    
    // 3. Actualizar hermanos del nuevo gallo
    await actualizarHermanos(gallo);
    
  } catch (error) {
    console.error("❌ Error actualizando relaciones familiares:", error);
  }
}



// Funciones de cierre
function cerrarDetalleGallo() {
  const modal = document.getElementById('galloDetailModal');
  if (modal) modal.innerHTML = '';
}

function cerrarArbolGenealogico() {
  const modal = document.getElementById('arbolGenealogicoModal');
  if (modal) modal.innerHTML = '';
}






// Función para generar código QR
async function generarQR() {
  if (!selectedGallo) {
    showError("No hay gallo seleccionado");
    return;
  }
  
  showLoading("🔄 Generando código QR...");
  
  try {
    // URL del gallo
    const urlGallo = `${window.location.origin}${window.location.pathname}?section=pedigree&galloId=${selectedGallo.id}`;
    
    // Crear modal para mostrar el QR
    const modalHTML = `
      <div class="modal-overlay show" id="qrModal">
        <div class="modal" style="max-width: 400px; text-align: center;">
          <div class="modal-header">
            <div class="modal-title">🔳 Código QR - #${selectedGallo.placa}</div>
            <button class="modal-close" onclick="cerrarQR()">✕</button>
          </div>
          
          <div class="modal-body">
            <!-- Imagen del gallo -->
            <div style="margin-bottom: 15px;">
              ${selectedGallo.fotos && Object.values(selectedGallo.fotos).length > 0 ? 
                `<img src="${Object.values(selectedGallo.fotos)[0]}" 
                      style="width: 150px; height: 150px; object-fit: cover; border-radius: 8px; border: 3px solid #667eea;" />` : 
                `<div style="width: 150px; height: 150px; margin: 0 auto; background: #f0f2f5; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 50px; color: #667eea;">
                  ${selectedGallo.sexo === 'Macho' ? '🐓' : '🐔'}
                </div>`
              }
              <div style="font-weight: 600; color: #050505; margin-top: 10px; font-size: 18px;">
                #${selectedGallo.placa}
              </div>
            </div>
            
 <div style="display: flex; gap: 10px; margin-top: 20px; justify-content: center;">
              <button onclick="descargarQR()" 
                      style="padding: 10px 20px; background: #17a2b8; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                📥 Descargar QR
              </button>
              <button onclick="compartirQR()" 
                      style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                🔗 Compartir
              </button>
            </div>

            <!-- Código QR -->
            <div id="qrCodeContainer" style="margin: 20px 0; padding: 10px; background: white; border-radius: 8px; display: inline-block;">
              <!-- QR se generará aquí -->
            </div>
            
            <!-- Información del enlace -->
            <div style="margin-top: 15px; padding: 10px; background: #f0f8ff; border-radius: 6px; font-size: 12px; word-break: break-all;">
              <div style="font-weight: 600; color: #667eea; margin-bottom: 5px;">Comparte este enlace con la informacion completa:</div>
              <div style="color: #050505;">${urlGallo}</div>
            </div>
            
            <!-- Botones de acción -->
            <div style="display: flex; gap: 10px; margin-top: 20px; justify-content: center;">
              <button onclick="descargarQR()" 
                      style="padding: 10px 20px; background: #17a2b8; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                📥 Descargar QR
              </button>
              <button onclick="compartirQR()" 
                      style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                🔗 Compartir
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('galloDetailModal').insertAdjacentHTML('beforeend', modalHTML);
    
    // Cargar librería QR si no está disponible
    if (typeof QRCode === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
      script.onload = () => generarCodigoQR(urlGallo);
      document.head.appendChild(script);
    } else {
      generarCodigoQR(urlGallo);
    }
    
  } catch (error) {
    console.error("Error generando QR:", error);
    showError("Error al generar código QR");
  } finally {
    hideLoading();
  }
}

// Función auxiliar para generar código QR
// Función auxiliar para generar código QR con información
function generarCodigoQR(url) {
  const qrContainer = document.getElementById('qrCodeContainer');
  if (!qrContainer || !selectedGallo) return;
  
  qrContainer.innerHTML = '';
  
  // Crear contenedor para QR e información
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.gap = '15px';
  
  // Generar QR
  const qrDiv = document.createElement('div');
  qrDiv.id = 'qrCodeCanvas';
  new QRCode(qrDiv, {
    text: url,
    width: 250,  // Aumentado para mejor definición
    height: 250, // Aumentado para mejor definición
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
  
  // Contenedor de información
  const infoDiv = document.createElement('div');
  infoDiv.style.width = '100%';
  infoDiv.style.maxWidth = '400px';
  infoDiv.style.background = '#f8f9fa';
  infoDiv.style.borderRadius = '8px';
  infoDiv.style.padding = '15px';
  infoDiv.style.fontSize = '11px';
  infoDiv.style.color = '#050505';
  
  // Información del gallo en 3 columnas
  const ganados = selectedGallo.combates ? selectedGallo.combates.filter(c => c.resultado === 'ganado').length : 0;
  const perdidos = selectedGallo.combates ? selectedGallo.combates.filter(c => c.resultado === 'perdido').length : 0;
  const tablas = selectedGallo.combates ? selectedGallo.combates.filter(c => c.resultado === 'tabla').length : 0;
  
  infoDiv.innerHTML = `
    <div style="text-align: center; margin-bottom: 10px; font-weight: 600; font-size: 12px; color: #667eea;">
      #${selectedGallo.placa}
    </div>
    
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: left;">
      <div>
        <div style="font-weight: 600; color: #65676b;">Sexo:</div>
        <div>${selectedGallo.sexo || '-'}</div>
      </div>
      <div>
        <div style="font-weight: 600; color: #65676b;">Criador:</div>
        <div>${selectedGallo.criador || '-'}</div>
      </div>
      <div>
        <div style="font-weight: 600; color: #65676b;">Nacimiento:</div>
        <div>${selectedGallo.fechaNacimiento ? new Date(selectedGallo.fechaNacimiento).toLocaleDateString() : '-'}</div>
      </div>
      
      <div>
        <div style="font-weight: 600; color: #65676b;">Pluma:</div>
        <div>${selectedGallo.pluma || '-'}</div>
      </div>
      <div>
        <div style="font-weight: 600; color: #65676b;">Cresta:</div>
        <div>${selectedGallo.cresta || '-'}</div>
      </div>
      <div>
        <div style="font-weight: 600; color: #65676b;">Estado:</div>
        <div>${selectedGallo.estado || '-'}</div>
      </div>
      
      <div>
        <div style="font-weight: 600; color: #65676b;">Ganados:</div>
        <div style="color: #42b72a;">${ganados}</div>
      </div>
      <div>
        <div style="font-weight: 600; color: #65676b;">Perdidos:</div>
        <div style="color: #dc3545;">${perdidos}</div>
      </div>
      <div>
        <div style="font-weight: 600; color: #65676b;">Tablas:</div>
        <div style="color: #ff9800;">${tablas}</div>
      </div>
      
      ${selectedGallo.madreId ? `
        <div>
          <div style="font-weight: 600; color: #65676b;">Madre:</div>
          <div style="color: #ff85c0;">${selectedGallo.madre?.placa || 'Registrada'}</div>
        </div>
      ` : '<div></div>'}
      
      ${selectedGallo.padreId ? `
        <div>
          <div style="font-weight: 600; color: #65676b;">Padre:</div>
          <div style="color: #1890ff;">${selectedGallo.padre?.placa || 'Registrado'}</div>
        </div>
      ` : '<div></div>'}
      
      ${selectedGallo.notas ? `
        <div style="grid-column: 1 / -1; margin-top: 5px; padding-top: 5px; border-top: 1px solid #dee2e6;">
          <div style="font-weight: 600; color: #65676b;">Notas/ Vacunas / Enfermedades / Observaciones</div>
          <div style="font-size: 10px; max-height: 40px; overflow-y: auto;">${selectedGallo.notas}</div>
        </div>
      ` : ''}
    </div>
    
    <div style="text-align: center; margin-top: 10px; font-size: 10px; color: #8a8d91;">
      Generado: ${new Date().toLocaleDateString('es-ES')}
    </div>
  `;
  
  container.appendChild(qrDiv);
  container.appendChild(infoDiv);
  qrContainer.appendChild(container);
}


// Función para descargar QR con imagen del gallo (MEJORADA)
// Función para descargar QR con imagen del gallo (MEJORADA Y MÁS GRANDE)
async function descargarQR() {
  try {
    showLoading("🔄 Generando imagen con QR e información...");
    
    const qrCanvas = document.querySelector('#qrCodeCanvas canvas');
    if (!qrCanvas) {
      throw new Error("No se encontró el código QR");
    }
    
    // Obtener imagen del gallo
    let imagenGallo = null;
    if (selectedGallo.fotos && Object.values(selectedGallo.fotos).length > 0) {
      const fotoUrl = Object.values(selectedGallo.fotos)[0];
      imagenGallo = await cargarImagen(fotoUrl);
    }
    
    // Información del gallo
    const ganados = selectedGallo.combates ? selectedGallo.combates.filter(c => c.resultado === 'ganado').length : 0;
    const perdidos = selectedGallo.combates ? selectedGallo.combates.filter(c => c.resultado === 'perdido').length : 0;
    const tablas = selectedGallo.combates ? selectedGallo.combates.filter(c => c.resultado === 'tabla').length : 0;
    
    // Crear canvas más grande
    const canvasCombinado = document.createElement('canvas');
    const ctx = canvasCombinado.getContext('2d');
    
    // Dimensiones AUMENTADAS
    const padding = 30; // Más padding
    const anchoTotal = 800; // Más ancho
    const altoImagen = 600; // Más alto
    const altoQR = 300; // QR más grande
    const altoInfo = 200; // Espacio para información
    const altoTotal = altoImagen + altoQR + altoInfo + padding * 4;
    
    canvasCombinado.width = anchoTotal;
    canvasCombinado.height = altoTotal;
    
    // Fondo blanco
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, anchoTotal, altoTotal);
    
    // Título principal
    let yPos = padding;
    ctx.fillStyle = '#667eea';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`GALLO #${selectedGallo.placa}`, anchoTotal / 2, yPos);
    
    yPos += 40;
    


    // Dibujar imagen del gallo (centrada y más grande)
    if (imagenGallo) {
      const ratio = imagenGallo.width / imagenGallo.height;
      let anchoDibujo = altoImagen * ratio;
      let altoDibujo = altoImagen;
      
      if (anchoDibujo > anchoTotal - padding * 2) {
        anchoDibujo = anchoTotal - padding * 2;
        altoDibujo = anchoDibujo / ratio;
      }
      
      const xPos = (anchoTotal - anchoDibujo) / 2;
      ctx.drawImage(imagenGallo, xPos, yPos, anchoDibujo, altoDibujo);
      
      // Borde alrededor de la imagen
      ctx.strokeStyle = '#667eea';
      ctx.lineWidth = 3;
      ctx.strokeRect(xPos - 3, yPos - 3, anchoDibujo + 6, altoDibujo + 6);
      
      yPos += altoDibujo + 20;
    } else {
      // Icono si no hay imagen
      ctx.fillStyle = '#f0f2f5';
      ctx.fillRect(padding, yPos, anchoTotal - padding * 2, altoImagen);
      ctx.fillStyle = '#667eea';
      ctx.font = 'bold 60px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(selectedGallo.sexo === 'Macho' ? '🐓' : '🐔', anchoTotal / 2, yPos + altoImagen / 2 + 25);
      yPos += altoImagen + 20;
    }
    


    // Información básica en 3 columnas
    const colWidth = (anchoTotal - padding * 2) / 3;
    const startX = padding;
    
    // Columna 1
    ctx.fillStyle = '#050505';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('INFORMACIÓN', startX, yPos);
    yPos += 25;
    
    ctx.font = '12px Arial';
    ctx.fillStyle = '#65676b';
    ctx.fillText(`Sexo: ${selectedGallo.sexo || '-'}`, startX, yPos);
    yPos += 20;
    ctx.fillText(`Criador: ${selectedGallo.criador || '-'}`, startX, yPos);
    yPos += 20;
    ctx.fillText(`Nacimiento: ${selectedGallo.fechaNacimiento ? new Date(selectedGallo.fechaNacimiento).toLocaleDateString() : '-'}`, startX, yPos);
    
    // Columna 2
    yPos = altoImagen + padding + 60;
    ctx.fillStyle = '#050505';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('CARACTERÍSTICAS', startX + colWidth, yPos);
    yPos += 25;
    
    ctx.font = '12px Arial';
    ctx.fillStyle = '#65676b';
    ctx.fillText(`Pluma: ${selectedGallo.pluma || '-'}`, startX + colWidth, yPos);
    yPos += 20;
    ctx.fillText(`Cresta: ${selectedGallo.cresta || '-'}`, startX + colWidth, yPos);
    yPos += 20;
    ctx.fillText(`Color: ${selectedGallo.color || '-'}`, startX + colWidth, yPos);
    
    // Columna 3
    yPos = altoImagen + padding + 60;
    ctx.fillStyle = '#050505';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('HISTORIAL', startX + colWidth * 2, yPos);
    yPos += 25;
    
    ctx.font = '12px Arial';
    ctx.fillStyle = '#42b72a';
    ctx.fillText(`✅ Ganados: ${ganados}`, startX + colWidth * 2, yPos);
    yPos += 20;
    ctx.fillStyle = '#dc3545';
    ctx.fillText(`❌ Perdidos: ${perdidos}`, startX + colWidth * 2, yPos);
    yPos += 20;
    ctx.fillStyle = '#ff9800';
    ctx.fillText(`🤝 Tablas: ${tablas}`, startX + colWidth * 2, yPos);
    
    yPos = altoImagen + padding + 150;
    
    // Información de padres si existe
    if (selectedGallo.madreId || selectedGallo.padreId) {
      ctx.fillStyle = '#050505';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('INFORMACIÓN DE FAMILIA', anchoTotal / 2, yPos);
      yPos += 25;
      
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      
      if (selectedGallo.madreId) {
        ctx.fillStyle = '#ff85c0';
        ctx.fillText(`Madre: #${selectedGallo.madre?.placa || 'Registrada'}`, padding, yPos);
      }
      
      if (selectedGallo.padreId) {
        ctx.fillStyle = '#1890ff';
        ctx.fillText(`Padre: #${selectedGallo.padre?.placa || 'Registrado'}`, anchoTotal - padding - 200, yPos);
      }
      
      yPos += 30;
    }
    
    // Dibujar código QR (más grande y centrado)
    const qrSize = 300; // QR más grande
    const qrX = (anchoTotal - qrSize) / 2;
    const qrY = yPos;
    
    // Fondo para el QR
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
    ctx.strokeStyle = '#dee2e6';
    ctx.lineWidth = 2;
    ctx.strokeRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
    
    // Dibujar QR
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
    
    yPos += qrSize + 40;
    
    // Texto del enlace
    ctx.fillStyle = '#65676b';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Escanea este código QR para ver todos los detalles del animal', anchoTotal / 2, yPos);
    
    // Pie de imagen
    ctx.fillStyle = '#8a8d91';
    ctx.font = '10px Arial';
    yPos += 20;
    ctx.fillText(`Sistema LEGADO AVICOLA (Premium Cotejos Gallisticos): Contacto: 961 115 03 94 • Generado: ${new Date().toLocaleDateString('es-ES')}`, anchoTotal / 2, yPos);
    
    // Descargar imagen combinada
    const link = document.createElement('a');
    link.download = `QR_Gallo_${selectedGallo.placa}_${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvasCombinado.toDataURL('image/png', 1.0); // Calidad máxima
    link.click();
    
    showSuccess("✅ Imagen con QR e información descargada correctamente");
    
  } catch (error) {
    console.error("Error descargando QR con imagen:", error);
    showError("Error al descargar la imagen combinada");
  } finally {
    hideLoading();
  }
}


// Función auxiliar para cargar imagen
function cargarImagen(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Error cargando imagen'));
    
    // Agregar timestamp para evitar cache
    const timestamp = new Date().getTime();
    const urlConCache = url + (url.includes('?') ? '&' : '?') + '_=' + timestamp;
    img.src = urlConCache;
  });
}



// Función para compartir QR
async function compartirQR() {
  try {
    const qrCanvas = document.querySelector('#qrCodeContainer canvas');
    if (qrCanvas) {
      const blob = await new Promise(resolve => qrCanvas.toBlob(resolve));
      const file = new File([blob], `QR_${selectedGallo.placa}.png`, { type: 'image/png' });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `QR Gallo #${selectedGallo.placa}`,
          text: `Código QR para gallo #${selectedGallo.placa}`
        });
        showSuccess("✅ QR compartido correctamente");
      } else {
        // Fallback: descargar
        descargarQR();
      }
    }
  } catch (error) {
    console.error("Error compartiendo QR:", error);
    showError("Error al compartir QR");
  }
}

// Función para cerrar modal QR
function cerrarQR() {
  const modal = document.getElementById('qrModal');
  if (modal) modal.remove();
}


// Función para compartir gallo
function compartirGallo() {
  if (!selectedGallo) return;
  
  const url = `${window.location.origin}${window.location.pathname}?section=pedigree&galloId=${selectedGallo.id}`;
  navigator.clipboard.writeText(url)
    .then(() => showSuccess("✅ Enlace copiado al portapapeles"))
    .catch(() => showError("Error al copiar enlace"));
}

// Funciones de selección/deselección de padres
function seleccionarMadre(galloId, esPublico = false) {
  window.madreSeleccionada = galloId;
  window.madreEsPublica = esPublico;
  
  if (esPublico) {
    // Cargar de públicos
    databasePedigri.ref(`public/gallos/${galloId}`).once('value').then(snapshot => {
      const gallo = snapshot.val();
      if (gallo) {
        mostrarInfoParentesco('madre', gallo, true);
      }
    });
  } else {
    // Cargar de usuario
    databasePedigri.ref(`users/${currentUser.uid}/gallos/${galloId}`).once('value').then(snapshot => {
      const gallo = snapshot.val();
      if (gallo) {
        mostrarInfoParentesco('madre', gallo, false);
      }
    });
  }
}

function deseleccionarMadre() {
  window.madreSeleccionada = null;
  document.getElementById('madreInfo').innerHTML = '';
  document.getElementById('madreInfo').style.display = 'none';
}

function seleccionarPadre(galloId, esPublico = false) {
  window.padreSeleccionada = galloId;
  window.padreEsPublica = esPublico;

  if (esPublico) {
    // Cargar de públicos
    databasePedigri.ref(`public/gallos/${galloId}`).once('value').then(snapshot => {
      const gallo = snapshot.val();
      if (gallo) {
        mostrarInfoParentesco('padre', gallo, true);
      }
    });
  } else {
    // Cargar de usuario
    databasePedigri.ref(`users/${currentUser.uid}/gallos/${galloId}`).once('value').then(snapshot => {
      const gallo = snapshot.val();
      if (gallo) {
        mostrarInfoParentesco('padre', gallo, false);
      }
    });
  }
}

function deseleccionarPadre() {
  window.padreSeleccionada = null;
  document.getElementById('padreInfo').innerHTML = '';
  document.getElementById('padreInfo').style.display = 'none';
}

// Cargar criadores desde Firebase Pedigri
async function cargarCriadores() {
  if (!currentUser) return;
  
  try {
const snapshot = await databasePedigri.ref(`users/${currentUser.uid}/criadores`).once('value');
    const criadores = snapshot.val();
    const datalist = document.getElementById('criadoresList');
    
    if (datalist && criadores) {
      datalist.innerHTML = Object.values(criadores).map(criador => 
        `<option value="${criador.nombre}">${criador.nombre}</option>`
      ).join('');
    }
  } catch (error) {
    console.log("No hay criadores registrados aún");
  }
}


// Función para agregar nuevo criador
async function agregarCriador() {
  const input = document.getElementById('criadorInput');
  const nombre = input.value.trim();
  
  if (!nombre) {
    showError("Ingresa el nombre del criador");
    input.focus();
    return;
  }
  
  if (!currentUser) {
    showError("Debes iniciar sesión para agregar criadores");
    return;
  }
  
  try {
    // Verificar si el criador ya existe
  const snapshot = await databasePedigri.ref(`users/${currentUser.uid}/criadores`)
  .orderByChild('nombre')
  .equalTo(nombre)
  .once('value');
    
    if (snapshot.exists()) {
      showSuccess(`El criador "${nombre}" ya existe`);
      return;
    }
    
    // Crear nuevo criador
const newCriadorRef = databasePedigri.ref(`users/${currentUser.uid}/criadores`).push();

    await newCriadorRef.set({
      id: newCriadorRef.key,
      nombre: nombre,
      userId: currentUser.uid,
      totalGallos: 0,
      gallosActivos: 0,
      gallosMachos: 0,
      gallosHembras: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    
    showSuccess(`✅ Criador "${nombre}" agregado correctamente`);
    
    // Actualizar la lista de criadores
    await cargarCriadores();
    
    // Seleccionar el criador recién creado
    input.value = nombre;
    
  } catch (error) {
    console.error("❌ Error agregando criador:", error);
    showError("Error al agregar criador: " + error.message);
  }
}

// Funciones para previsualizar fotos
function previewPhoto(numero, event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const maxSizeMB = 5;
  const fileSizeMB = file.size / (1024 * 1024);
  
  if (fileSizeMB > maxSizeMB) {
    showError(`La imagen es muy grande (${fileSizeMB.toFixed(1)}MB). Máximo: ${maxSizeMB}MB`);
    event.target.value = '';
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById(`foto${numero}Preview`);
    preview.innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;" />`;
  };
  reader.readAsDataURL(file);
}

// Funciones para ampliar foto
function ampliarFoto(url) {
  const modalHTML = `
    <div class="modal-overlay show" id="ampliarFotoModal" style="background: rgba(0,0,0,0.9); z-index: 2000;">
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;">
        <img src="${url}" style="max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 8px;" />
        <button onclick="document.getElementById('ampliarFotoModal').remove()" 
                style="position: absolute; top: 20px; right: 20px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 20px; cursor: pointer;">
          ✕
        </button>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Funciones responsivas
function checkResponsive() {
  const mobileControls = document.querySelector('.mobile-controls');
  if (window.innerWidth <= 768) {
    if (mobileControls) mobileControls.style.display = 'block';
    
    // Ajustar grid para móviles
    const grid = document.getElementById('gallosGrid');
    if (grid) {
      if (currentViewMode === 'grid') {
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
      } else if (currentViewMode === 'grid-small') {
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
      }
    }
  } else {
    if (mobileControls) mobileControls.style.display = 'none';
  }
}

// Inicializar controles responsivos
setTimeout(() => {
  checkResponsive();
  window.addEventListener('resize', checkResponsive);
}, 1000);

// Cuando se carga la pantalla de pedigree
if (currentScreen === 'products') {
  setTimeout(() => {
    cargarGallosUsuario();
    checkResponsive();
  }, 500);
}



// Función para comprar un gallo público
async function comprarGallo(galloId) {
  if (!currentUser) {
    showError("Debes iniciar sesión para comprar");
    return;
  }
  
  showLoading("🔄 Procesando compra...");
  
  try {
    // 1. Obtener datos del gallo público
    const snapshot = await databasePedigri.ref(`public/gallos/${galloId}`).once('value');
    const galloPublico = snapshot.val();
    
    if (!galloPublico) {
      showError("Este animal ya no está disponible para la venta");
      hideLoading();
      return;
    }
    
    // 2. Crear nueva ID única para el usuario
    const nuevoGalloId = generateUniqueId();
    
    // 3. Crear objeto para el usuario (copia del público)
    const galloComprado = {
      ...galloPublico,
      id: nuevoGalloId,
      userId: currentUser.uid,
      esPublico: false,
      compradoDe: galloPublico.propietarioOriginal || galloPublico.userId,
      fechaCompra: Date.now(),
      madreId: galloPublico.madreId || '',
      padreId: galloPublico.padreId || '',
      hijos: galloPublico.hijos || [],
      hermanos: galloPublico.hermanos || [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    // 4. Guardar en la base del usuario
    await databasePedigri.ref(`users/${currentUser.uid}/gallos/${nuevoGalloId}`).set(galloComprado);
    
    // 5. ELIMINAR de públicos (¡ESTO ES LO QUE PIDES!)
    await databasePedigri.ref(`public/gallos/${galloId}`).remove();
    
    showSuccess("✅ ¡Animal comprado exitosamente! Ahora está en tu colección.");
    
    // 6. Recargar y cerrar
    setTimeout(() => {
      cerrarDetalleGallo();
      cargarGallosUsuario();
      hideLoading();
      
      // Recargar búsqueda si hay término activo
      const buscarInput = document.getElementById('buscarGalloInput');
      if (buscarInput && buscarInput.value) {
        buscarGallos();
      }
    }, 1500);
    
  } catch (error) {
    console.error("Error comprando gallo:", error);
    showError("Error al procesar la compra: " + error.message);
    hideLoading();
  }
}


window.esGalloPublico = esGalloPublico;

window.comprarGallo = comprarGallo;

// Agrega estas líneas
window.generarQR = generarQR;
window.descargarQR = descargarQR;
window.compartirQR = compartirQR;
window.cerrarQR = cerrarQR;
window.generarCodigoQR = generarCodigoQR;



window.agregarNuevoCombate = agregarNuevoCombate;
window.eliminarCombate = eliminarCombate;
window.actualizarEstadisticas = actualizarEstadisticas;
window.validarTiempo = validarTiempo;


// En la lista de funciones globales (al final del archivo)
window.editarGallo = editarGallo;
window.actualizarGallo = actualizarGallo;
window.confirmarEliminarGallo = confirmarEliminarGallo;
window.eliminarGallo = eliminarGallo;
window.cerrarConfirmarEliminar = cerrarConfirmarEliminar;

// Declarar funciones globales
window.openRegistroGalloModal = openRegistroGalloModal;
window.closeRegistroGalloModal = closeRegistroGalloModal;
window.previewPhoto = previewPhoto;
window.agregarCriador = agregarCriador;
window.buscarParentesco = buscarParentesco;
window.seleccionarMadre = seleccionarMadre;
window.seleccionarPadre = seleccionarPadre;
window.deseleccionarMadre = deseleccionarMadre;
window.deseleccionarPadre = deseleccionarPadre;
window.guardarGallo = guardarGallo;
window.verDetalleGallo = verDetalleGallo;
window.cerrarDetalleGallo = cerrarDetalleGallo;
window.cerrarArbolGenealogico = cerrarArbolGenealogico;
window.compartirGallo = compartirGallo;
window.verArbolGenealogico = verArbolGenealogico;
window.ampliarFoto = ampliarFoto;
window.buscarGallos = buscarGallos;
window.cambiarVista = cambiarVista;
window.cambiarOrden = cambiarOrden;
window.toggleFiltros = toggleFiltros;
window.aplicarFiltros = aplicarFiltros;
window.limpiarFiltros = limpiarFiltros;
window.agregarMasFotos = agregarMasFotos;
window.eliminarFoto = eliminarFoto;
window.agregarNuevaOpcion = agregarNuevaOpcion;
window.registroRapidoParentesco = registroRapidoParentesco;



window.cargarCriadores = cargarCriadores;
window.cargarGrupos = cargarGrupos;
window.cerrarRegistroRapido = cerrarRegistroRapido;
window.guardarRegistroRapido = guardarRegistroRapido;
window.deseleccionarMadre = deseleccionarMadre;
window.deseleccionarPadre = deseleccionarPadre;


window.actualizarRelacionesFamiliares = actualizarRelacionesFamiliares;
window.actualizarEstadisticasCriador = actualizarEstadisticasCriador;
window.guardarGrupo = guardarGrupo;


  
  
  
