// ============================================================
// panel-clonar-state.js — Estado del Panel Clonar
// ============================================================

export const clonarState = {
    // ── Selección de personajes ───────────────────────────────
    pjOrigen:          null,
    pjDestino:         null,
    filtroOrigenRol:   'jugadores',
    filtroDestinoRol:  'jugadores',
    busquedaOrigen:    '',
    busquedaDestino:   '',

    // ── Módulos a clonar ──────────────────────────────────────
    modulos: {
        statsBase:  true,   // Afinidades base + vida/daño base
        buffsEfectos: false, // hechizos/hechizosEfecto/buffs de stats
        hex:        false,
        estados:    false,
        hechizos:   true,
        objetos:    false,
        imagen:     false,
    },

    // ── Opciones de hechizos ──────────────────────────────────
    hechizosMode:          'todos',   // 'todos' | 'selectivo'
    hechizosSeleccionados: new Set(),
    cobrarHexHechizos:     false,
    hechizoBusqueda:       '',

    // ── Opciones de objetos ───────────────────────────────────
    objetosMode:     'todos',   // 'todos' | 'selectivo'
    objetosCantidades: {},       // { nombre: cantidad override }

    // ── Resultado del último clonado ──────────────────────────
    feedback:       null,       // { ok: bool, msg: string }
    ejecutando:     false,
};
