// ============================================================
// panel-personaje-state.js — Estado del Panel Personajes
// ============================================================

export const pjEditorState = {
    tabActiva:       'jugadores', // 'jugadores' | 'npcs'
    busquedaNPC:     '',
    mostrarFormCrear: false,

    // Upload activo
    uploadTarget: null,  // { nombre, keyNorm }
    uploadFase:   null,  // null | 'subiendo' | 'ok' | 'error'
    uploadMsg:    '',

    // Edición de nombre inline
    editandoNombre: null, // nombre del pj siendo renombrado
};
