// ============================================================
// extra-state.js — Estado del módulo Extra
// ============================================================

export const BUCKET = 'imagenes-hex';
export const SUPABASE_URL = 'https://gkscqurkpyteusqyspsu.supabase.co'; // Asegúrate de mantener tu URL real
export const STORAGE_URL  = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}`;

export let estadoUI = {
    tab:          'personajes', // 'personajes' | 'objetos' | 'interfaz'
    filtro:       'todos',      // 'todos' | 'falta' | 'ok'
    busqueda:     '',
    uploadTarget: null          // { keyNorm, tipoIcono, nombre }
};

export let itemsPersonajes = [];
export let itemsObjetos    = [];
export let itemsInterfaz   = []; // <-- NUEVO
