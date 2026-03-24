// ============================================================
// region-state.js — Estado global del Editor de Mapa Regional
// ============================================================

export const SUPABASE_URL = 'https://gkscqurkpyteusqyspsu.supabase.co';
export const BUCKET       = 'imagenes-hex';
export const STORAGE_URL  = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}`;

// ── Tamaño del hexágono y Elevación ──────────────────────────
export const HEX_SIZE = 48; // px, ajustable

// ── Offset visual de la capa OVER (Map Planes) ───────────────
export const OVER_OFFSET_X = 0;                 // Alineado perfectamente al centro
export const OVER_OFFSET_Y = -(HEX_SIZE * 2.4); // Desfase vertical puro (hacia arriba)

// ── Tipos de prop ────────────────────────────────────────────
export const PROP_TIPOS = ['terreno', 'estructura', 'entidad', 'elemento', 'objeto'];

// ── Capas del mapa ──────────────────────────────────────────
export const CAPAS = ['back', 'mid', 'over'];

// ── Estado de la cámara ─────────────────────────────────────
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
    opacidadPincel: 1.0,     // Opacidad al colorear
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
export let personajesDB    = [];   
export let misionesActivas = [];  

// ── UI state ─────────────────────────────────────────────────
export const ui = {
    panelActual:  'props',    
    filtroTipo:   'todos',
    filtroPropSinImagen: false,  
    busqueda:     '',
    hoveredHex:   null,       
    selectedRegion: null,     
    modoPintar:   false,       
};

// ── Estructura de un HexData ─────────────────────────────────
export function crearHexData() {
    return {
        back:       [],   
        mid:        [],
        over:       [],
        region:     null, 
        misiones:   [],   
        color:      null,  
        opacidad:   null, 
        elevation:  0,    
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
