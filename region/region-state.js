// ============================================================
// region-state.js — Estado global del Editor de Mapa Regional (Isométrico 3D)
// ============================================================

export const SUPABASE_URL = 'https://gkscqurkpyteusqyspsu.supabase.co';
export const BUCKET       = 'imagenes-hex';
export const STORAGE_URL  = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}`;

// ── Tamaño del hexágono y Elevación ──────────────────────────
export const HEX_SIZE = 48; // px, ajustable

// ── Tipos de prop ────────────────────────────────────────────
export const PROP_TIPOS = ['terreno', 'estructura', 'entidad', 'elemento', 'objeto'];

// ── Capas del mapa ──────────────────────────────────────────
export const CAPAS = ['back', 'mid', 'over'];

// ── Estado de la cámara (Ahora más estática, pitch fijo) ─────
export const camara = {
    x: 0, y: 0,
    zoom: 1.0,
    minZoom: 0.1,
    maxZoom: 2.5,
    PITCH_SCALE: 0.65,      // Factor de squash isométrico
    elevationScale: 0.5,    // Escala vertical para la elevación
};

// ── Estado del editor ────────────────────────────────────────
export const editor = {
    activo: false,           // Solo OP
    herramienta: 'agregar',  // 'agregar'|'borrar'|'seleccionar'|'region'
    capaActual: 'back',
    selectedPropId: null,    // ID del prop a agregar
    selectedNpcId:  null,    // ID del NPC seleccionado para editar
    selectedHexKey: null,    // Key del hex seleccionado para info
    seleccion: new Set(),    // Set de "q,r" keys seleccionados (editor)
    brushSize: 1,            // 1 = un hex, 2 = radio 1 (+6), etc.
    colorActual: '#4488cc',  // Color para la herramienta colorear
    opacidadPincel: 0.7,     // Opacidad al colorear
    ruidoDensidad: 0.35,     // Densidad para aplicar ruido
};

// ── Mapa principal ──────────────────────────────────────────
export let mapaActual = {
    id:     'mundo',
    nombre: 'Mundo',
    ancho:  40,
    alto:   30,
    hexes:  {},            // "q,r" → HexData
    regiones: {},          // regionId → RegionData
    interiors: {},         
    esInterior: false,
    parentId: null,
    parentHex: null,
    bg_imagen: null,       // URL de imagen de fondo
};

// ── Props y NPCs locales (instancias cargadas) ───────────────
export let props = {};
export let npcsMapaLocal = {};

// ── Datos externos (personajes y misiones de DB) ────────────
export let personajesDB    = [];   // <-- ¡AQUÍ ESTABA EL ERROR! (personnagesDB)
export let misionesActivas = [];  

// ── UI state ─────────────────────────────────────────────────
export const ui = {
    panelActual:  'props',    
    filtroTipo:   'todos',
    filtroPropSinImagen: false,  // Filtro "faltantes" en imágenes
    busqueda:     '',
    hoveredHex:   null,       
    selectedRegion: null,     
    modoPintar:   false,       // Estado de clic arrastrado
};

// ── Estructura de un HexData ─────────────────────────────────
export function crearHexData() {
    return {
        back:       [],   // Lista de IDs de props o colores (COLOR:#rgb:op)
        mid:        [],
        over:       [],
        region:     null, // ID de la región
        misiones:   [],   // Lista de IDs de misiones locales
        color:      null,  // Color de base
        opacidad:   null, // Opacidad de base
        elevation:  0,    // Altura (entero)
    };
}

// ── Estructura de una Región ─────────────────────────────────
export function crearRegion(id) {
    return {
        id,
        nombre:      'Nueva Región',
        color:       '#4488cc',
        opacidad:    0.35,
        controlador: '',      
        accesible:   true,
        misiones:    [],
        hexes:       [],      
        tieneInterior: false,
        interiorId:  null
    };
}
