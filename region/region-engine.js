// ============================================================
// region-engine.js — Loop de Renderizado y Eventos de Entrada
// ============================================================

import {
    camara, editor, ui, mapaActual, crearHexData
} from './region-state.js';
import { inicializarRender, dibujarEscena } from './region-render.js';
import { pixelToHex3D, hexKey, hexesEnRadio } from './region-utils.js';

let canvas, rafId;
let _mouseDown = false, _dragging = false;
let _lastX, _lastY, _lastPinchDist;

export function inicializarEngine(canvasEl) {
    canvas = canvasEl;
    const ctx = canvas.getContext('2d');
    
    inicializarRender(ctx);
    redimensionar();
    window.addEventListener('resize', redimensionar);
    
    registrarEventos();
    iniciarLoop();
}

function redimensionar() {
    canvas.width  = window.innerWidth  * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width  = window.innerWidth  + 'px';
    canvas.style.height = window.innerHeight + 'px';
    canvas.getContext('2d').scale(window.devicePixelRatio, window.devicePixelRatio);
}

function iniciarLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    const loop = () => { dibujarEscena(); rafId = requestAnimationFrame(loop); };
    loop();
}

// ── Eventos de Ratón y Táctil ────────────────────────────────
function registrarEventos() {
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function onMouseMove(e) {
    const pos = getMousePos(e);
    // Traducción 3D (clic en la base isométrica)
    const { q, r } = pixelToHex3D(pos.x, pos.y);
    ui.hoveredHex = hexKey(q, r);

    if (_mouseDown) {
        if (e.buttons === 2 || !editor.activo) { // Botón derecho o no editor = mover cámara
            camara.x += e.movementX; camara.y += e.movementY;
        } else if (editor.activo && ui.modoPintar) {
            aplicarHerramienta(q, r, hexKey(q, r));
        }
    }
}

function onMouseDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    _mouseDown = true;
    
    const pos = getMousePos(e);
    const { q, r } = pixelToHex3D(pos.x, pos.y);
    const key = hexKey(q, r);

    if (e.button === 0) { // Botón izquierdo
        if (editor.activo) {
            ui.modoPintar = true;
            aplicarHerramienta(q, r, key);
        } else {
            editor.selectedHexKey = key;
            // Notificar selección para info del hex (region-main.js)
            window.dispatchEvent(new CustomEvent('hexSeleccionado', { detail: { q, r, key } }));
        }
    }
}

function onMouseUp(e) {
    _mouseDown = false;
    ui.modoPintar = false;
}

function onWheel(e) {
    e.preventDefault();
    const pos = getMousePos(e);
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(camara.minZoom, Math.min(camara.maxZoom, camara.zoom * delta));
    
    // Zoom centrado en el ratón
    camara.x = pos.x - (pos.x - camara.x) * (newZoom / camara.zoom);
    camara.y = pos.y - (pos.y - camara.y) * (newZoom / camara.zoom);
    camara.zoom = newZoom;
}

// ── Herramientas del Editor ──────────────────────────────────
function aplicarHerramienta(q, r, key) {
    const hexes = editor.brushSize > 1 ? hexesEnRadio(q, r, editor.brushSize - 1) : [{ q, r }];
    
    hexes.forEach(h => {
        const k = hexKey(h.q, h.r);
        _accionHex(h.q, h.r, k);
    });
    
    // Notificar cambio para activar el botón Guardar
    window.dispatchEvent(new Event('mapaModificado'));
}

function _accionHex(q, r, key) {
    const herr = editor.herramienta;
    const capa = editor.capaActual;

    if (herr === 'agregar') {
        if (!editor.selectedPropId) return;
        if (!mapaActual.hexes[key]) mapaActual.hexes[key] = crearHexData();
        const hex = mapaActual.hexes[key];
        
        const pid = editor.selectedPropId;
        
        if (pid === 'prop_pintar') {
            const colorEntry = `COLOR:${editor.colorActual}:${editor.opacidadPincel.toFixed(2)}`;
            const arr = hex[capa];
            const idx = arr.findIndex(e => typeof e === 'string' && e.startsWith('COLOR:'));
            if (idx >= 0) arr[idx] = colorEntry; else arr.push(colorEntry);
            if (capa === 'back') { hex.color = editor.colorActual; hex.opacidad = editor.opacidadPincel; }
        } else {
            if (!hex[capa].includes(pid)) hex[capa].push(pid);
        }

    } else if (herr === 'borrar') {
        // La herramienta borrar ahora limpia TODA la capa, no depende del prop seleccionado
        if (!mapaActual.hexes[key]) return;
        const hex = mapaActual.hexes[key];
        hex[capa] = []; // Limpia todo lo de la capa
        if (capa === 'back') { hex.color = null; hex.opacidad = null; }

    } else if (herr === 'region') {
        const rid = ui.selectedRegion;
        if (!rid) return;
        if (!mapaActual.hexes[key]) mapaActual.hexes[key] = crearHexData();
        const hex = mapaActual.hexes[key];
        if (hex.region === rid) hex.region = null; // Quitar región
        else {
            if (hex.region && mapaActual.regiones[hex.region]) { // Limpiar de región antigua
                mapaActual.regiones[hex.region].hexes = mapaActual.regiones[hex.region].hexes.filter(k => k !== key);
            }
            hex.region = rid; // Asignar nueva
        }
    }
}
