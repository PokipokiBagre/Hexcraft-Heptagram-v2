// ============================================================
// region-engine.js — Loop de Renderizado y Eventos de Entrada
// ============================================================

import {
    camara, editor, ui, mapaActual, crearHexData, HEX_SIZE, OVER_OFFSET_X, OVER_OFFSET_Y
} from './region-state.js';
import { inicializarRender, dibujarEscena } from './region-render.js';
import { pixelToHex3D, hexKey, hexesEnRadio } from './region-utils.js';

let canvas, rafId;
let _mouseDown = false;
let _lastX = 0, _lastY = 0, _pinchStart = 0;
let _lastClickTime = 0;
let _lastTouchTime = 0;

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

function getHexFromScreenPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    let px = clientX - rect.left;
    let py = clientY - rect.top;

    if (editor.activo && editor.capaActual === 'over') {
        px -= OVER_OFFSET_X * camara.zoom;
        py -= OVER_OFFSET_Y * camara.zoom;
    }
    return pixelToHex3D(px, py);
}

function onMouseMove(e) {
    const { q, r } = getHexFromScreenPos(e.clientX, e.clientY);
    ui.hoveredHex = hexKey(q, r);

    if (!_mouseDown) return;

    if (e.buttons === 2 || !editor.activo || editor.herramienta === 'mover' || editor.herramienta === 'ingresar') {
        camara.x += e.movementX; 
        camara.y += e.movementY;
    } else if (editor.activo && ui.modoPintar) {
        aplicarHerramienta(q, r, hexKey(q, r));
    }
}

function onMouseDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    _mouseDown = true;
    
    const { q, r } = getHexFromScreenPos(e.clientX, e.clientY);
    const key = hexKey(q, r);

    if (e.button === 0) { 
        const now = Date.now();
        const isDblClick = (now - _lastClickTime < 300);
        _lastClickTime = now;

        if (isDblClick) {
            const hex = mapaActual.hexes[key];
            if (hex && hex.region) { window.abrirInterior(hex.region); return; }
        }

        if (editor.activo) {
            if (editor.herramienta === 'ingresar') {
                const hex = mapaActual.hexes[key];
                if (hex && hex.region) {
                    window.abrirInterior(hex.region);
                } else {
                    editor.selectedHexKey = key;
                    window.dispatchEvent(new CustomEvent('hexSeleccionado', { detail: { q, r, key } }));
                }
            } else if (editor.herramienta === 'mover') {
                editor.selectedHexKey = key;
                window.dispatchEvent(new CustomEvent('hexSeleccionado', { detail: { q, r, key } }));
            } else {
                ui.modoPintar = true;
                aplicarHerramienta(q, r, key);
            }
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
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(camara.minZoom, Math.min(camara.maxZoom, camara.zoom * delta));
    
    camara.x = px - (px - camara.x) * (newZoom / camara.zoom);
    camara.y = py - (py - camara.y) * (newZoom / camara.zoom);
    camara.zoom = newZoom;
}

function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
        _pinchStart = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    } else if (e.touches.length === 1) {
        _lastX = e.touches[0].clientX; _lastY = e.touches[0].clientY;
        _mouseDown = true;
        
        const now = Date.now();
        const isDblTouch = (now - _lastTouchTime < 300);
        _lastTouchTime = now;

        const { q, r } = getHexFromScreenPos(e.touches[0].clientX, e.touches[0].clientY);
        const key = hexKey(q, r);

        if (isDblTouch) {
            const hex = mapaActual.hexes[key];
            if (hex && hex.region) { window.abrirInterior(hex.region); return; }
        }

        if (editor.activo) { 
            if (editor.herramienta === 'ingresar' || editor.herramienta === 'mover') {
                editor.selectedHexKey = key; window.dispatchEvent(new CustomEvent('hexSeleccionado', { detail: { q, r, key } }));
            } else {
                ui.modoPintar = true; aplicarHerramienta(q, r, key); 
            }
        }
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
        if (!editor.activo || editor.herramienta === 'mover' || editor.herramienta === 'ingresar') {
            camara.x += dx; camara.y += dy;
        } else if (ui.modoPintar) {
            const { q, r } = getHexFromScreenPos(e.touches[0].clientX, e.touches[0].clientY);
            aplicarHerramienta(q, r, hexKey(q, r));
        }
        _lastX = e.touches[0].clientX; _lastY = e.touches[0].clientY;
    }
}

function onTouchEnd() { _mouseDown = false; ui.modoPintar = false; _pinchStart = 0; }

export function aplicarHerramienta(q, r, key) {
    const hexes = editor.brushSize > 1 ? hexesEnRadio(q, r, editor.brushSize - 1) : [{ q, r }];
    let modificado = false;
    
    hexes.forEach(h => { 
        if (editor.ruidoActivo && editor.herramienta === 'agregar') {
            if (Math.random() > (editor.ruidoDensidad || 0.35)) return; 
        }
        _accionHex(h.q, h.r, hexKey(h.q, h.r)); 
        modificado = true;
    });

    if (modificado) window.dispatchEvent(new Event('mapaModificado'));
}

function _accionHex(q, r, key) {
    const herr = editor.herramienta;
    const capa = editor.capaActual;

    if (herr === 'agregar') {
        if (!editor.selectedPropId) return;
        if (!mapaActual.hexes[key]) mapaActual.hexes[key] = crearHexData();
        const hex = mapaActual.hexes[key];
        const pid = editor.selectedPropId;

        if (pid === 'prop_region') {
            const rid = ui.selectedRegion;
            if (!rid) return;
            if (hex.region !== rid) {
                if (hex.region && mapaActual.regiones[hex.region]) { 
                    mapaActual.regiones[hex.region].hexes = mapaActual.regiones[hex.region].hexes.filter(k => k !== key);
                }
                hex.region = rid; 
                if (mapaActual.regiones[rid] && !mapaActual.regiones[rid].hexes.includes(key)) {
                    mapaActual.regiones[rid].hexes.push(key);
                }
            }
            return; 
        }

        const opac = (editor.opacidadPincel ?? 1.0).toFixed(2);
        
        if (pid === 'prop_pintar') {
            let finalColor = editor.colorActual;
            
            if (editor.ruidoActivo) {
                const h = parseInt(finalColor.slice(1,3), 16);
                const s = parseInt(finalColor.slice(3,5), 16);
                const l = parseInt(finalColor.slice(5,7), 16);
                const v = Math.round((Math.random() - 0.5) * 40); 
                const clamp = n => Math.max(0, Math.min(255, n));
                const toHex = n => n.toString(16).padStart(2, '0');
                finalColor = `#${toHex(clamp(h+v))}${toHex(clamp(s+v))}${toHex(clamp(l+v))}`;
            }

            const colorEntry = `COLOR:${finalColor}:${opac}`;
            let arr = hex[capa];
            arr = arr.filter(e => !(typeof e === 'string' && e.startsWith('COLOR:')));
            arr.push(colorEntry);
            hex[capa] = arr;
        } else {
            const propEntry = `${pid}:${opac}`;
            let arr = hex[capa];
            arr = arr.filter(e => {
                const eId = typeof e === 'string' ? (e.startsWith('COLOR:') ? e : e.split(':')[0]) : e;
                return eId !== pid;
            });
            arr.push(propEntry);
            hex[capa] = arr;
        }

    } else if (herr === 'borrar') {
        if (!mapaActual.hexes[key]) return;
        const hex = mapaActual.hexes[key];
        const pid = editor.selectedPropId;

        // Si estamos borrando con el pincel de región, borramos la región.
        if (pid === 'prop_region') {
            if (hex.region) {
                if (mapaActual.regiones[hex.region]) {
                    mapaActual.regiones[hex.region].hexes = mapaActual.regiones[hex.region].hexes.filter(k => k !== key);
                }
                hex.region = null;
            }
            return;
        }

        // BORRADO UNIVERSAL: Limpia toda la capa actual (back, mid, over) sin importar el prop seleccionado.
        hex[capa] = [];
    }
}

export function centrarCamara() {
    camara.x = window.innerWidth  / 2;
    camara.y = window.innerHeight / 2;
    camara.zoom = 1;
}
