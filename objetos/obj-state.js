// ============================================================
// obj-state.js — ESTADO GLOBAL DE OBJETOS
// ============================================================

import { currentConfig } from '../hex-auth.js';

export let invGlobal = {}; 
export let objGlobal = {}; 
export let statsGlobal = {}; 
export let historial = [];
export let propuestasGlobal = []; // Objetos pendientes de aprobación 
export let eqpGlobal = {}; // 🌟 Rastreo de objetos equipados

export let estadoUI = {
    vistaActual: 'grilla',
    jugadorInv: null, 
    filtroRar: 'Todos', 
    filtroMat: 'Todos',
    filtroRol: 'Jugadores', 
    filtroAct: 'Activos',   
    busquedaOP: "", 
    busquedaCat: "", 
    busquedaInv: "", 
    logCopy: "", 
    esAdmin: false,
    cambiosSesion: {},
    modoSincronizado: true,
    partyLoot: [], 
    partyMult: 1, 
    transOrigen: null, 
    transDestino: null,
    transMult: 1,
    editMult: 1,
    editModo: 1,
    colaCambios: {}, 
    
    resetCacheOrder: true,
    cachedSortKeys: null, 
    cachedInvOrders: {}   
};

export function guardar() { 
    // 🌟 Guardamos con el ID dinámico de la campaña
    localStorage.setItem(`hex_obj_${currentConfig.id}`, JSON.stringify({ 
        inv: invGlobal, 
        obj: objGlobal, 
        his: historial, 
        modoSync: estadoUI.modoSincronizado, 
        eqp: eqpGlobal 
    }));
}

export function cargarLocal() {
    try {
        // 🌟 Leemos con el ID dinámico de la campaña
        const data = JSON.parse(localStorage.getItem(`hex_obj_${currentConfig.id}`));
        if (data) {
            if(data.inv) { for(let k in invGlobal) delete invGlobal[k]; Object.assign(invGlobal, data.inv); }
            if(data.obj) { for(let k in objGlobal) delete objGlobal[k]; Object.assign(objGlobal, data.obj); }
            if(data.eqp) { for(let k in eqpGlobal) delete eqpGlobal[k]; Object.assign(eqpGlobal, data.eqp); } 
            if(data.his) { historial.length = 0; historial.push(...data.his); }
            if(data.modoSync !== undefined) estadoUI.modoSincronizado = data.modoSync;
        }
    } catch(e) { console.error("Error leyendo caché:", e); }
}

export const TIPOS_OBJ = ["Consumible", "Herramienta", "Accesorio", "Equipo", "Equipamiento", "-"];
export const MATERIALES_OBJ = ["Cristal", "Metal", "Orgánico", "Sagrado", "-"];
export const RAREZAS_OBJ = ["Común", "Raro", "Legendario", "-"];
