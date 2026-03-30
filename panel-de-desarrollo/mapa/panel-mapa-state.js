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

    // ── Estado del editor (canvas) ───────────────────────────
    herramienta:       'cursor',  // 'cursor' | 'enlace' | 'eliminar-enlace'
    seleccionMultiple: new Set(),
    tempLink:          null,      // { source: nodo, endX, endY }
    boxStart:          null,      // { x, y } en coords mundo
    boxCurrent:        null,      // { x, y } en coords mundo

    // ── 🔥 Colas de cambios (Staging) ───────────────────────

    // Visibilidad: { [hechizoId]: true|false }
    colaVisibilidad: {},

    // Posiciones: { [hechizoId]: { x, y } }
    // (también se refleja en colaMetadatos para el guardado)
    colaPosiciones: {},

    // Metadatos editados: { [hechizoId]: { campo: valor, ... } }
    colaMetadatos: {},

    // IDs de nodos nuevos (el estado vivo está en nodosDB)
    colaNuevosNodos: [],   // ['Hechizo 5', 'Hechizo 6', ...]

    // Nuevos enlaces: [{ source: id, target: id }]
    colaNuevosEnlaces: [],

    // Eliminados
    colaEliminados: { nodos: new Set(), enlaces: [] },

    // Colores de afinidad: { [afinidad]: { t, b } }
    colaColores: {},

    // ── Log de sesión ────────────────────────────────────────
    logSesion: []
};
