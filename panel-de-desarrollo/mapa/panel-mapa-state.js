// ============================================================
// panel-mapa-state.js — Estado local y Cola de Cambios
// ============================================================

export const mapaDevState = {
    // ── Datos cargados desde el mapa ────────────────────────
    nodosDB: [],      // Copia en memoria de los nodos del mapa (estadoMapa.nodos)
    enlacesDB: [],    // Copia en memoria de los enlaces
    coloresDB: {},    // Copia de window.mapaColores

    // ── Vista del panel ──────────────────────────────────────
    vistaActiva: 'nodos',   // 'nodos' | 'enlaces' | 'colores'
    busqueda: '',
    filtroAfinidad: '',     // Filtrar lista de nodos por afinidad
    filtroVisibilidad: 'todos', // 'todos' | 'conocidos' | 'ocultos'

    // ── 🔥 COLAS DE CAMBIOS (Staging) 🔥 ──────────────────────
    // Visibilidad: { [hechizoId]: true|false }
    colaVisibilidad: {},

    // Posiciones: { [hechizoId]: { x, y } }
    colaPosiciones: {},

    // Metadatos de nodos editados: { [hechizoId]: { campo: valor } }
    colaMetadatos: {},

    // Nuevos nodos: [{ id, nombre, hex, clase, afinidad, ... }]
    colaNuevosNodos: [],

    // Nuevos enlaces: [{ source, target }]
    colaNuevosEnlaces: [],

    // Eliminados: { nodos: Set<hechizoId>, enlaces: [{ source, target }] }
    colaEliminados: { nodos: new Set(), enlaces: [] },

    // Colores de afinidad modificados: { [afinidad]: { t, b } }
    colaColores: {},

    // ── Log de sesión ────────────────────────────────────────
    // [{ msg: string }]  — sin PJ asociado (son cambios globales al mapa)
    logSesion: []
};
