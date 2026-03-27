// ============================================================
// panel-hechizos-state.js — Estado local y Cola de Cambios
// ============================================================

export const hzState = {
    catalogoDB: [], 
    inventariosDB: {}, 
    
    vistaActiva: 'castear', 
    busquedaAsignar: "",
    
    // 🌟 FORMULARIO DE CASTEO EXACTO A TU SISTEMA ORIGINAL 🌟
    casteoManual: {
        numFilas: 3,
        // Ahora con las 4 propiedades: dado, nombre, afinidad, cant
        filas: Array.from({ length: 50 }, () => ({ dado: '', nombre: '', afinidad: '', cant: 1 })),
        datalistModo: 'local'
    },
    
    cobrarAuto: true,
    mostrarEfectos: true,
    cobrarAlAsignar: true,
    
    vexGastadoPorPj: {}, 

    colaAsignaciones: {}, 
    colaVisibilidad: {}, 
    logCasteosSession: [] 
};
