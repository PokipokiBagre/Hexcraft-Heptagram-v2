// ============================================================
// region-engine.js — Motor hexagonal: geometría, render, cámara
// Sistema: "Offset flat-top" → coordenadas axiales (q, r)
// ============================================================

import {
    HEX_SIZE, camara, mapaActual, props, npcsMapaLocal,
    editor, ui, STORAGE_URL, CAPAS
} from './region-state.js';
import { db } from '../hex-db.js';

let canvas, ctx;
let imageCache = {};            // url → HTMLImageElement
let bgImage    = null;          // Imagen de fondo del mapa
let rafId      = null;

// ── Geometría Hexagonal (flat-top axial) ─────────────────────
// Flat-top: el hexágono tiene vértices en izquierda y derecha
const SQRT3 = Math.sqrt(3);

export function hexToPixel(q, r) {
    const size = HEX_SIZE * camara.zoom;
    const x = size * (3 / 2 * q);
    const y = size * (SQRT3 / 2 * q + SQRT3 * r);
    return { x: x + camara.x, y: y + camara.y };
}

export function pixelToHex(px, py) {
    const size = HEX_SIZE * camara.zoom;
    const x = (px - camara.x) / size;
    const y = (py - camara.y) / size;
    const q = (2 / 3) * x;
    const r = (-1 / 3) * x + (SQRT3 / 3) * y;
    return hexRound(q, r);
}

function hexRound(q, r) {
    const s = -q - r;
    let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
    const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs;
    else if (dr > ds) rr = -rq - rs;
    return { q: rq, r: rr };
}

export function hexKey(q, r) { return `${q},${r}`; }

export function hexNeighbors(q, r) {
    const dirs = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
    return dirs.map(([dq,dr]) => ({ q: q+dq, r: r+dr }));
}

export function hexesEnRadio(q, r, radio) {
    const result = [];
    for (let dq = -radio; dq <= radio; dq++) {
        for (let dr = Math.max(-radio,-dq-radio); dr <= Math.min(radio,-dq+radio); dr++) {
            result.push({ q: q+dq, r: r+dr });
        }
    }
    return result;
}

function hexVertices(cx, cy) {
    const size = HEX_SIZE * camara.zoom;
    const pts = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i);
        pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
    }
    return pts;
}

// ── Inicializar canvas ───────────────────────────────────────
export function inicializarEngine(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    redimensionar();
    window.addEventListener('resize', redimensionar);
    registrarEventos();
    iniciarLoop();
}

function redimensionar() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = window.innerWidth  * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width  = window.innerWidth  + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.scale(dpr, dpr);
}

// ── Loop de render ───────────────────────────────────────────
function iniciarLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    const loop = () => { dibujar(); rafId = requestAnimationFrame(loop); };
    loop();
}

export function dibujar() {
    if (!ctx) return;
    const W = canvas.width  / (window.devicePixelRatio || 1);
    const H = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, W, H);

    // ── Fondo ─────────────────────────────────────────────────
    if (bgImage && bgImage.complete) {
        ctx.globalAlpha = 0.18;
        const escala = Math.max(W / bgImage.naturalWidth, H / bgImage.naturalHeight);
        const bw = bgImage.naturalWidth * escala, bh = bgImage.naturalHeight * escala;
        ctx.drawImage(bgImage, (W - bw) / 2, (H - bh) / 2, bw, bh);
        ctx.globalAlpha = 1;
    } else {
        ctx.fillStyle = '#0a0014';
        ctx.fillRect(0, 0, W, H);
    }

    // ── Calcular rango visible de hexes ───────────────────────
    const size  = HEX_SIZE * camara.zoom;
    const margen = size * 2;
    const topLeft = pixelToHex(-margen, -margen);
    const botRight= pixelToHex(W + margen, H + margen);
    const qMin = topLeft.q - 2, qMax = botRight.q + 2;
    const rMin = topLeft.r - 2, rMax = botRight.r + 2;

    // ── Paso 1: Fondo de todos los hexes + regiones ───────────
    for (let q = qMin; q <= qMax; q++) {
        for (let r = rMin; r <= rMax; r++) {
            const key  = hexKey(q, r);
            const hex  = mapaActual.hexes[key];
            const { x: cx, y: cy } = hexToPixel(q, r);

            dibujarHexBase(q, r, cx, cy, hex, key);
        }
    }

    // ── Paso 2: Props por capa (background → mid → over) ─────
    for (const capa of CAPAS) {
        for (let q = qMin; q <= qMax; q++) {
            for (let r = rMin; r <= rMax; r++) {
                const key = hexKey(q, r);
                const hex = mapaActual.hexes[key];
                if (!hex || !hex[capa] || hex[capa].length === 0) continue;
                const { x: cx, y: cy } = hexToPixel(q, r);
                dibujarPropsCapa(hex[capa], cx, cy);
            }
        }
    }

    // ── Paso 3: NPCs ──────────────────────────────────────────
    Object.values(npcsMapaLocal).forEach(npc => {
        if (!npc.hex) return;
        const [nq, nr] = npc.hex.split(',').map(Number);
        const { x: cx, y: cy } = hexToPixel(nq, nr);
        dibujarNPC(npc, cx, cy);
    });

    // ── Paso 4: Overlay de selección y región ────────────────
    for (let q = qMin; q <= qMax; q++) {
        for (let r = rMin; r <= rMax; r++) {
            const key = hexKey(q, r);
            const { x: cx, y: cy } = hexToPixel(q, r);
            dibujarOverlay(q, r, cx, cy, key);
        }
    }

    // ── Paso 5: Grid ──────────────────────────────────────────
    for (let q = qMin; q <= qMax; q++) {
        for (let r = rMin; r <= rMax; r++) {
            const { x: cx, y: cy } = hexToPixel(q, r);
            dibujarGrid(cx, cy);
        }
    }

    // ── Paso 6: HUD del editor ────────────────────────────────
    if (editor.activo) dibujarHUDEditor(W, H);
}

function dibujarHexBase(q, r, cx, cy, hex, key) {
    const verts = hexVertices(cx, cy);
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    verts.forEach(v => ctx.lineTo(v.x, v.y));
    ctx.closePath();

    // Color base
    const tieneRegion = hex && hex.region;
    if (tieneRegion) {
        const reg = mapaActual.regiones[hex.region];
        if (reg) {
            ctx.fillStyle = reg.color || '#334';
            ctx.globalAlpha = reg.opacidad || 0.3;
            ctx.fill();
            ctx.globalAlpha = 1;
        } else {
            ctx.fillStyle = 'rgba(20,10,40,0.5)';
            ctx.fill();
        }
    } else {
        ctx.fillStyle = hex ? 'rgba(10,5,20,0.6)' : 'rgba(5,0,10,0.85)';
        ctx.fill();
    }
}

function dibujarGrid(cx, cy) {
    const verts = hexVertices(cx, cy);
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    verts.forEach(v => ctx.lineTo(v.x, v.y));
    ctx.closePath();
    ctx.strokeStyle = 'rgba(100, 70, 160, 0.25)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
}

function dibujarPropsCapa(propIds, cx, cy) {
    const size = HEX_SIZE * camara.zoom;
    propIds.forEach(pid => {
        const p = props[pid];
        if (!p || !p.imagen) return;
        const img = getCachedImage(p.imagen);
        if (!img || !img.complete) return;

        const w = size * 2 * (p.ancho || 1);
        const h = size * 2 * (p.alto  || 1);
        ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    });
}

function dibujarNPC(npc, cx, cy) {
    const size = HEX_SIZE * camara.zoom;
    const r    = size * 0.55;

    if (npc.icono) {
        const img = getCachedImage(npc.icono);
        if (img && img.complete) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy - r * 0.2, r * 0.85, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(img, cx - r * 0.85, cy - r - r * 0.2, r * 1.7, r * 1.7);
            ctx.restore();
        }
    }

    // Badge nombre
    if (camara.zoom > 0.5) {
        ctx.font = `bold ${Math.max(9, 11 * camara.zoom)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 3;
        ctx.strokeText(npc.nombre, cx, cy + r + 12 * camara.zoom);
        ctx.fillText(npc.nombre, cx, cy + r + 12 * camara.zoom);
    }
}

function dibujarOverlay(q, r, cx, cy, key) {
    const verts  = hexVertices(cx, cy);
    const isHov  = ui.hoveredHex  === key;
    const isSel  = editor.seleccion.has(key);
    const isSelH = ui.selectedHex === key;

    if (!isHov && !isSel && !isSelH) return;

    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    verts.forEach(v => ctx.lineTo(v.x, v.y));
    ctx.closePath();

    if (isSel) {
        ctx.fillStyle = 'rgba(100,200,255,0.2)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(100,200,255,0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
    } else if (isSelH) {
        ctx.strokeStyle = 'rgba(212,175,55,0.95)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
    } else if (isHov) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
    }

    // Coordenadas en debug
    if (editor.activo && camara.zoom > 0.8) {
        ctx.font = `${Math.max(7, 8 * camara.zoom)}px monospace`;
        ctx.fillStyle = 'rgba(150,130,200,0.5)';
        ctx.textAlign = 'center';
        ctx.fillText(`${q},${r}`, cx, cy + 4);
    }
}

function dibujarHUDEditor(W, H) {
    // Barra inferior: herramienta activa
    ctx.fillStyle = 'rgba(10,0,20,0.7)';
    ctx.fillRect(0, H - 32, W, 32);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#00ffff';
    ctx.textAlign = 'left';
    ctx.fillText(
        `  EDITOR ACTIVO  |  Herramienta: ${editor.herramienta.toUpperCase()}  |  Capa: ${editor.capaActual.toUpperCase()}  |  Prop: ${editor.propSeleccionado?.nombre || 'ninguno'}  |  Brush: ${editor.brushSize}`,
        10, H - 11
    );
}

// ── Cache de imágenes ─────────────────────────────────────────
function getCachedImage(url) {
    if (!url) return null;
    if (imageCache[url]) return imageCache[url];
    const img = new Image();
    img.src = url;
    imageCache[url] = img;
    return img;
}

export function setBackground(url) {
    if (!url) { bgImage = null; return; }
    const img = new Image();
    img.src = url;
    img.onload = () => { bgImage = img; };
}

export function limpiarImageCache() { imageCache = {}; }

// ── Eventos de input ──────────────────────────────────────────
let _mouseDown = false;
let _pinchStart = 0;
let _lastX = 0, _lastY = 0;

function registrarEventos() {
    canvas.addEventListener('mousemove',  onMouseMove);
    canvas.addEventListener('mousedown',  onMouseDown);
    canvas.addEventListener('mouseup',    onMouseUp);
    canvas.addEventListener('wheel',      onWheel,     { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
}

function getHexAtEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left);
    const py = (e.clientY - rect.top);
    return pixelToHex(px, py);
}

function onMouseMove(e) {
    const { q, r } = getHexAtEvent(e);
    const key = hexKey(q, r);
    ui.hoveredHex = key;

    if (_mouseDown) {
        if (e.buttons === 2 || (editor.activo && editor.herramienta === 'mover')) {
            // Pan con clic derecho
            camara.x += e.movementX;
            camara.y += e.movementY;
        } else if (editor.activo && ui.modoPintar) {
            aplicarHerramienta(q, r, key);
        }
    }
}

function onMouseDown(e) {
    _mouseDown = true;
    _lastX = e.clientX; _lastY = e.clientY;

    if (e.button === 2) return; // clic derecho = pan

    const { q, r } = getHexAtEvent(e);
    const key = hexKey(q, r);

    if (editor.activo) {
        ui.modoPintar = true;
        aplicarHerramienta(q, r, key);
    } else {
        // Vista jugador: seleccionar hex para info
        ui.selectedHex = key;
        window.dispatchEvent(new CustomEvent('hexSeleccionado', { detail: { q, r, key } }));
    }
}

function onMouseUp(e) {
    _mouseDown = false;
    ui.modoPintar = false;
}

function onWheel(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.88 : 1.12;
    const newZoom = Math.max(0.2, Math.min(camara.maxZoom || 3, camara.zoom * delta));
    camara.x = mx - (mx - camara.x) * (newZoom / camara.zoom);
    camara.y = my - (my - camara.y) * (newZoom / camara.zoom);
    camara.zoom = newZoom;
}

function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        _pinchStart = Math.hypot(dx, dy);
    } else if (e.touches.length === 1) {
        _lastX = e.touches[0].clientX;
        _lastY = e.touches[0].clientY;
        _mouseDown = true;
        const rect = canvas.getBoundingClientRect();
        const px = e.touches[0].clientX - rect.left;
        const py = e.touches[0].clientY - rect.top;
        const { q, r } = pixelToHex(px, py);
        const key = hexKey(q, r);
        if (editor.activo) { ui.modoPintar = true; aplicarHerramienta(q, r, key); }
        else { ui.selectedHex = key; window.dispatchEvent(new CustomEvent('hexSeleccionado', { detail: { q, r, key } })); }
    }
}

function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (_pinchStart > 0) {
            const f = dist / _pinchStart;
            const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const rect = canvas.getBoundingClientRect();
            const px = mx - rect.left, py = my - rect.top;
            const newZoom = Math.max(0.2, Math.min(3, camara.zoom * f));
            camara.x = px - (px - camara.x) * (newZoom / camara.zoom);
            camara.y = py - (py - camara.y) * (newZoom / camara.zoom);
            camara.zoom = newZoom;
        }
        _pinchStart = dist;
    } else if (e.touches.length === 1 && _mouseDown) {
        const dx = e.touches[0].clientX - _lastX;
        const dy = e.touches[0].clientY - _lastY;
        if (!editor.activo || editor.herramienta === 'mover') {
            camara.x += dx; camara.y += dy;
        } else if (ui.modoPintar) {
            const rect = canvas.getBoundingClientRect();
            const px = e.touches[0].clientX - rect.left;
            const py = e.touches[0].clientY - rect.top;
            const { q, r } = pixelToHex(px, py);
            aplicarHerramienta(q, r, hexKey(q, r));
        }
        _lastX = e.touches[0].clientX; _lastY = e.touches[0].clientY;
    }
}

function onTouchEnd(e) { _mouseDown = false; ui.modoPintar = false; _pinchStart = 0; }

// ── Aplicar herramienta del editor ───────────────────────────
import { crearHexData } from './region-state.js';

export function aplicarHerramienta(q, r, key) {
    const hexes = editor.brushSize > 1
        ? hexesEnRadio(q, r, editor.brushSize - 1)
        : [{ q, r }];

    hexes.forEach(h => {
        const k = hexKey(h.q, h.r);
        accionEnHex(h.q, h.r, k);
    });

    window.dispatchEvent(new Event('mapaModificado'));
}

function accionEnHex(q, r, key) {
    const herr  = editor.herramienta;
    const capa  = editor.capaActual;

    if (herr === 'pintar') {
        if (!editor.propSeleccionado) return;
        if (!mapaActual.hexes[key]) mapaActual.hexes[key] = crearHexData();
        const hex = mapaActual.hexes[key];
        const pid = editor.propSeleccionado.id;
        if (!hex[capa].includes(pid)) hex[capa].push(pid);

    } else if (herr === 'borrar') {
        if (!mapaActual.hexes[key]) return;
        const hex = mapaActual.hexes[key];
        if (editor.propSeleccionado) {
            // Borrar solo este prop de la capa
            const pid = editor.propSeleccionado.id;
            hex[capa] = hex[capa].filter(p => p !== pid);
        } else {
            // Borrar toda la capa
            hex[capa] = [];
        }

    } else if (herr === 'seleccionar') {
        if (editor.seleccion.has(key)) editor.seleccion.delete(key);
        else editor.seleccion.add(key);
        window.dispatchEvent(new CustomEvent('seleccionCambiada', { detail: { key, q, r } }));

    } else if (herr === 'region') {
        // Toggle hex en región activa
        const rid = ui.selectedRegion;
        if (!rid || !mapaActual.regiones[rid]) return;
        if (!mapaActual.hexes[key]) mapaActual.hexes[key] = crearHexData();
        const hex = mapaActual.hexes[key];
        const reg = mapaActual.regiones[rid];

        if (hex.region === rid) {
            hex.region = null;
            reg.hexes  = reg.hexes.filter(h => h !== key);
        } else {
            if (hex.region && mapaActual.regiones[hex.region]) {
                mapaActual.regiones[hex.region].hexes =
                    mapaActual.regiones[hex.region].hexes.filter(h => h !== key);
            }
            hex.region = rid;
            if (!reg.hexes.includes(key)) reg.hexes.push(key);
        }
    }
}

// ── Centrar cámara ───────────────────────────────────────────
export function centrarCamara() {
    camara.x = window.innerWidth  / 2;
    camara.y = window.innerHeight / 2;
    camara.zoom = 1;
}
