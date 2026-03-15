// ============================================================
// extra-main.js — Orquestador del módulo Extra
// ============================================================

import { hexAuth } from '../hex-auth.js';
import { estadoUI } from './extra-state.js';
import { asegurarBucket, cargarDatos, subirImagen } from './extra-data.js';
import { marcarExiste } from './extra-logic.js';
import {
    renderGrid, mostrarPanelUpload, ocultarPanelUpload,
    actualizarProgreso, resetProgressUI, actualizarTabs, actualizarFiltros
} from './extra-ui.js';

// ── Iniciar ──────────────────────────────────────────────────
async function iniciar() {
    await hexAuth.init();

    const badge = document.getElementById('hex-session-badge');
    if (badge) {
        if (hexAuth.esAdmin()) {
            badge.innerHTML = `<span style="background:#4a004a; color:#d4af37; border:1px dashed #d4af37; padding:8px 14px; border-radius:4px; font-weight:bold; font-family:'Cinzel'; cursor:pointer; font-size:0.85em;">⚙️ MÁSTER</span>`;
        } else if (hexAuth.estaLogueado()) {
            badge.innerHTML = hexAuth.renderStatusBadge();
        } else {
            // NUEVO: Letrero para los ayudantes que no tienen cuenta
            badge.innerHTML = `<span style="background:#222; color:#00ff00; border:1px solid #00ff00; padding:8px 14px; border-radius:4px; font-size:0.85em; font-weight:bold;">🤝 COLABORADOR</span>`;
        }
    }

    // ELIMINAMOS la validación "!hexAuth.estaLogueado()" 
    // Ahora todo el mundo pasa directo a intentar cargar los datos.

    try {
        await asegurarBucket();
        await cargarDatos();
        document.getElementById('loader-msg').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
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
    estadoUI.uploadTarget = { keyNorm, tipoIcono, nombre };
    mostrarPanelUpload(nombre, keyNorm, tipoIcono);
};

window.cerrarUpload = () => {
    estadoUI.uploadTarget = null;
    ocultarPanelUpload();
};

window.handleDrop = (e) => {
    e.preventDefault();
    document.getElementById('drop-zone').classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) ejecutarSubida(file);
};

window.handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) ejecutarSubida(file);
    e.target.value = '';
};

async function ejecutarSubida(file) {
    if (!estadoUI.uploadTarget) return;
    const { keyNorm, tipoIcono } = estadoUI.uploadTarget;

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
        actualizarProgreso(0, '❌ Error: ' + (e.message || 'fallo al subir'), true);
    }
}

iniciar();
