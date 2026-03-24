// ============================================================
// region-engine.js — Motor hexagonal
// ============================================================

import {
    HEX_SIZE, camara, mapaActual, props, npcsMapaLocal,
    editor, ui, STORAGE_URL, CAPAS, crearHexData
} from './region-state.js';

let canvas, ctx;
let imageCache = {};
let bgImage    = null;
let rafId      = null;

// ── Geometría Hexagonal (flat-top axial) ─────────────────────
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
    return [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]].map(([dq,dr]) => ({ q: q+dq, r: r+dr }));
}

export function hexesEnRadio(q, r, radio) {
    const result = [];
    for (let dq = -radio; dq <= radio; dq++)
        for (let dr = Math.max(-radio,-dq-radio); dr <= Math.min(radio,-dq+radio); dr++)
            result.push({ q: q+dq, r: r+dr });
    return result;
}

function hexVertices(cx, cy) {
    const size = HEX_SIZE * camara.zoom;
    return Array.from({length: 6}, (_, i) => {
        const angle = (Math.PI / 180) * (60 * i);
        return { x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) };
    });
}

function trazarHexPath(cx, cy) {
    const verts = hexVertices(cx, cy);
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    verts.forEach(v => ctx.lineTo(v.x, v.y));
    ctx.closePath();
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

    const margen = HEX_SIZE * camara.zoom * 2;
    const corners = [
        pixelToHex(-margen,    -margen),
        pixelToHex(W + margen, -margen),
        pixelToHex(-margen,    H + margen),
        pixelToHex(W + margen, H + margen)
    ];
    const qMin = Math.min(...corners.map(c => c.q)) - 1;
    const qMax = Math.max(...corners.map(c => c.q)) + 1;
    const rMin = Math.min(...corners.map(c => c.r)) - 1;
    const rMax = Math.max(...corners.map(c => c.r)) + 1;

    // 1. Base (Región y Color Pincel)
    for (let q = qMin; q <= qMax; q++)
        for (let r = rMin; r <= rMax; r++) {
            const key = hexKey(q, r);
            const { x: cx, y: cy } = hexToPixel(q, r);
            dibujarHexBase(cx, cy, mapaActual.hexes[key]);
        }

    // 2. Capa 'back' (Terrenos)
    for (let q = qMin; q <= qMax; q++)
        for (let r = rMin; r <= rMax; r++) {
            const hex = mapaActual.hexes[hexKey(q, r)];
            if (!hex?.back?.length) continue;
            const { x: cx, y: cy } = hexToPixel(q, r);
            dibujarBackgroundProps(hex.back, cx, cy);
        }

    // 3. Capas 'mid' y 'over' (Entidades/Objetos sin superponerse)
    for (const capa of ['mid', 'over'])
        for (let q = qMin; q <= qMax; q++)
            for (let r = rMin; r <= rMax; r++) {
                const hex = mapaActual.hexes[hexKey(q, r)];
                if (!hex?.[capa]?.length) continue;
                const { x: cx, y: cy } = hexToPixel(q, r);
                dibujarEntidadProps(hex[capa], cx, cy);
            }

    // (NPCs locales fijos)
    Object.values(npcsMapaLocal).forEach(npc => {
        if (!npc.hex) return;
        const [nq, nr] = npc.hex.split(',').map(Number);
        const { x: cx, y: cy } = hexToPixel(nq, nr);
        dibujarNPC(npc, cx, cy);
    });

    // 5. Overlays y Grid
    for (let q = qMin; q <= qMax; q++)
        for (let r = rMin; r <= rMax; r++) {
            const key = hexKey(q, r);
            const { x: cx, y: cy } = hexToPixel(q, r);
            dibujarOverlay(q, r, cx, cy, key);
            
            trazarHexPath(cx, cy);
            ctx.strokeStyle = 'rgba(100, 70, 160, 0.25)';
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }

    // Drag select
    if (_drag.activo) {
        const xMin = Math.min(_drag.x1, _drag.x2), yMin = Math.min(_drag.y1, _drag.y2);
        const w = Math.abs(_drag.x2 - _drag.x1), h = Math.abs(_drag.y2 - _drag.y1);
        ctx.strokeStyle = 'rgba(100,200,255,0.9)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
        ctx.strokeRect(xMin, yMin, w, h); ctx.setLineDash([]);
    }

    if (editor.activo) dibujarHUDEditor(W, H);
}

// ── Base del hex ─────────────────────────────────────────────
function dibujarHexBase(cx, cy, hex) {
    trazarHexPath(cx, cy);
    const reg = hex?.region ? mapaActual.regiones[hex.region] : null;
    if (reg) {
        ctx.fillStyle = reg.color || '#334'; ctx.globalAlpha = reg.opacidad || 0.3;
        ctx.fill(); ctx.globalAlpha = 1;
    } else {
        ctx.fillStyle = hex ? 'rgba(10,5,20,0.6)' : 'rgba(5,0,10,0.85)';
        ctx.fill();
    }
    // Color pintado por prop_pintar
    if (hex?.color) {
        trazarHexPath(cx, cy);
        ctx.fillStyle = hex.color;
        ctx.globalAlpha = hex.opacidad || 0.7; // Podemos guardar opacidad individual por hex luego
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// ── Terreno (Back) ───────────────────────────────────────────
function dibujarBackgroundProps(propIds, cx, cy) {
    const size = HEX_SIZE * camara.zoom;
    propIds.forEach(pid => {
        const p = props[pid];
        if (!p || !p.imagen) return;
        const img = getCachedImage(p.imagen);
        if (!img?.complete) return;
        ctx.save();
        trazarHexPath(cx, cy);
        ctx.clip();
        const w = size * 2.15, h = w * 0.9;
        ctx.drawImage(img, cx - w/2, cy - h/2, w, h);
        ctx.restore();
    });
}

// ── Entidades (No Superpuestas Dinámico) ─────────────────────
function dibujarEntidadProps(propIds, cx, cy) {
    const limit = propIds.length;
    if (limit === 0) return;
    
    const hexSize = HEX_SIZE * camara.zoom;
    
    // Calcular el tamaño disponible para que NADIE se toque
    // Si hay 1, ocupa casi todo el centro. Si hay más, se distribuyen en un círculo interno.
    let itemSize;
    let radiusFromCenter;

    if (limit === 1) {
        itemSize = hexSize * 1.2; // Un solo ítem grande en el centro
        radiusFromCenter = 0;
    } else if (limit === 2) {
        itemSize = hexSize * 0.7; // Dos ítems medianos
        radiusFromCenter = hexSize * 0.45;
    } else {
        // Fórmula perimetral para evitar que choquen: 
        // Se colocan en un círculo de radio (hexSize * 0.55).
        // El perímetro disponible es 2*PI*R. Dividido entre los ítems da el espacio máximo.
        radiusFromCenter = hexSize * 0.55; 
        const maxDiameter = (2 * Math.PI * radiusFromCenter) / limit;
        itemSize = Math.min(hexSize * 0.6, maxDiameter * 0.85); // 0.85 para dar margen/espaciado entre ellos
    }

    for (let i = 0; i < limit; i++) {
        const p = props[propIds[i]];
        if (!p) continue;

        let sx = cx, sy = cy;
        if (limit > 1) {
            // Distribuir equitativamente en 360 grados
            const angle = (2 * Math.PI / limit) * i - (Math.PI / 2);
            sx = cx + radiusFromCenter * Math.cos(angle);
            sy = cy + radiusFromCenter * Math.sin(angle);
        }

        ctx.save();
        clipPorTipo(p.tipo, sx, sy, itemSize);

        if (p.imagen) {
            const img = getCachedImage(p.imagen);
            if (img?.complete) ctx.drawImage(img, sx - itemSize/2, sy - itemSize/2, itemSize, itemSize);
        }

        bordeDecorativo(p.tipo, sx, sy, itemSize);
        ctx.restore();
    }
}

function clipPorTipo(tipo, x, y, size) {
    const r = size / 2;
    ctx.beginPath();
    if (tipo === 'elemento') {
        ctx.arc(x, y, r, 0, Math.PI * 2);
    } else if (tipo === 'objeto' || tipo === 'entidad') {
        const rd = size * 0.15;
        if (ctx.roundRect) ctx.roundRect(x - r, y - r, size, size, rd);
        else ctx.rect(x - r, y - r, size, size);
    } else {
        ctx.rect(x - r, y - r, size, size);
    }
    ctx.clip();
}

function bordeDecorativo(tipo, x, y, size) {
    const r = size / 2;
    ctx.beginPath();
    const colores = {
        elemento:  'rgba(0,200,255,0.75)',
        objeto:    'rgba(212,175,55,0.75)',
        estructura:'rgba(255,120,30,0.65)',
        entidad:   'rgba(180,80,220,0.65)',
    };
    const color = colores[tipo];
    if (!color) return;
    if (tipo === 'elemento') ctx.arc(x, y, r, 0, Math.PI * 2);
    else ctx.rect(x - r, y - r, size, size);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, size * 0.08);
    ctx.stroke();
}

// ── NPC ──────────────────────────────────────────────────────
function dibujarNPC(npc, cx, cy) {
    const size = HEX_SIZE * camara.zoom;
    const r    = size * 0.55;

    if (npc.icono) {
        const img = getCachedImage(npc.icono);
        if (img?.complete) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy - r * 0.2, r * 0.85, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(img, cx - r * 0.85, cy - r - r * 0.2, r * 1.7, r * 1.7);
            ctx.restore();
        }
    }

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

// ── Overlay ──────────────────────────────────────────────────
function dibujarOverlay(q, r, cx, cy, key) {
    const isHov  = ui.hoveredHex  === key;
    const isSel  = editor.seleccion.has(key);
    const isSelH = ui.selectedHex === key;

    if (!isHov && !isSel && !isSelH) return;

    trazarHexPath(cx, cy);
    if (isSel) {
        ctx.fillStyle = 'rgba(100,200,255,0.2)'; ctx.fill();
        trazarHexPath(cx, cy);
        ctx.strokeStyle = 'rgba(100,200,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
    } else if (isSelH) {
        ctx.strokeStyle = 'rgba(212,175,55,0.95)'; ctx.lineWidth = 2.5; ctx.stroke();
    } else if (isHov) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
        trazarHexPath(cx, cy);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.2; ctx.stroke();
    }

    if (editor.activo && camara.zoom > 0.8) {
        ctx.font = `${Math.max(7, 8 * camara.zoom)}px monospace`;
        ctx.fillStyle = 'rgba(150,130,200,0.5)';
        ctx.textAlign = 'center';
        ctx.fillText(`${q},${r}`, cx, cy + 4);
    }
}

// ── HUD ──────────────────────────────────────────────────────
function dibujarHUDEditor(W, H) {
    ctx.fillStyle = 'rgba(10,0,20,0.7)';
    ctx.fillRect(0, H - 32, W, 32);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#00ffff';
    ctx.textAlign = 'left';
    const extra = editor.herramienta === 'colorear'
        ? `  Color: ${editor.colorActual}  Opac: ${Math.round((editor.opacidadPincel ?? 0.7) * 100)}%`
        : `  Prop: ${editor.propSeleccionado?.nombre || 'ninguno'}`;
    ctx.fillText(
        `  EDITOR  |  ${editor.herramienta.toUpperCase()}  |  Capa: ${editor.capaActual.toUpperCase()}  |${extra}  |  Brush: ${editor.brushSize}`,
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

// ── Generador de ruido ────────────────────────────────────────
export function aplicarRuidoVisible(color, opacidad, densidad = 0.4) {
    if (!canvas) return;
    const W = canvas.width  / (window.devicePixelRatio || 1);
    const H = canvas.height / (window.devicePixelRatio || 1);
    const margen = HEX_SIZE * camara.zoom * 2;
    const cs = [
        pixelToHex(-margen, -margen),     pixelToHex(W+margen, -margen),
        pixelToHex(-margen, H+margen),    pixelToHex(W+margen, H+margen)
    ];
    const qMin = Math.min(...cs.map(c=>c.q))-1, qMax = Math.max(...cs.map(c=>c.q))+1;
    const rMin = Math.min(...cs.map(c=>c.r))-1, rMax = Math.max(...cs.map(c=>c.r))+1;

    for (let q = qMin; q <= qMax; q++)
        for (let r = rMin; r <= rMax; r++) {
            if (Math.random() > densidad) continue;
            const key = hexKey(q, r);
            if (!mapaActual.hexes[key]) mapaActual.hexes[key] = {
                background:[], mid:[], over:[], region:null, misiones:[], npcs:[], color:null
            };
            // Variar el color ligeramente por ruido
            const h = parseInt(color.slice(1,3),16), s = parseInt(color.slice(3,5),16), l = parseInt(color.slice(5,7),16);
            const v = Math.round((Math.random()-0.5)*40);
            const clamp = n => Math.max(0,Math.min(255,n));
            const toHex = n => n.toString(16).padStart(2,'0');
            mapaActual.hexes[key].color = `#${toHex(clamp(h+v))}${toHex(clamp(s+v))}${toHex(clamp(l+v))}`;
        }

    window.dispatchEvent(new Event('mapaModificado'));
}

// ── Eventos de input ──────────────────────────────────────────
let _mouseDown = false;
let _pinchStart = 0;
let _lastX = 0, _lastY = 0;

// Estado de selección por arrastre
const _drag = { activo: false, x1:0, y1:0, x2:0, y2:0 };

function registrarEventos() {
    canvas.addEventListener('mousemove',   onMouseMove);
    canvas.addEventListener('mousedown',   onMouseDown);
    canvas.addEventListener('mouseup',     onMouseUp);
    canvas.addEventListener('wheel',       onWheel,      { passive: false });
    canvas.addEventListener('touchstart',  onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',   onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',    onTouchEnd);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
}

function screenPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
}

function onMouseMove(e) {
    const { px, py } = screenPos(e);
    const { q, r } = pixelToHex(px, py);
    ui.hoveredHex = hexKey(q, r);

    if (!_mouseDown) return;

    if (e.buttons === 2) {
        camara.x += e.movementX; camara.y += e.movementY;
        return;
    }

    if (editor.activo) {
        if (editor.herramienta === 'seleccionar' && _drag.activo) {
            _drag.x2 = px; _drag.y2 = py;
        } else if (ui.modoPintar) {
            aplicarHerramienta(q, r, hexKey(q, r));
        }
    }
}

function onMouseDown(e) {
    _mouseDown = true;
    _lastX = e.clientX; _lastY = e.clientY;
    if (e.button === 2) return;

    const { px, py } = screenPos(e);
    const { q, r } = pixelToHex(px, py);
    const key = hexKey(q, r);

    if (editor.activo) {
        if (editor.herramienta === 'seleccionar') {
            _drag.activo = true;
            _drag.x1 = _drag.x2 = px;
            _drag.y1 = _drag.y2 = py;
        } else {
            ui.modoPintar = true;
            aplicarHerramienta(q, r, key);
        }
    } else {
        ui.selectedHex = key;
        window.dispatchEvent(new CustomEvent('hexSeleccionado', { detail: { q, r, key } }));
    }
}

function onMouseUp(e) {
    _mouseDown = false;

    if (editor.activo && editor.herramienta === 'seleccionar' && _drag.activo) {
        _confirmarArrastre(e.shiftKey);
    }

    _drag.activo = false;
    ui.modoPintar = false;
}

function _confirmarArrastre(mantenerSeleccion) {
    const { x1, y1, x2, y2 } = _drag;
    const xMin = Math.min(x1,x2), xMax = Math.max(x1,x2);
    const yMin = Math.min(y1,y2), yMax = Math.max(y1,y2);

    // Clic simple (sin arrastre)
    if (xMax - xMin < 5 && yMax - yMin < 5) {
        const { q, r } = pixelToHex(x1, y1);
        const key = hexKey(q, r);
        if (!mantenerSeleccion) editor.seleccion.clear();
        if (editor.seleccion.has(key)) editor.seleccion.delete(key);
        else editor.seleccion.add(key);
        window.dispatchEvent(new CustomEvent('seleccionCambiada', { detail: { key, q, r } }));
        return;
    }

    // Con shift: añadir a la selección existente; sin shift: reemplazar
    if (!mantenerSeleccion) editor.seleccion.clear();

    const margen = HEX_SIZE * camara.zoom;
    const cs = [
        pixelToHex(xMin-margen, yMin-margen), pixelToHex(xMax+margen, yMin-margen),
        pixelToHex(xMin-margen, yMax+margen), pixelToHex(xMax+margen, yMax+margen)
    ];
    const qMin = Math.min(...cs.map(c=>c.q))-1, qMax = Math.max(...cs.map(c=>c.q))+1;
    const rMin = Math.min(...cs.map(c=>c.r))-1, rMax = Math.max(...cs.map(c=>c.r))+1;

    for (let q = qMin; q <= qMax; q++)
        for (let r = rMin; r <= rMax; r++) {
            const { x, y } = hexToPixel(q, r);
            if (x >= xMin && x <= xMax && y >= yMin && y <= yMax)
                editor.seleccion.add(hexKey(q, r));
        }

    window.dispatchEvent(new Event('seleccionActualizada'));
}

function onWheel(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.88 : 1.12;
    const newZoom = Math.max(0.2, Math.min(camara.maxZoom || 3, camara.zoom * delta));
    camara.x = mx - (mx - camara.x) * (newZoom / camara.zoom);
    camara.y = my - (my - camara.y) * (newZoom / camara.zoom);
    camara.zoom = newZoom;
}

function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
        _pinchStart = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
    } else if (e.touches.length === 1) {
        _lastX = e.touches[0].clientX; _lastY = e.touches[0].clientY;
        _mouseDown = true;
        const rect = canvas.getBoundingClientRect();
        const { q, r } = pixelToHex(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
        const key = hexKey(q, r);
        if (editor.activo) { ui.modoPintar = true; aplicarHerramienta(q, r, key); }
        else { ui.selectedHex = key; window.dispatchEvent(new CustomEvent('hexSeleccionado', { detail: { q, r, key } })); }
    }
}

function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
        const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        if (_pinchStart > 0) {
            const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const rect = canvas.getBoundingClientRect();
            const px = mx - rect.left, py = my - rect.top;
            const newZoom = Math.max(0.2, Math.min(3, camara.zoom * dist / _pinchStart));
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
        } else if (ui.modoPintar && editor.herramienta !== 'seleccionar') {
            const rect = canvas.getBoundingClientRect();
            const { q, r } = pixelToHex(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
            aplicarHerramienta(q, r, hexKey(q, r));
        }
        _lastX = e.touches[0].clientX; _lastY = e.touches[0].clientY;
    }
}

function onTouchEnd() { _mouseDown = false; ui.modoPintar = false; _pinchStart = 0; }

// ── Aplicar herramienta ───────────────────────────────────────
export function aplicarHerramienta(q, r, key) {
    const hexes = editor.brushSize > 1 ? hexesEnRadio(q, r, editor.brushSize - 1) : [{ q, r }];
    hexes.forEach(h => _accionHex(h.q, h.r, hexKey(h.q, h.r)));
    window.dispatchEvent(new Event('mapaModificado'));
}

function _accionHex(q, r, key) {
    const herr = editor.herramienta; // Ahora es 'agregar' en vez de pintar
    const capa = editor.capaActual;

    if (herr === 'agregar') {
        if (!editor.propSeleccionado) return;
        if (!mapaActual.hexes[key]) mapaActual.hexes[key] = crearHexData();
        
        const pid = editor.propSeleccionado.id;
        
        // Si es el pincel falso, aplicamos color de fondo, no agregamos un prop físico
        if (pid === 'prop_pintar') {
            mapaActual.hexes[key].color = editor.colorActual;
            mapaActual.hexes[key].opacidad = editor.opacidadPincel ?? 0.7;
        } else {
            // Agregamos el prop real a la capa seleccionada
            const arr = mapaActual.hexes[key][capa];
            if (!arr.includes(pid)) arr.push(pid);
        }

    } else if (herr === 'borrar') {
        if (!mapaActual.hexes[key]) return;
        const hex = mapaActual.hexes[key];
        
        if (editor.propSeleccionado) {
            const pid = editor.propSeleccionado.id;
            if (pid === 'prop_pintar') {
                hex.color = null; // Borramos el color pintado
            } else {
                hex[capa] = hex[capa].filter(p => p !== pid); // Borramos el prop
            }
        } else {
            // Borrado general
            hex[capa] = [];
            hex.color = null;
        }

    } else if (herr === 'region') {
        const rid = ui.selectedRegion;
        if (!rid || !mapaActual.regiones[rid]) return;
        if (!mapaActual.hexes[key]) mapaActual.hexes[key] = crearHexData();
        const hex = mapaActual.hexes[key];
        const reg = mapaActual.regiones[rid];
        if (hex.region === rid) {
            hex.region = null;
            reg.hexes = reg.hexes.filter(h => h !== key);
        } else {
            if (hex.region && mapaActual.regiones[hex.region])
                mapaActual.regiones[hex.region].hexes =
                    mapaActual.regiones[hex.region].hexes.filter(h => h !== key);
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
