// ============================================================
// panel-stats-state.js — Estado local y Cola de Cambios
// ============================================================

export const stState = {
    statsDB: {},      
    estadosDB: [],    
    
    vistaActiva: 'hex', 
    subVistaAfinidades: 'totales', 
    subVistaVida: 'totales',
    logAsistencia: "",
    
    notasAfinidad: {},
    notasOcultasSet: new Set(),
    
    // 🔥 COLAS DE CAMBIOS (Staging) 🔥
    colaStats: {},         
    colaNotas: {},         // 🌟 Cola para las notas de afinidades
    colaEstadosConfig: {}, 
    colaBorrarEstados: []  
};

export const AFINIDADES_LISTA = ["fisica", "energetica", "espiritual", "mando", "psiquica", "oscura"];
