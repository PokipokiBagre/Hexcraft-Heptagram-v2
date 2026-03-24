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
export const CAPAS = ['background', 'mid', 'over'];

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
    herramienta: 'pintar',   // 'pintar'|'borrar'|'seleccionar'|'region'|'interior'
    capaActual: 'background',
    propSeleccionado: null,  // { id, tipo, nombre, imagen, capa }
    seleccion: new Set(),    // Set de "q,r" keys seleccionados
    modoRegion: false,
    brushSize: 1,            // 1 = un hex, 2 = radio 1 (+6), 3 = radio 2, etc.
};

// ── Mapa principal ───────────────────────────────────────────
// hexes[q][r] = { background:[...propIds], mid:[...], over:[...], region: regionId|null }
export let mapaActual = {
    id:     'mundo',
    nombre: 'Mundo',
    ancho:  40,
    alto:   30,
    hexes:  {},            // "q,r" → HexData
    regiones: {},          // regionId → RegionData
    interiors: {},         // regionId → MapaInterior
    esInterior: false,
    parentId: null,
    parentHex: null
};

// ── Props (biblioteca de imágenes/tiles) ────────────────────
// props[id] = { id, nombre, tipo, capa, imagen (url storage), forma:'hex'|'doble'|'triple', ancho:1, alto:1 }
export let props = {};

// ── NPCs del mapa ────────────────────────────────────────────
// npcsMapaLocal[id] = { id, nombre, tipo:'sistema'|'jugador', icono, hex:'q,r', capa:'mid'|'over', desc, stats:{} }
export let npcsMapaLocal = {};

// ── Datos de personajes y misiones (leídos de DB) ────────────
export let personajesDB   = [];   // jugadores + npcs_jugador activos
export let misionesActivas = [];  // misiones con estado 1 o 2

// ── UI state ─────────────────────────────────────────────────
export const ui = {
    panelActual:  'props',    // 'props'|'regiones'|'npcs'|'misiones'|'imagenes'
    filtroTipo:   'todos',
    filtroCapa:   'todos',
    busqueda:     '',
    hoveredHex:   null,       // "q,r"
    selectedHex:  null,       // "q,r"
    selectedRegion: null,     // regionId
    modoPintar:   false,      // Mouse down pintando
};

// ── Estructura de un HexData ─────────────────────────────────
export function crearHexData() {
    return {
        background: [],   // array de propIds
        mid:        [],
        over:       [],
        region:     null, // regionId
        misiones:   [],   // misionIds activas
        npcs:       []    // npcIds presentes
    };
}

// ── Estructura de una Región ─────────────────────────────────
export function crearRegion(id) {
    return {
        id,
        nombre:      'Nueva Región',
        color:       '#4488cc',
        opacidad:    0.35,
        controlador: '',      // nombre del personaje/facción
        accesible:   true,
        misiones:    [],
        hexes:       [],      // ["q,r", ...]
        tieneInterior: false,
        interiorId:  null
    };
}
