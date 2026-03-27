// ============================================================
// panel-stats-state.js — Estado local y Cola de Cambios (Stats)
// ============================================================

export const stState = {
    statsDB: {},      // Copia de statsGlobal
    estadosDB: [],    // Copia de listaEstados
    
    // Estado de la Interfaz
    vistaActiva: 'hex', // 'hex', 'vida', 'afinidades', 'estados'
    logAsistencia: "",
    
    // 🔥 LAS COLAS DE CAMBIOS (Staging) 🔥
    colaStats: {},         // Ej: { "Gnoma": { "hex": 1200, "afinidadesBase.fisica": 10 } }
    colaEstadosConfig: {}  // Ej: { "nuevo_veneno": { nombre, tipo, color_bg, color_border, descripcion } }
};

export const AFINIDADES_LISTA = ["fisica", "energetica", "espiritual", "mando", "psiquica", "oscura"];
