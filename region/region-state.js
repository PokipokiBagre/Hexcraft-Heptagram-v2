// ============================================================
// region-state.js — Estado global del Editor de Mapa Regional
// ============================================================

import { currentConfig } from '../hex-auth.js';
export const BUCKET      = 'imagenes-hex';
export const STORAGE_URL = currentConfig.storageUrl;

export const HEX_SIZE = 48;
export const OVER_OFFSET_X = 0;                 
export const OVER_OFFSET_Y = -(HEX_SIZE * 1.5); 

export const PROP_TIPOS = ['terreno', 'estructura', 'entidad', 'elemento', 'objeto'];
export const CAPAS = ['back', 'mid', 'over'];

export const camara = {
    x: 0, y: 0, zoom: 1.0, minZoom: 0.1, maxZoom: 2.5,
    PITCH_SCALE: 0.65, elevationScale: 0.5,
};

export const editor = {
    activo: false,
    herramienta: 'agregar', 
    capaActual: 'back',
    selectedPropId: null,
    selectedNpcId:  null,
    selectedHexKey: null,
    seleccion: new Set(),
    brushSize: 1,
    colorActual: '#4488cc',
    opacidadPincel: 1.0,
    ruidoActivo: false,  // 🌟 NUEVO: Estado del check de ruido
    ruidoDensidad: 0.35, // % de hexágonos que se pintan con el ruido
};

export let mapaActual = {
    id: 'mundo', nombre: 'Mundo', ancho: 40, alto: 30,
    hexes: {}, regiones: {}, interiors: {}, esInterior: false,
    parentId: null, parentHex: null, bg_imagen: null,
};

export let props = {};
export let npcsMapaLocal = {};
export let personajesDB    = [];   
export let misionesActivas = [];  

export const ui = {
    panelActual:  'props',    
    filtroTipo:   'todos',
    filtroPropSinImagen: false,  
    busqueda:     '',
    hoveredHex:   null,       
    selectedRegion: null,     
    modoPintar:   false,       
};

export function crearHexData() {
    return { back: [], mid: [], over: [], region: null, misiones: [], color: null, opacidad: null, elevation: 0 };
}

export function crearRegion(id) {
    return {
        id, nombre: 'Nueva Región', color: '#4488cc', opacidad: 0.35, controlador: '',      
        accesible: true, misiones: [], hexes: [],      
        tieneInterior: true, 
        interiorId: `interior_${id}`
    };
}
