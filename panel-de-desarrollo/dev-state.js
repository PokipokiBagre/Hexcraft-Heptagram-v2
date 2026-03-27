// ============================================================
// dev-state.js — Estado Global del Panel Máster
// ============================================================

export const STORAGE_URL = 'https://gkscqurkpyteusqyspsu.supabase.co/storage/v1/object/public/imagenes-hex';

export const devState = {
    pjSeleccionado: null,
    listaPersonajes: [],
    filtroRolActual: 'jugadores', // 'jugadores' o 'npcs'
    busquedaTexto: ''
};

// Función global de normalización de strings
export const norm = (str) => str.toString().trim().toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
    .replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/\s+/g,'_')
    .replace(/[^a-z0-9_]/g,'');
