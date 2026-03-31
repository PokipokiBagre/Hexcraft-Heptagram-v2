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
        const esProp = item.esPropuesta === true;
        const claseCard = esProp ? 'propuesta' : (item.existe ? 'ok' : 'falta');
        const badge     = esProp
            ? `<div class="badge-propuesta" style="position:absolute;top:5px;right:5px;background:#ff9900;color:#000;font-size:0.6em;padding:2px 5px;border-radius:3px;font-weight:bold;">?</div>`
            : item.existe
                ? `<div class="badge-ok">✓</div>`
                : `<div class="badge-falta">!</div>`;
            
        const imgSrc    = item.existe ? item.urlStorage : imgFallback;
        const btnTxt    = item.existe ? '🔄 Cambiar' : '📤 Subir';
        const btnColor  = item.existe ? '#004a00' : '#4a0000';
        const btnBorder = item.existe ? '#00ff00' : '#ff4444';
        const safeNombre = item.nombre.replace(/'/g, "\\'");

        const esNPC = item.tipoIcono === 'imgpersonajes' && item.isPlayer === false;
        const puedeEditar = hexAuth.estaLogueado() || item.tipoIcono === 'imgobjetos' || esNPC;

        const clickAction = puedeEditar ? `onclick="window.abrirUpload('${item.keyNorm}','${item.tipoIcono}','${safeNombre}')"` : '';
        const cursorStyle = puedeEditar ? 'cursor:pointer;' : '';

        // Border color for proposals
        const cardBorderStyle = esProp ? 'border-color:#ff9900; background:rgba(40,20,0,0.5);' : '';

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
            btnHtml = `<div style="margin-top:6px; font-size:0.7em; color:#666; font-style:italic;">Solo lectura</div>`;
        }

        const propBadgeExtra = esProp
            ? `<div style="font-size:0.65em;color:#ff9900;margin-top:3px;font-family:sans-serif;">Por: ${item.propuesto_por||'?'}</div>`
            : '';

        html += `
        <div class="img-card ${claseCard}" title="${item.nombre}" style="${cardBorderStyle}">
            ${badge}
            <img src="${imgSrc}"
                 onerror="this.onerror=null; this.src='${imgFallback}'"
                 style="${cursorStyle}"
                 ${clickAction}>
            <div class="nombre">${item.nombre}</div>
            ${propBadgeExtra}
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

// ── Panel de imágenes huérfanas ───────────────────────────────
export function renderHuerfanas(huerfanas) {
    const cont = document.getElementById('panel-huerfanas');
    if (!cont) return;

    if (!huerfanas || huerfanas.length === 0) {
        cont.innerHTML = `<p style="color:#00ff88;font-family:sans-serif;text-align:center;padding:30px;">
            ✅ No hay imágenes huérfanas. Todo está en orden.
        </p>`;
        return;
    }

    const totalKB = Math.round(huerfanas.reduce((s, h) => s + (h.size || 0), 0) / 1024);

    let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
        <span style="color:#ff9900;font-family:sans-serif;font-size:0.9em;">
            ⚠️ <strong>${huerfanas.length}</strong> imágenes sin usar · ${totalKB} KB en total
        </span>
        <button onclick="window.eliminarTodasHuerfanas()"
            style="background:#4a0000;border:1px solid #cc2222;color:#ff5555;
                   padding:7px 18px;border-radius:6px;cursor:pointer;
                   font-family:'Cinzel';font-size:0.82em;font-weight:bold;">
            🗑️ Eliminar Todas
        </button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;">`;

    huerfanas.forEach((h, idx) => {
        const safeRuta = h.ruta.replace(/'/g, "\\'");
        const safeNom  = h.nombre.replace(/'/g, "\\'");
        html += `
        <div id="hcard-${idx}" style="background:rgba(40,0,0,0.5);border:1px solid #4a1010;
                border-radius:8px;padding:8px;text-align:center;position:relative;">
            <img src="${h.url}" onerror="this.src='${STORAGE_URL}/imginterfaz/no_encontrado.png'"
                style="width:72px;height:72px;object-fit:cover;border-radius:6px;border:1px solid #555;">
            <div style="font-size:0.62em;color:#aaa;margin-top:5px;word-break:break-all;
                        font-family:sans-serif;line-height:1.3;">${h.nombre}</div>
            <button onclick="window.eliminarHuerfana('${safeRuta}','${safeNom}',${idx})"
                style="margin-top:6px;width:100%;background:#330000;border:1px solid #aa2222;
                       color:#ff5555;padding:3px 0;border-radius:4px;cursor:pointer;
                       font-size:0.7em;font-family:'Rajdhani';">
                🗑️ Borrar
            </button>
        </div>`;
    });

    html += `</div>`;
    cont.innerHTML = html;
}
