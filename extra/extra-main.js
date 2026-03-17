// ============================================================
// extra-main.js — Orquestador del módulo Extra
// ============================================================

import { hexAuth } from '../hex-auth.js';
import { estadoUI, STORAGE_URL } from './extra-state.js';
import { asegurarBucket, cargarDatos, subirImagen } from './extra-data.js';
import { marcarExiste } from './extra-logic.js';
import {
    renderGrid, mostrarPanelUpload, ocultarPanelUpload,
    actualizarProgreso, resetProgressUI, actualizarTabs, actualizarFiltros
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
    if (!hexAuth.estaLogueado() && tab !== 'objetos') {
        window.cerrarUpload();
    }
    actualizarTabs();
    renderGrid();
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
    const { keyNorm, tipoIcono } = estadoUI.uploadTarget;

    if (!hexAuth.estaLogueado() && tipoIcono !== 'imgobjetos' && tipoIcono !== 'imgpersonajes') {
        actualizarProgreso(0, '❌ Permiso denegado para esta categoría.', true);
        return;
    }

    try {
        const nuevaUrl = await subirImagen(file, keyNorm, tipoIcono, (pct, msg) => {
            actualizarProgreso(pct, msg);
        });

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

iniciar();
