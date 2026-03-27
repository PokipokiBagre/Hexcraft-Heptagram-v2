// ============================================================
// panel-hechizos-state.js — Estado local y Cola de Cambios
// ============================================================

export const hzState = {
    catalogoDB: [], 
    inventariosDB: {}, 
    
    vistaActiva: 'castear', 
    busquedaAsignar: "",
    
    casteoManual: {
        numFilas: 3,
        filas: Array.from({ length: 50 }, () => ({ dado: '', nombre: '', afinidad: '', cant: 1 })),
        datalistModo: 'local'
    },
    
    cobrarAuto: false,     // 🌟 Modificado: Por defecto en false
    mostrarEfectos: false, // 🌟 Modificado: Por defecto en false
    cobrarAlAsignar: false,
    
    vexGastadoPorPj: {}, 

    colaAsignaciones: {}, 
    colaVisibilidad: {}, 
    logCasteosSession: [] 
};
