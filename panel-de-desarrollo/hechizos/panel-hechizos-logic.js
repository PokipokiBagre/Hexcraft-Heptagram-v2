// ============================================================
// panel-hechizos-ui.js — Renderizado de la Columna de Hechizos
// ============================================================

import { hzState } from './panel-hechizos-state.js';
import { castearHechizo, asignarHechizo, copiarDadoHechizo, copiarInfoHechizo, setBusquedaHz, setVistaHz, toggleConfigCasteo } from './panel-hechizos-logic.js';

window.devCastearHz = castearHechizo;
window.devAsignarHz = asignarHechizo;
window.devCopiarDadoHz = copiarDadoHechizo;
window.devCopiarInfoHz = copiarInfoHechizo;
window.devBusquedaHz = setBusquedaHz;
window.devSetVistaHz = setVistaHz;
window.devToggleConfigHz = toggleConfigCasteo;

function drawnHEXPreserveFocus(containerId, html) {
    const activeEl = document.activeElement;
    const activeId = activeEl ? activeEl.id : null;
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = html;
        if (activeId) {
            const newEl = document.getElementById(activeId);
            if (newEl) newEl.focus();
        }
    }
}

// Vista 1: Tarjeta para el Grimorio (Casteo)
function generarTarjetaCastear(hechizo, pjNombre) {
    const cantInputId = `cast-input-${hechizo.ID}`;
    const costo = hechizo.Hex || hechizo.Costo || 0;
    
    return `
    <div style="background:#050505; border:1px solid var(--cyan-magic); border-radius:8px; padding:10px; margin-bottom:8px; display:flex; flex-direction:column; gap:8px;">
        <div>
            <div style="color:#eee; font-weight:bold; font-size:1em;">${hechizo.Nombre}</div>
            <div style="color:#888; font-size:0.75em;">Afinidad: <span style="color:var(--gold);">${hechizo.Afinidad}</span> | Coste: ${costo} HEX</div>
        </div>
        
        <div style="display:flex; gap:5px; align-items:center;">
            <input type="number" id="${cantInputId}" value="1" min="1" style="width:50px; background:#111; color:#fff; border:1px solid #555; border-radius:4px; text-align:center; padding:6px; font-weight:bold; outline:none;" title="Cantidad">
            <button onclick="window.devCastearHz('${pjNombre}', '${hechizo.ID}', '${cantInputId}')" style="flex:1; background:linear-gradient(135deg, #1a365d, #4a90e2); color:#fff; border:none; border-radius:4px; padding:6px; cursor:pointer; font-weight:bold; font-family:'Cinzel';">⚡ CASTEAR</button>
            <button onclick="window.devCopiarDadoHz('${hechizo.Nombre.replace(/'/g, "\\'")}', '${hechizo.Afinidad}')" style="background:#333; color:#fff; border:none; border-radius:4px; padding:6px 10px; cursor:pointer;" title="Dado">🎲</button>
            <button onclick="window.devCopiarInfoHz(${JSON.stringify(hechizo).replace(/"/g, '&quot;')})" style="background:#333; color:#fff; border:none; border-radius:4px; padding:6px 10px; cursor:pointer;" title="Info">📜</button>
        </div>
    </div>`;
}

// Vista 2: Tarjeta para la Base de Datos (Asignación)
function generarTarjetaAsignar(hechizo, pjNombre, loTiene) {
    const costo = hechizo.Hex || hechizo.Costo || 0;
    
    const btnHtml = loTiene 
        ? `<button onclick="window.devAsignarHz('${pjNombre}', '${hechizo.ID}')" style="width:100%; background:#4a0000; color:#fff; border:1px solid #ff4444; border-radius:4px; padding:6px; cursor:pointer; font-weight:bold; font-family:'Cinzel';">❌ QUITAR DEL GRIMORIO</button>`
        : `<button onclick="window.devAsignarHz('${pjNombre}', '${hechizo.ID}')" style="width:100%; background:#004a00; color:#fff; border:1px solid #00ff00; border-radius:4px; padding:6px; cursor:pointer; font-weight:bold; font-family:'Cinzel';">➕ ENSEÑAR HECHIZO</button>`;

    return `
    <div style="background:#050505; border:1px solid ${loTiene ? '#00ff00' : '#333'}; border-radius:8px; padding:10px; margin-bottom:8px; display:flex; flex-direction:column; gap:8px;">
        <div>
            <div style="color:#eee; font-weight:bold; font-size:1em;">${hechizo.Nombre}</div>
            <div style="color:#888; font-size:0.75em;">Afinidad: <span style="color:var(--gold);">${hechizo.Afinidad}</span> | Clase: ${hechizo.Clase || '-'} | Coste: ${costo} HEX</div>
        </div>
        ${btnHtml}
    </div>`;
}

export function renderColumnaHechizos(pjSeleccionado) {
    const contenedor = 'content-spells';
    if (!document.getElementById(contenedor)) return;

    if (!pjSeleccionado) {
        drawnHEXPreserveFocus(contenedor, `<div style="text-align:center; color:#666; margin-top:50px; font-style:italic;">Selecciona un personaje para gestionar sus Hechizos.</div>`);
        return;
    }

    const v = hzState.vistaActiva;
    const pjKey = pjSeleccionado.toLowerCase();
    
    // Lista de IDs en tiempo real (DB + Staging)
    const baseIds = hzState.inventariosDB[pjKey] || [];
    const cola = hzState.colaAsignaciones[pjKey] || {};
    const hechizosDelPj = new Set(baseIds);
    Object.entries(cola).forEach(([id, agregar]) => {
        if (agregar) hechizosDelPj.add(id);
        else hechizosDelPj.delete(id);
    });

    // Pestañas Superiores (El diseño "de 4" pero adaptado a 2 vistas principales)
    let html = `
        <div style="display:flex; gap:5px; margin-bottom:15px; border-bottom: 1px solid #333; padding-bottom:10px;">
            <button onclick="window.devSetVistaHz('castear')" style="flex:1; padding:8px; border-radius:4px; border:1px solid #444; background:${v==='castear'?'linear-gradient(135deg, #1a365d, #4a90e2)':'#111'}; color:${v==='castear'?'#fff':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">⚡ CASTEAR</button>
            <button onclick="window.devSetVistaHz('asignar')" style="flex:1; padding:8px; border-radius:4px; border:1px solid #444; background:${v==='asignar'?'linear-gradient(135deg, #004a00, #00b300)':'#111'}; color:${v==='asignar'?'#fff':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">➕ ASIGNAR</button>
        </div>
    `;

    if (v === 'castear') {
        // VISTA CASTEAR
        html += `
        <div style="background:#1a0f00; border:1px solid var(--gold); border-radius:6px; padding:10px; margin-bottom:15px; display:flex; justify-content:space-around; align-items:center; font-size:0.85em;">
            <div style="color:var(--gold); font-weight:bold;">Toggles de Casteo:</div>
            <label style="color:#ddd; cursor:pointer; display:flex; align-items:center; gap:4px;">
                <input type="checkbox" onchange="window.devToggleConfigHz('cobrarAuto', this.checked)" ${hzState.cobrarAuto ? 'checked' : ''}> Cobrar (Vex->Hex)
            </label>
            <label style="color:#ddd; cursor:pointer; display:flex; align-items:center; gap:4px;">
                <input type="checkbox" onchange="window.devToggleConfigHz('mostrarEfectos', this.checked)" ${hzState.mostrarEfectos ? 'checked' : ''}> Imprimir Efectos
            </label>
        </div>
        
        <input type="text" id="dev-search-hz-cast" placeholder="🔍 Buscar en su grimorio..." value="${hzState.busquedaCastear}" oninput="window.devBusquedaHz(this.value, 'castear')" style="width:100%; box-sizing:border-box; background:#000; color:var(--cyan-magic); border:1px solid var(--cyan-magic); padding:10px; border-radius:6px; margin-bottom:15px; font-family:'Rajdhani'; outline:none;">`;
        
        let mostrar = hzState.catalogoDB.filter(h => hechizosDelPj.has(h.ID));
        if (hzState.busquedaCastear) mostrar = mostrar.filter(h => h.Nombre.toLowerCase().includes(hzState.busquedaCastear));

        html += `<div style="overflow-y:auto; padding-right:5px; max-height: 550px;">`;
        if (mostrar.length === 0) html += `<div style="text-align:center; color:#555; padding:10px; font-style:italic;">No conoce hechizos que coincidan con la búsqueda.</div>`;
        else mostrar.forEach(h => { html += generarTarjetaCastear(h, pjSeleccionado); });
        html += `</div>`;
        
    } else {
        // VISTA ASIGNAR
        html += `
        <div style="background:#001a00; border:1px solid #00ff00; border-radius:6px; padding:10px; margin-bottom:15px; text-align:center; font-size:0.85em;">
            <label style="color:#ddd; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                <input type="checkbox" onchange="window.devToggleConfigHz('cobrarAlAsignar', this.checked)" ${hzState.cobrarAlAsignar ? 'checked' : ''}> 
                <span style="font-weight:bold; color:#00ff00;">Cobrar HEX automáticamente al Enseñar un Hechizo</span>
            </label>
        </div>

        <input type="text" id="dev-search-hz-asig" placeholder="🔍 Buscar en la base de datos global..." value="${hzState.busquedaAsignar}" oninput="window.devBusquedaHz(this.value, 'asignar')" style="width:100%; box-sizing:border-box; background:#000; color:#00ff00; border:1px solid #00ff00; padding:10px; border-radius:6px; margin-bottom:15px; font-family:'Rajdhani'; outline:none;">`;

        let mostrar = hzState.catalogoDB;
        if (hzState.busquedaAsignar) mostrar = mostrar.filter(h => h.Nombre.toLowerCase().includes(hzState.busquedaAsignar) || h.Afinidad.toLowerCase().includes(hzState.busquedaAsignar));

        html += `<div style="overflow-y:auto; padding-right:5px; max-height: 550px;">`;
        const top = mostrar.slice(0, 50); // Limite por rendimiento
        top.forEach(h => { html += generarTarjetaAsignar(h, pjSeleccionado, hechizosDelPj.has(h.ID)); });
        if (mostrar.length > 50) html += `<div style="text-align:center; color:#666; font-size:0.8em; padding:5px;">Mostrando los primeros 50 de ${mostrar.length} resultados. Usa el buscador para filtrar.</div>`;
        html += `</div>`;
    }

    drawnHEXPreserveFocus(contenedor, html);
}
