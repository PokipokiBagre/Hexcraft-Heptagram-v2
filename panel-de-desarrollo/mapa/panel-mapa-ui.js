// ============================================================
// panel-mapa-ui.js — Canvas interactivo embebido (Panel Dev)
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
    contarCambiosPendientes
} from './panel-mapa-logic.js';

// ── Estado interno del mini-canvas ───────────────────────────
const miniMapa = {
    canvas: null,
    ctx: null,
    camara: { x: 0, y: 0, zoom: 0.18 },
    interaccion: {
        isDraggingBg: false,
        lastMouseX: 0,
        lastMouseY: 0,
        hoveredNode: null,
        selectedNode: null,
    },
    loopActivo: false,
    rafId: null,
};

// ── Exponer funciones para onclick inline ─────────────────────
window.devMapa = {
    toggleVisibilidad: (id) => { toggleVisibilidadNodo(id); _actualizarTooltipById(id); },
    setBusqueda:  (t) => setBusquedaMapa(t),
    setFiltroAf:  (v) => setFiltroAfinidad(v),
    setFiltroVis: (v) => setFiltroVisibilidad(v),
    setVista:     (v) => { setVistaMapaDev(v); renderColumnaMapa(); },
    editarColor:  (af, hex) => editarColorAfinidad(af, hex),
    abrirMapa:    () => window.open('../mapa/index.html', '_blank'),
    centrarCamara:() => { _centrarCamaraAuto(); },
};

// ── RENDER PRINCIPAL ──────────────────────────────────────────
export function renderColumnaMapa() {
    const contenedor = document.getElementById('content-mapa');
    if (!contenedor) return;

    const pendientes = contarCambiosPendientes();
    const { vistaActiva } = mapaDevState;
    const esCanvas = !vistaActiva || vistaActiva === 'canvas' || vistaActiva === 'nodos';

    const tabStyle = (activa) => activa
        ? 'background:#4a1880; color:#fff; border-color:#b060ff;'
        : 'background:#111; color:#888; border-color:#444;';

    let html = `
    <div style="display:flex; gap:6px; margin-bottom:10px; align-items:center; flex-wrap:wrap;">
        <button onclick="window.devMapa.setVista('canvas')"
            style="${tabStyle(esCanvas)} padding:6px 12px; border:1px solid; border-radius:6px; cursor:pointer; font-family:'Cinzel'; font-size:0.78em; font-weight:bold;">
            🗺️ Mapa Visual
        </button>
        <button onclick="window.devMapa.setVista('lista')"
            style="${tabStyle(vistaActiva === 'lista')} padding:6px 12px; border:1px solid; border-radius:6px; cursor:pointer; font-family:'Cinzel'; font-size:0.78em; font-weight:bold;">
            📋 Lista
        </button>
        <button onclick="window.devMapa.setVista('colores')"
            style="${tabStyle(vistaActiva === 'colores')} padding:6px 12px; border:1px solid; border-radius:6px; cursor:pointer; font-family:'Cinzel'; font-size:0.78em; font-weight:bold;">
            🎨 Colores
        </button>
        <button onclick="window.devMapa.abrirMapa()"
            style="margin-left:auto; background:#003366; color:#00ffff; border:1px solid #00ffff; padding:6px 12px; border-radius:6px; cursor:pointer; font-family:'Cinzel'; font-size:0.78em; font-weight:bold;">
            ↗️ Ver Mapa Completo
        </button>
    </div>`;

    if (pendientes > 0) {
        html += `<div style="background:rgba(74,24,128,0.25); border:1px dashed #b060ff; border-radius:6px; padding:7px 12px; margin-bottom:8px; font-size:0.78em; color:#cc88ff;">
            ⏳ ${pendientes} cambio${pendientes > 1 ? 's' : ''} pendiente${pendientes > 1 ? 's' : ''} — usa 🔥 GUARDAR TODO
        </div>`;
    }

    if (esCanvas)                      html += _htmlVistaCanvas();
    else if (vistaActiva === 'lista')   html += _htmlVistaLista();
    else if (vistaActiva === 'colores') html += _htmlVistaColores();

    contenedor.innerHTML = html;

    if (esCanvas) {
        requestAnimationFrame(() => _montarCanvas());
    }
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

    return `
    <div style="display:flex; gap:8px; margin-bottom:8px; font-size:0.78em; text-align:center; align-items:center;">
        <div style="flex:1; background:#0a0020; border:1px solid #333; border-radius:6px; padding:6px;">
            <span style="color:#b060ff; font-weight:bold;">${total}</span> <span style="color:#555;">Total</span>
        </div>
        <div style="flex:1; background:#0a0020; border:1px solid #00cc88; border-radius:6px; padding:6px;">
            <span style="color:#00cc88; font-weight:bold;">${conocidos}</span> <span style="color:#555;">Desc.</span>
        </div>
        <div style="flex:1; background:#0a0020; border:1px solid #555; border-radius:6px; padding:6px;">
            <span style="color:#888; font-weight:bold;">${total - conocidos}</span> <span style="color:#555;">Sellados</span>
        </div>
        <button onclick="window.devMapa.centrarCamara()"
            style="background:#111; color:#aaa; border:1px solid #444; border-radius:6px; padding:6px 10px; cursor:pointer; font-size:1em;" title="Centrar vista">⌖</button>
    </div>

    <div style="position:relative; width:100%; height:520px; background:#05000a; border:1px solid #2a1060; border-radius:8px; overflow:hidden;">
        <canvas id="mini-mapa-canvas" style="display:block; width:100%; height:100%; cursor:grab;"></canvas>

        <div id="mini-mapa-tooltip" style="display:none; position:absolute; bottom:10px; left:10px; right:10px; background:rgba(8,0,18,0.96); border:1px solid #4a1880; border-radius:8px; padding:10px 14px; pointer-events:none; z-index:10;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <div style="min-width:0;">
                    <div id="mmt-nombre" style="font-weight:bold; color:#ddd; font-size:0.88em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></div>
                    <div id="mmt-meta"   style="color:#666; font-size:0.72em; margin-top:2px;"></div>
                </div>
                <div id="mmt-btn-area" style="flex-shrink:0; pointer-events:auto;"></div>
            </div>
        </div>

        <div style="position:absolute; top:8px; right:10px; color:#2a2a2a; font-size:0.68em; text-align:right; pointer-events:none; line-height:1.6;">
            Scroll: zoom<br>Arrastrar: mover<br>Click: desc./sellar
        </div>
    </div>`;
}

// ── MONTAR Y ENLAZAR EL CANVAS ────────────────────────────────
function _montarCanvas() {
    const canvas = document.getElementById('mini-mapa-canvas');
    if (!canvas) return;

    // Detener loop previo si existe
    if (miniMapa.rafId) {
        cancelAnimationFrame(miniMapa.rafId);
        miniMapa.rafId    = null;
        miniMapa.loopActivo = false;
    }

    miniMapa.canvas = canvas;
    miniMapa.ctx    = canvas.getContext('2d', { alpha: false });
    miniMapa.interaccion.hoveredNode  = null;
    miniMapa.interaccion.selectedNode = null;
    miniMapa.interaccion.isDraggingBg = false;

    _redimensionarCanvas();
    _centrarCamaraAuto();
    _engacharEventos(canvas);
    _iniciarLoop();
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
    const zx = rect.width  / (w * 1.12);
    const zy = rect.height / (h * 1.12);
    miniMapa.camara.zoom = Math.min(zx, zy, 1.5);
    miniMapa.camara.x = (rect.width  / 2) - ((minX + w / 2) * miniMapa.camara.zoom);
    miniMapa.camara.y = (rect.height / 2) - ((minY + h / 2) * miniMapa.camara.zoom);
}

// ── EVENTOS ───────────────────────────────────────────────────
function _engacharEventos(canvas) {
    const pos = (cx, cy) => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (cx - rect.left  - miniMapa.camara.x) / miniMapa.camara.zoom,
            y: (cy - rect.top - miniMapa.camara.y) / miniMapa.camara.zoom
        };
    };

    const hitNodo = (wx, wy) => {
        // radio mínimo de hit en coordenadas mundo: 14px en pantalla
        const minR = 14 / miniMapa.camara.zoom;
        for (let i = mapaDevState.nodosDB.length - 1; i >= 0; i--) {
            const n = mapaDevState.nodosDB[i];
            const r = Math.max(n.radio || 28, minR);
            if (Math.hypot(n.x - wx, n.y - wy) <= r) return n;
        }
        return null;
    };

    canvas.addEventListener('mousedown', (e) => {
        const wp   = pos(e.clientX, e.clientY);
        const nodo = hitNodo(wp.x, wp.y);
        if (nodo) {
            miniMapa.interaccion.selectedNode = nodo;
            toggleVisibilidadNodo(nodo.id);
            _actualizarTooltip(nodo);
        } else {
            miniMapa.interaccion.isDraggingBg = true;
            miniMapa.interaccion.selectedNode = null;
        }
        miniMapa.interaccion.lastMouseX = e.clientX;
        miniMapa.interaccion.lastMouseY = e.clientY;
        canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mousemove', (e) => {
        const dx = e.clientX - miniMapa.interaccion.lastMouseX;
        const dy = e.clientY - miniMapa.interaccion.lastMouseY;
        if (miniMapa.interaccion.isDraggingBg) {
            miniMapa.camara.x += dx;
            miniMapa.camara.y += dy;
        } else {
            const wp   = pos(e.clientX, e.clientY);
            const nodo = hitNodo(wp.x, wp.y);
            if (nodo !== miniMapa.interaccion.hoveredNode) {
                miniMapa.interaccion.hoveredNode = nodo;
                canvas.style.cursor = nodo ? 'pointer' : 'grab';
                if (nodo) _actualizarTooltip(nodo);
                else      _ocultarTooltip();
            }
        }
        miniMapa.interaccion.lastMouseX = e.clientX;
        miniMapa.interaccion.lastMouseY = e.clientY;
    });

    canvas.addEventListener('mouseup',    () => { miniMapa.interaccion.isDraggingBg = false; canvas.style.cursor = miniMapa.interaccion.hoveredNode ? 'pointer' : 'grab'; });
    canvas.addEventListener('mouseleave', () => { miniMapa.interaccion.isDraggingBg = false; miniMapa.interaccion.hoveredNode = null; _ocultarTooltip(); canvas.style.cursor = 'grab'; });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault(); e.stopPropagation();
        const f = e.deltaY > 0 ? 0.88 : 1.14;
        const nz = Math.max(0.02, Math.min(miniMapa.camara.zoom * f, 6));
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        miniMapa.camara.x = mx - (mx - miniMapa.camara.x) * (nz / miniMapa.camara.zoom);
        miniMapa.camara.y = my - (my - miniMapa.camara.y) * (nz / miniMapa.camara.zoom);
        miniMapa.camara.zoom = nz;
    }, { passive: false });

    // Touch
    let pinchDist = 0;
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            const t  = e.touches[0];
            const wp = pos(t.clientX, t.clientY);
            const n  = hitNodo(wp.x, wp.y);
            if (n) { toggleVisibilidadNodo(n.id); _actualizarTooltip(n); }
            else   miniMapa.interaccion.isDraggingBg = true;
            miniMapa.interaccion.lastMouseX = t.clientX;
            miniMapa.interaccion.lastMouseY = t.clientY;
        } else if (e.touches.length === 2) {
            miniMapa.interaccion.isDraggingBg = false;
            pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && miniMapa.interaccion.isDraggingBg) {
            const t = e.touches[0];
            miniMapa.camara.x += t.clientX - miniMapa.interaccion.lastMouseX;
            miniMapa.camara.y += t.clientY - miniMapa.interaccion.lastMouseY;
            miniMapa.interaccion.lastMouseX = t.clientX;
            miniMapa.interaccion.lastMouseY = t.clientY;
        } else if (e.touches.length === 2) {
            const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            if (pinchDist > 0) {
                const nz   = Math.max(0.02, Math.min(miniMapa.camara.zoom * (d / pinchDist), 6));
                const rect = canvas.getBoundingClientRect();
                const mx   = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
                const my   = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;
                miniMapa.camara.x = mx - (mx - miniMapa.camara.x) * (nz / miniMapa.camara.zoom);
                miniMapa.camara.y = my - (my - miniMapa.camara.y) * (nz / miniMapa.camara.zoom);
                miniMapa.camara.zoom = nz;
            }
            pinchDist = d;
        }
    }, { passive: false });

    canvas.addEventListener('touchend', () => { miniMapa.interaccion.isDraggingBg = false; pinchDist = 0; });
}

// ── TOOLTIP ───────────────────────────────────────────────────
function _actualizarTooltip(nodo) {
    const tip    = document.getElementById('mini-mapa-tooltip');
    const nomEl  = document.getElementById('mmt-nombre');
    const metaEl = document.getElementById('mmt-meta');
    const btnEl  = document.getElementById('mmt-btn-area');
    if (!tip || !nomEl) return;

    const esConocido = getVisibilidadActual(nodo.id);
    const colorAf    = _colorAf(nodo.afinidad);
    const safeId     = nodo.id.replace(/'/g, "\\'");

    nomEl.textContent = nodo.nombreOriginal || nodo.id;
    nomEl.style.color = esConocido ? '#ddd' : '#888';
    metaEl.innerHTML  = `<span style="color:${colorAf}">${nodo.afinidad || '—'}</span>&nbsp;&nbsp;${nodo.hex ? nodo.hex + ' HEX' : ''}&nbsp;&nbsp;${nodo.clase || ''}`;
    btnEl.innerHTML   = `<button onclick="window.devMapa.toggleVisibilidad('${safeId}')"
        style="background:${esConocido ? 'rgba(200,60,60,0.25)':'rgba(0,180,100,0.25)'}; color:${esConocido ? '#ff8888':'#00cc88'}; border:1px solid ${esConocido ? '#aa3333':'#00aa66'}; border-radius:4px; padding:5px 10px; cursor:pointer; font-size:0.8em; font-weight:bold;">
        ${esConocido ? '🔒 Sellar' : '👁️ Descubrir'}
    </button>`;
    tip.style.display = 'block';
}

function _actualizarTooltipById(id) {
    const nodo = mapaDevState.nodosDB.find(n => n.id === id);
    if (nodo) _actualizarTooltip(nodo);
}

function _ocultarTooltip() {
    const tip = document.getElementById('mini-mapa-tooltip');
    if (tip) tip.style.display = 'none';
}

// ── LOOP DE RENDER ────────────────────────────────────────────
function _iniciarLoop() {
    miniMapa.loopActivo = true;
    const tick = () => {
        if (!miniMapa.canvas?.isConnected) { miniMapa.loopActivo = false; return; }
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

        const angle  = Math.atan2(t.y - s.y, t.x - s.x);
        const r      = (t.radio || 20);
        const tx     = t.x - Math.cos(angle) * (r + 3 / sf);
        const ty     = t.y - Math.sin(angle) * (r + 3 / sf);

        const sV = getVisibilidadActual(s.id);
        const tV = getVisibilidadActual(t.id);
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
        const isHovered  = miniMapa.interaccion.hoveredNode  === nodo;
        const isSelected = miniMapa.interaccion.selectedNode === nodo;
        const colorAf    = _colorAf(nodo.afinidad);

        const r     = nodo.radio || (esConocido ? 35 : 28);
        const rCore = Math.max(1, r - 7);

        ctx.globalAlpha = esConocido ? 1.0 : 0.55;
        ctx.shadowBlur  = (isHovered || isSelected) ? 22 / sf : (esConocido ? 4 / sf : 0);
        ctx.shadowColor = esConocido ? colorAf : '#888';

        // Fondo exterior
        ctx.beginPath(); ctx.arc(nodo.x, nodo.y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#111'; ctx.fill();

        // Anillo intermedio gap
        ctx.beginPath(); ctx.arc(nodo.x, nodo.y, Math.max(1, r - 3), 0, Math.PI * 2);
        ctx.fillStyle = '#111'; ctx.fill();

        // Core
        ctx.beginPath(); ctx.arc(nodo.x, nodo.y, rCore, 0, Math.PI * 2);
        if (esConocido) {
            ctx.fillStyle = colorAf;
            ctx.globalAlpha = 0.88;
            ctx.fill();
            ctx.globalAlpha = esConocido ? 1.0 : 0.55;
        } else {
            ctx.fillStyle = '#111'; ctx.fill();
            ctx.fillStyle = colorAf; ctx.globalAlpha = 0.12; ctx.fill();
            ctx.globalAlpha = 0.55;
        }

        ctx.shadowBlur = 0;

        // Borde
        ctx.beginPath(); ctx.arc(nodo.x, nodo.y, r, 0, Math.PI * 2);
        ctx.lineWidth   = ((isHovered || isSelected) ? 3.5 : 1.8) / sf;
        ctx.strokeStyle = esConocido ? colorAf : 'rgba(150,150,150,0.35)';
        if (!esConocido) ctx.setLineDash([5 / sf, 4 / sf]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;

        // Texto
        if (miniMapa.camara.zoom > 0.06 || isHovered || isSelected) {
            const fs = Math.round((esConocido ? 28 : 22) + (isHovered ? 6 : 0));
            ctx.font = `bold ${fs}px sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            const texto = esConocido
                ? `${nodo.nombreOriginal} (${nodo.hex})`
                : `${nodo.id} (${nodo.hex})`;
            const ty2 = nodo.y + r + 9 / sf;
            ctx.lineWidth   = 5 / sf;
            ctx.strokeStyle = 'rgba(0,0,0,0.95)'; ctx.strokeText(texto, nodo.x, ty2);
            ctx.fillStyle   = esConocido ? (isHovered ? '#fff' : colorAf) : 'rgba(130,130,130,0.65)';
            ctx.fillText(texto, nodo.x, ty2);
        }
    });
}

// ── VISTA: LISTA ──────────────────────────────────────────────
function _htmlVistaLista() {
    const { busqueda, filtroAfinidad, filtroVisibilidad } = mapaDevState;
    const afinidades = getAfinidadesUnicas();
    const nodos      = getNodosFiltrados();
    const total      = mapaDevState.nodosDB.length;
    const conocidos  = mapaDevState.nodosDB.filter(n =>
        (mapaDevState.colaVisibilidad[n.id] !== undefined
            ? mapaDevState.colaVisibilidad[n.id]
            : n.esConocido)
    ).length;

    let html = `
    <div style="display:flex; gap:8px; margin-bottom:8px; font-size:0.78em; text-align:center;">
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
            <option value="todos"    ${filtroVisibilidad==='todos'    ?'selected':''}>Todos</option>
            <option value="conocidos"${filtroVisibilidad==='conocidos'?'selected':''}>👁️ Desc.</option>
            <option value="ocultos"  ${filtroVisibilidad==='ocultos'  ?'selected':''}>🔒 Sellados</option>
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
                        ${nodo.nombreOriginal||nodo.id}${cambio?' <span style="color:#ffaa00;font-size:0.8em;">●</span>':''}
                    </div>
                    <div style="color:${colorAf};font-size:0.7em;margin-top:2px;">${nodo.afinidad||'—'} ${nodo.hex?'· '+nodo.hex+' HEX':''} ${nodo.clase?'· '+nodo.clase:''}</div>
                </div>
                <button onclick="window.devMapa.toggleVisibilidad('${safeId}')"
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
    let html = `<div style="color:#555;font-size:0.78em;margin-bottom:10px;">Los cambios de color se aplican al guardar 🔥</div><div style="display:flex;flex-direction:column;gap:5px;">`;
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

// ── HELPER ────────────────────────────────────────────────────
function _colorAf(afinidad) {
    return mapaDevState.colaColores[afinidad]?.t
        ?? window.mapaColores?.[afinidad]?.t
        ?? '#888888';
}
