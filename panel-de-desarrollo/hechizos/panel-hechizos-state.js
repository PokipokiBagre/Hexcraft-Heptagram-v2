// ============================================================
// panel-hechizos-state.js — Estado local y Cola de Cambios
// ============================================================

export const hzState = {
    catalogoDB: [], 
    inventariosDB: {}, // pjKey: [array de IDs de hechizos]
    
    // UI State
    vistaActiva: 'local', // 'local' (Conocidos) o 'global' (Todos)
    busquedaLocal: "",
    busquedaGlobal: "",
    
    // Toggles de Casteo Rápido (Globales para todo el panel)
    cobrarAuto: true,
    mostrarEfectos: true,
    
    // Memoria Volátil de Sesión (Para calcular el consumo VEX -> HEX)
    vexGastadoPorPj: {}, 

    // 🔥 COLAS DE CAMBIOS (Staging) 🔥
    colaAsignaciones: {}, // pjKey: { hechizoId: true (agregar) / false (quitar) }
    logCasteosSession: [] // Registro temporal para el Log Global
};
