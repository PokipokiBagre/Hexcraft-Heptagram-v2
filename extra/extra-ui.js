// ============================================================
// extra-ui.js — Renderizado de la interfaz
// ============================================================

import { estadoUI, STORAGE_URL } from './extra-state.js';
import { getItemsFiltrados, getEstadisticas } from './extra-logic.js';
import { hexAuth } from '../hex-auth.js'; // <-- IMPORTANTE: Importamos para verificar permisos

// ── Stats ────────────────────────────────────────────────────
export function renderStats() {
    const { total, ok, faltan, pct } = getEstadisticas();
    document.getElementById('stats-row').innerHTML = `
        <div class="stat-box">
            <div class="num">${total}</div>
            <div class="lbl">Total</div>
        </div>
        <div class="stat-box" style="border-color:#00aa44">
            <div class="num" style="color:#00aa44">${ok}</div>
            <div class="lbl">Con imagen</div>
        </div>
        <div class="stat-box" style="border-color:#ff4444">
            <div class="num" style="color:#ff4444">${faltan}</div>
            <div class="lbl">Sin imagen</div>
        </div>
        <div class="stat-box">
            <div class="num" style="color:#4a90e2">${pct}%</div>
            <div class="lbl">Completado</div>
        </div>`;
}

// ── Grid principal ───────────────────────────────────────────
export function renderGrid() {
    renderStats();

    const filtrados = getItemsFiltrados();
    let html = '';

    const imgFallback = `${STORAGE_URL}/imginterfaz/no_encontrado.png`;

    filtrados.forEach(item => {
        const claseCard = item.existe ? 'ok' : 'falta';
        const badge     = item.existe
            ? `<div class="badge-ok">✓</div>`
            : `<div class="badge-falta">!</div>`;
            
        const imgSrc    = item.existe ? item.urlStorage : imgFallback;
        const btnTxt    = item.existe ? '🔄 Cambiar' : '📤 Subir';
        const btnColor  = item.existe ? '#004a00' : '#4a0000';
        const btnBorder = item.existe ? '#00ff00' : '#ff4444';
        const safeNombre = item.nombre.replace(/'/g, "\\'");

        // LÓGICA DE PERMISOS: Puede editar si está logueado, o si es la categoría de objetos
        const puedeEditar = hexAuth.estaLogueado() || item.tipoIcono === 'imgobjetos';

        // Desactivar el click en la imagen si no tiene permisos
        const clickAction = puedeEditar ? `onclick="window.abrirUpload('${item.keyNorm}','${item.tipoIcono}','${safeNombre}')"` : '';
        const cursorStyle = puedeEditar ? 'cursor:pointer;' : '';

        // Dibujar botones o texto de "Solo lectura"
        let btnHtml = '';
        if (puedeEditar) {
            btnHtml = `
            <div style="margin-top:6px;">
                <button onclick="window.abrirUpload('${item.keyNorm}','${item.tipoIcono}','${safeNombre}')"
                    style="background:${btnColor}; border:1px solid ${btnBorder};
                           color:#fff; padding:4px 8px; border-radius:4px;
                           font-size:0.7em; cursor:pointer; font-family:sans-serif;">
                    ${btnTxt}
                </button>
            </div>`;
        } else {
            btnHtml = `
            <div style="margin-top:6px; font-size:0.7em; color:#666; font-style:italic;">
                Solo lectura
            </div>`;
        }

        html += `
        <div class="img-card ${claseCard}" title="${item.nombre}">
            ${badge}
            <img src="${imgSrc}"
                 onerror="this.onerror=null; this.src='${imgFallback}'"
                 style="${cursorStyle}"
                 ${clickAction}>
            <div class="nombre">${item.nombre}</div>
            ${btnHtml}
        </div>`;
    });

    document.getElementById('img-grid').innerHTML = html ||
        '<p style="color:#666; font-style:italic; font-family:sans-serif; grid-column:1/-1; text-align:center; padding:40px;">No hay resultados.</p>';
}

// ── Panel de upload ──────────────────────────────────────────
export function mostrarPanelUpload(nombre, keyNorm, tipoIcono) {
    document.getElementById('upload-target-name').innerText = nombre;
    document.getElementById('upload-target-tipo').innerText = ` → ${tipoIcono}/${keyNorm}`;
    document.getElementById('zona-upload').style.display = 'block';
    resetProgressUI();
    document.getElementById('zona-upload').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function ocultarPanelUpload() {
    document.getElementById('zona-upload').style.display = 'none';
}

export function resetProgressUI() {
    document.getElementById('upload-progress').style.display = 'none';
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('upload-status').innerText = '';
    document.getElementById('upload-status').style.color = '#aaa';
}

export function actualizarProgreso(pct, mensaje, esError = false) {
    document.getElementById('upload-progress').style.display = 'block';
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('upload-status').innerText = mensaje;
    document.getElementById('upload-status').style.color = esError ? '#ff4444' : (pct === 100 ? '#00ff00' : '#aaa');
}

// ── Tabs y filtros ───────────────────────────────────────────
export function actualizarTabs() {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const tabEl = document.getElementById('tab-' + estadoUI.tab);
    if (tabEl) tabEl.classList.add('active');
}

export function actualizarFiltros() {
    document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
    const filEl = document.getElementById('filtro-' + estadoUI.filtro);
    if (filEl) filEl.classList.add('active');
}
