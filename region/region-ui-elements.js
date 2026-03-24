// ============================================================
// region-ui-elements.js — Elementos de UI Comunes y Formularios
// ============================================================

import { PROP_TIPOS } from './region-state.js';

export function htmlFormProp(propData = null) {
    const p = propData || { id: '', nombre: '', tipo: 'terreno', imagen: '' };
    return `
    <div style="display:flex; flex-direction:column; gap:10px;">
        <input type="hidden" id="fp-id" value="${p.id || ''}">
        <label>Nombre
            <input type="text" id="fp-nombre" value="${p.nombre}" class="form-input" placeholder="Nombre del prop">
        </label>
        <label>Tipo
            <select id="fp-tipo" class="form-input">
                ${PROP_TIPOS.map(t => `<option value="${t}" ${p.tipo===t?'selected':''}>${t}</option>`).join('')}
            </select>
        </label>
        <label>Imagen URL
            <input type="text" id="fp-imagen" value="${p.imagen}" class="form-input" placeholder="https://...">
        </label>
        <button class="btn-accion" style="background:var(--gold); color:#000;" onclick="window.guardarPropUI()">💾 Guardar Prop</button>
    </div>`;
}

export function abrirModalUI(contenidoHtml, titulo = '') {
    document.getElementById('modal-titulo').innerText = titulo;
    document.getElementById('modal-cuerpo').innerHTML = contenidoHtml;
    document.getElementById('modal-region').classList.remove('oculto');
}

export function cerrarModalUI() {
    document.getElementById('modal-region').classList.add('oculto');
}

export function mostrarToastUI(msg, tipo = 'ok') {
    let toast = document.getElementById('toast-region');
    if (!toast) {
        toast = document.createElement('div'); toast.id = 'toast-region';
        document.body.appendChild(toast);
    }
    toast.className = `toast-region toast-${tipo}`; toast.innerText = msg; toast.style.opacity = '1';
    clearTimeout(toast._t); toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}
