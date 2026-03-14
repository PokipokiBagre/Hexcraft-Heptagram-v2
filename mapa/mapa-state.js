export const estadoMapa = {
    esAdmin: false,
    modoVisual: 'descubiertos', // MODO POR DEFECTO
    jugadorActivo: 'Todos',
    jugadores: [],
    inventario: {},
    vistaJugador: {
        posesiones: new Set(),
        aprendibles: new Set(),
        rastreo: new Set()
    },
    nodos: [],
    enlaces: [],
    math: { originX: 0, originY: 0, maxXDist: 1, maxYDist: 1 }, 
    camara: { x: window.innerWidth/2, y: window.innerHeight/2, zoom: 0.8 },
    interaccion: {
        isDraggingBg: false,
        draggedNode: null,
        hoveredNode: null,
        selectedNode: null, 
        lastMouseX: 0,
        lastMouseY: 0
    }
};

window.mapaColores = {}; // Se llenará dinámicamente desde Google Sheets
export const COLOR_AFINIDAD = window.mapaColores;

export const ESTETICA = {
    lineaDescubierta: 'rgba(210, 190, 230, 0.2)', 
    lineaMostaza: 'rgba(212, 175, 55, 0.3)',       
    lineaRosa: 'rgba(200, 60, 100, 0.25)',         
    lineaPrecedente: 'rgba(177, 156, 217, 0.5)',   
    lineaSaliente: 'rgba(236, 213, 154, 0.5)'      
};

export const COLORES_JUGADOR = {
    posesionMorada: 'rgba(150, 131, 200, 0.6)', 
    doradoInmediato: 'rgba(236, 213, 154, 0.7)', 
    doradoMedio: 'rgba(212, 196, 146, 0.5)',     
    doradoTenue: 'rgba(188, 180, 156, 0.4)',     
    doradoRastreo: 'rgba(160, 150, 130, 0.3)',   
    fondoNeutro: 'rgba(60, 60, 65, 0.25)'        
};
