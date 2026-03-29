// ============================================================
// panel-stats-state.js — Estado local y Cola de Cambios
// ============================================================

export const stState = {
    statsDB: {},      
    estadosDB: [],    
    
    vistaActiva: 'hex', 
    subVistaAfinidades: 'totales', // Sub-tab dentro de la vista afinidades
    logAsistencia: "",
    
    // Notas por afinidad: { pjNombre: { 'afinidadesBase.fisica': 'nota...' } }
    notasAfinidad: {},
    // Set de flatKeys con el input de nota desplegado: "pj|flatKey"
    notasAbiertasSet: new Set(),
    
    // 🔥 COLAS DE CAMBIOS (Staging) 🔥
    colaStats: {},         
    colaEstadosConfig: {}, 
    colaBorrarEstados: []  // 🌟 NUEVO: Estados que serán borrados de la BD
};

export const AFINIDADES_LISTA = ["fisica", "energetica", "espiritual", "mando", "psiquica", "oscura"];
