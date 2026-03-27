// ============================================================
// obj-state.js — ESTADO GLOBAL DE OBJETOS
// ============================================================

export let invGlobal = {}; 
export let objGlobal = {}; 
export let statsGlobal = {}; 
export let historial = [];
export let propuestasGlobal = []; // Objetos pendientes de aprobación 
export let eqpGlobal = {}; // 🌟 NUEVO: Rastreo de objetos equipados

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
    localStorage.setItem('hex_obj_v4', JSON.stringify({ 
        inv: invGlobal, obj: objGlobal, his: historial, modoSync: estadoUI.modoSincronizado, eqp: eqpGlobal 
    }));
}

export function cargarLocal() {
    try {
        const data = JSON.parse(localStorage.getItem('hex_obj_v4'));
        if (data) {
            if(data.inv) { for(let k in invGlobal) delete invGlobal[k]; Object.assign(invGlobal, data.inv); }
            if(data.obj) { for(let k in objGlobal) delete objGlobal[k]; Object.assign(objGlobal, data.obj); }
            if(data.eqp) { for(let k in eqpGlobal) delete eqpGlobal[k]; Object.assign(eqpGlobal, data.eqp); } // 🌟 CARGAR EQP
            if(data.his) { historial.length = 0; historial.push(...data.his); }
            if(data.modoSync !== undefined) estadoUI.modoSincronizado = data.modoSync;
        }
    } catch(e) { console.error("Error leyendo caché:", e); }
}
