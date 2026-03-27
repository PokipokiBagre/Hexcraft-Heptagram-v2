// ============================================================
// panel-stats-state.js — Estado local y Cola de Cambios
// ============================================================

export const stState = {
    statsDB: {},      
    estadosDB: [],    
    
    vistaActiva: 'hex', 
    logAsistencia: "",
    
    // 🔥 COLAS DE CAMBIOS (Staging) 🔥
    colaStats: {},         
    colaEstadosConfig: {}, 
    colaBorrarEstados: []  // 🌟 NUEVO: Estados que serán borrados de la BD
};

export const AFINIDADES_LISTA = ["fisica", "energetica", "espiritual", "mando", "psiquica", "oscura"];
