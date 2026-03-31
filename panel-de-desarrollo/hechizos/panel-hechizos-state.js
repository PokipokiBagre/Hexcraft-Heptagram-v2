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
        // cobrarHex: null = sigue global | true/false = override individual
        // noFalla: el hechizo siempre acierta, ignora NC (sin overcast)
        // ajusteCosto: modificador de costo HEX (positivo=sobrecosto, negativo=descuento)
        filas: Array.from({ length: 50 }, () => ({ dado: '', nombre: '', afinidad: '', cant: 1, cobrarHex: null, noFalla: false, contrarrestado: false, ajusteCosto: 0 })),
        datalistModo: 'local'
    },
    
    cobrarAuto: false,     // Global: ¿cobrar hex al castear?
    mostrarEfectos: false, // Global: ¿imprimir efectos en log?
    cobrarAlAsignar: false,
    
    vexGastadoPorPj: {}, 

    colaAsignaciones: {}, 
    colaVisibilidad: {}, 
    logCasteosSession: [] 
};
