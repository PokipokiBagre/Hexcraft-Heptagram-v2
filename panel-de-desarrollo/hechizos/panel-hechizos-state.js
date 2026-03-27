// ============================================================
// panel-hechizos-state.js — Estado local y Cola de Cambios
// ============================================================

export const hzState = {
    catalogoDB: [], 
    inventariosDB: {}, 
    
    vistaActiva: 'castear', 
    busquedaAsignar: "",
    
    // 🌟 ESTADO DEL FORMULARIO DE CASTEO MULTIPLE 🌟
    casteoManual: {
        numFilas: 3,
        filas: Array.from({ length: 50 }, () => ({ nombre: '', cant: 1 })),
        datalistModo: 'local' // 'local' (Grimorio) o 'global' (Todos)
    },
    
    cobrarAuto: false,
    mostrarEfectos: true,
    cobrarAlAsignar: false,
    
    vexGastadoPorPj: {}, 

    // 🔥 COLAS DE CAMBIOS (Staging) 🔥
    colaAsignaciones: {}, 
    colaVisibilidad: {}, // Para Ocultar/Hacer Público
    logCasteosSession: [] 
};
