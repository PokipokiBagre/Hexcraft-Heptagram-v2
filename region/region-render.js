// ============================================================
// region-render.js — Motor de Renderizado de Mapas Superpuestos
// ============================================================

import {
    HEX_SIZE, camara, mapaActual, props, npcsMapaLocal,
    editor, ui, STORAGE_URL, OVER_OFFSET_X, OVER_OFFSET_Y
} from './region-state.js';
import { hexToPixel3D, hexKey } from './region-utils.js';

let context;
let imageCache = {};
let bgImage;
const NO_IMG = `${STORAGE_URL}/imginterfaz/no_encontrado.png`;

// 🌟 OPTIMIZACIÓN: Constantes precalculadas
const NEIGHBOR_DIRS = [
    {dq: 1, dr: 0}, {dq: 0, dr: 1}, {dq: -1, dr: 1},
    {dq: -1, dr: 0}, {dq: 0, dr: -1}, {dq: 1, dr: -1}
];
let baseHexOffsets = [];
let edgeToNeighborIndex = [];

export function inicializarRender(ctx) { context = ctx; }

// 🌟 OPTIMIZACIÓN MÁXIMA: Pre-calculamos los vértices base UNA vez por frame
// Esto evita crear 60,000 objetos temporales por segundo y sobrecargar la RAM.
function updateBaseOffsets() {
    const size = HEX_SIZE * camara.zoom;
    const squash = camara.PITCH_SCALE;
    
    baseHexOffsets = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i);
        const vx_2d = size * Math.cos(angle);
        const vy_2d = size * Math.sin(angle);
        baseHexOffsets.push({ x: (vx_2d - vy_2d), y: (vx_2d + vy_2d) * squash });
    }

    // 🌟 Mapeo Inteligente: Calcula la relación de bordes a vecinos UNA VEZ por frame 
    // (en lugar de hacerlo para cada hexágono, reduciendo el cálculo en un 99.9%)
    edgeToNeighborIndex = new Array(6);
    const centerPos = hexToPixel3D(0, 0, 0); 
    for (let i = 0; i < 6; i++) {
        const midX = centerPos.x + (baseHexOffsets[i].x + baseHexOffsets[(i+1)%6].x) / 2;
        const midY = centerPos.y + (baseHexOffsets[i].y + baseHexOffsets[(i+1)%6].y) / 2;
        
        let closestJ = 0;
        let minD = Infinity;
        for (let j = 0; j < 6; j++) {
            const nPos = hexToPixel3D(NEIGHBOR_DIRS[j].dq, NEIGHBOR_DIRS[j].dr, 0);
            const dist = Math.hypot(nPos.x - midX, nPos.y - midY);
            if (dist < minD) { minD = dist; closestJ = j; }
        }
        edgeToNeighborIndex[i] = closestJ;
    }
}

// Trazado ultrarrápido basado en caché
function trazarHexPathFast(cx, cy) {
    context.beginPath();
    context.moveTo(cx + baseHexOffsets[0].x, cy + baseHexOffsets[0].y);
    for (let i = 1; i < 6; i++) context.lineTo(cx + baseHexOffsets[i].x, cy + baseHexOffsets[i].y);
    context.closePath();
}

export function dibujarEscena() {
    if (!context) return;
    const canvas = context.canvas;
    const W = canvas.width, H = canvas.height;

    // Actualizar matemáticas del frame
    updateBaseOffsets();

    context.clearRect(0, 0, W, H);
    if (bgImage) {
        context.globalAlpha = 0.22;
        context.drawImage(bgImage, 0, 0, W, H);
        context.globalAlpha = 1;
    } else {
        context.fillStyle = '#0a0018'; context.fillRect(0, 0, W, H);
    }

    const layers = getDrawingLayers(W, H);
    
    // FASE 1: Suelo y texturas
    layers.ground.forEach(item => dibujarHexTop3D(item.q, item.r, item.hex, item.projPos));
    
    // FASE 2: Bordes de región
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
    const reg = hex.region ? mapaActual.regiones[hex.region] : null;

    trazarHexPathFast(topPos.x, topPos.y);
    context.fillStyle = '#0a0018'; 
    context.fill();

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
            trazarHexPathFast(topPos.x, topPos.y);
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
        
        // 🌟 LOD: Si alejamos la cámara mucho, apagamos el Clipping. Es el proceso más pesado y de lejos no se nota.
        if (camara.zoom >= 0.35) {
            trazarHexPathFast(topPos.x, topPos.y);
            context.clip();
        }
        
        context.drawImage(img, topPos.x - drawW / 2, topPos.y - drawH / 2, drawW, drawH);
        context.restore();
    });
}

// ── BORDES DE REGIÓN ──
function dibujarHexRegionBorder(q, r, hex, topPos) {
    const reg = mapaActual.regiones[hex.region];
    if (!reg) return;

    context.save();
    context.strokeStyle = reg.color || '#334';
    // 🌟 LOD: Grosor dinámico para que no se sature a larga distancia
    context.lineWidth = Math.max(1.5, 4.5 * camara.zoom); 
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.globalAlpha = reg.opacidad ? Math.min(1, reg.opacidad + 0.4) : 0.8;

    context.beginPath();
    for (let i = 0; i < 6; i++) {
        // Uso de mapeo en caché (O(1) en lugar de medir trigonométricamente)
        const neighborIdx = edgeToNeighborIndex[i];
        const dir = NEIGHBOR_DIRS[neighborIdx];
        const nHex = mapaActual.hexes[`${q + dir.dq},${r + dir.dr}`];
        
        if (!nHex || nHex.region !== hex.region) {
            context.moveTo(topPos.x + baseHexOffsets[i].x, topPos.y + baseHexOffsets[i].y);
            context.lineTo(topPos.x + baseHexOffsets[(i+1)%6].x, topPos.y + baseHexOffsets[(i+1)%6].y);
        }
    }
    context.stroke();
    context.restore();
}

// ── PLANO OVER ──
function dibujarHexOverBackground(q, r, propId, hex, overPos, opac) {
    const parts = propId.split(':');
    const color = parts[1];

    context.save();
    context.globalAlpha = opac;
    trazarHexPathFast(overPos.x, overPos.y);
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

    context.save();
    context.globalAlpha = opac;
    
    if (camara.zoom >= 0.35) {
        trazarHexPathFast(overPos.x, overPos.y);
        context.clip();
    }
    
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
    const key = hexKey(q, r);
    const isHov = ui.hoveredHex === key;
    const isSelH = editor.selectedHexKey === key;

    // 🌟 LOD: Ocultar Grid normal al alejar para evitar ruido visual y mejorar FPS.
    if (camara.zoom >= 0.35 || isHov || isSelH) {
        trazarHexPathFast(projPos.x, projPos.y);

        if (camara.zoom >= 0.35) {
            context.strokeStyle = layer === 'base' ? 'rgba(80, 50, 130, 0.22)' : 'rgba(100, 200, 255, 0.15)';
            context.lineWidth = Math.max(0.5, 0.8 * camara.zoom);
            context.stroke();
        }

        if (isHov || isSelH) {
            if (editor.activo) {
                if (layer === 'over' && editor.capaActual !== 'over') return;
                if (layer === 'base' && editor.capaActual === 'over') return;
            } else {
                if (layer === 'over') return;
            }

            if (isHov) { context.fillStyle = 'rgba(255,255,255,0.06)'; context.fill(); }
            
            context.strokeStyle = isSelH ? '#f1c40f' : 'rgba(255,255,255,0.3)';
            context.lineWidth = isSelH ? 2.5 : 1.5;
            context.stroke();
        }
    }
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
