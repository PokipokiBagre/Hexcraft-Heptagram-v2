// ============================================================
// region-main.js — Orquestador principal del mapa regional
// ============================================================

import { hexAuth } from '../hex-auth.js';
import { db }      from '../hex-db.js';
import {
    editor, ui, mapaActual, props, npcsMapaLocal,
    STORAGE_URL, camara, crearRegion, crearHexData
} from './region-state.js';
import { cargarTodo, guardarMapa, guardarProp, eliminarProp, guardarNPC, eliminarNPC, subirImagenProp, normKey } from './region-data.js';
import { inicializarEngine, centrarCamara, setBackground, hexKey, pixelToHex, aplicarHerramienta } from './region-engine.js';
import {
    renderPanel, renderInfoHex, abrirModal, cerrarModal,
    htmlFormProp, htmlFormNPC, cargarListaBG
} from './region-ui.js';
import { supabase } from '../hex-auth.js';
import { aplicarRuidoVisible } from './region-engine.js';

// ── Estado de cambios pendientes ─────────────────────────────
let cambiosPendientes = false;
let mapaIdActual = 'mundo';
let historialMapas = []; // Para el botón "volver" al salir de un interior

// ── Arranque ─────────────────────────────────────────────────
window.onload = async () => {
    // Favicon
    let fav = document.querySelector("link[rel='icon']");
    if (!fav) { fav = document.createElement("link"); fav.rel = "icon"; document.head.appendChild(fav); }
    fav.href = `${STORAGE_URL}/imginterfaz/icon.png`;

    // Auth
    await hexAuth.init();
    editor.activo = hexAuth.esAdmin();

    const badge = document.getElementById('hex-session-badge');
    if (badge) badge.innerHTML = hexAuth.renderStatusBadge ? hexAuth.renderStatusBadge() : '';

    // Mostrar/ocultar controles OP
    document.querySelectorAll('.solo-op').forEach(el => {
        el.style.display = editor.activo ? '' : 'none';
    });

    // Canvas
    const canvas = document.getElementById('mapa-canvas');
    inicializarEngine(canvas);
    centrarCamara();

    // Cargar datos
    const loader = document.getElementById('loader-mapa');
    if (loader) loader.style.display = 'flex';

    const ok = await cargarTodo(mapaIdActual);

    if (loader) loader.style.display = 'none';

    if (!ok) {
        mostrarToast('⚠️ Error cargando datos del mapa', 'error');
    }

    // Panel lateral
    renderPanel();
    actualizarBreadcrumb();

    // Eventos personalizados del engine
    window.addEventListener('hexSeleccionado', (e) => {
        const { q, r, key } = e.detail;
        renderInfoHex(q, r, key);
    });

    window.addEventListener('mapaModificado', () => {
        cambiosPendientes = true;
        const btn = document.getElementById('btn-guardar-mapa');
        if (btn) { btn.classList.remove('oculto'); btn.innerText = '💾 Guardar Cambios'; }
    });

    // Cargar lista de fondos si estamos en tab imágenes
    if (editor.activo) cargarListaBG();
};

// ── Navegación entre paneles ─────────────────────────────────
window.cambiarPanelUI = (panel) => {
    ui.panelActual = panel;
    renderPanel();
    if (panel === 'imagenes') cargarListaBG();
};

// ── Filtros de props ─────────────────────────────────────────
window.setFiltroTipo = (t) => { ui.filtroTipo = t; renderPanel(); };
window.setFiltroCapa = (c) => { ui.filtroCapa = c; renderPanel(); };
window.setBusquedaUI = (v) => { ui.busqueda   = v; renderPanel(); };
window.setBrushSize  = (n) => { editor.brushSize = n; renderPanel(); };
window.setCapaActual = (c) => { editor.capaActual = c; renderPanel(); };

// ── Acciones OP ───────────────────────────────────────────────
window.abrirMenuOP = async () => {
    if (hexAuth.esAdmin()) {
        editor.activo = !editor.activo;
        mostrarToast(editor.activo ? '✏️ Modo Editor Activado' : '👁️ Modo Visualización', 'info');
        document.querySelectorAll('.solo-op').forEach(el => {
            el.style.display = editor.activo ? '' : 'none';
        });
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

// ── Props ─────────────────────────────────────────────────────
window.seleccionarProp = (id) => {
    editor.propSeleccionado = props[id] || null;
    editor.herramienta = 'pintar';
    renderPanel();
};

window.abrirCrearProp = () => {
    abrirModal(htmlFormProp(), '➕ Nuevo Prop');
};

window.guardarPropUI = async () => {
    const nombre = document.getElementById('fp-nombre')?.value?.trim();
    if (!nombre) return mostrarToast('El nombre es obligatorio', 'error');
    const id   = `prop_${normKey(nombre)}_${Date.now()}`;
    const tipo = document.getElementById('fp-tipo').value;
    const capa = document.getElementById('fp-capa').value;
    const ancho = parseInt(document.getElementById('fp-ancho').value) || 1;
    const alto  = parseInt(document.getElementById('fp-alto').value)  || 1;
    const imagen = document.getElementById('fp-imagen').value.trim();

    const propData = { id, nombre, tipo, capa, ancho, alto, forma: 'hex', imagen };
    props[id] = propData;
    const ok = await guardarProp(propData);
    if (ok) { mostrarToast('Prop guardado ✅'); cerrarModal(); renderPanel(); }
    else mostrarToast('Error guardando prop', 'error');
};

window.eliminarPropUI = async (id) => {
    if (!confirm(`¿Eliminar el prop "${props[id]?.nombre}"?`)) return;
    delete props[id];
    await eliminarProp(id);
    renderPanel();
};

// Subida de imagen para prop desde el panel Imágenes
window.dropPropImagen = async (e) => {
    e.preventDefault();
    document.getElementById('drop-prop-zone').classList.remove('drag-sobre');
    const file = e.dataTransfer.files[0];
    if (file) await _subirPropFile(file);
};
window.subirPropImagen = async (e) => {
    const file = e.target.files[0];
    if (file) await _subirPropFile(file);
    e.target.value = '';
};

async function _subirPropFile(file) {
    const nombre = document.getElementById('up-prop-nombre')?.value?.trim();
    if (!nombre) return mostrarToast('Escribe el nombre del prop antes de subir', 'error');
    const tipo = document.getElementById('up-prop-tipo')?.value || 'terreno';
    const capa = document.getElementById('up-prop-capa')?.value || 'background';
    const key  = normKey(nombre);

    setProgresoProp(0, 'Iniciando...', true);
    try {
        const url = await subirImagenProp(file, `imgregion/${capa}`, key, (pct, msg) => setProgresoProp(pct, msg, true));
        // Crear el prop automáticamente
        const id = `prop_${key}`;
        const propData = { id, nombre, tipo, capa, ancho: 1, alto: 1, forma: 'hex', imagen: url };
        props[id] = propData;
        await guardarProp(propData);
        mostrarToast(`Prop "${nombre}" creado ✅`);
        renderPanel();
    } catch (err) {
        setProgresoProp(0, '❌ ' + err.message, true);
        mostrarToast('Error: ' + err.message, 'error');
    }
}

function setProgresoProp(pct, msg, show) {
    const el  = document.getElementById('up-prop-progress');
    const fill = document.getElementById('up-prop-fill');
    const stat = document.getElementById('up-prop-status');
    if (el) el.style.display = show ? 'block' : 'none';
    if (fill) fill.style.width = pct + '%';
    if (stat) { stat.innerText = msg; stat.style.color = pct === 100 ? '#00ff88' : (msg.startsWith('❌') ? '#ff4444' : '#aaa'); }
}

// ── Background ────────────────────────────────────────────────
window.dropBGImagen = async (e) => {
    e.preventDefault();
    document.getElementById('drop-bg-zone').classList.remove('drag-sobre');
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
        mostrarToast('Subiendo fondo...', 'info');
        const url = await subirImagenProp(file, 'imginterfaz', key, () => {});
        setBackground(url);
        await supabase.from('region_mapas').update({ bg_imagen: url }).eq('id', mapaIdActual);
        mostrarToast('Fondo actualizado ✅');
        await cargarListaBG();
    } catch (err) {
        mostrarToast('Error subiendo fondo: ' + err.message, 'error');
    }
}

window.aplicarBG = (url) => {
    setBackground(url);
    mostrarToast('Fondo aplicado');
};

// ── Regiones ──────────────────────────────────────────────────
window.crearRegionUI = () => {
    const id  = `reg_${Date.now()}`;
    const reg = crearRegion(id);
    mapaActual.regiones[id] = reg;
    ui.selectedRegion = id;
    cambiosPendientes = true;
    renderPanel();
    window.dispatchEvent(new Event('mapaModificado'));
};

window.seleccionarRegion = (id) => {
    ui.selectedRegion = ui.selectedRegion === id ? null : id;
    renderPanel();
};

window.actualizarRegion = (id, campo, valor) => {
    const reg = mapaActual.regiones[id];
    if (!reg) return;
    reg[campo] = valor;
    window.dispatchEvent(new Event('mapaModificado'));
};

window.actualizarRegionMisiones = (id, selectEl) => {
    const reg = mapaActual.regiones[id];
    if (!reg) return;
    reg.misiones = Array.from(selectEl.selectedOptions).map(o => o.value);
    window.dispatchEvent(new Event('mapaModificado'));
};

window.eliminarRegionUI = (id) => {
    if (!confirm('¿Eliminar esta región?')) return;
    const reg = mapaActual.regiones[id];
    if (reg) {
        reg.hexes.forEach(key => {
            if (mapaActual.hexes[key]) mapaActual.hexes[key].region = null;
        });
    }
    delete mapaActual.regiones[id];
    if (ui.selectedRegion === id) ui.selectedRegion = null;
    window.dispatchEvent(new Event('mapaModificado'));
    renderPanel();
};

window.activarHerramientaRegion = (id) => {
    ui.selectedRegion = id;
    editor.herramienta = 'region';
    mostrarToast('🖊️ Haz clic/arrastra en hexes para añadir a la región', 'info');
};

// ── Interiores ────────────────────────────────────────────────
window.abrirInterior = async (regionId) => {
    const reg = mapaActual.regiones[regionId];
    if (!reg) return;

    const interiorId = reg.interiorId || `interior_${regionId}`;
    reg.tieneInterior = true;
    reg.interiorId    = interiorId;

    historialMapas.push({ id: mapaIdActual, nombre: mapaActual.nombre });
    mapaIdActual = interiorId;

    mostrarToast('Cargando interior...', 'info');
    const ok = await cargarTodo(interiorId);
    if (!ok) {
        // Interior nuevo — inicializarlo con tamaño por defecto
        mapaActual.id   = interiorId;
        mapaActual.nombre = `Interior de ${reg.nombre}`;
        mapaActual.ancho = 12;
        mapaActual.alto  = 10;
        mapaActual.esInterior = true;
        mapaActual.parentId   = historialMapas[historialMapas.length-1].id;
        for (const k in mapaActual.hexes) delete mapaActual.hexes[k];
        for (const k in mapaActual.regiones) delete mapaActual.regiones[k];
    }

    centrarCamara();
    actualizarBreadcrumb();
    renderPanel();
};

window.volverMapaPadre = async () => {
    if (historialMapas.length === 0) return;
    const prev = historialMapas.pop();
    mapaIdActual = prev.id;
    await cargarTodo(mapaIdActual);
    centrarCamara();
    actualizarBreadcrumb();
    renderPanel();
};

window.entrarInterior = (regionId) => {
    if (!editor.activo) {
        window.abrirInterior(regionId);
    }
};

// ── NPCs ──────────────────────────────────────────────────────
window.abrirCrearNPC = () => {
    abrirModal(htmlFormNPC(), '➕ Nuevo NPC');
};

window.seleccionarNPCUI = (id) => {
    if (!editor.activo) return;
    const npc = npcsMapaLocal[id];
    if (npc) abrirModal(htmlFormNPC(npc), `✏️ ${npc.nombre}`);
};

window.guardarNPCUI = async (idExistente) => {
    const nombre = document.getElementById('fn-nombre')?.value?.trim();
    if (!nombre) return mostrarToast('El nombre es obligatorio', 'error');
    const id    = idExistente || `npc_${normKey(nombre)}_${Date.now()}`;
    const tipo  = document.getElementById('fn-tipo').value;
    const icono = document.getElementById('fn-icono').value.trim();
    const hex   = document.getElementById('fn-hex').value.trim() || null;
    const capa  = document.getElementById('fn-capa').value;
    const desc  = document.getElementById('fn-desc').value.trim();

    const npcData = { id, nombre, tipo, icono, hex, capa, desc, stats: {}, mapaId: mapaIdActual };
    npcsMapaLocal[id] = npcData;

    const ok = await guardarNPC(npcData);
    if (ok) { mostrarToast('NPC guardado ✅'); cerrarModal(); renderPanel(); }
    else mostrarToast('Error guardando NPC', 'error');
};

window.eliminarNPCUI = async (id) => {
    if (!confirm(`¿Eliminar ${npcsMapaLocal[id]?.nombre}?`)) return;
    delete npcsMapaLocal[id];
    await eliminarNPC(id);
    renderPanel();
};

// ── Herramientas ──────────────────────────────────────────────
window.setHerramienta = (h) => {
    editor.herramienta = h;
    document.querySelectorAll('.tool-btn').forEach(b => {
        b.classList.toggle('activo', b.dataset.tool === h);
    });
};

// ── Guardar mapa ─────────────────────────────────────────────
window.guardarMapaUI = async () => {
    const btn = document.getElementById('btn-guardar-mapa');
    if (btn) { btn.innerText = 'Guardando...'; btn.disabled = true; }
    const ok = await guardarMapa();
    if (ok) {
        cambiosPendientes = false;
        mostrarToast('Mapa guardado ✅');
        if (btn) { btn.classList.add('oculto'); btn.disabled = false; }
    } else {
        mostrarToast('Error guardando', 'error');
        if (btn) { btn.innerText = '💾 Guardar Cambios'; btn.disabled = false; }
    }
};

// ── Modal global ──────────────────────────────────────────────
window.cerrarModalRegion = cerrarModal;

// ── Breadcrumb ────────────────────────────────────────────────
function actualizarBreadcrumb() {
    const el = document.getElementById('breadcrumb');
    if (!el) return;
    const partes = historialMapas.map(h =>
        `<span class="bread-item" onclick="window.volverMapaPadre()">🗺️ ${h.nombre}</span> ›`
    ).join(' ');
    el.innerHTML = partes + ` <span class="bread-actual">📍 ${mapaActual.nombre}</span>`;
    const btnVolver = document.getElementById('btn-volver-mapa');
    if (btnVolver) btnVolver.style.display = historialMapas.length > 0 ? '' : 'none';
}

// ── Toast notifications ───────────────────────────────────────
function mostrarToast(msg, tipo = 'ok') {
    let toast = document.getElementById('toast-region');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-region';
        document.body.appendChild(toast);
    }
    toast.className = `toast-region toast-${tipo}`;
    toast.innerText = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 2800);
}

// ── Atajos de teclado ─────────────────────────────────────────
document.addEventListener('keydown', (e) => {
    if (!editor.activo) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const tools = { 'p': 'pintar', 'b': 'borrar', 's': 'seleccionar', 'r': 'region', 'm': 'mover' };
    if (tools[e.key]) window.setHerramienta(tools[e.key]);

    if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); window.guardarMapaUI(); }
    if (e.key === 'Escape') cerrarModal();

    // Brush size con números
    const n = parseInt(e.key);
    if (n >= 1 && n <= 4) { editor.brushSize = n; renderPanel(); }
});

window.setColorActual = (color) => {
    editor.colorActual = color;
    renderPanel();
};

window.setOpacidadPincel = (val) => {
    editor.opacidadPincel = val;
};

window.aplicarRuido = () => {
    const color = editor.colorActual || '#4488cc';
    aplicarRuidoVisible(color, editor.opacidadPincel ?? 0.7, 0.35);
    mostrarToast('≋ Ruido aplicado', 'info');
};

// Abrir subida de imagen para un prop específico desde la tab Imgs
window.abrirSubidaProp = (propId) => {
    const p = props[propId];
    if (!p) return;
    // Rellenar el formulario de subida con los datos del prop
    const nombre = document.getElementById('up-prop-nombre');
    const tipo   = document.getElementById('up-prop-tipo');
    const capa   = document.getElementById('up-prop-capa');
    if (nombre) nombre.value = p.nombre;
    if (tipo)   tipo.value   = p.tipo;
    if (capa)   capa.value   = p.capa;
    // Scroll up al formulario
    document.getElementById('drop-prop-zone')?.scrollIntoView({ behavior: 'smooth' });
    mostrarToast(`Sube imagen para: ${p.nombre}`, 'info');
};

