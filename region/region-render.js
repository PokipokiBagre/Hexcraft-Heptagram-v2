// ============================================================
// region-render.js — Motor de Renderizado de Mapas Superpuestos
// ============================================================

import {
    HEX_SIZE, camara, mapaActual, props, npcsMapaLocal,
    editor, ui, STORAGE_URL, OVER_OFFSET_X, OVER_OFFSET_Y
} from './region-state.js';
import { hexToPixel3D, isometricHexVertices, hexKey } from './region-utils.js';

let context;
let imageCache = {};
let bgImage;
const NO_IMG = `${STORAGE_URL}/imginterfaz/no_encontrado.png`;

export function inicializarRender(ctx) { context = ctx; }

export function dibujarEscena() {
    if (!context) return;
    const canvas = context.canvas;
    const W = canvas.width, H = canvas.height;

    context.clearRect(0, 0, W, H);
    if (bgImage) {
        context.globalAlpha = 0.22;
        context.drawImage(bgImage, 0, 0, W, H);
        context.globalAlpha = 1;
    } else {
        context.fillStyle = '#0a0018'; context.fillRect(0, 0, W, H);
    }

    const layers = getDrawingLayers(W, H);
    
    // FASE 1: Suelo y texturas (Garantiza que nada solape los bordes después)
    layers.ground.forEach(item => dibujarHexTop3D(item.q, item.r, item.hex, item.projPos));
    
    // FASE 2: Bordes de región (Siempre encima del suelo)
    layers.borders.forEach(item => dibujarHexRegionBorder(item.q, item.r, item.hex, item.projPos));

    // FASE 3: Rejilla base (Grid)
    layers.gridBase.forEach(item => dibujarGridAndOverlay(item.q, item.r, item.hex, item.projPos, 'base'));

    // FASE 4: Props, personajes y entidades
    layers.props.forEach(item => {
        const currentOpac = item.opacidad || 1.0;
        if (item.type === 'itemMid') dibujarBillboardItem(item.q, item.r, item.propId, item.projPos, currentOpac, 'mid');
        if (item.type === 'itemNPC') dibujarNPC(item.q, item.r, item.npc, item.projPos, currentOpac);
    });

    // FASE 5: Capa OVER flotante
    layers.over.forEach(item => {
        const currentOpac = item.opacidad || 1.0;
        if (item.type === 'hexOverBg') dibujarHexOverBackground(item.q, item.r, item.propId, item.hex, item.projPos, currentOpac);
        if (item.type === 'hexOverItem') dibujarHexOverItem(item.q, item.r, item.propId, item.hex, item.projPos, currentOpac);
        if (item.type === 'gridOverlay') dibujarGridAndOverlay(item.q, item.r, item.hex, item.projPos, 'over');
    });

    if (editor.activo) dibujarHUDEditor(W, H);
}

function getDrawingLayers(W, H) {
    const layers = { ground: [], borders: [], gridBase: [], props: [], over: [] };
    const margen = HEX_SIZE * camara.zoom * 6;
    
    for (const key in mapaActual.hexes) {
        const [q, r] = key.split(',').map(Number);
        const hex = mapaActual.hexes[key];
        
        const baseProjPos = hexToPixel3D(q, r, 0); 
        if (baseProjPos.x < -margen || baseProjPos.x > W + margen || baseProjPos.y < -margen || baseProjPos.y > H + margen) continue;

        const baseDepth = baseProjPos.y; 

        layers.ground.push({ type: 'hexTop', q, r, hex, projPos: baseProjPos, depth: baseDepth });
        if (hex.region) layers.borders.push({ type: 'regionBorder', q, r, hex, projPos: baseProjPos, depth: baseDepth });

        hex.mid?.forEach(pid => {
            let opac = 1.0;
            if (typeof pid === 'string') {
                if (pid.startsWith('COLOR:')) opac = parseFloat(pid.split(':')[2]) || 1.0;
                else if (pid.includes(':')) opac = parseFloat(pid.split(':')[1]) || 1.0;
            }
            layers.props.push({ type: 'itemMid', q, r, propId: pid, projPos: baseProjPos, opacidad: opac, depth: baseDepth + 1 });
        });
        
        Object.values(npcsMapaLocal).forEach(npc => {
            if (npc.hex_pos === key) layers.props.push({ type: 'itemNPC', q, r, npc, projPos: baseProjPos, opacidad: 1.0, depth: baseDepth + 2 });
        });

        layers.gridBase.push({ type: 'gridOverlay', q, r, hex, projPos: baseProjPos, depth: baseDepth + 3 });

        if (hex.over?.length > 0) {
            const overProjPos = { 
                x: baseProjPos.x + (OVER_OFFSET_X * camara.zoom), 
                y: baseProjPos.y + (OVER_OFFSET_Y * camara.zoom)
            };
            const overDepth = baseDepth + 5000;

            hex.over.forEach(pid => {
                const isColor = typeof pid === 'string' && pid.startsWith('COLOR:');
                let opac = 1.0;
                if (isColor) opac = parseFloat(pid.split(':')[2]) || 1.0;
                else if (typeof pid === 'string' && pid.includes(':')) opac = parseFloat(pid.split(':')[1]) || 1.0;
                
                if (isColor) {
                    layers.over.push({ type: 'hexOverBg', q, r, propId: pid, hex, projPos: overProjPos, opacidad: opac, depth: overDepth });
                } else {
                    layers.over.push({ type: 'hexOverItem', q, r, propId: pid, hex, projPos: overProjPos, opacidad: opac, depth: overDepth + 1 });
                }
            });
            layers.over.push({ type: 'gridOverlay', q, r, hex, projPos: overProjPos, depth: overDepth + 2 });
        }
    }

    Object.values(layers).forEach(arr => arr.sort((a, b) => a.depth - b.depth));
    return layers;
}

// ── PLANO BASE ──
function dibujarHexTop3D(q, r, hex, topPos) {
    const verts = isometricHexVertices(topPos.x, topPos.y, 0);
    const reg = hex.region ? mapaActual.regiones[hex.region] : null;

    trazarHexPath(verts);
    
    // Suelo base oscuro para tapar el vacío
    context.fillStyle = '#0a0018'; 
    context.fill();

    // Tinte visual tenue para los hexágonos de región
    if (reg) {
        context.fillStyle = reg.color || '#334'; 
        context.globalAlpha = Math.max(0.05, (reg.opacidad || 0.3) * 0.2); 
        context.fill(); 
        context.globalAlpha = 1;
    }

    const backItems = hex.back || [];
    const size = HEX_SIZE * camara.zoom;
    const drawW = size * 2.85; 
    const drawH = drawW * camara.PITCH_SCALE;

    backItems.forEach(pid => {
        if (typeof pid === 'string' && pid.startsWith('COLOR:')) {
            const parts = pid.split(':');
            context.save();
            trazarHexPath(verts);
            context.fillStyle = parts[1]; context.globalAlpha = parseFloat(parts[2]) || 1.0; context.fill();
            context.restore();
            return;
        }

        let basePid = pid; let opac = 1.0;
        if (typeof pid === 'string' && pid.includes(':')) {
            const parts = pid.split(':');
            basePid = parts[0]; opac = parseFloat(parts[1]) || 1.0;
        }

        const p = props[basePid];
        if (!p || !p.imagen) return;
        const img = getCachedImage(p.imagen);
        if (!img?.complete) return;

        context.save();
        context.globalAlpha = opac;
        trazarHexPath(verts);
        context.clip();
        context.drawImage(img, topPos.x - drawW / 2, topPos.y - drawH / 2, drawW, drawH);
        context.restore();
    });
}

// ── BORDES DE REGIÓN (Método Clásico de Distancia - Perfecto para Isométrico) ──
function dibujarHexRegionBorder(q, r, hex, topPos) {
    const reg = mapaActual.regiones[hex.region];
    if (!reg) return;

    const verts = isometricHexVertices(topPos.x, topPos.y, 0);

    context.save();
    context.strokeStyle = reg.color || '#334';
    context.lineWidth = 4.5 * camara.zoom; 
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.globalAlpha = reg.opacidad ? Math.min(1, reg.opacidad + 0.4) : 0.8;

    const neighborDirs = [
        {dq: 1, dr: 0}, {dq: 0, dr: 1}, {dq: -1, dr: 1},
        {dq: -1, dr: 0}, {dq: 0, dr: -1}, {dq: 1, dr: -1}
    ];

    context.beginPath();
    for (let i = 0; i < 6; i++) {
        const midX = (verts[i].x + verts[(i+1)%6].x) / 2;
        const midY = (verts[i].y + verts[(i+1)%6].y) / 2;
        
        let closestNeighborKey = null;
        let minD = Infinity;
        
        // Buscar cuál de los 6 vecinos teóricos es el dueño de esta arista por distancia real
        for (const dir of neighborDirs) {
            const nq = q + dir.dq; const nr = r + dir.dr;
            const nPos = hexToPixel3D(nq, nr, 0);
            const dist = Math.hypot(nPos.x - midX, nPos.y - midY);
            if (dist < minD) { minD = dist; closestNeighborKey = `${nq},${nr}`; }
        }

        const nHex = closestNeighborKey ? mapaActual.hexes[closestNeighborKey] : null;
        
        // Si el vecino NO es de mi misma región, dibujamos esta arista
        if (!nHex || nHex.region !== hex.region) {
            context.moveTo(verts[i].x, verts[i].y);
            context.lineTo(verts[(i+1)%6].x, verts[(i+1)%6].y);
        }
    }
    context.stroke();
    context.restore();
}

// ── PLANO OVER (Limpio y plano sin sombras) ──
function dibujarHexOverBackground(q, r, propId, hex, overPos, opac) {
    const parts = propId.split(':');
    const color = parts[1];
    const verts = isometricHexVertices(overPos.x, overPos.y, 0);

    context.save();
    context.globalAlpha = opac;
    trazarHexPath(verts);
    context.fillStyle = color;
    context.fill();
    context.restore();
}

function dibujarHexOverItem(q, r, propId, hex, overPos, opac) {
    let basePid = propId;
    if (typeof propId === 'string' && propId.includes(':')) basePid = propId.split(':')[0];

    const p = props[basePid];
    if (!p || !p.imagen) return;
    const img = getCachedImage(p.imagen);
    if (!img?.complete) return;

    const size = HEX_SIZE * camara.zoom;
    const drawW = size * 2.85; 
    const drawH = drawW * camara.PITCH_SCALE;
    const vertsOver = isometricHexVertices(overPos.x, overPos.y, 0);

    context.save();
    context.globalAlpha = opac;
    trazarHexPath(vertsOver);
    context.clip();
    context.drawImage(img, overPos.x - drawW / 2, overPos.y - drawH / 2, drawW, drawH);
    context.restore();
}

// ── OBJETOS MID ──
function dibujarBillboardItem(q, r, propId, projPos, opac, capa) {
    if (typeof propId === 'string' && propId.startsWith('COLOR:')) {
        const parts = propId.split(':');
        const size = HEX_SIZE * 0.8 * camara.zoom;
        context.save();
        context.globalAlpha = parseFloat(parts[2]) || 1.0;
        context.beginPath();
        context.arc(projPos.x, projPos.y - size/2, size/2, 0, Math.PI*2);
        context.fillStyle = parts[1]; context.fill();
        context.restore();
        return;
    }
    
    let basePid = propId;
    if (typeof propId === 'string' && propId.includes(':')) basePid = propId.split(':')[0];

    const p = props[basePid];
    if (!p) return;

    const img = getCachedImage(p.imagen || NO_IMG);
    if (!img?.complete) return;

    const size = HEX_SIZE * 1.5 * camara.zoom; 
    const verticalOffset = size * 0.2; 

    context.save();
    context.globalAlpha = opac;
    context.drawImage(img, projPos.x - size/2, projPos.y - size * 0.8 - verticalOffset, size, size);
    context.restore();
}

// ── NPCs ──
function dibujarNPC(q, r, npc, projPos, opac) {
    const img = getCachedImage(npc.icono_url || NO_IMG);
    if (!img?.complete) return;
    const size = HEX_SIZE * 1.6 * camara.zoom;
    context.save();
    context.globalAlpha = opac;
    context.drawImage(img, projPos.x - size/2, projPos.y - size - size*0.1, size, size);
    context.restore();
}

// ── GRIDS Y OVERLAYS ──
function dibujarGridAndOverlay(q, r, hex, projPos, layer) {
    const verts = isometricHexVertices(projPos.x, projPos.y, 0);
    const key = hexKey(q, r);

    trazarHexPath(verts);
    context.strokeStyle = layer === 'base' ? 'rgba(80, 50, 130, 0.22)' : 'rgba(100, 200, 255, 0.15)';
    context.lineWidth = 0.8;
    context.stroke();

    const isHov = ui.hoveredHex === key;
    const isSelH = editor.selectedHexKey === key;

    if (isHov || isSelH) {
        if (editor.activo) {
            if (layer === 'over' && editor.capaActual !== 'over') return;
            if (layer === 'base' && editor.capaActual === 'over') return;
        } else {
            if (layer === 'over') return;
        }

        trazarHexPath(verts);
        if (isHov) { context.fillStyle = 'rgba(255,255,255,0.06)'; context.fill(); }
        
        context.strokeStyle = isSelH ? '#f1c40f' : 'rgba(255,255,255,0.3)';
        context.lineWidth = isSelH ? 2.5 : 1.5;
        context.stroke();
    }
}

function trazarHexPath(verts) {
    context.beginPath();
    context.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < 6; i++) context.lineTo(verts[i].x, verts[i].y);
    context.closePath();
}

function getCachedImage(url) {
    if (!url) return null;
    if (imageCache[url]) return imageCache[url];
    const img = new Image(); img.src = url;
    imageCache[url] = img;
    return img;
}

export function setBackground(url) {
    if (!url) { bgImage = null; return; }
    const img = new Image(); img.src = url;
    img.onload = () => { bgImage = img; };
}

function dibujarHUDEditor(W, H) {
    context.fillStyle = 'rgba(10,0,20,0.8)';
    context.fillRect(0, H - 32, W, 32);
    context.font = '12px monospace'; context.fillStyle = '#00ffff'; context.textAlign = 'left';
    context.fillText(
        `  EDITOR SUPERPUESTO  |  ${editor.herramienta.toUpperCase()}  |  Capa: ${editor.capaActual.toUpperCase()}  |  Brush: ${editor.brushSize}`,
        10, H - 11
    );
}
