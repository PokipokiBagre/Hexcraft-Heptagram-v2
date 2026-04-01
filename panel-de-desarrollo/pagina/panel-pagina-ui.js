// ============================================================
// panel-pagina-ui.js — Render del panel "Editar Página"
// ============================================================

import { paginaState }                         from './panel-pagina-state.js';
import { cargarConfigUI, guardarConfigUI, marcarCambioPagina, haycambiosPagina } from './panel-pagina-logic.js';

// ── Punto de entrada: inicializa estado y expone funciones globales ──
export async function initPaginaDev() {
    await cargarConfigUI();
    _exponerGlobales();
}

// ── Render principal ─────────────────────────────────────────
export function renderColumnaPagina() {
    const contenedor = document.getElementById('content-pagina');
    if (!contenedor) return;

    const c = paginaState.config || {};

    contenedor.innerHTML = `
    <div style="max-width:860px; margin:0 auto; display:flex; flex-direction:column; gap:28px;">

        <!-- Encabezado -->
        <div style="border:1px solid #4a1880; border-radius:10px; padding:22px; background:#08000f;">
            <h3 style="margin:0 0 18px 0; color:#d4af37; font-family:'Cinzel',serif; font-size:1em; text-transform:uppercase; letter-spacing:2px;">
                🏷️ Encabezado de la Campaña
            </h3>

            <label class="pag-label">Título principal</label>
            <input  class="pag-input" id="pag-titulo"    value="${_esc(c.titulo    || '')}"
                    oninput="window._paginaMod('titulo',    this.value)"
                    placeholder="HEXCRAFT HEPTAGRAM">

            <label class="pag-label" style="margin-top:14px;">Subtítulo</label>
            <input  class="pag-input" id="pag-subtitulo" value="${_esc(c.subtitulo || '')}"
                    oninput="window._paginaMod('subtitulo', this.value)"
                    placeholder="Campaña de rol mágica...">

            <label class="pag-label" style="margin-top:14px;">Texto de lore / descripción</label>
            <textarea class="pag-textarea" id="pag-lore"
                      oninput="window._paginaMod('lore', this.value)"
                      placeholder="Descripción larga de la campaña...">${_esc(c.lore || '')}</textarea>
        </div>

        <!-- Hilos -->
        <div style="border:1px solid #4a1880; border-radius:10px; padding:22px; background:#08000f;">
            <h3 style="margin:0 0 18px 0; color:#d4af37; font-family:'Cinzel',serif; font-size:1em; text-transform:uppercase; letter-spacing:2px;">
                🔗 Hilos Activos
            </h3>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                <div>
                    <label class="pag-label">Etiqueta del hilo de Rol</label>
                    <input  class="pag-input" id="pag-nombre-rol" value="${_esc(c.nombre_rol || '')}"
                            oninput="window._paginaMod('nombre_rol', this.value)"
                            placeholder="ROL ACTUAL">
                    <label class="pag-label" style="margin-top:10px;">URL del hilo de Rol</label>
                    <input  class="pag-input" id="pag-link-rol"   value="${_esc(c.link_rol   || '')}"
                            oninput="window._paginaMod('link_rol',   this.value)"
                            placeholder="https://...">
                </div>
                <div>
                    <label class="pag-label">Etiqueta del hilo de Meta</label>
                    <input  class="pag-input" id="pag-nombre-meta" value="${_esc(c.nombre_meta || '')}"
                            oninput="window._paginaMod('nombre_meta', this.value)"
                            placeholder="META">
                    <label class="pag-label" style="margin-top:10px;">URL del hilo de Meta</label>
                    <input  class="pag-input" id="pag-link-meta"   value="${_esc(c.link_meta   || '')}"
                            oninput="window._paginaMod('link_meta',   this.value)"
                            placeholder="https://...">
                </div>
            </div>
        </div>

        <!-- Previsualización -->
        <div style="border:1px dashed #4a1880; border-radius:10px; padding:20px; background:#03000a;">
            <h3 style="margin:0 0 14px 0; color:#888; font-family:'Cinzel',serif; font-size:0.85em; text-transform:uppercase; letter-spacing:2px;">
                👁 Previsualización
            </h3>
            <div id="pag-preview" style="pointer-events:none; opacity:0.85;">
                ${_renderPreview(c)}
            </div>
        </div>

        <!-- Botón guardar -->
        <div style="display:flex; align-items:center; gap:16px;">
            <button id="btn-guardar-pagina"
                    onclick="window._paginaGuardar()"
                    style="background:linear-gradient(135deg,#4a1880,#7b2fff);
                           color:#fff; border:1px solid #b07aff;
                           padding:14px 32px; border-radius:8px;
                           font-family:'Cinzel',serif; font-weight:bold;
                           font-size:1em; cursor:pointer; transition:0.2s;"
                    onmouseover="this.style.filter='brightness(1.2)'"
                    onmouseout="this.style.filter='brightness(1)'">
                💾 GUARDAR CAMBIOS EN LA BD
            </button>
            <span id="pag-status" style="font-family:monospace; font-size:0.9em; color:#888;"></span>
        </div>

        <!-- Nota sobre estilos -->
        <div style="border:1px dashed #333; border-radius:8px; padding:14px; color:#555; font-size:0.82em; font-family:sans-serif; line-height:1.6;">
            ℹ️ <strong style="color:#666;">Selector de estilos</strong> — Próximamente podrás elegir el tema visual de la campaña desde aquí.<br>
            Los cambios en título, subtítulo y lore se aplican al recargar el <code>index.html</code> principal.
        </div>

    </div>

    <style>
        .pag-label  { display:block; color:#aaa; font-size:0.78em; font-family:sans-serif; margin-bottom:5px; text-transform:uppercase; letter-spacing:1px; }
        .pag-input  { width:100%; box-sizing:border-box; background:#000; color:#e0d0ff; border:1px solid #4a1880; border-radius:6px; padding:10px 14px; font-family:'Cinzel',serif; font-size:0.95em; outline:none; transition:border-color 0.2s; }
        .pag-input:focus  { border-color:#b07aff; }
        .pag-textarea { width:100%; box-sizing:border-box; background:#000; color:#e0d0ff; border:1px solid #4a1880; border-radius:6px; padding:10px 14px; font-family:sans-serif; font-size:0.9em; outline:none; min-height:90px; resize:vertical; transition:border-color 0.2s; }
        .pag-textarea:focus { border-color:#b07aff; }
    </style>`;
}

// ── Previsualización compacta ────────────────────────────────
function _renderPreview(c) {
    return `
    <div style="background:linear-gradient(rgba(18,0,36,.7),rgba(18,0,36,.7)); border-radius:8px; padding:20px 24px; border:1px solid #2a0050;">
        <h1 style="font-family:'Cinzel',serif; color:#d4af37; font-size:1.8em; margin:0 0 6px 0;">${_esc(c.titulo || '—')}</h1>
        <p  style="color:#ccc; letter-spacing:2px; font-size:0.85em; text-transform:uppercase; margin:0 0 12px 0;">${_esc(c.subtitulo || '—')}</p>
        <p  style="color:#bbb; font-size:0.85em; border-left:3px solid #4a1880; padding-left:12px; margin:0 0 16px 0; font-style:italic;">${_esc(c.lore || '—')}</p>
        <div style="display:flex; gap:16px; flex-wrap:wrap;">
            <a style="color:#00ccff; font-size:0.8em; font-family:'Cinzel',serif;">🔗 ${_esc(c.nombre_rol || 'ROL')}</a>
            <a style="color:#d4af37; font-size:0.8em; font-family:'Cinzel',serif;">🔗 ${_esc(c.nombre_meta || 'META')}</a>
        </div>
    </div>`;
}

// ── Helpers ──────────────────────────────────────────────────
function _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _actualizarPreview() {
    const el = document.getElementById('pag-preview');
    if (el) el.innerHTML = _renderPreview(paginaState.config || {});
}

function _exponerGlobales() {
    window._paginaMod = (campo, valor) => {
        marcarCambioPagina(campo, valor);
        _actualizarPreview();
        const status = document.getElementById('pag-status');
        if (status) status.textContent = '● Cambios sin guardar';
        // Activar botón global de guardado del panel dev
        window.dispatchEvent(new Event('devDataChanged'));
    };

    window._paginaGuardar = async () => {
        const btn    = document.getElementById('btn-guardar-pagina');
        const status = document.getElementById('pag-status');
        if (!haycambiosPagina()) {
            if (status) status.textContent = '✓ Sin cambios';
            return;
        }
        if (btn) { btn.textContent = '⏳ Guardando...'; btn.disabled = true; }
        const res = await guardarConfigUI();
        if (res.ok) {
            if (status) { status.style.color = '#00ff88'; status.textContent = '✅ Guardado correctamente'; }
            setTimeout(() => { if (status) { status.style.color = '#888'; status.textContent = ''; } }, 3000);
        } else {
            if (status) { status.style.color = '#ff4444'; status.textContent = `❌ ${res.msg}`; }
        }
        if (btn) { btn.textContent = '💾 GUARDAR CAMBIOS EN LA BD'; btn.disabled = false; }
    };
}
