// ============================================================
// region-state.js — Estado global del Editor de Mapa Regional
// ============================================================

export const SUPABASE_URL = 'https://gkscqurkpyteusqyspsu.supabase.co';
export const BUCKET       = 'imagenes-hex';
export const STORAGE_URL  = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}`;

// ── Tamaño del hexágono (radio del circuncentro) ─────────────
export const HEX_SIZE = 48; // px, ajustable

// ── Tipos de prop ────────────────────────────────────────────
export const PROP_TIPOS = ['terreno', 'estructura', 'entidad', 'elemento', 'objeto'];

// ── Capas del mapa ───────────────────────────────────────────
export const CAPAS = ['back', 'mid', 'over'];

// ── Estado de la cámara ──────────────────────────────────────
export const camara = {
    x: 0, y: 0,
    zoom: 1.0,
    minZoom: 0.2,
    maxZoom: 3.0
};

// ── Estado del editor ────────────────────────────────────────
export const editor = {
    activo: false,           // Solo OP
    herramienta: 'agregar',  // 'agregar'|'borrar'|'seleccionar'|'region'
    capaActual: 'back',
    propSeleccionado: null,  // { id, tipo, nombre, imagen }
    seleccion: new Set(),    // Set de "q,r" keys seleccionados
    modoRegion: false,
    brushSize: 1,            // 1 = un hex, 2 = radio 1 (+6), etc.
    colorActual: '#4488cc',  // Color para la herramienta colorear
    opacidadPincel: 0.7,     // Opacidad al colorear
};

// ── Mapa principal ───────────────────────────────────────────
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
    parentHex: null
};

// ── Props (biblioteca de imágenes/tiles) ────────────────────
export let props = {};

// ── NPCs del mapa (instancias colocadas) ─────────────────────
export let npcsMapaLocal = {};

// ── Datos de personajes y misiones (leídos de DB) ────────────
export let personajesDB   = [];   
export let misionesActivas = [];  

// ── UI state ─────────────────────────────────────────────────
export const ui = {
    panelActual:  'props',    
    filtroTipo:   'todos',
    busqueda:     '',
    filtroImgs:   'todos',    // 'todos' | 'con' | 'sin'
    hoveredHex:   null,       
    selectedHex:  null,       
    selectedRegion: null,     
    modoAgregar:  false,      
};

// ── Estructura de un HexData ─────────────────────────────────
export function crearHexData() {
    return {
        back:       [],   
        mid:        [],
        over:       [],
        region:     null, 
        misiones:   [],   
        npcs:       [],   
        color:      null  
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
