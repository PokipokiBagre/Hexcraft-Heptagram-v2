// ============================================================
// panel-mapa-ui.js — Canvas editor embebido (Panel Dev)
// v2: colores fijos (lila/dorado), buscador, selector de personaje,
//     asignación de hechizos integrada, sin tab de colores.
// ============================================================

import { mapaDevState } from './panel-mapa-state.js';
import {
    getNodosFiltrados,
    getAfinidadesUnicas,
    getVisibilidadActual,
    toggleVisibilidadNodo,
    setBusquedaMapa,
    setFiltroAfinidad,
    setFiltroVisibilidad,
    setVistaMapaDev,
    contarCambiosPendientes,
    crearNodoDev,
    crearEnlaceDev,
    eliminarEnlaceDev,
    eliminarNodosDev,
    actualizarDatoNodoDev
} from './panel-mapa-logic.js';

import { hzState } from '../hechizos/panel-hechizos-state.js';
import { asignarHechizo } from '../hechizos/panel-hechizos-logic.js';
import { norm } from '../dev-state.js';

// ── Colores fijos (ya no viene de mapaColores por afinidad para el canvas) ──
const COLOR_DESCUBIERTO = 'rgba(180, 140, 255, 1)';     // lila
const COLOR_OCULTO      = 'rgba(212, 175, 55, 0.75)';   // dorado suave
const COLOR_BORDE_DESC  = 'rgba(200, 160, 255, 0.9)';
const COLOR_BORDE_OCU   = 'rgba(180, 148, 40, 0.6)';

// ── Estado interno del canvas ─────────────────────────────────
const miniMapa = {
    canvas: null,
    ctx:    null,
    camara: { x: 0, y: 0, zoom: 0.18 },
    inter: {
        isDraggingBg: false,
        draggedNode:  null,
        hoveredNode:  null,
        hasDragged:   false,
        lastMouseX:   0,
        lastMouseY:   0,
    },
    rafId: null,
};

// ── Estado del selector de personaje para asignación ─────────
const asignState = {
    pjSeleccionado: null,   
    filtroRol: 'jugadores', 
    posesiones: new Set(),  
    aprendibles: new Set(), 
    rastreo:     new Set(), 
};

// ── API pública expuesta al HTML inline ───────────────────────
window.devMapa = {
    setVista:    (v) => { setVistaMapaDev(v); renderColumnaMapa(); },
    setBusqueda: (t) => { setBusquedaMapa(t); _actualizarBuscadorCanvas(t); },
    setBusquedaCanvas: (t) => _actualizarBuscadorCanvas(t),
    setFiltroAf: (v) => setFiltroAfinidad(v),
    setFiltroVis:(v) => setFiltroVisibilidad(v),
    abrirMapa:   () => window.open('../mapa/index.html', '_blank'),
    centrarCamara: () => _centrarCamaraAuto(),

    setHerramienta: (h) => {
        mapaDevState.herramienta = h;
        _actualizarToolbar();
    },

    crearNodo: () => {
        const c = miniMapa.camara;
        const canvas = miniMapa.canvas;
        let wx = 0, wy = 0;
        if (canvas) {
            const r = canvas.getBoundingClientRect();
            wx = (r.width  / 2 - c.x) / c.zoom;
            wy = (r.height / 2 - c.y) / c.zoom;
        }
        const nuevo = crearNodoDev(wx, wy);
        mapaDevState.seleccionMultiple.clear();
        mapaDevState.seleccionMultiple.add(nuevo);
        _renderPropiedades();
        _marcarGuardar();
    },

    eliminarSeleccion: () => {
        const n = mapaDevState.seleccionMultiple.size;
        if (!n) return;
        if (!confirm(`¿Destruir ${n} nodo${n > 1 ? 's' : ''} y todas sus conexiones?`)) return;
        eliminarNodosDev(mapaDevState.seleccionMultiple);
        mapaDevState.seleccionMultiple.clear();
        _renderPropiedades();
        _marcarGuardar();
    },

    actualizarCampo: (id, campo, valor) => {
        actualizarDatoNodoDev(id, campo, valor);
        _marcarGuardar();
    },

    forzarCampoMasivo: (campo, valor) => {
        if (!valor && valor !== 0) return;
        mapaDevState.seleccionMultiple.forEach(n => {
            actualizarDatoNodoDev(n.id, campo, campo === 'hex' ? parseInt(valor) || 0 : valor);
        });
        _marcarGuardar();
    },

    toggleVis: (id) => {
        const { mapaDevState: mds } = window.__mapaDevStateRef || {};
        toggleVisibilidadNodo(id);
        _renderPropiedades();
        if (asignState.pjSeleccionado) {
            _calcularVistaPj(asignState.pjSeleccionado);
            const np = document.getElementById('mm-asign-nodo-panel');
            if (np) np.innerHTML = _htmlAsignNodo();
        }
        _marcarGuardar();
    },

    setFiltroRolAsign: (rol) => {
        asignState.filtroRol = rol;
        asignState.pjSeleccionado = null; 
        _calcularVistaPj(null);
        _renderPanelAsignacion();
    },

    seleccionarPjAsign: (nombre) => {
        if (nombre === null || asignState.pjSeleccionado === nombre) {
            asignState.pjSeleccionado = null;
        } else {
            asignState.pjSeleccionado = nombre;
        }
        _calcularVistaPj(asignState.pjSeleccionado);
        _renderPanelAsignacion();
    },

    asignarDesdeNodo: (hechizoId, cobrarHex) => {
        const pj = asignState.pjSeleccionado;
        if (!pj) return;
        const cobrarOriginal = hzState.cobrarAlAsignar;
        hzState.cobrarAlAsignar = cobrarHex;
        asignarHechizo(pj, hechizoId);
        hzState.cobrarAlAsignar = cobrarOriginal;

        _calcularVistaPj(pj);
        _renderPanelAsignacion();
        _marcarGuardar();
    },

    // 🌟 NUEVA LÓGICA: ASIGNACIÓN MÚLTIPLE
    asignarMasivo: (cobrarHex) => {
        const pj = asignState.pjSeleccionado;
        if (!pj) return;
        const pjKey = norm(pj);
        const inv   = hzState.inventariosDB[pjKey] || [];
        const cobrarOriginal = hzState.cobrarAlAsignar;
        hzState.cobrarAlAsignar = cobrarHex;

        const cands = Array.from(mapaDevState.seleccionMultiple);
        cands.forEach(n => {
            const idNorm  = norm(n.id);
            const inCola  = hzState.colaAsignaciones[pjKey]?.[n.id];
            const tieneDB = inv.includes(idNorm) || inv.includes(norm(n.nombreOriginal || ''));
            const tiene   = inCola !== undefined ? inCola : tieneDB;

            if (!tiene) asignarHechizo(pj, n.id);
        });

        hzState.cobrarAlAsignar = cobrarOriginal;
        _calcularVistaPj(pj);
        _renderPanelAsignacion();
        _marcarGuardar();
    },

    quitarMasivo: () => {
        const pj = asignState.pjSeleccionado;
        if (!pj) return;
        const pjKey = norm(pj);
        const inv   = hzState.inventariosDB[pjKey] || [];
        const cobrarOriginal = hzState.cobrarAlAsignar;
        hzState.cobrarAlAsignar = false; 

        const cands = Array.from(mapaDevState.seleccionMultiple);
        cands.forEach(n => {
            const idNorm  = norm(n.id);
            const inCola  = hzState.colaAsignaciones[pjKey]?.[n.id];
            const tieneDB = inv.includes(idNorm) || inv.includes(norm(n.nombreOriginal || ''));
            const tiene   = inCola !== undefined ? inCola : tieneDB;

            if (tiene) asignarHechizo(pj, n.id);
        });

        hzState.cobrarAlAsignar = cobrarOriginal;
        _calcularVistaPj(pj);
        _renderPanelAsignacion();
        _marcarGuardar();
    }
};

// ── Calcular posesiones/aprendibles/rastreo para el personaje ─
function _calcularVistaPj(nombre) {
    asignState.posesiones.clear();
    asignState.aprendibles.clear();
    asignState.rastreo.clear();
    if (!nombre) return;

    const pjKey = norm(nombre);
    const inv   = hzState.inventariosDB[pjKey] || [];

    // Determinar posesiones
    mapaDevState.nodosDB.forEach(n => {
        const idNorm  = norm(n.id);
        const nomNorm = norm(n.nombreOriginal || '');
        const inCola  = hzState.colaAsignaciones[pjKey]?.[n.id];
        const tieneDB = inv.includes(idNorm) || inv.includes(nomNorm);
        const tiene   = inCola !== undefined ? inCola : tieneDB;
        if (tiene) asignState.posesiones.add(n);
    });

    // Aprendibles (1 paso adelante)
    mapaDevState.enlacesDB.forEach(e => {
        if (asignState.posesiones.has(e.source) && !asignState.posesiones.has(e.target)) {
            asignState.aprendibles.add(e.target);
        }
    });

    // Rastreo recursivo hacia atrás
    const rastrear = (n) => {
        mapaDevState.enlacesDB.forEach(e => {
            if (e.target === n && !asignState.rastreo.has(e.source) && !asignState.posesiones.has(e.source)) {
                asignState.rastreo.add(e.source);
                rastrear(e.source);
            }
        });
    };
    asignState.aprendibles.forEach(n => rastrear(n));
    asignState.posesiones.forEach(n => rastrear(n));
}

// ── Buscador del canvas (busca y centra la cámara en el nodo) ─
let _busquedaCanvas = '';
function _actualizarBuscadorCanvas(texto) {
    _busquedaCanvas = (texto || '').toLowerCase().trim();
    if (!_busquedaCanvas) return;
    const nodo = mapaDevState.nodosDB.find(n =>
        (n.id || '').toLowerCase().includes(_busquedaCanvas) ||
        (n.nombreOriginal || '').toLowerCase().includes(_busquedaCanvas)
    );
    if (nodo && miniMapa.canvas) {
        const c    = miniMapa.canvas.getBoundingClientRect();
        const zoom = miniMapa.camara.zoom;
        miniMapa.camara.x = (c.width  / 2) - (nodo.x * zoom);
        miniMapa.camara.y = (c.height / 2) - (nodo.y * zoom);
        mapaDevState.seleccionMultiple.clear();
        mapaDevState.seleccionMultiple.add(nodo);
        _renderPropiedades();
    }
}

// ── RENDER PRINCIPAL ──────────────────────────────────────────
export function renderColumnaMapa() {
    const contenedor = document.getElementById('content-mapa');
    if (!contenedor) return;

    const pendientes = contarCambiosPendientes();
    const { vistaActiva } = mapaDevState;

    const canvasExistente = document.getElementById('mini-mapa-canvas');
    if (canvasExistente && canvasExistente.isConnected) {
        _marcarGuardarSilencioso(pendientes);
        _renderPropiedades();
        _renderPanelAsignacion();
        return;
    }

    let html = `
    <div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap;">
        <button onclick="window.devMapa.abrirMapa()" style="margin-left:auto;background:#003366;color:#00ffff;border:1px solid #00ffff;padding:6px 12px;border-radius:6px;cursor:pointer;font-family:'Cinzel';font-size:0.78em;font-weight:bold;">↗️ Mapa Completo</button>
    </div>
    <div id="mm-pendientes" style="background:rgba(74,24,128,0.25);border:1px dashed #b060ff;border-radius:6px;padding:7px 12px;margin-bottom:8px;font-size:0.78em;color:#cc88ff;display:${pendientes > 0 ? 'block' : 'none'};">
        ⏳ ${pendientes} cambio${pendientes !== 1 ? 's' : ''} pendiente${pendientes !== 1 ? 's' : ''} — usa 🔥 GUARDAR TODO
    </div>`;

    html += _htmlVistaCanvas();

    contenedor.innerHTML = html;

    requestAnimationFrame(() => _montarCanvas());
}

function _marcarGuardarSilencioso(pendientes) {
    const div = document.getElementById('mm-pendientes');
    if (div) {
        div.style.display = pendientes > 0 ? 'block' : 'none';
        div.textContent   = `⏳ ${pendientes} cambio${pendientes !== 1 ? 's' : ''} pendiente${pendientes !== 1 ? 's' : ''} — usa 🔥 GUARDAR TODO`;
    }
}

function _generarBotonesPersonajes(fuentePj) {
    const isNinguno = !asignState.pjSeleccionado;
    let html = `
    <button onclick="window.devMapa.seleccionarPjAsign(null)"
        style="padding:5px 11px;border-radius:20px;cursor:pointer;font-family:'Rajdhani';font-size:0.82em;font-weight:bold;transition:0.2s;
        ${isNinguno ? 'background:#4a4a4a;color:#fff;border:1px solid #fff;' : 'background:#0a0018;color:#888;border:1px solid #333;'}">
        🚫 Ninguno
    </button>`;

    html += fuentePj.map(p => {
        const activo = asignState.pjSeleccionado === p.nombre;
        return `<button onclick="window.devMapa.seleccionarPjAsign('${p.nombre.replace(/'/g,"\\'")}')"
            style="padding:5px 11px;border-radius:20px;cursor:pointer;font-family:'Rajdhani';font-size:0.82em;font-weight:bold;transition:0.2s;
            ${activo
                ? 'background:#4a1880;color:#fff;border:1px solid #b060ff;'
                : 'background:#0a0018;color:#888;border:1px solid #333;'}">
            ${_esc(p.nombre)}
        </button>`;
    }).join('');

    if (fuentePj.length === 0) {
        html += `<span style="color:#555;font-style:italic;font-size:0.8em;align-self:center;">Sin personajes activos en esta categoría.</span>`;
    }
    return html;
}

// ── HTML DEL CANVAS ───────────────────────────────────────────
function _htmlVistaCanvas() {
    const nodos     = mapaDevState.nodosDB;
    const total     = nodos.length;
    const conocidos = nodos.filter(n =>
        mapaDevState.colaVisibilidad[n.id] !== undefined
            ? mapaDevState.colaVisibilidad[n.id]
            : n.esConocido
    ).length;

    const listaPersonajes = window.__devListaPersonajes || [];
    const jugadores = listaPersonajes.filter(p => p.is_player && p.is_active);
    const npcs      = listaPersonajes.filter(p => !p.is_player && p.is_active);
    const fuentePj  = asignState.filtroRol === 'jugadores' ? jugadores : npcs;

    return `
    <div style="display:flex;gap:8px;margin-bottom:8px;font-size:0.78em;align-items:center;">
        <div style="flex:0 0 auto;background:#0a0020;border:1px solid #333;border-radius:6px;padding:6px 10px;">
            <span style="color:#b060ff;font-weight:bold;">${total}</span> <span style="color:#555;">Total</span>
        </div>
        <div style="flex:0 0 auto;background:#0a0020;border:1px solid #b896ff;border-radius:6px;padding:6px 10px;">
            <span style="color:#b896ff;font-weight:bold;">${conocidos}</span> <span style="color:#555;">Desc.</span>
        </div>
        <div style="flex:0 0 auto;background:#0a0020;border:1px solid #d4af37;border-radius:6px;padding:6px 10px;">
            <span style="color:#d4af37;font-weight:bold;">${total - conocidos}</span> <span style="color:#555;">Sellados</span>
        </div>
        <div style="flex:1;position:relative;">
            <input id="mm-buscador" type="text" placeholder="🔍 Buscar por ID o nombre..."
                oninput="window.devMapa.setBusquedaCanvas(this.value)"
                style="width:100%;box-sizing:border-box;background:#0a0020;color:#fff;border:1px solid #4a1880;border-radius:6px;padding:6px 10px;font-family:'Rajdhani';font-size:0.9em;outline:none;">
        </div>
        <button onclick="window.devMapa.centrarCamara()"
            style="background:#111;color:#aaa;border:1px solid #444;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:1em;" title="Centrar vista">⌖</button>
    </div>

    <div style="display:flex;gap:6px;margin-bottom:8px;background:rgba(8,0,18,0.85);padding:8px;border-radius:8px;border:1px solid #2a1060;">
        <button id="mm-tool-cursor" onclick="window.devMapa.setHerramienta('cursor')"
            title="Seleccionar y mover nodos"
            style="flex:1;padding:8px 4px;border-radius:6px;background:#00ffff;color:#000;border:2px solid #00ffff;cursor:pointer;font-weight:bold;font-size:0.74em;font-family:'Cinzel';">
            👆<br>Select
        </button>
        <button id="mm-tool-enlace" onclick="window.devMapa.setHerramienta('enlace')"
            title="Arrastra de un nodo a otro para crear una flecha"
            style="flex:1;padding:8px 4px;border-radius:6px;background:#111;color:#00ffff;border:2px solid #00ffff;cursor:pointer;font-weight:bold;font-size:0.74em;font-family:'Cinzel';">
            ↗️<br>Flecha
        </button>
        <button id="mm-tool-cortar" onclick="window.devMapa.setHerramienta('eliminar-enlace')"
            title="Arrastra de un nodo a otro para eliminar la conexión"
            style="flex:1;padding:8px 4px;border-radius:6px;background:#111;color:#ff4444;border:2px solid #ff4444;cursor:pointer;font-weight:bold;font-size:0.74em;font-family:'Cinzel';">
            ✂️<br>Cortar
        </button>
        <button onclick="window.devMapa.crearNodo()"
            style="flex:1;padding:8px 4px;border-radius:6px;background:#111;color:#00ff00;border:2px solid #00ff00;cursor:pointer;font-weight:bold;font-size:0.74em;font-family:'Cinzel';">
            ➕<br>Nodo
        </button>
    </div>

    <div style="display:flex;gap:8px;align-items:flex-start;">
        <div style="position:relative;flex:1;height:600px;background:#05000a;border:1px solid #2a1060;border-radius:8px;overflow:hidden;min-width:0;">
            <canvas id="mini-mapa-canvas" style="display:block;width:100%;height:100%;cursor:grab;"></canvas>
            <div style="position:absolute;top:8px;right:8px;color:#2a2a2a;font-size:0.62em;text-align:right;pointer-events:none;line-height:1.7;">
                Scroll: zoom<br>Drag: mover<br>SHIFT+drag fondo: caja
            </div>
        </div>
        <div id="mm-props-panel"
            style="width:255px;flex-shrink:0;background:rgba(8,0,18,0.95);border:1px solid #4a1880;border-radius:8px;overflow-y:auto;max-height:600px;font-size:0.82em;">
            <div style="padding:20px;text-align:center;color:#3a3a4a;line-height:1.8;">
                <div style="font-size:1.3em;margin-bottom:6px;">🗺️</div>
                <p style="margin:0 0 6px 0;">Haz clic en un nodo para editar sus propiedades.</p>
                <p style="margin:0;font-size:0.85em;">SHIFT + arrastra el fondo para seleccionar varios.</p>
            </div>
        </div>
    </div>

    <div id="mm-asign-panel" style="margin-top:14px;background:rgba(5,0,15,0.9);border:1px solid #3a1060;border-radius:10px;padding:14px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
            <span style="color:#b060ff;font-family:'Cinzel';font-weight:bold;font-size:0.85em;">👤 ASIGNAR HECHIZOS A PERSONAJE</span>
            <div style="display:flex;gap:6px;margin-left:auto;">
                <button onclick="window.devMapa.setFiltroRolAsign('jugadores')"
                    id="mm-tab-jug"
                    style="padding:5px 12px;border-radius:5px;cursor:pointer;font-family:'Cinzel';font-size:0.72em;font-weight:bold;
                    ${asignState.filtroRol==='jugadores'?'background:#004a00;color:#fff;border:1px solid #00e676;':'background:#111;color:#888;border:1px solid #444;'}">
                    ⚔️ Jugadores
                </button>
                <button onclick="window.devMapa.setFiltroRolAsign('npcs')"
                    id="mm-tab-npcs"
                    style="padding:5px 12px;border-radius:5px;cursor:pointer;font-family:'Cinzel';font-size:0.72em;font-weight:bold;
                    ${asignState.filtroRol==='npcs'?'background:#4a0000;color:#fff;border:1px solid #ff4444;':'background:#111;color:#888;border:1px solid #444;'}">
                    🎭 NPCs
                </button>
            </div>
        </div>

        <div class="mm-pj-lista" style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:12px;">
            ${_generarBotonesPersonajes(fuentePj)}
        </div>

        <div id="mm-asign-nodo-panel">
            ${asignState.pjSeleccionado
                ? _htmlAsignNodo()
                : `<div style="color:#3a3a4a;text-align:center;padding:15px;font-size:0.8em;">Selecciona un personaje arriba para ver sus hechizos y asignar.</div>`
            }
        </div>
    </div>`;
}

function _renderPanelAsignacion() {
    const panel = document.getElementById('mm-asign-panel');
    if (!panel) { renderColumnaMapa(); return; }

    const listaPersonajes = window.__devListaPersonajes || [];
    const jugadores = listaPersonajes.filter(p => p.is_player && p.is_active);
    const npcs      = listaPersonajes.filter(p => !p.is_player && p.is_active);
    const fuentePj  = asignState.filtroRol === 'jugadores' ? jugadores : npcs;

    const tabJug = document.getElementById('mm-tab-jug');
    const tabNpc = document.getElementById('mm-tab-npcs');
    if (tabJug) {
        tabJug.style.background    = asignState.filtroRol === 'jugadores' ? '#004a00' : '#111';
        tabJug.style.color         = asignState.filtroRol === 'jugadores' ? '#fff' : '#888';
        tabJug.style.borderColor   = asignState.filtroRol === 'jugadores' ? '#00e676' : '#444';
    }
    if (tabNpc) {
        tabNpc.style.background    = asignState.filtroRol === 'npcs' ? '#4a0000' : '#111';
        tabNpc.style.color         = asignState.filtroRol === 'npcs' ? '#fff' : '#888';
        tabNpc.style.borderColor   = asignState.filtroRol === 'npcs' ? '#ff4444' : '#444';
    }

    const listContainer = panel.querySelector('.mm-pj-lista');
    if (listContainer) {
        listContainer.innerHTML = _generarBotonesPersonajes(fuentePj);
    }

    const nodoPanel = document.getElementById('mm-asign-nodo-panel');
    if (nodoPanel) {
        nodoPanel.innerHTML = asignState.pjSeleccionado
            ? _htmlAsignNodo()
            : `<div style="color:#3a3a4a;text-align:center;padding:15px;font-size:0.8em;">Selecciona un personaje arriba para ver sus hechizos y asignar.</div>`;
    }
}

// ── HTML del nodo seleccionado + panel de asignación ─────────
function _htmlAsignNodo() {
    if (!mapaDevState.seleccionMultiple.size) {
        return `<div style="color:#3a3a4a;text-align:center;padding:15px;font-size:0.8em;">
            Haz clic en un nodo del mapa para ver opciones de asignación para <strong style="color:#b060ff;">${_esc(asignState.pjSeleccionado)}</strong>.
        </div>`;
    }

    const cands = Array.from(mapaDevState.seleccionMultiple);
    
    // 🌟 SELECCIÓN MÚLTIPLE (MASS ASSIGN)
    if (cands.length > 1) {
        const pj      = asignState.pjSeleccionado;
        const pjKey   = norm(pj);
        const inv     = hzState.inventariosDB[pjKey] || [];

        let faltantes = 0;
        let poseidos = 0;
        let costoTotal = 0;

        cands.forEach(n => {
            const idNorm  = norm(n.id);
            const inCola  = hzState.colaAsignaciones[pjKey]?.[n.id];
            const tieneDB = inv.includes(idNorm) || inv.includes(norm(n.nombreOriginal || ''));
            const tiene   = inCola !== undefined ? inCola : tieneDB;
            if (tiene) {
                poseidos++;
            } else {
                faltantes++;
                costoTotal += (n.hex || 0);
            }
        });

        return `
        <div style="background:rgba(10,0,25,0.8);border:1px solid #3a1060;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:0.85em;margin-bottom:4px;color:#ddd;font-weight:bold;">Asignación Múltiple (${cands.length} hechizos)</div>
                    <div style="font-size:0.75em;color:#aaa;">Posee: <span style="color:#b896ff;">${poseidos}</span> | Faltan: <span style="color:#d4af37;">${faltantes}</span></div>
                </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                ${faltantes > 0 ? `
                <button onclick="window.devMapa.asignarMasivo(false)"
                    style="flex:1;padding:8px;background:rgba(0,180,100,0.15);color:#00cc88;border:1px solid #00aa66;border-radius:6px;cursor:pointer;font-family:'Cinzel';font-size:0.75em;font-weight:bold;">
                    ✅ DAR FALTANTES (0 HEX)
                </button>
                ${costoTotal > 0 ? `
                <button onclick="window.devMapa.asignarMasivo(true)"
                    style="flex:1;padding:8px;background:rgba(180,140,0,0.15);color:#d4af37;border:1px solid #b09030;border-radius:6px;cursor:pointer;font-family:'Cinzel';font-size:0.75em;font-weight:bold;">
                    💰 DAR FALTANTES (−${costoTotal} HEX)
                </button>` : ''}
                ` : ''}
                ${poseidos > 0 ? `
                <button onclick="window.devMapa.quitarMasivo()"
                    style="flex:1;padding:8px;background:rgba(180,0,0,0.15);color:#ff6666;border:1px solid #aa3333;border-radius:6px;cursor:pointer;font-family:'Cinzel';font-size:0.75em;font-weight:bold;">
                    ❌ QUITAR TODOS
                </button>
                ` : ''}
            </div>
        </div>`;
    }

    // 🌟 SELECCIÓN ÚNICA
    const n       = cands[0];
    const pj      = asignState.pjSeleccionado;
    const pjKey   = norm(pj);
    const idNorm  = norm(n.id);
    const inv     = hzState.inventariosDB[pjKey] || [];
    const inCola  = hzState.colaAsignaciones[pjKey]?.[n.id];
    const tieneDB = inv.includes(idNorm) || inv.includes(norm(n.nombreOriginal || ''));
    const tiene   = inCola !== undefined ? inCola : tieneDB;
    const cambioEnCola = inCola !== undefined && inCola !== tieneDB;

    const esConocido  = getVisibilidadActual(n.id);
    const esPosesion  = asignState.posesiones.has(n);
    const esAprendible = asignState.aprendibles.has(n);
    const esRastreo   = asignState.rastreo.has(n);

    let estadoLabel = '';
    if (esPosesion)    estadoLabel = `<span style="background:rgba(180,140,255,0.2);color:#b896ff;border:1px solid #b060ff;border-radius:4px;padding:2px 7px;font-size:0.75em;">● Posee</span>`;
    else if (esAprendible) estadoLabel = `<span style="background:rgba(212,175,55,0.15);color:#d4af37;border:1px solid #d4af37;border-radius:4px;padding:2px 7px;font-size:0.75em;">✦ Aprendible</span>`;
    else if (esRastreo) estadoLabel = `<span style="background:rgba(100,100,80,0.2);color:#888;border:1px solid #555;border-radius:4px;padding:2px 7px;font-size:0.75em;">○ Prereq.</span>`;

    let textoNombre = '';
    if (esConocido) {
        textoNombre = `<span style="color:#ddd;font-weight:bold;">${_esc(n.nombreOriginal || n.id)}</span> <span style="color:#888;font-size:0.85em;">(${n.hex} HEX)</span>`;
    } else {
        // 🌟 CORRECCIÓN DEL GRIS DEL TACHADO
        textoNombre = `
            <div style="color:#aaa;">Hechizo ${_extractNum(n.id)} <span style="color:#777;font-size:0.85em;">(${n.hex} HEX)</span></div>
            <div style="color:#aaa;text-decoration:line-through;font-size:0.82em;">${_esc(n.nombreOriginal || n.id)} (${n.hex} HEX)</div>`;
    }

    const safeId  = n.id.replace(/'/g, "\\'");
    const hexCost = n.hex || 0;

    return `
    <div style="background:rgba(10,0,25,0.8);border:1px solid #3a1060;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="flex:1;min-width:0;">
                <div style="font-size:0.85em;margin-bottom:4px;">${textoNombre}</div>
                <div style="font-size:0.72em;color:#aaa;">${_esc(n.afinidad || '—')} · ${_esc(n.clase)}</div>
            </div>
            ${estadoLabel}
            ${cambioEnCola ? `<span style="color:#ffaa00;font-size:0.72em;">● cola</span>` : ''}
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            ${!tiene ? `
            <button onclick="window.devMapa.asignarDesdeNodo('${safeId}', false)"
                style="flex:1;padding:8px;background:rgba(0,180,100,0.15);color:#00cc88;border:1px solid #00aa66;border-radius:6px;cursor:pointer;font-family:'Cinzel';font-size:0.75em;font-weight:bold;">
                ✅ DAR (sin cobrar)
            </button>
            ${hexCost > 0 ? `
            <button onclick="window.devMapa.asignarDesdeNodo('${safeId}', true)"
                style="flex:1;padding:8px;background:rgba(180,140,0,0.15);color:#d4af37;border:1px solid #b09030;border-radius:6px;cursor:pointer;font-family:'Cinzel';font-size:0.75em;font-weight:bold;">
                💰 DAR (−${hexCost} HEX)
            </button>` : ''}
            ` : `
            <button onclick="window.devMapa.asignarDesdeNodo('${safeId}', false)"
                style="flex:1;padding:8px;background:rgba(180,0,0,0.15);color:#ff6666;border:1px solid #aa3333;border-radius:6px;cursor:pointer;font-family:'Cinzel';font-size:0.75em;font-weight:bold;">
                ❌ QUITAR HECHIZO
            </button>
            `}
        </div>
        ${n.efecto ? `<div style="font-size:0.75em;color:#aaa;border-top:1px dashed #2a1060;padding-top:8px;line-height:1.4;">${_esc(n.efecto)}</div>` : ''}
    </div>`;
}

// ── MONTAR CANVAS ─────────────────────────────────────────────
function _montarCanvas() {
    const canvas = document.getElementById('mini-mapa-canvas');
    if (!canvas) return;

    if (miniMapa.rafId) { cancelAnimationFrame(miniMapa.rafId); miniMapa.rafId = null; }

    miniMapa.canvas = canvas;
    miniMapa.ctx    = canvas.getContext('2d', { alpha: false });
    miniMapa.inter.isDraggingBg = false;
    miniMapa.inter.draggedNode  = null;
    miniMapa.inter.hoveredNode  = null;
    miniMapa.inter.hasDragged   = false;

    _redimensionarCanvas();
    _centrarCamaraAuto();
    _engacharEventos(canvas);
    _iniciarLoop();
    _actualizarToolbar();
}

function _redimensionarCanvas() {
    const c = miniMapa.canvas;
    if (!c) return;
    const dpr  = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width  = Math.round(rect.width  * dpr);
    c.height = Math.round(rect.height * dpr);
}

function _centrarCamaraAuto() {
    const c = miniMapa.canvas;
    if (!c || !mapaDevState.nodosDB.length) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    mapaDevState.nodosDB.forEach(n => {
        if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
        if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
    });
    const w = (maxX - minX) || 1000;
    const h = (maxY - minY) || 1000;
    const rect = c.getBoundingClientRect();
    const zx = rect.width  / (w * 1.15);
    const zy = rect.height / (h * 1.15);
    miniMapa.camara.zoom = Math.min(zx, zy, 1.5);
    miniMapa.camara.x = (rect.width  / 2) - ((minX + w / 2) * miniMapa.camara.zoom);
    miniMapa.camara.y = (rect.height / 2) - ((minY + h / 2) * miniMapa.camara.zoom);
}

// ── EVENTOS ───────────────────────────────────────────────────
function _engacharEventos(canvas) {
    const toWorld = (cx, cy) => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (cx - rect.left - miniMapa.camara.x) / miniMapa.camara.zoom,
            y: (cy - rect.top  - miniMapa.camara.y) / miniMapa.camara.zoom,
        };
    };

    const hitNodo = (wx, wy) => {
        const minR = 14 / miniMapa.camara.zoom;
        for (let i = mapaDevState.nodosDB.length - 1; i >= 0; i--) {
            const n = mapaDevState.nodosDB[i];
            const r = Math.max(n.radio || 28, minR);
            if (Math.hypot(n.x - wx, n.y - wy) <= r) return n;
        }
        return null;
    };

    canvas.addEventListener('mousedown', (e) => {
        const wp   = toWorld(e.clientX, e.clientY);
        const nodo = hitNodo(wp.x, wp.y);
        const herr = mapaDevState.herramienta;

        miniMapa.inter.hasDragged  = false;
        miniMapa.inter.lastMouseX  = e.clientX;
        miniMapa.inter.lastMouseY  = e.clientY;

        if (herr === 'enlace' || herr === 'eliminar-enlace') {
            if (nodo) {
                mapaDevState.tempLink = { source: nodo, endX: nodo.x, endY: nodo.y };
            }
        } else {
            if (nodo) {
                if (e.shiftKey) {
                    if (mapaDevState.seleccionMultiple.has(nodo)) mapaDevState.seleccionMultiple.delete(nodo);
                    else mapaDevState.seleccionMultiple.add(nodo);
                } else {
                    if (!mapaDevState.seleccionMultiple.has(nodo)) {
                        mapaDevState.seleccionMultiple.clear();
                        mapaDevState.seleccionMultiple.add(nodo);
                    }
                }
                miniMapa.inter.draggedNode = nodo;
                _renderPropiedades();
                if (asignState.pjSeleccionado) {
                    const np = document.getElementById('mm-asign-nodo-panel');
                    if (np) np.innerHTML = _htmlAsignNodo();
                }
            } else {
                if (e.shiftKey) {
                    mapaDevState.seleccionMultiple.clear();
                    mapaDevState.boxStart   = { ...wp };
                    mapaDevState.boxCurrent = { ...wp };
                } else {
                    miniMapa.inter.isDraggingBg = true;
                }
            }
        }
        canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mousemove', (e) => {
        const dx = e.clientX - miniMapa.inter.lastMouseX;
        const dy = e.clientY - miniMapa.inter.lastMouseY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) miniMapa.inter.hasDragged = true;

        const wp = toWorld(e.clientX, e.clientY);

        if (mapaDevState.tempLink) {
            mapaDevState.tempLink.endX = wp.x;
            mapaDevState.tempLink.endY = wp.y;
            miniMapa.inter.hoveredNode = hitNodo(wp.x, wp.y);
        } else if (mapaDevState.boxStart) {
            mapaDevState.boxCurrent = { ...wp };
        } else if (miniMapa.inter.draggedNode) {
            const z = miniMapa.camara.zoom;
            mapaDevState.seleccionMultiple.forEach(n => {
                n.x += dx / z;
                n.y += dy / z;
                if (!mapaDevState.colaMetadatos[n.id]) mapaDevState.colaMetadatos[n.id] = {};
                mapaDevState.colaMetadatos[n.id].x = n.x;
                mapaDevState.colaMetadatos[n.id].y = n.y;
                mapaDevState.colaPosiciones[n.id]  = { x: n.x, y: n.y };
            });
        } else if (miniMapa.inter.isDraggingBg) {
            miniMapa.camara.x += dx;
            miniMapa.camara.y += dy;
        } else {
            const nodo = hitNodo(wp.x, wp.y);
            if (nodo !== miniMapa.inter.hoveredNode) {
                miniMapa.inter.hoveredNode = nodo;
                canvas.style.cursor = nodo ? 'pointer' : 'grab';
            }
        }

        miniMapa.inter.lastMouseX = e.clientX;
        miniMapa.inter.lastMouseY = e.clientY;
    });

    canvas.addEventListener('mouseup', (e) => {
        const wp   = toWorld(e.clientX, e.clientY);
        const nodo = hitNodo(wp.x, wp.y);
        const herr = mapaDevState.herramienta;

        if (mapaDevState.tempLink) {
            if (nodo && nodo !== mapaDevState.tempLink.source) {
                if (herr === 'enlace') {
                    crearEnlaceDev(mapaDevState.tempLink.source, nodo);
                    _marcarGuardar();
                } else {
                    const ok = eliminarEnlaceDev(mapaDevState.tempLink.source, nodo);
                    if (ok) _marcarGuardar();
                }
            }
            mapaDevState.tempLink = null;
        } else if (mapaDevState.boxStart) {
            const minX = Math.min(mapaDevState.boxStart.x, mapaDevState.boxCurrent.x);
            const maxX = Math.max(mapaDevState.boxStart.x, mapaDevState.boxCurrent.x);
            const minY = Math.min(mapaDevState.boxStart.y, mapaDevState.boxCurrent.y);
            const maxY = Math.max(mapaDevState.boxStart.y, mapaDevState.boxCurrent.y);
            mapaDevState.nodosDB.forEach(n => {
                if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY)
                    mapaDevState.seleccionMultiple.add(n);
            });
            mapaDevState.boxStart   = null;
            mapaDevState.boxCurrent = null;
            _renderPropiedades();
            if (asignState.pjSeleccionado) {
                const np = document.getElementById('mm-asign-nodo-panel');
                if (np) np.innerHTML = _htmlAsignNodo();
            }
        } else if (miniMapa.inter.draggedNode) {
            if (miniMapa.inter.hasDragged) _marcarGuardar();
        } else if (miniMapa.inter.isDraggingBg && !miniMapa.inter.hasDragged && !e.shiftKey) {
            mapaDevState.seleccionMultiple.clear();
            _renderPropiedades();
            if (asignState.pjSeleccionado) {
                const np = document.getElementById('mm-asign-nodo-panel');
                if (np) np.innerHTML = _htmlAsignNodo();
            }
        }

        miniMapa.inter.isDraggingBg = false;
        miniMapa.inter.draggedNode  = null;
        canvas.style.cursor = miniMapa.inter.hoveredNode ? 'pointer' : 'grab';
    });

    canvas.addEventListener('mouseleave', () => {
        miniMapa.inter.isDraggingBg = false;
        miniMapa.inter.draggedNode  = null;
        miniMapa.inter.hoveredNode  = null;
        mapaDevState.tempLink       = null;
        canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault(); e.stopPropagation();
        const f  = e.deltaY > 0 ? 0.88 : 1.14;
        const nz = Math.max(0.02, Math.min(miniMapa.camara.zoom * f, 6));
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        miniMapa.camara.x = mx - (mx - miniMapa.camara.x) * (nz / miniMapa.camara.zoom);
        miniMapa.camara.y = my - (my - miniMapa.camara.y) * (nz / miniMapa.camara.zoom);
        miniMapa.camara.zoom = nz;
    }, { passive: false });

    let pinchDist = 0;
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            miniMapa.inter.isDraggingBg = true;
            miniMapa.inter.lastMouseX = e.touches[0].clientX;
            miniMapa.inter.lastMouseY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            miniMapa.inter.isDraggingBg = false;
            pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && miniMapa.inter.isDraggingBg) {
            const t = e.touches[0];
            miniMapa.camara.x += t.clientX - miniMapa.inter.lastMouseX;
            miniMapa.camara.y += t.clientY - miniMapa.inter.lastMouseY;
            miniMapa.inter.lastMouseX = t.clientX;
            miniMapa.inter.lastMouseY = t.clientY;
        } else if (e.touches.length === 2) {
            const d  = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            const nz = Math.max(0.02, Math.min(miniMapa.camara.zoom * (d / (pinchDist || d)), 6));
            const rect = canvas.getBoundingClientRect();
            const mx = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
            const my = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;
            miniMapa.camara.x = mx - (mx - miniMapa.camara.x) * (nz / miniMapa.camara.zoom);
            miniMapa.camara.y = my - (my - miniMapa.camara.y) * (nz / miniMapa.camara.zoom);
            miniMapa.camara.zoom = nz;
            pinchDist = d;
        }
    }, { passive: false });

    canvas.addEventListener('touchend', () => { miniMapa.inter.isDraggingBg = false; pinchDist = 0; });
}

// ── LOOP DE RENDER ────────────────────────────────────────────
function _iniciarLoop() {
    const tick = () => {
        if (!miniMapa.canvas?.isConnected) return;
        _dibujarFrame();
        miniMapa.rafId = requestAnimationFrame(tick);
    };
    miniMapa.rafId = requestAnimationFrame(tick);
}

function _dibujarFrame() {
    const canvas = miniMapa.canvas;
    const ctx    = miniMapa.ctx;
    if (!canvas || !ctx) return;

    const dpr  = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const tw   = Math.round(rect.width  * dpr);
    const th   = Math.round(rect.height * dpr);
    if (canvas.width !== tw || canvas.height !== th) { canvas.width = tw; canvas.height = th; }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05000a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.scale(dpr, dpr);
    ctx.translate(miniMapa.camara.x, miniMapa.camara.y);
    ctx.scale(miniMapa.camara.zoom, miniMapa.camara.zoom);

    const sf       = Math.max(miniMapa.camara.zoom, 0.04);
    const hayPj    = !!asignState.pjSeleccionado;

    // ── ENLACES ───────────────────────────────────────────────
    mapaDevState.enlacesDB.forEach(link => {
        const s = link.source;
        const t = link.target;
        if (!s || !t) return;
        const angle = Math.atan2(t.y - s.y, t.x - s.x);
        const r     = (t.radio || 20);
        const tx    = t.x - Math.cos(angle) * (r + 3 / sf);
        const ty    = t.y - Math.sin(angle) * (r + 3 / sf);

        let color;
        if (hayPj) {
            const sP = asignState.posesiones.has(s);
            const tP = asignState.posesiones.has(t);
            const tA = asignState.aprendibles.has(t);
            const sT = asignState.rastreo.has(s) || sP;
            const tT = asignState.rastreo.has(t) || tP || tA;
            if (sP && tP)       color = 'rgba(180,140,255,0.5)';
            else if (sP && tA)  color = 'rgba(212,175,55,0.5)';
            else if (sT && tT)  color = 'rgba(140,120,80,0.25)';
            else                color = 'rgba(60,60,70,0.15)';
        } else {
            const sV = getVisibilidadActual(s.id);
            const tV = getVisibilidadActual(t.id);
            color = sV && tV  ? 'rgba(180,140,255,0.22)'
                  : sV || tV  ? 'rgba(212,175,55,0.28)'
                              : 'rgba(100,100,120,0.12)';
        }

        ctx.beginPath();
        ctx.moveTo(s.x, s.y); ctx.lineTo(tx, ty);
        ctx.strokeStyle = color; ctx.lineWidth = 1.2 / sf; ctx.setLineDash([]); ctx.stroke();

        const hl = (ctx.lineWidth * 3) + (8 / sf);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - hl * Math.cos(angle - Math.PI / 7), ty - hl * Math.sin(angle - Math.PI / 7));
        ctx.lineTo(tx - hl * Math.cos(angle + Math.PI / 7), ty - hl * Math.sin(angle + Math.PI / 7));
        ctx.lineTo(tx, ty);
        ctx.fillStyle = color; ctx.fill();
    });

    // ── NODOS ─────────────────────────────────────────────────
    mapaDevState.nodosDB.forEach(nodo => {
        const esConocido  = getVisibilidadActual(nodo.id);
        const isHovered   = miniMapa.inter.hoveredNode  === nodo;
        const isSel       = mapaDevState.seleccionMultiple.has(nodo);

        let colorCore, colorBorde, alpha;
        if (hayPj) {
            const esPosesion   = asignState.posesiones.has(nodo);
            const esAprendible = asignState.aprendibles.has(nodo);
            const esRastreo    = asignState.rastreo.has(nodo);
            if (esPosesion) {
                colorCore  = 'rgba(180,140,255,0.9)';
                colorBorde = 'rgba(200,160,255,1)';
                alpha      = 1.0;
            } else if (esAprendible) {
                colorCore  = 'rgba(212,175,55,0.85)';
                colorBorde = 'rgba(230,195,75,0.95)';
                alpha      = 1.0;
            } else if (esRastreo) {
                colorCore  = 'rgba(130,110,60,0.5)';
                colorBorde = 'rgba(160,140,80,0.55)';
                alpha      = esConocido ? 0.65 : 0.45;
            } else {
                colorCore  = 'rgba(50,50,55,0.3)';
                colorBorde = 'rgba(80,80,85,0.3)';
                alpha      = esConocido ? 0.35 : 0.25;
            }
        } else {
            colorCore  = esConocido ? COLOR_DESCUBIERTO : COLOR_OCULTO;
            colorBorde = esConocido ? COLOR_BORDE_DESC  : COLOR_BORDE_OCU;
            alpha      = esConocido ? 1.0 : 0.55;
        }

        const r     = nodo.radio || (esConocido ? 35 : 28);
        const rCore = Math.max(1, r - 7);

        ctx.globalAlpha = alpha;
        ctx.shadowBlur  = (isHovered || isSel) ? 22 / sf : (esConocido ? 4 / sf : 0);
        ctx.shadowColor = colorBorde;

        ctx.beginPath(); ctx.arc(nodo.x, nodo.y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#111'; ctx.fill();

        ctx.beginPath(); ctx.arc(nodo.x, nodo.y, rCore, 0, Math.PI * 2);
        ctx.fillStyle   = colorCore;
        ctx.globalAlpha = alpha * 0.88;
        ctx.fill();
        ctx.globalAlpha = alpha;

        ctx.shadowBlur = 0;

        ctx.beginPath(); ctx.arc(nodo.x, nodo.y, r, 0, Math.PI * 2);
        ctx.lineWidth   = 1.8 / sf;
        ctx.strokeStyle = colorBorde;
        if (!esConocido) ctx.setLineDash([5 / sf, 4 / sf]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;

        if (isSel) {
            ctx.beginPath(); ctx.arc(nodo.x, nodo.y, r + 6 / sf, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0,255,255,0.85)';
            ctx.lineWidth   = 2 / sf;
            ctx.setLineDash([5 / sf, 3 / sf]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (!esConocido && !hayPj) {
            ctx.font      = `bold ${Math.round(18 + 2)}px sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.globalAlpha = 0.45;
            ctx.fillText('🔒', nodo.x, nodo.y);
            ctx.globalAlpha = 1.0;
        }

        if (miniMapa.camara.zoom > 0.05 || isHovered || isSel) {
            const fs = Math.round((esConocido ? 26 : 20) + (isHovered ? 4 : 0));
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'top';

            let fillColor;
            if (isSel) fillColor = '#00ffff';
            else if (isHovered) fillColor = '#fff';
            else if (hayPj) {
                if (asignState.posesiones.has(nodo))       fillColor = 'rgba(200,170,255,0.95)';
                else if (asignState.aprendibles.has(nodo)) fillColor = 'rgba(230,200,80,0.95)';
                else fillColor = esConocido ? 'rgba(160,160,180,0.6)' : 'rgba(130,120,80,0.45)';
            } else {
                fillColor = esConocido ? COLOR_DESCUBIERTO : 'rgba(180,150,60,0.7)';
            }

            if (esConocido) {
                const texto = `${nodo.nombreOriginal} (${nodo.hex})`;
                ctx.font        = `bold ${fs}px sans-serif`;
                const ty2 = nodo.y + r + 8 / sf;
                ctx.lineWidth   = 5 / sf;
                ctx.strokeStyle = 'rgba(0,0,0,0.95)'; ctx.strokeText(texto, nodo.x, ty2);
                ctx.fillStyle   = fillColor;           ctx.fillText(texto, nodo.x, ty2);
            } else {
                const texto1 = `Hechizo ${_extractNum(nodo.id)} (${nodo.hex})`;
                const texto2 = `${nodo.nombreOriginal} (${nodo.hex})`;
                const fs2    = Math.round(fs * 0.78);
                const gap    = (fs + 4) / sf;

                ctx.font     = `bold ${fs}px sans-serif`;
                const ty1 = nodo.y + r + 8 / sf;
                ctx.lineWidth   = 5 / sf;
                ctx.strokeStyle = 'rgba(0,0,0,0.95)'; ctx.strokeText(texto1, nodo.x, ty1);
                ctx.fillStyle   = fillColor;           ctx.fillText(texto1, nodo.x, ty1);

                ctx.font        = `${fs2}px sans-serif`;
                const ty2b = ty1 + gap;
                
                // 🌟 CORRECCIÓN DEL GRIS DEL TACHADO (Canvas)
                const fillColor2 = 'rgba(160,150,140,0.8)'; // Más blanco/brillante
                ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.strokeText(texto2, nodo.x, ty2b);
                ctx.fillStyle   = fillColor2;         ctx.fillText(texto2, nodo.x, ty2b);

                const medida = ctx.measureText(texto2);
                const midY   = ty2b + fs2 / 2;
                ctx.beginPath();
                ctx.moveTo(nodo.x - medida.width / 2, midY);
                ctx.lineTo(nodo.x + medida.width / 2, midY);
                
                // 🌟 Línea de tachado más visible
                ctx.strokeStyle = 'rgba(180,160,140,0.9)'; 
                ctx.lineWidth   = 1.5 / sf;
                ctx.stroke();
            }
        }
    });

    if (mapaDevState.tempLink) {
        const { source, endX, endY } = mapaDevState.tempLink;
        const isDelete = mapaDevState.herramienta === 'eliminar-enlace';
        ctx.beginPath();
        ctx.moveTo(source.x, source.y); ctx.lineTo(endX, endY);
        ctx.strokeStyle = isDelete ? 'rgba(255,68,68,0.75)' : 'rgba(0,255,255,0.75)';
        ctx.lineWidth   = 2.5 / sf;
        ctx.setLineDash([8 / sf, 4 / sf]);
        ctx.stroke();
        ctx.setLineDash([]);
        const angle = Math.atan2(endY - source.y, endX - source.x);
        const hl    = 12 / sf;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - hl * Math.cos(angle - Math.PI / 7), endY - hl * Math.sin(angle - Math.PI / 7));
        ctx.lineTo(endX - hl * Math.cos(angle + Math.PI / 7), endY - hl * Math.sin(angle + Math.PI / 7));
        ctx.lineTo(endX, endY);
        ctx.fillStyle = isDelete ? 'rgba(255,68,68,0.75)' : 'rgba(0,255,255,0.75)';
        ctx.fill();
    }

    if (mapaDevState.boxStart && mapaDevState.boxCurrent) {
        const bx = Math.min(mapaDevState.boxStart.x, mapaDevState.boxCurrent.x);
        const by = Math.min(mapaDevState.boxStart.y, mapaDevState.boxCurrent.y);
        const bw = Math.abs(mapaDevState.boxCurrent.x - mapaDevState.boxStart.x);
        const bh = Math.abs(mapaDevState.boxCurrent.y - mapaDevState.boxStart.y);
        ctx.fillStyle   = 'rgba(0,255,255,0.04)';
        ctx.strokeStyle = 'rgba(0,255,255,0.5)';
        ctx.lineWidth   = 1.5 / sf;
        ctx.setLineDash([6 / sf, 3 / sf]);
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);
    }
}

// ── PANEL DE PROPIEDADES ──────────────────────────────────────
function _renderPropiedades() {
    const panel = document.getElementById('mm-props-panel');
    if (!panel) return;

    const cands  = Array.from(mapaDevState.seleccionMultiple);
    const afs    = getAfinidadesUnicas();
    const inp    = `width:100%;box-sizing:border-box;background:#000;color:#fff;border:1px solid #444;border-radius:4px;padding:6px;font-family:'Rajdhani';font-size:0.9em;outline:none;`;
    const lbl    = `color:#aaa;font-weight:bold;font-size:0.75em;display:block;margin-bottom:3px;`;
    const dlHTML = `<datalist id="mm-dl-af">${afs.map(a => `<option value="${a}">`).join('')}</datalist>`;

    if (cands.length === 0) {
        panel.innerHTML = `<div style="padding:20px;text-align:center;color:#3a3a4a;line-height:1.8;">
            <div style="font-size:1.3em;margin-bottom:6px;">🗺️</div>
            <p style="margin:0 0 6px 0;">Haz clic en un nodo para editar sus propiedades.</p>
            <p style="margin:0;font-size:0.85em;">SHIFT + arrastra el fondo para seleccionar varios.</p>
        </div>`;
        return;
    }

    if (cands.length > 1) {
        panel.innerHTML = `${dlHTML}
        <div style="padding:12px;">
            <h4 style="color:#00ffff;text-align:center;font-family:'Cinzel';margin:0 0 14px 0;font-size:0.85em;">Edición Masiva (${cands.length} nodos)</h4>
            <div style="display:flex;flex-direction:column;gap:10px;">
                <div>
                    <label style="${lbl}">FORZAR COSTO HEX:</label>
                    <input type="number" step="50" placeholder="— sin cambio —"
                        onchange="window.devMapa.forzarCampoMasivo('hex', parseInt(this.value)||0)"
                        style="${inp}">
                </div>
                <div>
                    <label style="${lbl}">FORZAR CLASE:</label>
                    <select onchange="window.devMapa.forzarCampoMasivo('clase', this.value)" style="${inp}">
                        <option value="">— sin cambio —</option>
                        ${['Clase 1','Clase 2','Clase 3','Clase 4','Clase 5'].map(c=>`<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="${lbl}">FORZAR AFINIDAD:</label>
                    <input type="text" list="mm-dl-af" placeholder="— sin cambio —"
                        onchange="window.devMapa.forzarCampoMasivo('afinidad', this.value)"
                        style="${inp}">
                </div>
                <button onclick="window.devMapa.eliminarSeleccion()"
                    style="width:100%;background:#4a0000;border:1px solid #ff0000;border-radius:6px;color:white;padding:10px;font-weight:bold;margin-top:8px;cursor:pointer;font-family:'Cinzel';font-size:0.78em;">
                    🗑️ DESTRUIR SELECCIÓN
                </button>
            </div>
        </div>`;
        return;
    }

    const n          = cands[0];
    const esConocido = getVisibilidadActual(n.id);
    const sid        = n.id.replace(/'/g, "\\'");

    window.__devEditNodo = n;

    const visStyle = esConocido
        ? 'background:rgba(0,180,100,0.2);color:#00cc88;border:1px solid #00aa66;'
        : 'background:rgba(80,80,80,0.2);color:#aaa;border:1px solid #555;';

    const headerNombre = esConocido
        ? `<div style="font-weight:bold;color:#b896ff;font-size:0.88em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(n.nombreOriginal || n.id)} <span style="color:#aaa;font-weight:normal;">(${n.hex} HEX)</span></div>`
        : `<div style="font-size:0.85em;line-height:1.6;">
               <div style="color:#aaa;">Hechizo ${_extractNum(n.id)} <span style="color:#888;font-size:0.9em;">(${n.hex} HEX)</span></div>
               <div style="color:#aaa;text-decoration:line-through;font-size:0.8em;">${_esc(n.nombreOriginal || n.id)} (${n.hex} HEX)</div>
           </div>`; // 🌟 CORRECCIÓN DEL GRIS EN PANEL

    panel.innerHTML = `${dlHTML}
    <div style="padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #2a1060;">
            <div style="min-width:0;">
                ${headerNombre}
                <div style="color:#aaa;font-size:0.7em;margin-top:2px;">${_esc(n.afinidad || '—')} · ${n.hex} HEX · ${_esc(n.clase)}</div>
            </div>
            <button onclick="window.devMapa.toggleVis('${sid}')"
                style="${visStyle}border-radius:4px;padding:4px 8px;cursor:pointer;font-size:0.72em;font-weight:bold;flex-shrink:0;">
                ${esConocido ? '👁️ Desc.' : '🔒 Sellado'}
            </button>
        </div>

        <div style="display:flex;flex-direction:column;gap:9px;">
            <div>
                <label style="${lbl}">ID</label>
                <div style="background:#0a0020;color:#aaa;border:1px solid #222;border-radius:4px;padding:6px;font-size:0.85em;">${_esc(n.id)}</div>
            </div>
            <div>
                <label style="${lbl}">NOMBRE</label>
                <input type="text" value="${_esc(n.nombreOriginal)}"
                    onchange="window.__devEditNodo && window.devMapa.actualizarCampo(window.__devEditNodo.id, 'nombreOriginal', this.value)"
                    style="${inp}">
            </div>
            <div style="display:flex;gap:6px;">
                <div style="flex:1;">
                    <label style="${lbl}">HEX</label>
                    <input type="number" step="50" value="${n.hex}"
                        onchange="window.__devEditNodo && window.devMapa.actualizarCampo(window.__devEditNodo.id, 'hex', parseInt(this.value)||0)"
                        style="${inp}">
                </div>
                <div style="flex:1;">
                    <label style="${lbl}">CLASE</label>
                    <select onchange="window.__devEditNodo && window.devMapa.actualizarCampo(window.__devEditNodo.id, 'clase', this.value)" style="${inp}">
                        ${['Clase 1','Clase 2','Clase 3','Clase 4','Clase 5'].map(c =>
                            `<option value="${c}"${n.clase===c?' selected':''}>${c}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
            <div>
                <label style="${lbl}">AFINIDAD</label>
                <input type="text" list="mm-dl-af" value="${_esc(n.afinidad)}"
                    onchange="window.__devEditNodo && window.devMapa.actualizarCampo(window.__devEditNodo.id, 'afinidad', this.value)"
                    style="${inp}">
            </div>
            <div>
                <label style="${lbl}">RESUMEN</label>
                <textarea onchange="window.__devEditNodo && window.devMapa.actualizarCampo(window.__devEditNodo.id, 'resumen', this.value)"
                    style="${inp}height:42px;resize:none;">${_esc(n.resumen)}</textarea>
            </div>
            <div>
                <label style="${lbl}">EFECTO MECÁNICO</label>
                <textarea onchange="window.__devEditNodo && window.devMapa.actualizarCampo(window.__devEditNodo.id, 'efecto', this.value)"
                    style="${inp}height:55px;resize:none;">${_esc(n.efecto)}</textarea>
            </div>
            <div>
                <label style="${lbl};color:#ff9999;">OVERCAST (100%)</label>
                <input type="text" value="${_esc(n.overcast)}"
                    onchange="window.__devEditNodo && window.devMapa.actualizarCampo(window.__devEditNodo.id, 'overcast', this.value)"
                    style="${inp}">
            </div>
            <div>
                <label style="${lbl};color:#99aaff;">UNDERCAST (50%)</label>
                <input type="text" value="${_esc(n.undercast)}"
                    onchange="window.__devEditNodo && window.devMapa.actualizarCampo(window.__devEditNodo.id, 'undercast', this.value)"
                    style="${inp}">
            </div>
            <div>
                <label style="${lbl};color:#d4af37;">REGLA ESPECIAL</label>
                <input type="text" value="${_esc(n.especial)}"
                    onchange="window.__devEditNodo && window.devMapa.actualizarCampo(window.__devEditNodo.id, 'especial', this.value)"
                    style="${inp}">
            </div>
            <button onclick="window.devMapa.eliminarSeleccion()"
                style="width:100%;background:#4a0000;border:1px solid #ff0000;border-radius:6px;color:white;padding:10px;font-weight:bold;margin-top:6px;cursor:pointer;font-family:'Cinzel';font-size:0.78em;">
                🗑️ DESTRUIR NODO
            </button>
        </div>
    </div>`;
}

// ── TOOLBAR ───────────────────────────────────────────────────
function _actualizarToolbar() {
    const herr = mapaDevState.herramienta;
    const ids  = { cursor: 'mm-tool-cursor', enlace: 'mm-tool-enlace', 'eliminar-enlace': 'mm-tool-cortar' };
    Object.values(ids).forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const isCut = id === 'mm-tool-cortar';
        el.style.background = '#111';
        el.style.color = isCut ? '#ff4444' : '#00ffff';
    });
    const activeId = ids[herr];
    if (activeId) {
        const el = document.getElementById(activeId);
        if (el) {
            el.style.background = herr === 'eliminar-enlace' ? '#ff4444' : '#00ffff';
            el.style.color      = '#000';
        }
    }
}

// ── CONTADOR DE PENDIENTES ────────────────────────────────────
function _marcarGuardar() {
    window.dispatchEvent(new Event('devDataChanged'));
    const p   = contarCambiosPendientes();
    const div = document.getElementById('mm-pendientes');
    if (div) {
        div.style.display = p > 0 ? 'block' : 'none';
        div.textContent   = `⏳ ${p} cambio${p !== 1 ? 's' : ''} pendiente${p !== 1 ? 's' : ''} — usa 🔥 GUARDAR TODO`;
    }
}

// ── VISTA: LISTA ──────────────────────────────────────────────
function _htmlVistaLista() {
    const { busqueda, filtroAfinidad, filtroVisibilidad } = mapaDevState;
    const afinidades = getAfinidadesUnicas();
    const nodos      = getNodosFiltrados();
    const total      = mapaDevState.nodosDB.length;
    const conocidos  = mapaDevState.nodosDB.filter(n =>
        (mapaDevState.colaVisibilidad[n.id] !== undefined ? mapaDevState.colaVisibilidad[n.id] : n.esConocido)
    ).length;

    let html = `
    <div style="display:flex;gap:8px;margin-bottom:8px;font-size:0.78em;text-align:center;">
        <div style="flex:1;background:#0a0020;border:1px solid #333;border-radius:6px;padding:6px;">
            <span style="color:#b060ff;font-weight:bold;">${total}</span> <span style="color:#555;">Total</span></div>
        <div style="flex:1;background:#0a0020;border:1px solid #b896ff;border-radius:6px;padding:6px;">
            <span style="color:#b896ff;font-weight:bold;">${conocidos}</span> <span style="color:#555;">Desc.</span></div>
        <div style="flex:1;background:#0a0020;border:1px solid #d4af37;border-radius:6px;padding:6px;">
            <span style="color:#d4af37;font-weight:bold;">${total-conocidos}</span> <span style="color:#555;">Sellados</span></div>
    </div>
    <input type="text" value="${busqueda}" placeholder="🔍 Buscar por ID o nombre real..."
        oninput="window.devMapa.setBusqueda(this.value)"
        style="width:100%;box-sizing:border-box;background:#000;color:#fff;border:1px solid #444;border-radius:6px;padding:7px 10px;margin-bottom:7px;font-family:'Rajdhani';font-size:0.92em;outline:none;">
    <div style="display:flex;gap:6px;margin-bottom:8px;">
        <select onchange="window.devMapa.setFiltroAf(this.value)"
            style="flex:1;background:#0a0020;color:#ddd;border:1px solid #555;border-radius:4px;padding:5px;font-family:'Rajdhani';font-size:0.82em;">
            <option value="">— Afinidad —</option>
            ${afinidades.map(a=>`<option value="${a}"${filtroAfinidad===a?' selected':''}>${a}</option>`).join('')}
        </select>
        <select onchange="window.devMapa.setFiltroVis(this.value)"
            style="flex:1;background:#0a0020;color:#ddd;border:1px solid #555;border-radius:4px;padding:5px;font-family:'Rajdhani';font-size:0.82em;">
            <option value="todos"     ${filtroVisibilidad==='todos'    ?'selected':''}>Todos</option>
            <option value="conocidos" ${filtroVisibilidad==='conocidos'?'selected':''}>👁️ Desc.</option>
            <option value="ocultos"   ${filtroVisibilidad==='ocultos'  ?'selected':''}>🔒 Sellados</option>
        </select>
    </div>
    <div style="display:flex;flex-direction:column;gap:5px;">`;

    if (!nodos.length) {
        html += `<div style="color:#555;font-style:italic;text-align:center;padding:20px;">Sin resultados.</div>`;
    } else {
        nodos.forEach(nodo => {
            const esConocido = getVisibilidadActual(nodo.id);
            const cambio     = mapaDevState.colaVisibilidad[nodo.id] !== undefined;
            const colorBorde = esConocido ? '#b896ff' : '#d4af37';
            const safeId     = nodo.id.replace(/'/g, "\\'");

            const textoMostrado = esConocido
                ? `<span style="color:#ddd;font-weight:bold;">${_esc(nodo.nombreOriginal || nodo.id)}</span>`
                : `<span style="color:#888;">Hechizo ${_extractNum(nodo.id)}</span> <span style="color:#aaa;text-decoration:line-through;font-size:0.82em;margin-left:4px;">${_esc(nodo.nombreOriginal || nodo.id)}</span>`; // 🌟 CORRECCIÓN EN LISTA

            html += `
            <div style="background:#0a0020;border:1px solid ${esConocido?'#2a1060':'#1a1510'};border-left:3px solid ${colorBorde};border-radius:6px;padding:7px 11px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <div style="min-width:0;flex:1;">
                    <div style="font-size:0.84em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${textoMostrado}${cambio?' <span style="color:#ffaa00;font-size:0.8em;">●</span>':''}
                    </div>
                    <div style="color:${esConocido?'#b896ff':'#d4af37'};font-size:0.7em;margin-top:2px;opacity:0.7;">${_esc(nodo.afinidad||'—')}${nodo.hex?' · '+nodo.hex+' HEX':''}${nodo.clase?' · '+nodo.clase:''}</div>
                </div>
                <button onclick="window.devMapa.toggleVis('${safeId}')"
                    style="background:${esConocido?'rgba(200,60,60,0.2)':'rgba(0,180,100,0.2)'};color:${esConocido?'#ff8888':'#00cc88'};border:1px solid ${esConocido?'#aa3333':'#00aa66'};border-radius:4px;padding:4px 8px;cursor:pointer;font-size:0.74em;font-weight:bold;flex-shrink:0;">
                    ${esConocido?'🔒 Sellar':'👁️ Desc.'}
                </button>
            </div>`;
        });
    }
    html += `</div>`;
    return html;
}

// ── HELPERS ───────────────────────────────────────────────────
function _extractNum(id) {
    const m = String(id || '').match(/\d+/);
    return m ? m[0] : id;
}

function _esc(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
