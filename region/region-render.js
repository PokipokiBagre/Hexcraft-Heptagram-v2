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

// 🌟 OPTIMIZACIÓN EXTREMA: Constantes y variables precalculadas
const NEIGHBOR_DIRS = [
    {dq: 1, dr: 0}, {dq: 0, dr: 1}, {dq: -1, dr: 1},
    {dq: -1, dr: 0}, {dq: 0, dr: -1}, {dq: 1, dr: -1}
];
let baseHexOffsets = [];
let edgeToNeighborIndex = [];

export function inicializarRender(ctx) { context = ctx; }

// Calcula la geometría base 1 sola vez por frame en lugar de 10,000 veces
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

export function dibujarEscena() {
    if (!context) return;
    const canvas = context.canvas;
    const W = canvas.width, H = canvas.height;

    updateBaseOffsets(); // Sincroniza geometría

    context.clearRect(0, 0, W, H);
    if (bgImage) {
        context.globalAlpha = 0.22;
        context.drawImage(bgImage, 0, 0, W, H);
        context.globalAlpha = 1;
    } else {
        context.fillStyle = '#0a0018'; context.fillRect(0, 0, W, H);
    }

    const layers = getDrawingLayers(W, H);
    
    // 🌟 BATCH RENDERING: Dibuja miles de cosas en 1 solo comando agrupándolas
    renderBatchSueloBase(layers.ground);
    renderBatchRegionesTint(layers.ground);
    renderBatchColoresFondo(layers.ground);
    renderBatchImagenesFondo(layers.ground);
    renderBatchBordesRegion(layers.borders);
    renderBatchGrid(layers.gridBase);
    
    // Elementos mid no se pueden hacer en batch tan fácil, pero son pocos
    renderPropsYPersonajes(layers.props);
    renderCapaOver(layers.over);

    if (editor.activo) dibujarHUDEditor(W, H);
}

function getDrawingLayers(W, H) {
    const layers = { ground: [], borders: [], gridBase: [], props: [], over: [] };
    const margen = HEX_SIZE * camara.zoom * 6;
    
    for (const key in mapaActual.hexes) {
        const [q, r] = key.split(',').map(Number);
        const hex = mapaActual.hexes[key];
        
        const baseProjPos = hexToPixel3D(q, r, 0); 
        // Culling: Si está fuera de la pantalla, no procesar
        if (baseProjPos.x < -margen || baseProjPos.x > W + margen || baseProjPos.y < -margen || baseProjPos.y > H + margen) continue;

        const baseDepth = baseProjPos.y; 

        layers.ground.push({ q, r, hex, projPos: baseProjPos, depth: baseDepth });
        if (hex.region) layers.borders.push({ q, r, hex, projPos: baseProjPos, depth: baseDepth });

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

        layers.gridBase.push({ layer: 'base', q, r, hex, projPos: baseProjPos, depth: baseDepth + 3 });

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
            layers.over.push({ layer: 'over', q, r, hex, projPos: overProjPos, depth: overDepth + 2 });
        }
    }

    layers.props.sort((a, b) => a.depth - b.depth);
    return layers;
}

// ────────────────────────────────────────────────────────────
// FUNCIONES DE BATCH RENDERING (Optimizadas para Canvas 2D)
// ────────────────────────────────────────────────────────────

function addHexToPath(p) {
    context.moveTo(p.x + baseHexOffsets[0].x, p.y + baseHexOffsets[0].y);
    for (let j = 1; j < 6; j++) context.lineTo(p.x + baseHexOffsets[j].x, p.y + baseHexOffsets[j].y);
    context.lineTo(p.x + baseHexOffsets[0].x, p.y + baseHexOffsets[0].y); // Cierra el path
}

function renderBatchSueloBase(groundLayers) {
    if(groundLayers.length === 0) return;
    context.beginPath();
    for(let i=0; i<groundLayers.length; i++) {
        addHexToPath(groundLayers[i].projPos);
    }
    context.fillStyle = '#0a0018';
    context.fill();
}

function renderBatchRegionesTint(groundLayers) {
    const regionBatches = {};
    for(let i=0; i<groundLayers.length; i++) {
        const item = groundLayers[i];
        const reg = item.hex.region ? mapaActual.regiones[item.hex.region] : null;
        if (reg) {
            const alpha = Math.max(0.05, (reg.opacidad || 0.3) * 0.2);
            const key = `${reg.color || '#334'}_${alpha}`;
            if (!regionBatches[key]) regionBatches[key] = { color: reg.color || '#334', alpha: alpha, points: [] };
            regionBatches[key].points.push(item.projPos);
        }
    }
    
    for (const k in regionBatches) {
        const b = regionBatches[k];
        context.beginPath();
        for(let i=0; i<b.points.length; i++) addHexToPath(b.points[i]);
        context.fillStyle = b.color;
        context.globalAlpha = b.alpha;
        context.fill();
    }
    context.globalAlpha = 1.0;
}

function renderBatchColoresFondo(groundLayers) {
    const colorBatches = {};
    for(let i=0; i<groundLayers.length; i++) {
        const item = groundLayers[i];
        const backItems = item.hex.back || [];
        for(let j=0; j<backItems.length; j++) {
            const pid = backItems[j];
            if (typeof pid === 'string' && pid.startsWith('COLOR:')) {
                const parts = pid.split(':');
                const color = parts[1];
                const alpha = parseFloat(parts[2]) || 1.0;
                const key = `${color}_${alpha}`;
                if (!colorBatches[key]) colorBatches[key] = { color, alpha, points: [] };
                colorBatches[key].points.push(item.projPos);
            }
        }
    }
    
    for (const k in colorBatches) {
        const b = colorBatches[k];
        context.beginPath();
        for(let i=0; i<b.points.length; i++) addHexToPath(b.points[i]);
        context.fillStyle = b.color;
        context.globalAlpha = b.alpha;
        context.fill();
    }
    context.globalAlpha = 1.0;
}

function renderBatchImagenesFondo(groundLayers) {
    const size = HEX_SIZE * camara.zoom;
    const drawW = size * 2.85; 
    const drawH = drawW * camara.PITCH_SCALE;
    const isLOD = camara.zoom < 0.35; // LOD: Desactiva clipping si está muy lejos

    for(let i=0; i<groundLayers.length; i++) {
        const item = groundLayers[i];
        const backItems = item.hex.back || [];
        
        for(let j=0; j<backItems.length; j++) {
            const pid = backItems[j];
            if (typeof pid === 'string' && pid.startsWith('COLOR:')) continue;

            let basePid = pid; let opac = 1.0;
            if (typeof pid === 'string' && pid.includes(':')) {
                const parts = pid.split(':');
                basePid = parts[0]; opac = parseFloat(parts[1]) || 1.0;
            }

            const p = props[basePid];
            if (!p || !p.imagen) continue;
            const img = getCachedImage(p.imagen);
            if (!img?.complete) continue;

            context.save();
            context.globalAlpha = opac;
            if (!isLOD) {
                context.beginPath();
                addHexToPath(item.projPos);
                context.clip();
            }
            context.drawImage(img, item.projPos.x - drawW / 2, item.projPos.y - drawH / 2, drawW, drawH);
            context.restore();
        }
    }
}

function renderBatchBordesRegion(borderLayers) {
    const borderBatches = {};
    
    for(let i=0; i<borderLayers.length; i++) {
        const item = borderLayers[i];
        const reg = mapaActual.regiones[item.hex.region];
        if (!reg) continue;
        
        const color = reg.color || '#334';
        const alpha = reg.opacidad ? Math.min(1, reg.opacidad + 0.4) : 0.8;
        const key = `${color}_${alpha}`;
        
        if (!borderBatches[key]) borderBatches[key] = { color, alpha, lines: [] };
        
        for (let edge = 0; edge < 6; edge++) {
            const neighborIdx = edgeToNeighborIndex[edge];
            const dir = NEIGHBOR_DIRS[neighborIdx];
            const nHex = mapaActual.hexes[`${item.q + dir.dq},${item.r + dir.dr}`];
            
            if (!nHex || nHex.region !== item.hex.region) {
                borderBatches[key].lines.push({
                    x1: item.projPos.x + baseHexOffsets[edge].x, y1: item.projPos.y + baseHexOffsets[edge].y,
                    x2: item.projPos.x + baseHexOffsets[(edge+1)%6].x, y2: item.projPos.y + baseHexOffsets[(edge+1)%6].y
                });
            }
        }
    }

    context.lineWidth = Math.max(1.5, 4.5 * camara.zoom);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    
    for (const k in borderBatches) {
        const b = borderBatches[k];
        context.beginPath();
        for(let i=0; i<b.lines.length; i++) {
            context.moveTo(b.lines[i].x1, b.lines[i].y1);
            context.lineTo(b.lines[i].x2, b.lines[i].y2);
        }
        context.strokeStyle = b.color;
        context.globalAlpha = b.alpha;
        context.stroke();
    }
    context.globalAlpha = 1.0;
}

function renderBatchGrid(gridLayers) {
    // 🌟 BATCH de grid completo para dibujar todo de una sola vez
    if (camara.zoom >= 0.35) { 
        context.beginPath();
        for(let i=0; i<gridLayers.length; i++) {
            addHexToPath(gridLayers[i].projPos);
        }
        context.strokeStyle = 'rgba(80, 50, 130, 0.22)';
        context.lineWidth = Math.max(0.5, 0.8 * camara.zoom);
        context.stroke();
    }

    // Puntero y Selección (Deben dibujarse independientes por tener otro color)
    for(let i=0; i<gridLayers.length; i++) {
        const item = gridLayers[i];
        const key = hexKey(item.q, item.r);
        const isHov = ui.hoveredHex === key;
        const isSelH = editor.selectedHexKey === key;

        if (isHov || isSelH) {
            if (editor.activo) {
                if (item.layer === 'over' && editor.capaActual !== 'over') continue;
                if (item.layer === 'base' && editor.capaActual === 'over') continue;
            } else {
                if (item.layer === 'over') continue;
            }

            context.beginPath();
            addHexToPath(item.projPos);
            
            if (isHov) { context.fillStyle = 'rgba(255,255,255,0.06)'; context.fill(); }
            context.strokeStyle = isSelH ? '#f1c40f' : 'rgba(255,255,255,0.3)';
            context.lineWidth = isSelH ? 2.5 : 1.5;
            context.stroke();
        }
    }
}

// ────────────────────────────────────────────────────────────
// RENDERIZADO DE PROPS, NPCS Y CAPA OVER
// ────────────────────────────────────────────────────────────

function renderPropsYPersonajes(propLayers) {
    for(let i=0; i<propLayers.length; i++) {
        const item = propLayers[i];
        if (item.type === 'itemMid') {
            if (typeof item.propId === 'string' && item.propId.startsWith('COLOR:')) {
                const parts = item.propId.split(':');
                const size = HEX_SIZE * 0.8 * camara.zoom;
                context.save();
                context.globalAlpha = parseFloat(parts[2]) || 1.0;
                context.beginPath();
                context.arc(item.projPos.x, item.projPos.y - size/2, size/2, 0, Math.PI*2);
                context.fillStyle = parts[1]; context.fill();
                context.restore();
            } else {
                let basePid = item.propId;
                if (typeof item.propId === 'string' && item.propId.includes(':')) basePid = item.propId.split(':')[0];
                const p = props[basePid];
                if (!p) continue;
                const img = getCachedImage(p.imagen || NO_IMG);
                if (!img?.complete) continue;
                const size = HEX_SIZE * 1.5 * camara.zoom; 
                context.save();
                context.globalAlpha = item.opacidad;
                context.drawImage(img, item.projPos.x - size/2, item.projPos.y - size * 0.8 - (size * 0.2), size, size);
                context.restore();
            }
        } else if (item.type === 'itemNPC') {
            const img = getCachedImage(item.npc.icono_url || NO_IMG);
            if (!img?.complete) continue;
            const size = HEX_SIZE * 1.6 * camara.zoom;
            context.save();
            context.globalAlpha = item.opacidad;
            context.drawImage(img, item.projPos.x - size/2, item.projPos.y - size - size*0.1, size, size);
            context.restore();
        }
    }
}

function renderCapaOver(overLayers) {
    const isLOD = camara.zoom < 0.35;
    const size = HEX_SIZE * camara.zoom;
    const drawW = size * 2.85; 
    const drawH = drawW * camara.PITCH_SCALE;
    
    // Batch Backgrounds for Over
    const colorBatches = {};
    for(let i=0; i<overLayers.length; i++) {
        const item = overLayers[i];
        if (item.type === 'hexOverBg') {
            const parts = item.propId.split(':');
            const color = parts[1];
            const key = `${color}_${item.opacidad}`;
            if(!colorBatches[key]) colorBatches[key] = { color, alpha: item.opacidad, points: [] };
            colorBatches[key].points.push(item.projPos);
        }
    }
    
    for(const k in colorBatches) {
        const b = colorBatches[k];
        context.beginPath();
        for(let i=0; i<b.points.length; i++) addHexToPath(b.points[i]);
        context.fillStyle = b.color;
        context.globalAlpha = b.alpha;
        context.fill();
    }
    context.globalAlpha = 1.0;

    // Items Over and Grids
    for(let i=0; i<overLayers.length; i++) {
        const item = overLayers[i];
        if (item.type === 'hexOverItem') {
            let basePid = item.propId;
            if (typeof item.propId === 'string' && item.propId.includes(':')) basePid = item.propId.split(':')[0];
            const p = props[basePid];
            if (!p || !p.imagen) continue;
            const img = getCachedImage(p.imagen);
            if (!img?.complete) continue;

            context.save();
            context.globalAlpha = item.opacidad;
            if (!isLOD) {
                context.beginPath();
                addHexToPath(item.projPos);
                context.clip();
            }
            context.drawImage(img, item.projPos.x - drawW / 2, item.projPos.y - drawH / 2, drawW, drawH);
            context.restore();
        } else if (item.type === 'gridOverlay') {
            // Renderiza Grid OVER igual que la base, solo si es hover
            const key = hexKey(item.q, item.r);
            const isHov = ui.hoveredHex === key;
            const isSelH = editor.selectedHexKey === key;
            if (isHov || isSelH) {
                if (editor.activo && editor.capaActual !== 'over') continue;
                context.beginPath();
                addHexToPath(item.projPos);
                if (isHov) { context.fillStyle = 'rgba(255,255,255,0.06)'; context.fill(); }
                context.strokeStyle = isSelH ? '#f1c40f' : 'rgba(255,255,255,0.3)';
                context.lineWidth = isSelH ? 2.5 : 1.5;
                context.stroke();
            }
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
