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
    if (badge) badge.innerHTML = hexAuth.renderStatusBadge ? hexAuth.renderStatusBadge() : '';

    document.querySelectorAll('.solo-op').forEach(el => {
        el.style.display = editor.activo ? '' : 'none';
    });

    const canvas = document.getElementById('mapa-canvas');
    inicializarEngine(canvas);
    centrarCamara();

    const loader = document.getElementById('loader-mapa');
    if (loader) loader.style.display = 'flex';

    const ok = await cargarTodo(mapaIdActual);

    if (loader) loader.style.display = 'none';

    if (!ok) mostrarToast('⚠️ Error cargando datos del mapa', 'error');

    renderPanel();
    actualizarBreadcrumb();

    window.addEventListener('hexSeleccionado', (e) => {
        const { q, r, key } = e.detail;
        renderInfoHex(q, r, key);
    });

    window.addEventListener('mapaModificado', () => {
        cambiosPendientes = true;
        const btn = document.getElementById('btn-guardar-mapa');
        if (btn) { btn.classList.remove('oculto'); btn.innerText = '💾 Guardar Cambios'; }
    });

    if (editor.activo) cargarListaBG();
};

window.cambiarPanelUI = (panel) => {
    ui.panelActual = panel;
    renderPanel();
    if (panel === 'imagenes') cargarListaBG();
};

window.setBusquedaUI = (v) => { ui.busqueda   = v; renderPanel(); };
window.setBrushSize  = (n) => { editor.brushSize = n; renderPanel(); };
window.setCapaActual = (c) => { editor.capaActual = c; renderPanel(); };

window.abrirMenuOP = async () => {
    if (hexAuth.esAdmin()) {
        editor.activo = !editor.activo;
        mostrarToast(editor.activo ? '✏️ Modo Editor Activado' : '👁️ Modo Visualización', 'info');
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

window.setFiltroImagen = (v) => { ui.filtroImagen = v; renderPanel(); };

window.seleccionarProp = (id) => {
    editor.propSeleccionado = props[id] || null;
    // Solo cambia a 'agregar' si la herramienta actual no tiene sentido mantener (mover, seleccionar)
    // NUNCA cambia si estás en borrar o region — esas herramientas no dependen del prop activo
    const herrSinProp = ['borrar', 'region', 'seleccionar', 'mover'];
    if (!herrSinProp.includes(editor.herramienta)) {
        editor.herramienta = 'agregar';
        document.querySelectorAll('.tool-btn').forEach(b => {
            b.classList.toggle('activo', b.dataset.tool === 'agregar');
        });
    }
    renderPanel();
};

window.abrirCrearProp = () => abrirModal(htmlFormProp(), '➕ Nuevo Prop');

window.guardarPropUI = async () => {
    const nombre = document.getElementById('fp-nombre')?.value?.trim();
    if (!nombre) return mostrarToast('El nombre es obligatorio', 'error');
    const id     = `prop_${normKey(nombre)}`;  // ID estable basado en nombre
    const tipo   = document.getElementById('fp-tipo').value;
    const imagen = document.getElementById('fp-imagen').value.trim();

    const propData = { id, nombre, tipo, imagen };
    props[id] = propData;
    const ok = await guardarProp(propData);
    if (ok) { mostrarToast('Prop guardado ✅'); cerrarModal(); renderPanel(); }
    else mostrarToast('Error guardando prop', 'error');
};

window.eliminarPropUI = async (id) => {
    if (!confirm(`¿Eliminar el prop "${props[id]?.nombre}"?`)) return;
    // Si era el prop activo, deseleccionar
    if (editor.propSeleccionado?.id === id) editor.propSeleccionado = null;
    // Limpiar referencias en todos los hexes del mapa
    Object.values(mapaActual.hexes).forEach(hex => {
        if (!hex) return;
        ['back','mid','over'].forEach(capa => {
            if (Array.isArray(hex[capa]))
                hex[capa] = hex[capa].filter(pid => pid !== id);
        });
    });
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
    const nombreInput = document.getElementById('up-prop-nombre')?.value?.trim();
    if (!nombreInput) return mostrarToast('Escribe el nombre del prop antes de subir', 'error');
    const tipo = document.getElementById('up-prop-tipo')?.value || 'terreno';
    const key  = normKey(nombreInput);
    const id   = `prop_${key}`;  // ID estable — no timestamp, para evitar duplicados

    setProgresoProp(0, 'Iniciando...', true);
    try {
        // Carpeta basada en tipo
        const carpeta = `imgregion`;
        const url = await subirImagenProp(file, carpeta, key, (pct, msg) => setProgresoProp(pct, msg, true));

        // Si ya existe un prop con ese ID, actualizar en lugar de crear nuevo
        const existente = props[id];
        const propData = {
            id,
            nombre: existente ? existente.nombre : nombreInput,
            tipo:   existente ? existente.tipo   : tipo,
            imagen: url
        };
        props[id] = propData;
        await guardarProp(propData);
        mostrarToast(`Prop "${propData.nombre}" actualizado ✅`);
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

window.toggleMisionRegion = (regionId, misionId, activa) => {
    const reg = mapaActual.regiones[regionId];
    if (!reg) return;
    if (!reg.misiones) reg.misiones = [];
    if (activa) {
        if (!reg.misiones.includes(misionId)) reg.misiones.push(misionId);
    } else {
        reg.misiones = reg.misiones.filter(m => m !== misionId);
    }
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

window.setHerramienta = (h) => {
    editor.herramienta = h;
    document.querySelectorAll('.tool-btn').forEach(b => {
        b.classList.toggle('activo', b.dataset.tool === h);
    });
};

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

window.cerrarModalRegion = cerrarModal;

// ── Deseleccionar región ──────────────────────────────────────
window.deseleccionarRegion = () => {
    ui.selectedRegion = null;
    renderPanel();
};

// ── Subida de imagen para NPC desde el panel Imágenes ─────────
window.subirNPCImagen = async (e) => {
    const file = e.target.files[0];
    if (file) await _subirNPCFile(file);
    e.target.value = '';
};
window.dropNPCImagen = async (e) => {
    e.preventDefault();
    document.getElementById('drop-npc-zone')?.classList.remove('drag-sobre');
    const file = e.dataTransfer.files[0];
    if (file) await _subirNPCFile(file);
};

async function _subirNPCFile(file) {
    const npcId = document.getElementById('up-npc-id')?.value?.trim();
    if (!npcId) return mostrarToast('Selecciona un NPC primero', 'error');
    const npc = npcsMapaLocal[npcId];
    if (!npc) return mostrarToast('NPC no encontrado', 'error');

    const key = normKey(npc.nombre);
    const progEl = document.getElementById('up-npc-progress');
    const fillEl = document.getElementById('up-npc-fill');
    const statEl = document.getElementById('up-npc-status');
    const show = (pct, msg) => {
        if (progEl) progEl.style.display = 'block';
        if (fillEl) fillEl.style.width = pct + '%';
        if (statEl) { statEl.innerText = msg; statEl.style.color = pct === 100 ? '#00ff88' : '#aaa'; }
    };
    show(0, 'Iniciando...');
    try {
        const url = await subirImagenProp(file, 'imgnpcs', key, (pct, msg) => show(pct, msg));
        npc.icono = url;
        await guardarNPC(npc);
        mostrarToast(`Imagen de ${npc.nombre} actualizada ✅`);
        renderPanel();
    } catch (err) {
        show(0, '❌ ' + err.message);
        mostrarToast('Error: ' + err.message, 'error');
    }
}

// Pre-rellenar selector de NPC en la pestaña imágenes
window.setNPCParaSubida = (npcId) => {
    const sel = document.getElementById('up-npc-id');
    if (sel) sel.value = npcId;
};

function actualizarBreadcrumb() {
    const el = document.getElementById('breadcrumb');
    if (!el) return;
    const partes = historialMapas.map(h => `<span class="bread-item" onclick="window.volverMapaPadre()">🗺️ ${h.nombre}</span> ›`).join(' ');
    el.innerHTML = partes + ` <span class="bread-actual">📍 ${mapaActual.nombre}</span>`;
    const btnVolver = document.getElementById('btn-volver-mapa');
    if (btnVolver) btnVolver.style.display = historialMapas.length > 0 ? '' : 'none';
}

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

document.addEventListener('keydown', (e) => {
    if (!editor.activo) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // ACTUALIZADO: 'a' o 'p' para agregar
    const tools = { 'a': 'agregar', 'p': 'agregar', 'b': 'borrar', 's': 'seleccionar', 'r': 'region', 'm': 'mover' };
    if (tools[e.key.toLowerCase()]) window.setHerramienta(tools[e.key.toLowerCase()]);

    if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); window.guardarMapaUI(); }
    if (e.key === 'Escape') cerrarModal();

    const n = parseInt(e.key);
    if (n >= 1 && n <= 4) { editor.brushSize = n; renderPanel(); }
});

window.setColorActual = (color) => { editor.colorActual = color; renderPanel(); };
window.setOpacidadPincel = (val) => { editor.opacidadPincel = val; };

window.aplicarRuido = () => {
    const color = editor.colorActual || '#4488cc';
    aplicarRuidoVisible(color, editor.opacidadPincel ?? 0.7, 0.35);
    mostrarToast('≋ Ruido aplicado', 'info');
};

window.abrirSubidaProp = (propId) => {
    const p = props[propId];
    if (!p) return;
    // Cambiar a pestaña imágenes si no estamos en ella
    if (ui.panelActual !== 'imagenes') {
        ui.panelActual = 'imagenes';
        renderPanel();
        // Esperar a que el DOM se actualice antes de rellenar
        setTimeout(() => _rellenarFormSubida(p), 50);
    } else {
        _rellenarFormSubida(p);
    }
    mostrarToast(`Sube imagen para: ${p.nombre}`, 'info');
};

function _rellenarFormSubida(p) {
    const nombre = document.getElementById('up-prop-nombre');
    const tipo   = document.getElementById('up-prop-tipo');
    if (nombre) nombre.value = p.nombre;
    if (tipo)   tipo.value   = p.tipo;
    document.getElementById('drop-prop-zone')?.scrollIntoView({ behavior: 'smooth' });
}
