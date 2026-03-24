// ============================================================
// region-engine.js — Loop de Renderizado y Eventos de Entrada
// ============================================================

import {
    camara, editor, ui, mapaActual, crearHexData, HEX_SIZE
} from './region-state.js';
import { inicializarRender, dibujarEscena } from './region-render.js';
import { pixelToHex3D, hexKey, hexesEnRadio } from './region-utils.js';

let canvas, rafId;
let _mouseDown = false;
let _lastX = 0, _lastY = 0, _pinchStart = 0;
const _drag = { activo: false, x1:0, y1:0, x2:0, y2:0 };

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
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = window.innerWidth  * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width  = window.innerWidth  + 'px';
    canvas.style.height = window.innerHeight + 'px';
    canvas.getContext('2d').scale(dpr, dpr);
}

function iniciarLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    const loop = () => { dibujarEscena(); rafId = requestAnimationFrame(loop); };
    loop();
}

function registrarEventos() {
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function onMouseMove(e) {
    const pos = getMousePos(e);
    const { q, r } = pixelToHex3D(pos.x, pos.y);
    ui.hoveredHex = hexKey(q, r);

    if (!_mouseDown) return;

    if (e.buttons === 2 || !editor.activo || editor.herramienta === 'mover') {
        camara.x += e.movementX; 
        camara.y += e.movementY;
    } else if (editor.activo && ui.modoPintar) {
        aplicarHerramienta(q, r, hexKey(q, r));
    }
}

function onMouseDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    _mouseDown = true;
    
    const pos = getMousePos(e);
    const { q, r } = pixelToHex3D(pos.x, pos.y);
    const key = hexKey(q, r);

    if (e.button === 0) { 
        if (editor.activo) {
            ui.modoPintar = true;
            aplicarHerramienta(q, r, key);
        } else {
            editor.selectedHexKey = key;
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
    
    camara.x = pos.x - (pos.x - camara.x) * (newZoom / camara.zoom);
    camara.y = pos.y - (pos.y - camara.y) * (newZoom / camara.zoom);
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
        const { q, r } = pixelToHex3D(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
        const key = hexKey(q, r);
        if (editor.activo) { ui.modoPintar = true; aplicarHerramienta(q, r, key); }
        else { editor.selectedHexKey = key; window.dispatchEvent(new CustomEvent('hexSeleccionado', { detail: { q, r, key } })); }
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
            const newZoom = Math.max(camara.minZoom, Math.min(camara.maxZoom, camara.zoom * dist / _pinchStart));
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
            const { q, r } = pixelToHex3D(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
            aplicarHerramienta(q, r, hexKey(q, r));
        }
        _lastX = e.touches[0].clientX; _lastY = e.touches[0].clientY;
    }
}

function onTouchEnd() { _mouseDown = false; ui.modoPintar = false; _pinchStart = 0; }

export function aplicarHerramienta(q, r, key) {
    const hexes = editor.brushSize > 1 ? hexesEnRadio(q, r, editor.brushSize - 1) : [{ q, r }];
    hexes.forEach(h => {
        const k = hexKey(h.q, h.r);
        _accionHex(h.q, h.r, k);
    });
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
        const opac = (editor.opacidadPincel ?? 1.0).toFixed(2);
        
        if (pid === 'prop_pintar') {
            const colorEntry = `COLOR:${editor.colorActual}:${opac}`;
            const arr = hex[capa];
            const idx = arr.findIndex(e => typeof e === 'string' && e.startsWith('COLOR:'));
            if (idx >= 0) arr[idx] = colorEntry; else arr.push(colorEntry);
            if (capa === 'back') { hex.color = editor.colorActual; hex.opacidad = editor.opacidadPincel; }
        } else {
            const propEntry = `${pid}:${opac}`;
            let arr = hex[capa];
            arr = arr.filter(e => {
                const eId = typeof e === 'string' ? e.split(':')[0] : e;
                return eId !== pid;
            });
            arr.push(propEntry);
            hex[capa] = arr;
        }

    } else if (herr === 'borrar') {
        if (!mapaActual.hexes[key]) return;
        const hex = mapaActual.hexes[key];
        const pid = editor.selectedPropId;

        if (pid === 'prop_pintar') {
            hex[capa] = hex[capa].filter(e => !(typeof e === 'string' && e.startsWith('COLOR:')));
            if (capa === 'back') { hex.color = null; hex.opacidad = null; }
        } else {
            hex[capa] = [];
            if (capa === 'back') { hex.color = null; hex.opacidad = null; }
        }

    } else if (herr === 'region') {
        const rid = ui.selectedRegion;
        if (!rid) return;
        if (!mapaActual.hexes[key]) mapaActual.hexes[key] = crearHexData();
        const hex = mapaActual.hexes[key];
        if (hex.region === rid) hex.region = null; 
        else {
            if (hex.region && mapaActual.regiones[hex.region]) { 
                mapaActual.regiones[hex.region].hexes = mapaActual.regiones[hex.region].hexes.filter(k => k !== key);
            }
            hex.region = rid; 
            if (!mapaActual.regiones[rid].hexes.includes(key)) {
                mapaActual.regiones[rid].hexes.push(key);
            }
        }
    }
}

// ── Generador de Ruido ───────────────────────────────────────
export function aplicarRuidoVisible(color, opacidad, densidad = 0.4) {
    if (!canvas) return;
    const W = window.innerWidth * (window.devicePixelRatio || 1);
    const H = window.innerHeight * (window.devicePixelRatio || 1);
    const margen = HEX_SIZE * camara.zoom * 2;
    
    const cs = [
        pixelToHex3D(-margen, -margen),     pixelToHex3D(W+margen, -margen),
        pixelToHex3D(-margen, H+margen),    pixelToHex3D(W+margen, H+margen)
    ];
    const qMin = Math.min(...cs.map(c=>c.q))-1, qMax = Math.max(...cs.map(c=>c.q))+1;
    const rMin = Math.min(...cs.map(c=>c.r))-1, rMax = Math.max(...cs.map(c=>c.r))+1;

    for (let q = qMin; q <= qMax; q++) {
        for (let r = rMin; r <= rMax; r++) {
            if (Math.random() > densidad) continue;
            const key = hexKey(q, r);
            if (!mapaActual.hexes[key]) mapaActual.hexes[key] = crearHexData();
            
            const h = parseInt(color.slice(1,3),16), s = parseInt(color.slice(3,5),16), l = parseInt(color.slice(5,7),16);
            const v = Math.round((Math.random()-0.5)*40);
            const clamp = n => Math.max(0,Math.min(255,n));
            const toHex = n => n.toString(16).padStart(2,'0');
            const noisyColor = `#${toHex(clamp(h+v))}${toHex(clamp(s+v))}${toHex(clamp(l+v))}`;
            
            const colorEntry = `COLOR:${noisyColor}:${opacidad.toFixed(2)}`;
            const arr = mapaActual.hexes[key][editor.capaActual];
            const idx = arr.findIndex(e => typeof e === 'string' && e.startsWith('COLOR:'));
            if (idx >= 0) arr[idx] = colorEntry;
            else arr.push(colorEntry);

            if (editor.capaActual === 'back') {
                mapaActual.hexes[key].color = noisyColor;
                mapaActual.hexes[key].opacidad = opacidad;
            }
        }
    }
    window.dispatchEvent(new Event('mapaModificado'));
}

export function centrarCamara() {
    camara.x = window.innerWidth  / 2;
    camara.y = window.innerHeight / 2;
    camara.zoom = 1;
}
