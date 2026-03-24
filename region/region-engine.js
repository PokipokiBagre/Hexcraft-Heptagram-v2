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

    // ── Fondo global ──────────────────────────────────────────
    if (bgImage && bgImage.complete) {
        ctx.globalAlpha = 0.22;
        const escala = Math.max(W / bgImage.naturalWidth, H / bgImage.naturalHeight);
        const bw = bgImage.naturalWidth * escala, bh = bgImage.naturalHeight * escala;
        ctx.drawImage(bgImage, (W - bw) / 2, (H - bh) / 2, bw, bh);
        ctx.globalAlpha = 1;
    } else {
        ctx.fillStyle = '#07000f';
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

    // ══════════════════════════════════════════════════════════
    // ALGORITMO DEL PINTOR - 3 PASADAS PARA PROFUNDIDAD 3D
    // ══════════════════════════════════════════════════════════
    
    // PASADA 1: Capa Base y Back (El suelo)
    for (let r = rMin; r <= rMax; r++) {
        for (let q = qMin; q <= qMax; q++) {
            const key = hexKey(q, r);
            const { x: cx, y: cy } = hexToPixel(q, r);
            const hex = mapaActual.hexes[key];
            dibujarHexBase(cx, cy, hex);
            if (hex?.back?.length) dibujarCapaBack(hex.back, cx, cy);
        }
    }

    // PASADA 2: Capa Mid (Estructuras de pie)
    for (let r = rMin; r <= rMax; r++) {
        for (let q = qMin; q <= qMax; q++) {
            const key = hexKey(q, r);
            const { x: cx, y: cy } = hexToPixel(q, r);
            const hex = mapaActual.hexes[key];
            if (hex?.mid?.length) dibujarCapaMid(hex.mid, cx, cy);
        }
    }

    // PASADA 3: Capa Over (Cielo/Gigantes)
    for (let r = rMin; r <= rMax; r++) {
        for (let q = qMin; q <= qMax; q++) {
            const key = hexKey(q, r);
            const { x: cx, y: cy } = hexToPixel(q, r);
            const hex = mapaActual.hexes[key];
            if (hex?.over?.length) dibujarCapaOver(hex.over, cx, cy);
        }
    }

    // ── NPCs locales (encima de todo, ordenados por profundidad Y) ────
    const npcsSorted = Object.values(npcsMapaLocal)
        .filter(n => n.hex)
        .map(n => { const [nq, nr] = n.hex.split(',').map(Number); return { n, nq, nr }; })
        .sort((a, b) => a.nr - b.nr || a.nq - b.nq);
    
    npcsSorted.forEach(({ n, nq, nr }) => {
        const { x: cx, y: cy } = hexToPixel(nq, nr);
        dibujarNPC(n, cx, cy);
    });

    // ── Overlays e Interfaces ───
    for (let r = rMin; r <= rMax; r++)
        for (let q = qMin; q <= qMax; q++) {
            const key = hexKey(q, r);
            const { x: cx, y: cy } = hexToPixel(q, r);
            dibujarOverlay(q, r, cx, cy, key);
        }

    // Grid
    for (let r = rMin; r <= rMax; r++)
        for (let q = qMin; q <= qMax; q++) {
            const { x: cx, y: cy } = hexToPixel(q, r);
            trazarHexPath(cx, cy);
            ctx.strokeStyle = 'rgba(100, 70, 160, 0.22)';
            ctx.lineWidth = 0.7;
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
    // Legado color
    if (hex?.color) {
        trazarHexPath(cx, cy);
        ctx.fillStyle = hex.color;
        ctx.globalAlpha = hex.opacidad || 0.7; 
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

function dibujarCapaBack(propIds, cx, cy) {
    const size = HEX_SIZE * camara.zoom;
    propIds.forEach(pid => {
        if (typeof pid === 'string' && pid.startsWith('COLOR:')) {
            const parts = pid.split(':');
            ctx.save();
            trazarHexPath(cx, cy);
            ctx.fillStyle = parts[1];
            ctx.globalAlpha = parseFloat(parts[2]) || 0.7;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();
            return;
        }

        const p = props[pid];
        if (!p || !p.imagen) return;
        const img = getCachedImage(p.imagen);
        if (!img?.complete) return;

        ctx.save();
        trazarHexPath(cx, cy);
        ctx.clip();
        const w = size * 2.2, h = w * 0.92;
        ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
        ctx.restore();

        // Relieve 3D de profundidad para la capa back
        trazarHexPath(cx, cy);
        const grad = ctx.createLinearGradient(cx, cy - size, cx, cy + size);
        grad.addColorStop(0,    'rgba(255,255,255,0.06)');
        grad.addColorStop(0.45, 'rgba(0,0,0,0)');
        grad.addColorStop(1,    'rgba(0,0,0,0.55)');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.save();
        const verts = hexVertices(cx, cy);
        ctx.beginPath();
        ctx.moveTo(verts[2].x, verts[2].y);
        ctx.lineTo(verts[3].x, verts[3].y);
        ctx.lineTo(verts[4].x, verts[4].y);
        ctx.lineTo(verts[4].x, verts[4].y + size * 0.15);
        ctx.lineTo(verts[2].x, verts[2].y + size * 0.15);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fill();
        ctx.restore();
    });
}

function dibujarCapaMid(propIds, cx, cy) {
    const size    = HEX_SIZE * camara.zoom;
    const offsetY = size * 0.45; // Aumentado para dar mayor ilusión de altura

    const colorEntries = propIds.filter(pid => typeof pid === 'string' && pid.startsWith('COLOR:'));
    const propEntries  = propIds.filter(pid => !(typeof pid === 'string' && pid.startsWith('COLOR:')));

    colorEntries.forEach(pid => {
        const parts = pid.split(':');
        ctx.save();
        ctx.globalAlpha = parseFloat(parts[2]) || 0.7;
        const midGrad = ctx.createRadialGradient(cx, cy - offsetY, 0, cx, cy - offsetY * 0.5, size);
        midGrad.addColorStop(0,   parts[1]);
        midGrad.addColorStop(0.7, parts[1] + 'aa');
        midGrad.addColorStop(1,   parts[1] + '00');
        trazarHexPath(cx, cy - offsetY * 0.3);
        ctx.fillStyle = midGrad;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
    });

    const limit = propEntries.length;
    if (limit === 0) return;

    let itemSize, radioCirculo;
    if (limit === 1)      { itemSize = size * 1.35; radioCirculo = 0; }
    else if (limit === 2) { itemSize = size * 0.75; radioCirculo = size * 0.42; }
    else {
        radioCirculo = size * 0.5;
        itemSize = Math.min(size * 0.65, (2 * Math.PI * radioCirculo / limit) * 0.85);
    }

    for (let i = 0; i < limit; i++) {
        const p = props[propEntries[i]];
        if (!p) continue;

        let sx = cx, sy = cy - offsetY;
        if (limit > 1) {
            const ang = (2 * Math.PI / limit) * i - Math.PI / 2;
            sx = cx + radioCirculo * Math.cos(ang);
            sy = (cy - offsetY) + radioCirculo * Math.sin(ang) * 0.7;
        }

        // Sombra proyectada
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.ellipse(sx, sy + itemSize * 0.5 + offsetY * 0.7, itemSize * 0.45, itemSize * 0.15, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.fill();
        ctx.restore();

        // Dibujo del prop mid
        ctx.save();
        clipPorTipo(p.tipo, sx, sy, itemSize);
        if (p.imagen) {
            const img = getCachedImage(p.imagen);
            if (img?.complete) ctx.drawImage(img, sx - itemSize / 2, sy - itemSize / 2, itemSize, itemSize);
        } else {
            ctx.fillStyle = '#334';
            ctx.fillRect(sx - itemSize / 2, sy - itemSize / 2, itemSize, itemSize);
        }
        bordeDecorativo(p.tipo, sx, sy, itemSize);
        ctx.restore();
    }
}

function dibujarCapaOver(propIds, cx, cy) {
    const size    = HEX_SIZE * camara.zoom;
    const offsetY = size * 0.85;

    propIds.filter(pid => typeof pid === 'string' && pid.startsWith('COLOR:')).forEach(pid => {
        const parts = pid.split(':');
        ctx.save();
        ctx.globalAlpha = parseFloat(parts[2]) || 0.7;
        const grad = ctx.createRadialGradient(cx, cy - offsetY, 0, cx, cy - offsetY * 0.5, size * 1.2);
        grad.addColorStop(0,   parts[1]);
        grad.addColorStop(0.5, parts[1] + '88');
        grad.addColorStop(1,   parts[1] + '00');
        ctx.beginPath();
        ctx.ellipse(cx, cy - offsetY * 0.4, size * 1.2, size * 0.8, 0, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
    });

    const propEntries = propIds.filter(pid => !(typeof pid === 'string' && pid.startsWith('COLOR:')));
    const limit = propEntries.length;
    if (limit === 0) return;

    const itemSize = limit === 1 ? size * 1.85 : size * 0.95;

    for (let i = 0; i < limit; i++) {
        const p = props[propEntries[i]];
        if (!p) continue;

        let sx = cx, sy = cy - offsetY;
        if (limit > 1) {
            const ang = (2 * Math.PI / limit) * i - Math.PI / 2;
            sx = cx + size * 0.4 * Math.cos(ang);
            sy = (cy - offsetY) + size * 0.25 * Math.sin(ang);
        }

        ctx.save();
        ctx.globalAlpha = 0.25;
        const sgRad = itemSize * 0.55;
        const sgX = sx, sgY = sy + itemSize * 0.52 + offsetY * 0.9;
        const shadowGrad = ctx.createRadialGradient(sgX, sgY, 0, sgX, sgY, sgRad);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0.8)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.ellipse(sgX, sgY, sgRad, sgRad * 0.28, 0, 0, Math.PI * 2);
        ctx.fillStyle = shadowGrad;
        ctx.fill();
        ctx.restore();

        ctx.save();
        clipPorTipo(p.tipo, sx, sy, itemSize);
        if (p.imagen) {
            const img = getCachedImage(p.imagen);
            if (img?.complete) ctx.drawImage(img, sx - itemSize / 2, sy - itemSize / 2, itemSize, itemSize);
        } else {
            ctx.fillStyle = '#223';
            ctx.fillRect(sx - itemSize / 2, sy - itemSize / 2, itemSize, itemSize);
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
                back:[], mid:[], over:[], region:null, misiones:[], npcs:[], color:null
            };
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

    if (xMax - xMin < 5 && yMax - yMin < 5) {
        const { q, r } = pixelToHex(x1, y1);
        const key = hexKey(q, r);
        if (!mantenerSeleccion) editor.seleccion.clear();
        if (editor.seleccion.has(key)) editor.seleccion.delete(key);
        else editor.seleccion.add(key);
        window.dispatchEvent(new CustomEvent('seleccionCambiada', { detail: { key, q, r } }));
        return;
    }

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
        _pinchStart = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
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
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (_pinchStart > 0) {
            const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2, my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
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

export function aplicarHerramienta(q, r, key) {
    const hexes = editor.brushSize > 1 ? hexesEnRadio(q, r, editor.brushSize - 1) : [{ q, r }];
    hexes.forEach(h => _accionHex(h.q, h.r, hexKey(h.q, h.r)));
    window.dispatchEvent(new Event('mapaModificado'));
}

function _accionHex(q, r, key) {
    const herr = editor.herramienta;
    const capa = editor.capaActual;

    if (herr === 'agregar') {
        if (!editor.propSeleccionado) return;
        if (!mapaActual.hexes[key]) mapaActual.hexes[key] = crearHexData();
        
        const pid = editor.propSeleccionado.id;
        
        if (pid === 'prop_pintar') {
            const colorEntry = `COLOR:${editor.colorActual}:${(editor.opacidadPincel ?? 0.7).toFixed(2)}`;
            const arr = mapaActual.hexes[key][capa];
            const idx = arr.findIndex(e => typeof e === 'string' && e.startsWith('COLOR:'));
            if (idx >= 0) arr[idx] = colorEntry;
            else arr.push(colorEntry);
            if (capa === 'back') {
                mapaActual.hexes[key].color = editor.colorActual;
                mapaActual.hexes[key].opacidad = editor.opacidadPincel ?? 0.7;
            }
        } else {
            const arr = mapaActual.hexes[key][capa];
            if (!arr.includes(pid)) arr.push(pid);
        }

    } else if (herr === 'borrar') {
        // La herramienta borrar ahora vacía completamente la capa actual del hex
        if (!mapaActual.hexes[key]) return;
        const hex = mapaActual.hexes[key];
        hex[capa] = []; // Limpia todo lo de la capa (props y colores)
        if (capa === 'back') { 
            hex.color = null; 
            hex.opacidad = null; 
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
                mapaActual.regiones[hex.region].hexes = mapaActual.regiones[hex.region].hexes.filter(h => h !== key);
            hex.region = rid;
            if (!reg.hexes.includes(key)) reg.hexes.push(key);
        }
    }
}

export function centrarCamara() {
    camara.x = window.innerWidth  / 2;
    camara.y = window.innerHeight / 2;
    camara.zoom = 1;
}
