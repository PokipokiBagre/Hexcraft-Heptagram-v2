// ============================================================
// panel-stats-state.js — Estado local y Cola de Cambios
// ============================================================

export const stState = {
    statsDB: {},      
    estadosDB: [],    
    
    vistaActiva: 'hex', 
    subVistaAfinidades: 'totales', 
    subVistaVida: 'totales', // 🌟 Sub-tab de Vida
    logAsistencia: "",
    
    notasAfinidad: {},
    // 🌟 Set que almacena qué notas ESTÁN OCULTAS. Si no está aquí, se muestra.
    notasOcultasSet: new Set(),
    
    colaStats: {},         
    colaEstadosConfig: {}, 
    colaBorrarEstados: []  
};

export const AFINIDADES_LISTA = ["fisica", "energetica", "espiritual", "mando", "psiquica", "oscura"];
