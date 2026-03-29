// ============================================================
// panel-mapa-state.js — Estado local, Colas de Cambios y Editor
// ============================================================

export const mapaDevState = {
    // ── Datos del mapa ───────────────────────────────────────
    nodosDB:   [],
    enlacesDB: [],
    coloresDB: {},

    // ── Vista del panel ──────────────────────────────────────
    vistaActiva:       'nodos',   // 'nodos' | 'lista' | 'colores'
    busqueda:          '',
    filtroAfinidad:    '',
    filtroVisibilidad: 'todos',   // 'todos' | 'conocidos' | 'ocultos'
    
    // 🌟 NUEVOS FILTROS
    filtroPersonaje:   null,      
    filtroRolPj:       'jugadores', // 'jugadores' | 'npcs'

    // ── Estado del editor (canvas) ───────────────────────────
    herramienta:       'cursor', 
    seleccionMultiple: new Set(),
    tempLink:          null,      
    boxStart:          null,      
    boxCurrent:        null,      

    // ── 🔥 Colas de cambios (Staging) ───────────────────────
    colaVisibilidad: {},
    colaPosiciones: {},
    colaMetadatos: {},
    colaNuevosNodos: [],   
    colaNuevosEnlaces: [],
    colaEliminados: { nodos: new Set(), enlaces: [] },
    colaColores: {},
    logSesion: []
};
