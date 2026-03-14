export let statsGlobal = {};
export let listaEstados = []; 
export let estadoUI = {
    vistaActual: 'catalogo',
    personajeSeleccionado: null,
    esAdmin: false,
    filtroRol: 'Todos',
    filtroAct: 'Todos',
    party: [null, null, null, null, null, null], 
    hexLog: {},
    colaCambios: { stats: {} } // Inicializado aquí para máxima seguridad
};

export let dbExtra = {
    objetosCount: {},   
    inventarios: {},    // Array de nombres de objetos por PJ
    infoObjetos: {},    // Rarezas
    hechizos: { inventario: [], nodos: [], nodosOcultos: [] }
};

export function guardar() {
    localStorage.setItem('hex_stats_v2', JSON.stringify({ 
        stats: statsGlobal,
        party: estadoUI.party
    }));
}
