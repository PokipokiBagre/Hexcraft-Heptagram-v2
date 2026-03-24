// ============================================================
// region-render.js — Motor de Renderizado de Mapas Superpuestos (Map Planes)
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

// Configuración de los Planos de Mapa Superpuestos
// OFFSET_Y: Brutal separación vertical (4 pisos de altura)
const MAP_PLANE_OVER_OFFSET_Y = -(HEX_SIZE * 4.0); 
// OFFSET_X: Ligero desencaje horizontal para el efecto "desencajado"
const MAP_PLANE_OVER_OFFSET_X = (HEX_SIZE * 0.4); 

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
        // Obtenemos la opacidad asignada individualmente (o por defecto)
        const currentOpac = item.opacidad || 1.0;

        switch (item.type) {
            case 'hexTop':    
                dibujarHexTop3D(item.q, item.r, item.hex, item.projPos); break;
            case 'itemMid':   
                dibujarBillboardItem(item.q, item.r, item.propId, item.projPos, currentOpac, 'mid'); break;
            case 'itemNPC':   
                dibujarNPC(item.q, item.r, item.npc, item.projPos, currentOpac); break;
            case 'hexOverBg': 
                dibujarHexOverBackground(item.q, item.r, item.propId, item.hex, item.projPos, currentOpac); break;
            case 'hexOverItem': 
                dibujarHexOverItem(item.q, item.r, item.propId, item.hex, item.projPos, currentOpac); break;
            case 'gridOverlay': 
                dibujarGridAndOverlay(item.q, item.r, item.hex, item.projPos, item.layer); break;
        }
    });

    if (editor.activo) dibujarHUDEditor(W, H);
}

function getDrawingList(W, H) {
    const list = [];
    // Aumentamos el margen para asegurar que las plataformas flotantes no se corten al salir
    const margen = HEX_SIZE * camara.zoom * 6;
    
    for (const key in mapaActual.hexes) {
        const [q, r] = key.split(',').map(Number);
        const hex = mapaActual.hexes[key];
        
        const baseProjPos = hexToPixel3D(q, r, 0); 
        if (baseProjPos.x < -margen || baseProjPos.x > W + margen || baseProjPos.y < -margen || baseProjPos.y > H + margen) continue;

        // Profundidad de ordenado (Y)
        const baseDepth = baseProjPos.y; 

        // ══════════════════════════════════════════════════════════
        // PLANO BASE (Back/Mid/Terreno)
        // ══════════════════════════════════════════════════════════
        
        // 1. Terreno y capa Back
        list.push({ type: 'hexTop', q, r, hex, projPos: baseProjPos, depth: baseDepth });

        // 2. Mid (Props)
        hex.mid?.forEach(pid => {
            const opac = typeof pid === 'string' && pid.includes(':') ? parseFloat(pid.split(':')[1]) : 1.0;
            list.push({ type: 'itemMid', q, r, propId: pid, projPos: baseProjPos, opacidad: opac, depth: baseDepth + 1 });
        });
        
        // 3. NPCs (Lógica de mapa)
        Object.values(npcsMapaLocal).forEach(npc => {
            if (npc.hex_pos === key) list.push({ type: 'itemNPC', q, r, npc, projPos: baseProjPos, opacidad: 1.0, depth: baseDepth + 2 });
        });

        // Grid del plano base
        list.push({ type: 'gridOverlay', q, r, hex, projPos: baseProjPos, layer: 'base', depth: baseDepth + 3 });

        // ══════════════════════════════════════════════════════════
        // PLANO OVER SUPERPUESTO (La plataforma flotante desencajada)
        // ══════════════════════════════════════════════════════════
        
        if (hex.over?.length > 0) {
            // Calculamos la posición con el brutal desencaje vertical y ligero horizontal
            const size = HEX_SIZE * camara.zoom;
            const overProjPos = { 
                x: baseProjPos.x + (MAP_PLANE_OVER_OFFSET_X * camara.zoom), 
                y: baseProjPos.y + (MAP_PLANE_OVER_OFFSET_Y * camara.zoom)
            };
            
            // Profundidad brutalmente alta para que flote por encima de todo
            const overDepth = baseDepth + 5000; 

            // Dividimos Over en dos tipos: Colores/Fondo y Objetos
            hex.over.forEach(pid => {
                const isColor = typeof pid === 'string' && pid.startsWith('COLOR:');
                const opac = typeof pid === 'string' && pid.includes(':') ? parseFloat(pid.split(':')[1]) : 1.0;
                
                if (isColor) {
                    // Fondo de color flotante (Pincel)
                    list.push({ type: 'hexOverBg', q, r, propId: pid, hex, projPos: overProjPos, opacidad: opac, depth: overDepth });
                } else {
                    // Objetos/Props en la plataforma flotante
                    list.push({ type: 'hexOverItem', q, r, propId: pid, hex, projPos: overProjPos, opacidad: opac, depth: overDepth + 1 });
                }
            });

            // Grid del plano over
            list.push({ type: 'gridOverlay', q, r, hex, projPos: overProjPos, layer: 'over', depth: overDepth + 2 });
        }
    }

    return list.sort((a, b) => a.depth - b.depth);
}

// ── PLANO BASE: TERRENO Y BACK ──
function dibujarHexTop3D(q, r, hex, topPos) {
    const verts = isometricHexVertices(topPos.x, topPos.y, 0);

    // Trazar el hexágono
    trazarHexPath(verts);
    
    const reg = hex.region ? mapaActual.regiones[hex.region] : null;
    if (reg) {
        context.fillStyle = reg.color; context.globalAlpha = reg.opacidad; context.fill(); context.globalAlpha = 1;
    } else if (hex.color) {
        context.fillStyle = hex.color; context.globalAlpha = hex.opacidad ?? 1.0; context.fill(); context.globalAlpha = 1;
    } else {
        context.fillStyle = '#0a0018'; // Fondo oscuro base
        context.fill();
    }

    const backItems = hex.back || [];
    
    // ANCHURA MAXIMA calculada para la proyección isométrica (2.732 base matemática).
    // Usamos 2.85 para rellenar perfectamente y evitar huecos en los bordes.
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
        
        // Dibujado ampliado para RELLENO TOTAL
        context.drawImage(img, topPos.x - drawW / 2, topPos.y - drawH / 2, drawW, drawH);
        context.restore();
    });
}

// ── PLANO OVER: FONDO DE COLOR (Pincel) ──
function dibujarHexOverBackground(q, r, propId, hex, overPos, opac) {
    const parts = propId.split(':');
    const color = parts[1];
    
    const verts = isometricHexVertices(overPos.x, overPos.y, 0);
    const size = HEX_SIZE * camara.zoom;

    // 1. Color superior flotante
    context.save();
    context.globalAlpha = opac;
    trazarHexPath(verts);
    context.fillStyle = color;
    context.fill();
    context.restore();

    // 2. Borde del grosor (efecto grosor 3D flotante)
    context.save();
    context.globalAlpha = opac;
    context.beginPath();
    context.moveTo(verts[2].x, verts[2].y);
    context.lineTo(verts[3].x, verts[3].y);
    context.lineTo(verts[4].x, verts[4].y);
    context.lineTo(verts[4].x, verts[4].y + size * 0.15);
    context.lineTo(verts[2].x, verts[2].y + size * 0.15);
    context.closePath();
    context.fillStyle = 'rgba(0,0,0,0.4)'; // Grosor oscuro
    context.fill();
    context.restore();
}

// ── PLANO OVER: OBJETOS (Props) ──
function dibujarHexOverItem(q, r, propId, hex, overPos, opac) {
    let basePid = propId;
    if (typeof propId === 'string' && propId.includes(':')) basePid = propId.split(':')[0];

    const p = props[basePid];
    if (!p || !p.imagen) return;
    const img = getCachedImage(p.imagen);
    if (!img?.complete) return;

    const size = HEX_SIZE * camara.zoom;
    const drawW = size * 2.85; // Relleno total
    const drawH = drawW * camara.PITCH_SCALE;
    
    const vertsOver = isometricHexVertices(overPos.x, overPos.y, 0);

    // 1. Relleno texturizado (clipeado) en la altura Over
    context.save();
    context.globalAlpha = opac;
    trazarHexPath(vertsOver);
    context.clip();
    context.drawImage(img, overPos.x - drawW / 2, overPos.y - drawH / 2, drawW, drawH);
    context.restore();

    // 2. Borde del grosor (igual que el fondo de color)
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

// ── OBJETOS MID (Billboard centrado) ──
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

// ── GRIDS Y OVERLAYS (Base y Over) ──
function dibujarGridAndOverlay(q, r, hex, projPos, layer) {
    const verts = isometricHexVertices(projPos.x, projPos.y, 0);
    const key = hexKey(q, r);

    // Dibuja el borde base
    trazarHexPath(verts);
    context.strokeStyle = layer === 'base' ? 'rgba(80, 50, 130, 0.22)' : 'rgba(100, 200, 255, 0.15)';
    context.lineWidth = 0.8;
    context.stroke();

    // Solo dibujamos la selección si el modo editor está activo y estamos en la capa correcta
    // (O si el editor está apagado para la selección del jugador)
    const isHov = ui.hoveredHex === key;
    const isSelH = editor.selectedHexKey === key;
    const isSel = editor.seleccion.has(key);

    if (isHov || isSelH || isSel) {
        // En el modo editor, solo permitimos interactuar con la plataforma que estamos editando
        if (editor.activo) {
            if (layer === 'over' && editor.capaActual !== 'over') return;
            if (layer === 'base' && editor.capaActual === 'over') return;
        } else {
            // Fuera del editor, no interactuamos con el plano Over flotante
            if (layer === 'over') return;
        }

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
        `  EDITOR SUPERPUESTO (Map Planes)  |  ${editor.herramienta.toUpperCase()}  |  Capa: ${editor.capaActual.toUpperCase()}  |  Brush: ${editor.brushSize}`,
        10, H - 11
    );
}
