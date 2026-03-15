export let db = {
    personajes: {},
    hechizos: { nodos: [], nodosOcultos: [], inventario: [], string: [] }
};

export let estadoUI = {
    vistaActual: 'catalogo', personajeSeleccionado: null, esAdmin: false,
    filtroRol: 'Todos', filtroAct: 'Todos',
    filtrosGrimorio: { afinidad: 'Todos', busqueda: '' },
    filtrosGestion: { afinidad: 'Todos', clase: 'Todos', busqueda: '' },
    filtrosAprendizaje: { afinidad: 'Todos', clase: 'Todos', busqueda: '' },
    filtrosAll: { afinidad: 'Todos', clase: 'Todos', estado: 'Todos', busqueda: '' },
    restarHexAsignacion: true,
    logOP: { descubiertos: [], aprendidos: [], hexGastado: 0 },
    colaCambios: { agregar: [], quitar: [], toggleConocido: [], hexCasts: [], stats: {} }
};
