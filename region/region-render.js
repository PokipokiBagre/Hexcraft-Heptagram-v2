// ============================================================
// region-render.js — Motor de Renderizado Isométrico 3D Real
// ============================================================

import {
    HEX_SIZE, camara, mapaActual, props, npcsMapaLocal,
    editor, ui, CAPAS, STORAGE_URL
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

    // 1. Limpiar y dibujar Fondo
    context.clearRect(0, 0, W, H);
    if (bgImage) {
        context.globalAlpha = 0.22;
        context.drawImage(bgImage, 0, 0, W, H);
        context.globalAlpha = 1;
    } else {
        context.fillStyle = '#0a0018'; context.fillRect(0, 0, W, H);
    }

    // 2. Obtener hexágonos visibles y ordenarlos por profundidad (Depth Sorting)
    const listDrawingItems = getDrawingList(W, H);
    
    // 3. Renderizar items ordenados (Painter's Algorithm)
    listDrawingItems.forEach(item => {
        switch (item.type) {
            case 'hexVolume': dibujarHexVolume3D(item.q, item.r, item.hex, item.projPos); break;
            case 'hexTop':    dibujarHexTop3D(item.q, item.r, item.hex, item.projPos); break;
            case 'itemMid':    dibujarBillboardItem(item.q, item.r, item.propId, item.projPos, 'mid'); break;
            case 'itemOver':   dibujarBillboardItem(item.q, item.r, item.propId, item.projPos, 'over'); break;
            case 'itemNPC':    dibujarNPC(item.q, item.r, item.npc, item.projPos); break;
            case 'gridOverlay': dibujarGridAndOverlay(item.q, item.r, item.hex, item.projPos); break;
        }
    });

    // 4. UI del editor
    if (editor.activo) dibujarHUDEditor(W, H);
}

// Crea una lista de todos los elementos visibles ordenados por profundidad (screen_y de la base).
function getDrawingList(W, H) {
    const list = [];
    // Un margen generoso para hexágonos visibles debido a la perspectiva inclinada
    const margen = HEX_SIZE * camara.zoom * 3;
    
    // Iterar por todo el mapa
    for (const key in mapaActual.hexes) {
        const [q, r] = key.split(',').map(Number);
        const hex = mapaActual.hexes[key];
        
        // Posición proyectada de la BASE del hex
        const projPos = hexToPixel3D(q, r, 0); 
        
        // Culling básico (solo si la base está cerca de la pantalla)
        if (projPos.x < -margen || projPos.x > W + margen || projPos.y < -margen || projPos.y > H + margen) continue;

        const depth = projPos.y; // Profundidad isométrica básica

        // 1. Caras de Volumen de elevación
        if (hex.elevation > 0) {
            list.push({ type: 'hexVolume', q, r, hex, projPos, depth });
        }
        
        // 2. Tapa (Back) con Suelo / Color
        list.push({ type: 'hexTop', q, r, hex, projPos, depth: depth + 1 }); // Un poco por delante del volumen

        // 3. Objetos Billboard (Mid, Over, NPCs)
        const posTop = hexToPixel3D(q, r, hex.elevation); // Posición superior para props

        hex.mid?.forEach(pid => list.push({ type: 'itemMid', q, r, propId: pid, projPos: posTop, depth: depth + 2 }));
        hex.over?.forEach(pid => list.push({ type: 'itemOver', q, r, propId: pid, projPos: posTop, depth: depth + 3 }));
        
        Object.values(npcsMapaLocal).forEach(npc => {
            if (npc.hex_pos === key) list.push({ type: 'itemNPC', q, r, npc, projPos: posTop, depth: depth + 4 });
        });

        // 4. Grid y superposiciones (lo último)
        list.push({ type: 'gridOverlay', q, r, hex, projPos, depth: depth + 5 });
    }

    // Ordenar de atrás hacia adelante
    return list.sort((a, b) => a.depth - b.depth);
}

// Dibuja las caras laterales isométricas para crear el volumen elevado
function dibujarHexVolume3D(q, r, hex, basePos) {
    const elevation = hex.elevation;
    const size = HEX_SIZE * camara.zoom;
    const squash = camara.PITCH_SCALE;
    const elevationPx = elevation * camara.elevationScale * camara.zoom;

    // Vértices proyectados de la tapa superior
    const topPos = hexToPixel3D(q, r, elevation);
    const topV = isometricHexVertices(topPos.x, topPos.y, 0); // Elevation ya aplicada en topPos
    
    // Vértices proyectados de la base
    const baseV = isometricHexVertices(basePos.x, basePos.y, 0);

    // Caras laterales visibles (dependen de la inclinación, típicamente las de "abajo")
    const facesVisible = [2, 3, 4]; // Vértices indices en flat-top hex

    context.beginPath();
    facesVisible.forEach(i => {
        context.moveTo(topV[i].x, topV[i].y);
        context.lineTo(topV[(i+1)%6].x, topV[(i+1)%6].y);
        context.lineTo(baseV[(i+1)%6].x, baseV[(i+1)%6].y);
        context.lineTo(baseV[i].x, baseV[i].y);
        context.closePath();
    });
    
    // Sombreado de las caras laterales (gris oscuro/marrón)
    context.fillStyle = '#2a1a0a'; context.fill();
    context.strokeStyle = 'rgba(0,0,0,0.5)'; context.stroke();
}

// Dibuja la tapa superior del hexágono con la textura de suelo/back.
// Aquí se usa recorte (clipping) para que la textura llene todo el hex y no sea circular.
function dibujarHexTop3D(q, r, hex, basePos) {
    const elevation = hex.elevation;
    const size = HEX_SIZE * camara.zoom;
    
    // Posición superior proyectada
    const topPos = hexToPixel3D(q, r, elevation);
    const verts = isometricHexVertices(topPos.x, topPos.y, 0);

    // Definir la forma hexagonal isométrica (tapa)
    trazarHexPath(verts);
    
    // 1. Color de base de Región o Color base
    const reg = hex.region ? mapaActual.regiones[hex.region] : null;
    if (reg) {
        context.fillStyle = reg.color; context.globalAlpha = reg.opacidad; context.fill(); context.globalAlpha = 1;
    } else if (hex.color) {
        context.fillStyle = hex.color; context.globalAlpha = hex.opacidad ?? 0.7; context.fill(); context.globalAlpha = 1;
    } else {
        context.fillStyle = '#07000f'; context.fill();
    }

    // 2. Textura de Suelo (Back) - Usando Recorte (Clipping)
    const backItems = hex.back || [];
    const size2d = HEX_SIZE * 2.2 * camara.zoom;
    const squash = camara.PITCH_SCALE;

    backItems.forEach(pid => {
        if (typeof pid === 'string' && pid.startsWith('COLOR:')) {
            const parts = pid.split(':');
            context.save();
            trazarHexPath(verts);
            context.fillStyle = parts[parts.length-2]; context.globalAlpha = parseFloat(parts[parts.length-1]); context.fill();
            context.restore();
            return;
        }

        const p = props[pid];
        if (!p || !p.imagen) return;
        const img = getCachedImage(p.imagen);
        if (!img?.complete) return;

        context.save();
        // Recorte para que la textura solo se dibuje dentro de la tapa hexagonal
        trazarHexPath(verts);
        context.clip();
        
        // Dibujar textura escalada para cubrir todo el hex (no circular)
        context.drawImage(img, topPos.x - size2d / 2, topPos.y - size2d * squash / 2, size2d, size2d * squash);
        context.restore();
    });
}

// Dibuja un prop de Mid u Over como un sprite vertical (billboard) limpio.
// No hay texturas circulares y no se conectan. Es un sprite ordenado en el centro.
function dibujarBillboardItem(q, r, propId, projPos, capa) {
    if (typeof propId === 'string' && propId.startsWith('COLOR:')) {
        dibujarEsferaColor(q, r, propId, projPos, capa); return;
    }
    
    const p = props[propId];
    if (!p) return;

    const img = getCachedImage(p.imagen || NO_IMG);
    if (!img?.complete) return;

    const size = HEX_SIZE * 1.5 * camara.zoom; // Tamaño del sprite vertical
    const verticalOffset = capa === 'mid' ? size * 0.45 : size * 0.8; // Altura sobre el suelo

    // Dibujar el sprite vertical ordenado y centrado
    context.drawImage(img, projPos.x - size/2, projPos.y - size * 0.95 - verticalOffset, size, size);
}

// Representación simbólica de una esfera de color (pincel) en mid/over
function dibujarEsferaColor(q, r, colorEntry, projPos, capa) {
    const parts = colorEntry.split(':');
    const color = parts[parts.length-2];
    const opacity = parseFloat(parts[parts.length-1]);
    const size = HEX_SIZE * 0.8 * camara.zoom;
    const verticalOffset = capa === 'mid' ? size * 0.4 : size * 0.8;

    context.save();
    context.globalAlpha = opacity;
    context.beginPath();
    context.arc(projPos.x, projPos.y - size/2 - verticalOffset, size/2, 0, Math.PI*2);
    context.fillStyle = color; context.fill();
    context.restore();
}

function dibujarNPC(q, r, npc, projPos) {
    const img = getCachedImage(npc.icono_url || NO_IMG);
    if (!img?.complete) return;
    const size = HEX_SIZE * 1.6 * camara.zoom;
    // NPC es un billboard vertical ordenado
    context.drawImage(img, projPos.x - size/2, projPos.y - size - size*0.1, size, size);
}

// Dibuja la cuadrícula y las superposiciones de selección
function dibujarGridAndOverlay(q, r, hex, basePos) {
    const topPos = hexToPixel3D(q, r, hex?.elevation || 0);
    const verts = isometricHexVertices(topPos.x, topPos.y, 0);
    const key = hexKey(q, r);

    // Grid (Cuadrícula básica)
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

// Helper para trazar la forma de un hexágono isométrico
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
