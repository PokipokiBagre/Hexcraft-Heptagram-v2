// ============================================================
// extra-main.js — Orquestador del módulo Extra
// ============================================================

import { hexAuth } from '../hex-auth.js';
import { estadoUI, STORAGE_URL } from './extra-state.js';
import { asegurarBucket, cargarDatos, subirImagen, cargarHuerfanas, eliminarImagenStorage } from './extra-data.js';
import { marcarExiste } from './extra-logic.js';
import {
    renderGrid, mostrarPanelUpload, ocultarPanelUpload,
    actualizarProgreso, resetProgressUI, actualizarTabs, actualizarFiltros,
    renderHuerfanas
} from './extra-ui.js';

// ── Iniciar ──────────────────────────────────────────────────
async function iniciar() {
    const favicon = document.querySelector("link[rel='icon']");
    if (favicon) favicon.href = `${STORAGE_URL}/imginterfaz/icon.png`;

    await hexAuth.init();

    const badge = document.getElementById('hex-session-badge');
    let esColaborador = false;

    if (badge) {
        if (hexAuth.esAdmin()) {
            badge.innerHTML = `<span style="background:#4a004a; color:#d4af37; border:1px dashed #d4af37; padding:8px 14px; border-radius:4px; font-weight:bold; font-family:'Cinzel'; cursor:pointer; font-size:0.85em;">⚙️ MÁSTER</span>`;
        } else if (hexAuth.estaLogueado()) {
            badge.innerHTML = hexAuth.renderStatusBadge();
        } else {
            badge.innerHTML = `<span style="background:#222; color:#00ff00; border:1px solid #00ff00; padding:8px 14px; border-radius:4px; font-size:0.85em; font-weight:bold;">🤝 COLABORADOR</span>`;
            esColaborador = true;
        }
    }

    if (esColaborador) {
        estadoUI.tab = 'objetos'; 
    }

    try {
        await asegurarBucket();
        await cargarDatos();
        document.getElementById('loader-msg').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        
        if (esColaborador) actualizarTabs(); 
        
        renderGrid();
    } catch(e) {
        document.getElementById('loader-msg').innerHTML =
            `<p style="color:#ff4444; font-family:sans-serif;">Error cargando datos: ${e.message}</p>`;
        console.error(e);
    }
}

// ── Cambiar tab ──────────────────────────────────────────────
window.cambiarTab = (tab) => {
    estadoUI.tab = tab;
    estadoUI.filtro = 'todos'; // reset filter on tab change
    if (!hexAuth.estaLogueado() && tab !== 'objetos') {
        window.cerrarUpload();
    }
    actualizarTabs();
    actualizarFiltros();
    renderGrid();
    // Notificar al HTML para mostrar filtros de propuesta
    window.dispatchEvent(new CustomEvent('tabChanged', { detail: tab }));
};

// ── Filtros y búsqueda ───────────────────────────────────────
window.setFiltro = (f) => {
    estadoUI.filtro = f;
    actualizarFiltros();
    renderGrid();
};

window.setBusqueda = (v) => {
    estadoUI.busqueda = v;
    renderGrid();
};

// ── Upload ───────────────────────────────────────────────────
window.abrirUpload = (keyNorm, tipoIcono, nombre) => {
    // Permitido si: está logueado, es objeto, o es personaje NPC
    // (isPlayer=false se detecta leyendo itemsPersonajes)
    if (!hexAuth.estaLogueado() && tipoIcono !== 'imgobjetos') {
        // Verificar si es un NPC antes de bloquear
        const { itemsPersonajes } = estadoUI._items || {};
        // La forma más directa: buscar en el DOM si el card tiene botón (ya lo tiene si llegó aquí)
        // Simplemente permitir imgpersonajes cuando el botón existe — la UI ya filtró
        if (tipoIcono !== 'imgpersonajes') return;
    }

    estadoUI.uploadTarget = { keyNorm, tipoIcono, nombre };
    mostrarPanelUpload(nombre, keyNorm, tipoIcono);
};

window.cerrarUpload = () => {
    estadoUI.uploadTarget = null;
    ocultarPanelUpload();
};

window.handleDrop = async (e) => {
    e.preventDefault();
    document.getElementById('drop-zone').classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        await ejecutarSubida(file);
    }
};

window.handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
        await ejecutarSubida(file); 
    }
    // Limpieza SEGURA del input de memoria una vez que todo el proceso ha terminado
    e.target.value = ''; 
};

    async function ejecutarSubida(file) {
    if (!estadoUI.uploadTarget) return;
    // Añade 'nombre' a la desestructuración
    const { keyNorm, tipoIcono, nombre } = estadoUI.uploadTarget;

    if (!hexAuth.estaLogueado() && tipoIcono !== 'imgobjetos' && tipoIcono !== 'imgpersonajes') {
        actualizarProgreso(0, '❌ Permiso denegado para esta categoría.', true);
        return;
    }

    try {
        // Pasa 'nombre' como quinto parámetro
        const nuevaUrl = await subirImagen(file, keyNorm, tipoIcono, (pct, msg) => {
            actualizarProgreso(pct, msg);
        }, nombre);

        marcarExiste(keyNorm, tipoIcono, nuevaUrl);


        setTimeout(() => {
            window.cerrarUpload();
            renderGrid();
        }, 1500);

    } catch(e) {
        console.error('Error subiendo imagen:', e);
        actualizarProgreso(0, '❌ ' + (e.message || 'Fallo al subir.'), true);
        
        // 👉 NUEVO: Auto-Recuperación de Interfaz. 
        // Si falla, borramos el error y cerramos la ventana a los 3.5 seg para evitar bloqueos
        setTimeout(() => {
            if (estadoUI.uploadTarget && estadoUI.uploadTarget.keyNorm === keyNorm) {
                window.cerrarUpload();
            }
        }, 3500);
    }
}


// ── Imágenes Huérfanas ────────────────────────────────────────
let _huerfanasCache = null;

window.abrirHuerfanas = async () => {
    const panel = document.getElementById('panel-huerfanas');
    const btn   = document.getElementById('btn-huerfanas');
    if (!panel) return;

    const visible = panel.style.display !== 'none';
    if (visible) {
        panel.style.display = 'none';
        if (btn) btn.textContent = '🗂️ Ver Imágenes No Usadas';
        return;
    }

    panel.style.display = 'block';
    if (btn) btn.textContent = '⏳ Cargando...';
    panel.innerHTML = '<p style="color:#aaa;font-family:sans-serif;text-align:center;padding:20px;">Buscando imágenes huérfanas...</p>';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    _huerfanasCache = await cargarHuerfanas();
    renderHuerfanas(_huerfanasCache);
    if (btn) btn.textContent = '🗂️ Ver Imágenes No Usadas';
};

window.eliminarHuerfana = async (ruta, nombre, idx) => {
    if (!confirm(`¿Eliminar "${nombre}" del Storage?
Esta acción no se puede deshacer.`)) return;
    const card = document.getElementById(`hcard-${idx}`);
    if (card) card.style.opacity = '0.4';
    const ok = await eliminarImagenStorage(ruta);
    if (ok) {
        if (card) card.remove();
        if (_huerfanasCache) _huerfanasCache = _huerfanasCache.filter(h => h.ruta !== ruta);
    } else {
        if (card) card.style.opacity = '1';
        alert('Error al eliminar. Intenta de nuevo.');
    }
};

window.eliminarTodasHuerfanas = async () => {
    if (!_huerfanasCache || _huerfanasCache.length === 0) return;
    if (!confirm(`¿Eliminar las ${_huerfanasCache.length} imágenes huérfanas?
Esta acción NO se puede deshacer.`)) return;
    const panel = document.getElementById('panel-huerfanas');
    if (panel) panel.innerHTML = '<p style="color:#aaa;font-family:sans-serif;text-align:center;padding:20px;">⏳ Eliminando...</p>';
    let ok = 0;
    for (const h of _huerfanasCache) {
        const res = await eliminarImagenStorage(h.ruta);
        if (res) ok++;
    }
    _huerfanasCache = [];
    if (panel) panel.innerHTML = `<p style="color:#00ff88;font-family:sans-serif;text-align:center;padding:20px;">✅ ${ok} imágenes eliminadas.</p>`;
};

iniciar();
