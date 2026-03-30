// ============================================================
// panel-mapa-ui.js — Canvas editor embebido (Panel Dev)
// Siempre en modo edición: selección, arrastrar, crear/editar/borrar nodos y flechas
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
    editarColorAfinidad,
    contarCambiosPendientes,
    crearNodoDev,
    crearEnlaceDev,
    eliminarEnlaceDev,
    eliminarNodosDev,
    actualizarDatoNodoDev,
} from './panel-mapa-logic.js';

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

// ── API pública expuesta al HTML inline ───────────────────────
window.devMapa = {
    setVista:    (v) => { setVistaMapaDev(v); renderColumnaMapa(); },
    setBusqueda: (t) => setBusquedaMapa(t),
    setFiltroAf: (v) => setFiltroAfinidad(v),
    setFiltroVis:(v) => setFiltroVisibilidad(v),
    editarColor: (af, hex) => editarColorAfinidad(af, hex),
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
        toggleVisibilidadNodo(id);
        _renderPropiedades();
        _marcarGuardar();
    },
};

// ── RENDER PRINCIPAL ──────────────────────────────────────────
export function renderColumnaMapa() {
    const contenedor = document.getElementById('content-mapa');
    if (!contenedor) return;

    const pendientes = contarCambiosPendientes();
    const { vistaActiva } = mapaDevState;
    const esCanvas = !vistaActiva || vistaActiva === 'canvas' || vistaActiva === 'nodos';

    const tabStyle = (activa) => activa
        ? 'background:#4a1880;color:#fff;border-color:#b060ff;'
        : 'background:#111;color:#888;border-color:#444;';

    let html = `
    <div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap;">
        <button onclick="window.devMapa.setVista('canvas')" style="${tabStyle(esCanvas)}padding:6px 12px;border:1px solid;border-radius:6px;cursor:pointer;font-family:'Cinzel';font-size:0.78em;font-weight:bold;">🗺️ Mapa Visual</button>
        <button onclick="window.devMapa.setVista('lista')"  style="${tabStyle(vistaActiva==='lista')}padding:6px 12px;border:1px solid;border-radius:6px;cursor:pointer;font-family:'Cinzel';font-size:0.78em;font-weight:bold;">📋 Lista</button>
        <button onclick="window.devMapa.setVista('colores')" style="${tabStyle(vistaActiva==='colores')}padding:6px 12px;border:1px solid;border-radius:6px;cursor:pointer;font-family:'Cinzel';font-size:0.78em;font-weight:bold;">🎨 Colores</button>
        <button onclick="window.devMapa.abrirMapa()" style="margin-left:auto;background:#003366;color:#00ffff;border:1px solid #00ffff;padding:6px 12px;border-radius:6px;cursor:pointer;font-family:'Cinzel';font-size:0.78em;font-weight:bold;">↗️ Mapa Completo</button>
    </div>
    <div id="mm-pendientes" style="background:rgba(74,24,128,0.25);border:1px dashed #b060ff;border-radius:6px;padding:7px 12px;margin-bottom:8px;font-size:0.78em;color:#cc88ff;display:${pendientes > 0 ? 'block' : 'none'};">
        ⏳ ${pendientes} cambio${pendientes !== 1 ? 's' : ''} pendiente${pendientes !== 1 ? 's' : ''} — usa 🔥 GUARDAR TODO
    </div>`;

    if (esCanvas)                       html += _htmlVistaCanvas();
    else if (vistaActiva === 'lista')   html += _htmlVistaLista();
    else if (vistaActiva === 'colores') html += _htmlVistaColores();

    contenedor.innerHTML = html;

    if (esCanvas) requestAnimationFrame(() => _montarCanvas());
}

// ── HTML DEL CANVAS (con toolbar y panel de propiedades) ──────
function _htmlVistaCanvas() {
    const nodos     = mapaDevState.nodosDB;
    const total     = nodos.length;
    const conocidos = nodos.filter(n =>
        mapaDevState.colaVisibilidad[n.id] !== undefined
            ? mapaDevState.colaVisibilidad[n.id]
            : n.esConocido
    ).length;

    return `
    <!-- Estadísticas rápidas -->
    <div style="display:flex;gap:8px;margin-bottom:8px;font-size:0.78em;text-align:center;align-items:center;">
        <div style="flex:1;background:#0a0020;border:1px solid #333;border-radius:6px;padding:6px;">
            <span style="color:#b060ff;font-weight:bold;">${total}</span> <span style="color:#555;">Total</span>
        </div>
        <div style="flex:1;background:#0a0020;border:1px solid #00cc88;border-radius:6px;padding:6px;">
            <span style="color:#00cc88;font-weight:bold;">${conocidos}</span> <span style="color:#555;">Desc.</span>
        </div>
        <div style="flex:1;background:#0a0020;border:1px solid #555;border-radius:6px;padding:6px;">
            <span style="color:#888;font-weight:bold;">${total - conocidos}</span> <span style="color:#555;">Sellados</span>
        </div>
        <button onclick="window.devMapa.centrarCamara()"
            style="background:#111;color:#aaa;border:1px solid #444;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:1em;" title="Centrar vista">⌖</button>
    </div>

    <!-- Barra de herramientas -->
    <div style="display:flex;gap:6px;margin-bottom:8px;background:rgba(8,0,18,0.85);padding:8px;border-radius:8px;border:1px solid #2a1060;">
        <button id="mm-tool-cursor" onclick="window.devMapa.setHerramienta('cursor')"
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

    <!-- Canvas + Panel de propiedades -->
    <div style="display:flex;gap:8px;align-items:flex-start;">
        <!-- Canvas -->
        <div style="position:relative;flex:1;height:450px;background:#05000a;border:1px solid #2a1060;border-radius:8px;overflow:hidden;min-width:0;">
            <canvas id="mini-mapa-canvas" style="display:block;width:100%;height:100%;cursor:grab;"></canvas>
            <div style="position:absolute;top:8px;right:8px;color:#2a2a2a;font-size:0.62em;text-align:right;pointer-events:none;line-height:1.7;">
                Scroll: zoom<br>Drag: mover<br>SHIFT+drag fondo: caja
            </div>
        </div>
        <!-- Panel de propiedades -->
        <div id="mm-props-panel"
            style="width:255px;flex-shrink:0;background:rgba(8,0,18,0.95);border:1px solid #4a1880;border-radius:8px;overflow-y:auto;max-height:450px;font-size:0.82em;">
            <div style="padding:20px;text-align:center;color:#3a3a4a;line-height:1.8;">
                <div style="font-size:1.3em;margin-bottom:6px;">🗺️</div>
                <p style="margin:0 0 6px 0;">Haz clic en un nodo para editar sus propiedades.</p>
                <p style="margin:0;font-size:0.85em;">SHIFT + arrastra el fondo para seleccionar varios.</p>
            </div>
        </div>
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

    // Actualizar toolbar al montar (por si la herramienta cambió)
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

    // ── mousedown ────────────────────────────────────────────
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
            // cursor
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

    // ── mousemove ────────────────────────────────────────────
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
                // Registrar posición en cola
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

    // ── mouseup ──────────────────────────────────────────────
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
        } else if (miniMapa.inter.draggedNode) {
            if (miniMapa.inter.hasDragged) _marcarGuardar();
            // La selección ya se actualizó en mousedown
        } else if (miniMapa.inter.isDraggingBg && !miniMapa.inter.hasDragged && !e.shiftKey) {
            mapaDevState.seleccionMultiple.clear();
            _renderPropiedades();
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

    // Zoom
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

    // Touch (sólo pan básico en móvil)
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

    const sf = Math.max(miniMapa.camara.zoom, 0.04);

    // ── ENLACES ───────────────────────────────────────────────
    mapaDevState.enlacesDB.forEach(link => {
        const s = link.source;
        const t = link.target;
        if (!s || !t) return;
        const angle = Math.atan2(t.y - s.y, t.x - s.x);
        const r     = (t.radio || 20);
        const tx    = t.x - Math.cos(angle) * (r + 3 / sf);
        const ty    = t.y - Math.sin(angle) * (r + 3 / sf);

        const sV    = getVisibilidadActual(s.id);
        const tV    = getVisibilidadActual(t.id);
        const color = sV && tV  ? 'rgba(210,190,230,0.22)'
                    : sV || tV  ? 'rgba(212,175,55,0.28)'
                                : 'rgba(200,60,100,0.15)';

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
        const esConocido = getVisibilidadActual(nodo.id);
        const isHovered  = miniMapa.inter.hoveredNode  === nodo;
        const isSel      = mapaDevState.seleccionMultiple.has(nodo);
        const colorAf    = _colorAf(nodo.afinidad);

        const r     = nodo.radio || (esConocido ? 35 : 28);
        const rCore = Math.max(1, r - 7);

        ctx.globalAlpha = esConocido ? 1.0 : 0.55;
        ctx.shadowBlur  = (isHovered || isSel) ? 22 / sf : (esConocido ? 4 / sf : 0);
        ctx.shadowColor = esConocido ? colorAf : '#888';

        // Fondo
        ctx.beginPath(); ctx.arc(nodo.x, nodo.y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#111'; ctx.fill();

        // Core
        ctx.beginPath(); ctx.arc(nodo.x, nodo.y, rCore, 0, Math.PI * 2);
        if (esConocido) {
            ctx.fillStyle   = colorAf;
            ctx.globalAlpha = 0.88;
            ctx.fill();
            ctx.globalAlpha = 1.0;
        } else {
            ctx.fillStyle = '#111'; ctx.fill();
            ctx.fillStyle = colorAf; ctx.globalAlpha = 0.12; ctx.fill();
            ctx.globalAlpha = 0.55;
        }

        ctx.shadowBlur = 0;

        // Borde normal
        ctx.beginPath(); ctx.arc(nodo.x, nodo.y, r, 0, Math.PI * 2);
        ctx.lineWidth   = 1.8 / sf;
        ctx.strokeStyle = esConocido ? colorAf : 'rgba(150,150,150,0.35)';
        if (!esConocido) ctx.setLineDash([5 / sf, 4 / sf]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;

        // ── Anillo de selección (cyan) ────────────────────────
        if (isSel) {
            ctx.beginPath(); ctx.arc(nodo.x, nodo.y, r + 6 / sf, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0,255,255,0.85)';
            ctx.lineWidth   = 2 / sf;
            ctx.setLineDash([5 / sf, 3 / sf]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Etiqueta de sellado (🔒) si está oculto
        if (!esConocido) {
            ctx.font      = `bold ${Math.round(18 + 2)}px sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.globalAlpha = 0.45;
            ctx.fillText('🔒', nodo.x, nodo.y);
            ctx.globalAlpha = 1.0;
        }

        // Texto
        if (miniMapa.camara.zoom > 0.05 || isHovered || isSel) {
            const fs = Math.round((esConocido ? 26 : 20) + (isHovered ? 4 : 0));
            ctx.font        = `bold ${fs}px sans-serif`;
            ctx.textAlign   = 'center';
            ctx.textBaseline = 'top';
            const texto = esConocido
                ? `${nodo.nombreOriginal} (${nodo.hex})`
                : `${nodo.id} (${nodo.hex})`;
            const ty2 = nodo.y + r + 8 / sf;
            ctx.lineWidth   = 5 / sf;
            ctx.strokeStyle = 'rgba(0,0,0,0.95)'; ctx.strokeText(texto, nodo.x, ty2);
            ctx.fillStyle   = esConocido ? (isSel ? '#00ffff' : isHovered ? '#fff' : colorAf) : 'rgba(130,130,130,0.65)';
            ctx.fillText(texto, nodo.x, ty2);
        }
    });

    // ── LINK TEMPORAL (mientras arrastra herramienta flecha/cortar) ──
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
        // Punta
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

    // ── CAJA DE SELECCIÓN ─────────────────────────────────────
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
    const lbl    = `color:#888;font-weight:bold;font-size:0.75em;display:block;margin-bottom:3px;`;
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

    // ── 1 nodo seleccionado → form completo ───────────────────
    const n          = cands[0];
    const esConocido = getVisibilidadActual(n.id);
    const colorAf    = _colorAf(n.afinidad);
    const sid        = n.id.replace(/'/g, "\\'");

    // Guardamos referencia global para los onchange
    window.__devEditNodo = n;

    const visStyle = esConocido
        ? 'background:rgba(0,180,100,0.2);color:#00cc88;border:1px solid #00aa66;'
        : 'background:rgba(80,80,80,0.2);color:#888;border:1px solid #555;';

    panel.innerHTML = `${dlHTML}
    <div style="padding:12px;">

        <!-- Header: nombre + badge de visibilidad -->
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #2a1060;">
            <div style="min-width:0;">
                <div style="font-weight:bold;color:${colorAf || '#ddd'};font-size:0.88em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(n.nombreOriginal || n.id)}</div>
                <div style="color:#555;font-size:0.7em;margin-top:2px;">${_esc(n.afinidad || '—')} · ${n.hex} HEX · ${_esc(n.clase)}</div>
            </div>
            <button onclick="window.devMapa.toggleVis('${sid}')"
                style="${visStyle}border-radius:4px;padding:4px 8px;cursor:pointer;font-size:0.72em;font-weight:bold;flex-shrink:0;">
                ${esConocido ? '👁️ Desc.' : '🔒 Sellado'}
            </button>
        </div>

        <div style="display:flex;flex-direction:column;gap:9px;">

            <!-- ID (sólo lectura) -->
            <div>
                <label style="${lbl}">ID</label>
                <div style="background:#0a0020;color:#555;border:1px solid #222;border-radius:4px;padding:6px;font-size:0.85em;">${_esc(n.id)}</div>
            </div>

            <!-- Nombre -->
            <div>
                <label style="${lbl}">NOMBRE</label>
                <input type="text" value="${_esc(n.nombreOriginal)}"
                    onchange="window.__devEditNodo && window.devMapa.actualizarCampo(window.__devEditNodo.id, 'nombreOriginal', this.value)"
                    style="${inp}">
            </div>

            <!-- HEX + Clase -->
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

            <!-- Afinidad -->
            <div>
                <label style="${lbl}">AFINIDAD</label>
                <input type="text" list="mm-dl-af" value="${_esc(n.afinidad)}"
                    onchange="window.__devEditNodo && window.devMapa.actualizarCampo(window.__devEditNodo.id, 'afinidad', this.value)"
                    style="${inp}">
            </div>

            <!-- Resumen -->
            <div>
                <label style="${lbl}">RESUMEN</label>
                <textarea onchange="window.__devEditNodo && window.devMapa.actualizarCampo(window.__devEditNodo.id, 'resumen', this.value)"
                    style="${inp}height:42px;resize:none;">${_esc(n.resumen)}</textarea>
            </div>

            <!-- Efecto -->
            <div>
                <label style="${lbl}">EFECTO MECÁNICO</label>
                <textarea onchange="window.__devEditNodo && window.devMapa.actualizarCampo(window.__devEditNodo.id, 'efecto', this.value)"
                    style="${inp}height:55px;resize:none;">${_esc(n.efecto)}</textarea>
            </div>

            <!-- Overcast -->
            <div>
                <label style="${lbl};color:#ff9999;">OVERCAST (100%)</label>
                <input type="text" value="${_esc(n.overcast)}"
                    onchange="window.__devEditNodo && window.devMapa.actualizarCampo(window.__devEditNodo.id, 'overcast', this.value)"
                    style="${inp}">
            </div>

            <!-- Undercast -->
            <div>
                <label style="${lbl};color:#99aaff;">UNDERCAST (50%)</label>
                <input type="text" value="${_esc(n.undercast)}"
                    onchange="window.__devEditNodo && window.devMapa.actualizarCampo(window.__devEditNodo.id, 'undercast', this.value)"
                    style="${inp}">
            </div>

            <!-- Especial -->
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

// ── TOOLBAR: actualizar visual de herramienta activa ──────────
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

// ── ACTUALIZAR CONTADOR DE PENDIENTES ─────────────────────────
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
        <div style="flex:1;background:#0a0020;border:1px solid #00cc88;border-radius:6px;padding:6px;">
            <span style="color:#00cc88;font-weight:bold;">${conocidos}</span> <span style="color:#555;">Desc.</span></div>
        <div style="flex:1;background:#0a0020;border:1px solid #555;border-radius:6px;padding:6px;">
            <span style="color:#888;font-weight:bold;">${total-conocidos}</span> <span style="color:#555;">Sellados</span></div>
    </div>
    <input type="text" value="${busqueda}" placeholder="🔍 Buscar nodo..."
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
            const colorAf    = _colorAf(nodo.afinidad);
            const safeId     = nodo.id.replace(/'/g, "\\'");
            html += `
            <div style="background:#0a0020;border:1px solid ${esConocido?'#2a1060':'#1a1a1a'};border-left:3px solid ${colorAf};border-radius:6px;padding:7px 11px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <div style="min-width:0;">
                    <div style="font-weight:bold;color:${esConocido?'#ddd':'#666'};font-size:0.84em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${_esc(nodo.nombreOriginal||nodo.id)}${cambio?' <span style="color:#ffaa00;font-size:0.8em;">●</span>':''}
                    </div>
                    <div style="color:${colorAf};font-size:0.7em;margin-top:2px;">${_esc(nodo.afinidad||'—')}${nodo.hex?' · '+nodo.hex+' HEX':''}${nodo.clase?' · '+nodo.clase:''}</div>
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

// ── VISTA: COLORES ────────────────────────────────────────────
function _htmlVistaColores() {
    const afinidades = getAfinidadesUnicas();
    if (!afinidades.length) return `<div style="color:#555;text-align:center;padding:20px;">Sin afinidades cargadas.</div>`;
    let html = `<div style="color:#555;font-size:0.78em;margin-bottom:10px;">Los cambios de color se guardan con 🔥</div><div style="display:flex;flex-direction:column;gap:5px;">`;
    afinidades.forEach(af => {
        const col    = _colorAf(af);
        const enCola = mapaDevState.colaColores[af] !== undefined;
        const safeAf = af.replace(/'/g, "\\'");
        html += `
        <div style="background:#0a0020;border:1px solid ${enCola?'#ffaa00':'#222'};border-radius:6px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <span style="color:${col};font-weight:bold;font-size:0.85em;">${af}</span>
            ${enCola?`<span style="color:#ffaa00;font-size:0.72em;">●</span>`:''}
            <div style="display:flex;align-items:center;gap:8px;margin-left:auto;">
                <span style="color:#444;font-size:0.72em;">${col}</span>
                <input type="color" value="${col}" onchange="window.devMapa.editarColor('${safeAf}',this.value)"
                    style="width:32px;height:26px;background:none;border:1px solid #444;border-radius:4px;cursor:pointer;padding:1px;">
            </div>
        </div>`;
    });
    html += `</div>`;
    return html;
}

// ── HELPERS ───────────────────────────────────────────────────
function _colorAf(afinidad) {
    return mapaDevState.colaColores[afinidad]?.t
        ?? window.mapaColores?.[afinidad]?.t
        ?? '#888888';
}

function _esc(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
