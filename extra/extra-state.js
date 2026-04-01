// ============================================================
// extra-state.js — Estado del módulo Extra
// ============================================================

import { currentConfig } from '../hex-auth.js';

export const BUCKET      = 'imagenes-hex';
export const SUPABASE_URL = currentConfig.dbUrl;
export const STORAGE_URL  = currentConfig.storageUrl;

export let estadoUI = {
    tab:          'personajes',
    filtro:       'todos',
    busqueda:     '',
    uploadTarget: null
};

export let itemsPersonajes = [];
export let itemsObjetos    = [];
export let itemsInterfaz   = [];
