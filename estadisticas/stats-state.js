import { currentConfig } from '../hex-auth.js';

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
    colaCambios: { stats: {} } 
};

export let dbExtra = {
    objetosCount: {},   
    inventarios: {},    
    infoObjetos: {},    
    hechizos: { inventario: [], nodos: [], nodosOcultos: [] }
};

export function guardar() {
    // Solo guardamos la party de forma aislada
    localStorage.setItem(`hex_party_${currentConfig.id}`, JSON.stringify(estadoUI.party));
}
