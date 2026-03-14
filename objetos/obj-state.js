export let invGlobal = {}; 
export let objGlobal = {}; 
export let statsGlobal = {}; // NUEVO: Para guardar si son Jugadores/Activos
export let historial = []; 
export let estadoUI = {
    vistaActual: 'grilla',
    jugadorInv: null, 
    filtroRar: 'Todos', 
    filtroMat: 'Todos',
    filtroRol: 'Jugadores', // Valor por defecto
    filtroAct: 'Activos',   // Valor por defecto
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
        inv: invGlobal, obj: objGlobal, his: historial, modoSync: estadoUI.modoSincronizado, colaCambios: estadoUI.colaCambios 
    })); 
}
