// ============================================================
// region-main.js — Orquestador principal del mapa regional (Isométrico 3D)
// ============================================================

import { hexAuth, supabase } from '../hex-auth.js';
import { db }      from '../hex-db.js';
import {
    editor, ui, mapaActual, props, npcsMapaLocal,
    STORAGE_URL, camara, crearRegion
} from './region-state.js';
import { 
    cargarTodo, guardarMapa, guardarProp, eliminarProp, 
    guardarNPC, eliminarNPC, subirImagenStorage 
} from './region-data.js';
import { inicializarEngine, aplicarRuidoVisible } from './region-engine.js';
import { setBackground } from './region-render.js';
import { renderPanel, renderInfoHexPanel, cargarListaBG_UI } from './region-ui.js';
import { 
    htmlFormProp, htmlFormNPC, abrirModalUI, 
    cerrarModalUI, mostrarToastUI 
} from './region-ui-elements.js';
import { normKey } from './region-utils.js';

let cambiosPendientes = false;
let mapaIdActual = 'mundo';
let historialMapas = []; 

window.onload = async () => {
    let fav = document.querySelector("link[rel='icon']");
    if (!fav) { fav = document.createElement("link"); fav.rel = "icon"; document.head.appendChild(fav); }
    fav.href = `${STORAGE_URL}/imginterfaz/icon.png`;

    await hexAuth.init();
    editor.activo = hexAuth.esAdmin();

    const badge = document.getElementById('hex-session-badge');
    if (badge && hexAuth.renderStatusBadge) badge.innerHTML = hexAuth.renderStatusBadge();

    document.querySelectorAll('.solo-op').forEach(el => {
        el.style.display = editor.activo ? '' : 'none';
    });

    const canvas = document.getElementById('mapa-canvas');
    inicializarEngine(canvas);

    const loader = document.getElementById('loader-mapa');
    if (loader) loader.style.display = 'flex';

    const ok = await cargarTodo(mapaIdActual);

    if (loader) loader.style.display = 'none';

    if (!ok) mostrarToastUI('⚠️ Error cargando datos del mapa', 'error');

    renderPanel();
    actualizarBreadcrumb();

    window.addEventListener('hexSeleccionado', (e) => {
        const { q, r, key } = e.detail;
        renderInfoHexPanel(q, r, key);
    });

    window.addEventListener('mapaModificado', () => {
        cambiosPendientes = true;
        const btn = document.getElementById('btn-guardar-mapa');
        if (btn) { btn.classList.remove('oculto'); btn.innerText = '💾 Guardar Cambios'; }
    });
};

// ── UI Básica ────────────────────────────────────────────────
window.cambiarPanelUI = (panel) => { ui.panelActual = panel; renderPanel(); };
window.setBusquedaUI = (v) => { ui.busqueda = v; renderPanel(); };
window.setFiltroPropSinImagenUI = (v) => { ui.filtroPropSinImagen = v; renderPanel(); };
window.setBrushSizeUI = (n) => { editor.brushSize = n; renderPanel(); };
window.setCapaActualUI = (c) => { editor.capaActual = c; renderPanel(); };
window.setColorActual = (color) => { editor.colorActual = color; renderPanel(); };
window.setOpacidadPincel = (val) => { editor.opacidadPincel = parseFloat(val); };

window.aplicarRuido = () => {
    const color = editor.colorActual || '#4488cc';
    aplicarRuidoVisible(color, editor.opacidadPincel ?? 1.0, 0.35);
    mostrarToastUI('≋ Ruido aplicado a la capa ' + editor.capaActual.toUpperCase(), 'info');
};

window.abrirMenuOP = async () => {
    if (hexAuth.esAdmin()) {
        editor.activo = !editor.activo;
        mostrarToastUI(editor.activo ? '✏️ Modo Editor Activado' : '👁️ Modo Visualización', 'info');
        document.querySelectorAll('.solo-op').forEach(el => el.style.display = editor.activo ? '' : 'none');
        renderPanel();
    } else {
        await hexAuth._mostrarModalLogin();
        editor.activo = hexAuth.esAdmin();
        if (editor.activo) {
            document.querySelectorAll('.solo-op').forEach(el => el.style.display = '');
            renderPanel();
        }
    }
};

window.setHerramienta = (h) => {
    editor.herramienta = h;
    document.querySelectorAll('.tool-btn').forEach(b => {
        b.classList.toggle('activo', b.dataset.tool === h);
    });
};

window.cerrarModalRegion = cerrarModalUI;

window.guardarMapaUI = async () => {
    const btn = document.getElementById('btn-guardar-mapa');
    if (btn) { btn.innerText = 'Guardando...'; btn.disabled = true; }
    const ok = await guardarMapa();
    if (ok) {
        cambiosPendientes = false;
        mostrarToastUI('Mapa guardado ✅');
        if (btn) { btn.classList.add('oculto'); btn.disabled = false; }
    } else {
        mostrarToastUI('Error guardando', 'error');
        if (btn) { btn.innerText = '💾 Guardar Cambios'; btn.disabled = false; }
    }
};

// ── Props ───────────────────────────────────────────────────
window.seleccionarPropUI = (id) => {
    editor.selectedPropId = id;
    editor.herramienta = 'agregar';
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('activo', b.dataset.tool === 'agregar'));
    renderPanel();
};

window.seleccionarPropEntidadUI = (id) => { window.seleccionarPropUI(id); };

window.abrirCrearPropUI = () => abrirModalUI(htmlFormProp(), '➕ Nuevo Prop');

window.guardarPropUI = async () => {
    const idExistente = document.getElementById('fp-id')?.value;
    const nombre = document.getElementById('fp-nombre')?.value?.trim();
    if (!nombre) return mostrarToastUI('El nombre es obligatorio', 'error');
    
    const id = idExistente || `prop_${normKey(nombre)}_${Date.now()}`;
    const tipo = document.getElementById('fp-tipo').value;
    const imagen = document.getElementById('fp-imagen').value.trim();

    const propData = { id, nombre, tipo, imagen };
    props[id] = propData;
    const ok = await guardarProp(propData);
    if (ok) { mostrarToastUI('Prop guardado ✅'); cerrarModalUI(); renderPanel(); }
    else mostrarToastUI('Error guardando prop', 'error');
};

window.eliminarPropUI = async (id) => {
    if (!confirm(`¿Eliminar el prop "${props[id]?.nombre}"?`)) return;
    if (editor.selectedPropId === id) editor.selectedPropId = null;
    
    Object.values(mapaActual.hexes).forEach(hex => {
        ['back','mid','over'].forEach(capa => {
            if (Array.isArray(hex[capa])) hex[capa] = hex[capa].filter(pid => {
                const basePid = typeof pid === 'string' ? pid.split(':')[0] : pid;
                return basePid !== id;
            });
        });
    });
    delete props[id];
    await eliminarProp(id);
    renderPanel();
    window.dispatchEvent(new Event('mapaModificado'));
};

window.abrirSubidaPropUI = (propId) => {
    const p = props[propId];
    if (!p) return;
    const idHidden = document.getElementById('up-prop-id');
    const nombre = document.getElementById('up-prop-nombre');
    const tipo = document.getElementById('up-prop-tipo');
    
    if (idHidden) idHidden.value = p.id;
    if (nombre) nombre.value = p.nombre;
    if (tipo) tipo.value = p.tipo;
    document.getElementById('upload-form')?.scrollIntoView({ behavior: 'smooth' });
    mostrarToastUI(`Sube imagen para: ${p.nombre}`, 'info');
};

window.subirPropImagenUI = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    const idInput = document.getElementById('up-prop-id')?.value;
    const nombreInput = document.getElementById('up-prop-nombre')?.value?.trim();
    if (!nombreInput) return mostrarToastUI('Escribe el nombre del prop antes de subir', 'error');
    
    const tipo = document.getElementById('up-prop-tipo')?.value || 'terreno';
    const key = normKey(nombreInput);
    const id = idInput || `prop_${key}_${Date.now()}`;

    mostrarToastUI('Subiendo imagen de prop...', 'info');
    try {
        const url = await subirImagenStorage(file, 'imgregion', key);
        const existente = props[id];
        const propData = { id, nombre: existente ? existente.nombre : nombreInput, tipo: existente ? existente.tipo : tipo, imagen: url };
        props[id] = propData;
        await guardarProp(propData);
        mostrarToastUI(`Prop actualizado ✅`);
        renderPanel();
    } catch (err) {
        mostrarToastUI('Error: ' + err.message, 'error');
    }
};

// ── NPCs ────────────────────────────────────────────────────
window.abrirCrearNPCUI = () => abrirModalUI(htmlFormNPC(), '➕ Nuevo NPC');

window.seleccionarNPCUI = (id) => {
    if (!editor.activo) return;
    const npc = npcsMapaLocal[id];
    if (npc) abrirModalUI(htmlFormNPC(npc), `✏️ ${npc.nombre}`);
};

window.guardarNPCUI = async () => {
    const idExistente = document.getElementById('fn-id')?.value;
    const nombre = document.getElementById('fn-nombre')?.value?.trim();
    if (!nombre) return mostrarToastUI('El nombre es obligatorio', 'error');
    
    const npcData = {
        id: idExistente || `npc_${normKey(nombre)}_${Date.now()}`,
        nombre,
        tipo: document.getElementById('fn-tipo').value,
        icono_url: document.getElementById('fn-icono').value.trim(),
        hex_pos: document.getElementById('fn-hex').value.trim() || null,
        capa: 'mid',
        descripcion: document.getElementById('fn-desc').value.trim(),
        stats: {}
    };

    npcsMapaLocal[npcData.id] = npcData;
    const ok = await guardarNPC(npcData);
    if (ok) { mostrarToastUI('NPC guardado ✅'); cerrarModalUI(); renderPanel(); window.dispatchEvent(new Event('mapaModificado')); }
    else mostrarToastUI('Error guardando NPC', 'error');
};

window.eliminarNPCUI = async (id) => {
    if (!confirm(`¿Eliminar ${npcsMapaLocal[id]?.nombre}?`)) return;
    delete npcsMapaLocal[id];
    await eliminarNPC(id);
    renderPanel();
    window.dispatchEvent(new Event('mapaModificado'));
};

// ── Regiones e Interiores ───────────────────────────────────
window.crearRegionUI = () => {
    const id = `reg_${Date.now()}`;
    mapaActual.regiones[id] = crearRegion(id);
    ui.selectedRegion = id;
    renderPanel();
    window.dispatchEvent(new Event('mapaModificado'));
};

window.seleccionarRegionUI = (id) => {
    ui.selectedRegion = ui.selectedRegion === id ? null : id;
    renderPanel();
};

window.deseleccionarRegion = () => { window.seleccionarRegionUI(null); };

window.actualizarRegion = (id, campo, valor) => {
    const reg = mapaActual.regiones[id];
    if (reg) { reg[campo] = valor; window.dispatchEvent(new Event('mapaModificado')); }
};

window.eliminarRegionUI = (id) => {
    if (!confirm('¿Eliminar esta región completamente?')) return;
    const reg = mapaActual.regiones[id];
    if (reg) {
        reg.hexes.forEach(key => { if (mapaActual.hexes[key]) mapaActual.hexes[key].region = null; });
    }
    delete mapaActual.regiones[id];
    ui.selectedRegion = null;
    renderPanel();
    window.dispatchEvent(new Event('mapaModificado'));
};

window.toggleMisionRegion = (regionId, misionId, activa) => {
    const reg = mapaActual.regiones[regionId];
    if (!reg) return;
    if (!reg.misiones) reg.misiones = [];
    if (activa && !reg.misiones.includes(misionId)) reg.misiones.push(misionId);
    else if (!activa) reg.misiones = reg.misiones.filter(m => m !== misionId);
    window.dispatchEvent(new Event('mapaModificado'));
};

window.activarHerramientaRegion = (id) => {
    ui.selectedRegion = id;
    window.setHerramienta('region');
    mostrarToastUI('🖊️ Haz clic/arrastra en hexes para añadir a la región', 'info');
};

window.abrirInterior = async (regionId) => { /* Lógica de interior igual */ };
window.entrarInterior = (regionId) => { if (!editor.activo) window.abrirInterior(regionId); };
window.volverMapaPadre = async () => { /* Lógica de padre igual */ };

// ── Elevación 3D (Exclusivo del nuevo motor) ────────────────
window.actualizarElevacionUI = (key, val) => {
    if (mapaActual.hexes[key]) {
        mapaActual.hexes[key].elevation = parseInt(val) || 0;
        window.dispatchEvent(new Event('mapaModificado'));
    }
};

// ── Fondos ──────────────────────────────────────────────────
window.dropBGImagen = async (e) => {
    e.preventDefault();
    document.getElementById('drop-bg-zone')?.classList.remove('drag-sobre');
    const file = e.dataTransfer.files[0];
    if (file) await _subirBGFile(file);
};

window.subirBGImagen = async (e) => {
    const file = e.target.files[0];
    if (file) await _subirBGFile(file);
    e.target.value = '';
};

async function _subirBGFile(file) {
    const key = `region_bg_${mapaIdActual}_${Date.now()}`;
    try {
        mostrarToastUI('Subiendo fondo...', 'info');
        const url = await subirImagenStorage(file, 'imginterfaz', key);
        mapaActual.bg_imagen = url;
        setBackground(url);
        window.dispatchEvent(new Event('mapaModificado'));
        mostrarToastUI('Fondo actualizado ✅');
    } catch (err) { mostrarToastUI('Error: ' + err.message, 'error'); }
}

window.aplicarFondUI = (url) => {
    mapaActual.bg_imagen = url;
    setBackground(url);
    window.dispatchEvent(new Event('mapaModificado'));
    mostrarToastUI('Fondo aplicado');
};

function actualizarBreadcrumb() {
    const el = document.getElementById('breadcrumb');
    if (!el) return;
    const partes = historialMapas.map(h => `<span class="bread-item" onclick="window.volverMapaPadre()">🗺️ ${h.nombre}</span> ›`).join(' ');
    el.innerHTML = partes + ` <span class="bread-actual">📍 ${mapaActual.nombre}</span>`;
    const btnVolver = document.getElementById('btn-volver-mapa');
    if (btnVolver) btnVolver.style.display = historialMapas.length > 0 ? '' : 'none';
}

// Teclado
document.addEventListener('keydown', (e) => {
    if (!editor.activo) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    const tools = { 'a': 'agregar', 'p': 'agregar', 'b': 'borrar', 's': 'seleccionar', 'r': 'region', 'm': 'mover' };
    if (tools[e.key.toLowerCase()]) window.setHerramienta(tools[e.key.toLowerCase()]);

    if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); window.guardarMapaUI(); }
    if (e.key === 'Escape') cerrarModalUI();

    const n = parseInt(e.key);
    if (n >= 1 && n <= 4) { window.setBrushSizeUI(n); }
});
