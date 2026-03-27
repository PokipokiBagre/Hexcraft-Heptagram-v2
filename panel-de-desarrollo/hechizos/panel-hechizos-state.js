// ============================================================
// panel-hechizos-state.js — Estado local y Cola de Cambios
// ============================================================

export const hzState = {
    catalogoDB: [], 
    inventariosDB: {}, 
    
    // UI State: 'castear' o 'asignar'
    vistaActiva: 'castear', 
    busquedaCastear: "",
    busquedaAsignar: "",
    
    // Toggles de Casteo Rápido 
    cobrarAuto: true,
    mostrarEfectos: true,
    cobrarAlAsignar: true,
    
    // Memoria Volátil de Sesión (Para calcular el consumo VEX -> HEX)
    vexGastadoPorPj: {}, 

    // 🔥 COLAS DE CAMBIOS (Staging) 🔥
    colaAsignaciones: {}, 
    logCasteosSession: [] 
};
