// ============================================================
// region-render.js — Motor de Renderizado Isométrico 3D Real
// ============================================================

import {
    HEX_SIZE, camara, mapaActual, props, npcsMapaLocal,
    editor, ui, STORAGE_URL
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

    const listDrawingItems = getDrawingList(W, H);
    
    listDrawingItems.forEach(item => {
        switch (item.type) {
            case 'hexVolume': dibujarHexVolume3D(item.q, item.r, item.hex, item.projPos); break;
            case 'hexTop':    dibujarHexTop3D(item.q, item.r, item.hex, item.projPos); break;
            case 'itemMid':   dibujarBillboardItem(item.q, item.r, item.propId, item.projPos, 'mid'); break;
            case 'hexOver':   dibujarHexOver3D(item.q, item.r, item.propId, item.hex, item.projPos); break; 
            case 'itemNPC':   dibujarNPC(item.q, item.r, item.npc, item.projPos); break;
            case 'gridOverlay': dibujarGridAndOverlay(item.q, item.r, item.hex, item.projPos); break;
        }
    });

    if (editor.activo) dibujarHUDEditor(W, H);
}

function getDrawingList(W, H) {
    const list = [];
    const margen = HEX_SIZE * camara.zoom * 3;
    
    for (const key in mapaActual.hexes) {
        const [q, r] = key.split(',').map(Number);
        const hex = mapaActual.hexes[key];
        
        const projPos = hexToPixel3D(q, r, 0); 
        if (projPos.x < -margen || projPos.x > W + margen || projPos.y < -margen || projPos.y > H + margen) continue;

        const depth = projPos.y; 

        if (hex.elevation > 0) {
            list.push({ type: 'hexVolume', q, r, hex, projPos, depth });
        }
        
        list.push({ type: 'hexTop', q, r, hex, projPos, depth: depth + 1 });

        const posTop = hexToPixel3D(q, r, hex.elevation);

        hex.mid?.forEach(pid => list.push({ type: 'itemMid', q, r, propId: pid, projPos: posTop, depth: depth + 2 }));
        hex.over?.forEach(pid => list.push({ type: 'hexOver', q, r, propId: pid, hex, projPos: posTop, depth: depth + 3 }));
        
        Object.values(npcsMapaLocal).forEach(npc => {
            if (npc.hex_pos === key) list.push({ type: 'itemNPC', q, r, npc, projPos: posTop, depth: depth + 4 });
        });

        list.push({ type: 'gridOverlay', q, r, hex, projPos, depth: depth + 5 });
    }

    return list.sort((a, b) => a.depth - b.depth);
}

function dibujarHexVolume3D(q, r, hex, basePos) {
    const elevation = hex.elevation;
    const topPos = hexToPixel3D(q, r, elevation);
    const topV = isometricHexVertices(topPos.x, topPos.y, 0); 
    const baseV = isometricHexVertices(basePos.x, basePos.y, 0);

    const facesVisible = [2, 3, 4]; 

    context.beginPath();
    facesVisible.forEach(i => {
        context.moveTo(topV[i].x, topV[i].y);
        context.lineTo(topV[(i+1)%6].x, topV[(i+1)%6].y);
        context.lineTo(baseV[(i+1)%6].x, baseV[(i+1)%6].y);
        context.lineTo(baseV[i].x, baseV[i].y);
        context.closePath();
    });
    
    context.fillStyle = '#2a1a0a'; context.fill();
    context.strokeStyle = 'rgba(0,0,0,0.5)'; context.stroke();
}

function dibujarHexTop3D(q, r, hex, basePos) {
    const elevation = hex.elevation;
    const topPos = hexToPixel3D(q, r, elevation);
    const verts = isometricHexVertices(topPos.x, topPos.y, 0);

    trazarHexPath(verts);
    
    const reg = hex.region ? mapaActual.regiones[hex.region] : null;
    if (reg) {
        context.fillStyle = reg.color; context.globalAlpha = reg.opacidad; context.fill(); context.globalAlpha = 1;
    } else if (hex.color) {
        context.fillStyle = hex.color; context.globalAlpha = hex.opacidad ?? 1.0; context.fill(); context.globalAlpha = 1;
    } else {
        context.fillStyle = '#07000f'; context.fill();
    }

    const backItems = hex.back || [];
    const size = HEX_SIZE * camara.zoom;
    const drawW = size * 2.8; 
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

function dibujarBillboardItem(q, r, propId, projPos, capa) {
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
    
    let basePid = propId; let opac = 1.0;
    if (typeof propId === 'string' && propId.includes(':')) {
        const parts = propId.split(':');
        basePid = parts[0]; opac = parseFloat(parts[1]) || 1.0;
    }

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

// ── OVER AHORA SOPORTA COLOR DEL PINCEL ──
function dibujarHexOver3D(q, r, propId, hex, basePos) {
    const size = HEX_SIZE * camara.zoom;
    const floatElevation = (hex.elevation || 0) + 1.2;
    const overPos = hexToPixel3D(q, r, floatElevation);
    const vertsOver = isometricHexVertices(overPos.x, overPos.y, 0);
    const baseVerts = isometricHexVertices(basePos.x, basePos.y, 0);

    // DIBUJAR PINCEL EN CAPA OVER
    if (typeof propId === 'string' && propId.startsWith('COLOR:')) {
        const parts = propId.split(':');
        const color = parts[1];
        const opac  = parseFloat(parts[2]) || 1.0;

        // 1. Sombra
        context.save();
        context.globalAlpha = 0.35 * opac; 
        trazarHexPath(baseVerts);
        context.fillStyle = '#000';
        context.fill();
        context.restore();

        // 2. Color superior
        context.save();
        context.globalAlpha = opac;
        trazarHexPath(vertsOver);
        context.fillStyle = color;
        context.fill();
        
        // 3. Relieve 3D
        const grad = context.createLinearGradient(overPos.x, overPos.y - size, overPos.x, overPos.y + size);
        grad.addColorStop(0,    'rgba(255,255,255,0.15)');
        grad.addColorStop(0.45, 'rgba(0,0,0,0)');
        grad.addColorStop(1,    'rgba(0,0,0,0.5)');
        context.fillStyle = grad;
        context.fill();

        // 4. Borde del grosor
        context.beginPath();
        context.moveTo(vertsOver[2].x, vertsOver[2].y);
        context.lineTo(vertsOver[3].x, vertsOver[3].y);
        context.lineTo(vertsOver[4].x, vertsOver[4].y);
        context.lineTo(vertsOver[4].x, vertsOver[4].y + size * 0.15);
        context.lineTo(vertsOver[2].x, vertsOver[2].y + size * 0.15);
        context.closePath();
        context.fillStyle = 'rgba(0,0,0,0.4)';
        context.fill();
        context.restore();
        return; 
    }
    
    // DIBUJAR PROP CON IMAGEN EN CAPA OVER
    let basePid = propId; let opac = 1.0;
    if (typeof propId === 'string' && propId.includes(':')) {
        const parts = propId.split(':');
        basePid = parts[0]; opac = parseFloat(parts[1]) || 1.0;
    }

    const p = props[basePid];
    if (!p || !p.imagen) return;
    const img = getCachedImage(p.imagen);
    if (!img?.complete) return;

    const drawW = size * 2.8;
    const drawH = drawW * camara.PITCH_SCALE;
    
    context.save();
    context.globalAlpha = 0.35 * opac; 
    trazarHexPath(baseVerts);
    context.fillStyle = '#000';
    context.fill();
    context.restore();

    context.save();
    context.globalAlpha = opac;
    trazarHexPath(vertsOver);
    context.clip();
    context.drawImage(img, overPos.x - drawW / 2, overPos.y - drawH / 2, drawW, drawH);
    context.restore();

    context.save();
    context.globalAlpha = opac;
    trazarHexPath(vertsOver);
    const grad = context.createLinearGradient(overPos.x, overPos.y - size, overPos.x, overPos.y + size);
    grad.addColorStop(0,    'rgba(255,255,255,0.15)');
    grad.addColorStop(0.45, 'rgba(0,0,0,0)');
    grad.addColorStop(1,    'rgba(0,0,0,0.5)');
    context.fillStyle = grad;
    context.fill();
    context.restore();

    context.save();
    context.globalAlpha = opac;
    context.beginPath();
    context.moveTo(vertsOver[2].x, vertsOver[2].y);
    context.lineTo(vertsOver[3].x, vertsOver[3].y);
    context.lineTo(vertsOver[4].x, vertsOver[4].y);
    context.lineTo(vertsOver[4].x, vertsOver[4].y + size * 0.15);
    context.lineTo(vertsOver[2].x, vertsOver[2].y + size * 0.15);
    context.closePath();
    context.fillStyle = 'rgba(0,0,0,0.4)';
    context.fill();
    context.restore();
}

function dibujarNPC(q, r, npc, projPos) {
    const img = getCachedImage(npc.icono_url || NO_IMG);
    if (!img?.complete) return;
    const size = HEX_SIZE * 1.6 * camara.zoom;
    context.drawImage(img, projPos.x - size/2, projPos.y - size - size*0.1, size, size);
}

function dibujarGridAndOverlay(q, r, hex, basePos) {
    const topPos = hexToPixel3D(q, r, hex?.elevation || 0);
    const verts = isometricHexVertices(topPos.x, topPos.y, 0);
    const key = hexKey(q, r);

    trazarHexPath(verts);
    context.strokeStyle = 'rgba(80, 50, 130, 0.22)';
    context.lineWidth = 0.8;
    context.stroke();

    const isHov = ui.hoveredHex === key;
    const isSelH = editor.selectedHexKey === key;
    const isSel = editor.seleccion.has(key);

    if (isHov || isSelH || isSel) {
        trazarHexPath(verts);
        if (isSel) { context.fillStyle = 'rgba(100,200,255,0.2)'; context.fill(); }
        else if (isHov) { context.fillStyle = 'rgba(255,255,255,0.06)'; context.fill(); }
        
        context.strokeStyle = isSelH ? '#f1c40f' : (isSel ? '#3498db' : 'rgba(255,255,255,0.3)');
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
        `  EDITOR 3D ISOMETRICO  |  ${editor.herramienta.toUpperCase()}  |  Capa: ${editor.capaActual.toUpperCase()}  |  Brush: ${editor.brushSize}`,
        10, H - 11
    );
}
