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

function generarTarjetaHechizo(hechizo, pjNombre, loTiene) {
    const cantInputId = `cast-input-${hechizo.id}`;
    
    // Botón de Asignar (Verde si lo va a dar, Rojo si lo va a quitar)
    const btnAsignar = loTiene 
        ? `<button onclick="window.devAsignarHz('${pjNombre}', '${hechizo.id}', false, 0)" style="background:#4a0000; color:#fff; border:1px solid #ff4444; border-radius:4px; padding:4px 8px; cursor:pointer; font-weight:bold; font-size:0.75em;">❌ QUITAR</button>`
        : `<button onclick="window.devAsignarHz('${pjNombre}', '${hechizo.id}', document.getElementById('chk-cobrar-asig').checked, ${hechizo.costo})" style="background:#004a00; color:#fff; border:1px solid #00ff00; border-radius:4px; padding:4px 8px; cursor:pointer; font-weight:bold; font-size:0.75em;">➕ ASIGNAR</button>`;

    return `
    <div style="background:#050505; border:1px solid ${loTiene ? 'var(--cyan-magic)' : '#333'}; border-radius:8px; padding:10px; margin-bottom:8px; display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
                <div style="color:#eee; font-weight:bold; font-size:1em;">${hechizo.nombre}</div>
                <div style="color:#888; font-size:0.75em;">Afinidad: <span style="color:var(--gold);">${hechizo.afinidad}</span> | Coste: ${hechizo.costo}</div>
            </div>
            ${btnAsignar}
        </div>
        
        <div style="display:flex; gap:5px; align-items:center;">
            <input type="number" id="${cantInputId}" value="1" min="1" style="width:50px; background:#111; color:#fff; border:1px solid #555; border-radius:4px; text-align:center; padding:6px; font-weight:bold; outline:none;" title="Cantidad a castear">
            <button onclick="window.devCastearHz('${pjNombre}', '${hechizo.id}', '${cantInputId}')" style="flex:1; background:linear-gradient(135deg, #1a365d, #4a90e2); color:#fff; border:none; border-radius:4px; padding:6px; cursor:pointer; font-weight:bold; font-family:'Cinzel';">⚡ CASTEAR</button>
            <button onclick="window.devCopiarDadoHz('${hechizo.nombre.replace(/'/g, "\\'")}', '${hechizo.afinidad}')" style="background:#333; color:#fff; border:none; border-radius:4px; padding:6px 10px; cursor:pointer;" title="Copiar Comando de Dado">🎲</button>
            <button onclick="window.devCopiarInfoHz(${JSON.stringify(hechizo).replace(/"/g, '&quot;')})" style="background:#333; color:#fff; border:none; border-radius:4px; padding:6px 10px; cursor:pointer;" title="Copiar Info">📜</button>
        </div>
    </div>`;
}

export function renderColumnaHechizos(pjSeleccionado) {
    const contenedor = 'content-spells';
    if (!document.getElementById(contenedor)) return;

    if (!pjSeleccionado) {
        drawnHEXPreserveFocus(contenedor, `<div style="text-align:center; color:#666; margin-top:50px; font-style:italic;">Selecciona un personaje para ver su Grimorio.</div>`);
        return;
    }

    const v = hzState.vistaActiva;
    const pjKey = pjSeleccionado.toLowerCase();
    
    // Construir lista de IDs que tiene el PJ (fusionando BD y Cola de staging)
    const baseIds = hzState.inventariosDB[pjKey] || [];
    const cola = hzState.colaAsignaciones[pjKey] || {};
    const hechizosDelPj = new Set(baseIds);
    Object.entries(cola).forEach(([id, agregar]) => {
        if (agregar) hechizosDelPj.add(id);
        else hechizosDelPj.delete(id);
    });

    let html = `
        <div style="background:#1a0f00; border:1px solid var(--gold); border-radius:6px; padding:10px; margin-bottom:15px; display:flex; justify-content:space-around; align-items:center; font-size:0.85em;">
            <div style="color:var(--gold); font-family:'Cinzel'; font-weight:bold;">⚙️ Casteo Rápido:</div>
            <label style="color:#ddd; cursor:pointer; display:flex; align-items:center; gap:4px;">
                <input type="checkbox" onchange="window.devToggleConfigHz('cobrarAuto', this.checked)" ${hzState.cobrarAuto ? 'checked' : ''}> Cobrar (Vex->Hex)
            </label>
            <label style="color:#ddd; cursor:pointer; display:flex; align-items:center; gap:4px;">
                <input type="checkbox" onchange="window.devToggleConfigHz('mostrarEfectos', this.checked)" ${hzState.mostrarEfectos ? 'checked' : ''}> +Efectos en Log
            </label>
        </div>

        <div style="display:flex; gap:5px; margin-bottom:15px;">
            <button onclick="window.devSetVistaHz('local')" style="flex:1; padding:6px; border-radius:4px; border:1px solid #444; background:${v==='local'?'var(--cyan-magic)':'#111'}; color:${v==='local'?'#000':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel';">📖 Conocidos</button>
            <button onclick="window.devSetVistaHz('global')" style="flex:1; padding:6px; border-radius:4px; border:1px solid #444; background:${v==='global'?'#9966ff':'#111'}; color:${v==='global'?'#fff':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel';">🌍 Todos</button>
        </div>
    `;

    if (v === 'local') {
        html += `<input type="text" id="dev-search-hz-local" placeholder="🔍 Buscar en su grimorio..." value="${hzState.busquedaLocal}" oninput="window.devBusquedaHz(this.value, 'local')" style="width:100%; box-sizing:border-box; background:#000; color:var(--cyan-magic); border:1px solid var(--cyan-magic); padding:10px; border-radius:6px; margin-bottom:15px; font-family:'Rajdhani'; outline:none;">`;
        
        let mostrar = hzState.catalogoDB.filter(h => hechizosDelPj.has(h.id));
        if (hzState.busquedaLocal) mostrar = mostrar.filter(h => h.nombre.toLowerCase().includes(hzState.busquedaLocal));

        html += `<div style="overflow-y:auto; padding-right:5px; max-height: 600px;">`;
        if (mostrar.length === 0) html += `<div style="text-align:center; color:#555; padding:10px;">No conoce hechizos que coincidan.</div>`;
        else mostrar.forEach(h => { html += generarTarjetaHechizo(h, pjSeleccionado, true); });
        html += `</div>`;
    } 
    else {
        html += `
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
            <input type="text" id="dev-search-hz-global" placeholder="🔍 Buscar en la base de datos..." value="${hzState.busquedaGlobal}" oninput="window.devBusquedaHz(this.value, 'global')" style="flex:1; background:#000; color:#9966ff; border:1px solid #9966ff; padding:10px; border-radius:6px; font-family:'Rajdhani'; outline:none;">
            <label style="color:#ffaa00; font-size:0.75em; display:flex; align-items:center; gap:4px; background:#221100; padding:8px; border-radius:4px; border:1px solid #ffaa00;">
                <input type="checkbox" id="chk-cobrar-asig" checked> Cobrar al Asignar
            </label>
        </div>`;

        let mostrar = hzState.catalogoDB;
        if (hzState.busquedaGlobal) mostrar = mostrar.filter(h => h.nombre.toLowerCase().includes(hzState.busquedaGlobal));

        html += `<div style="overflow-y:auto; padding-right:5px; max-height: 600px;">`;
        const top = mostrar.slice(0, 50); // Limitar a 50 para rendimiento
        top.forEach(h => { html += generarTarjetaHechizo(h, pjSeleccionado, hechizosDelPj.has(h.id)); });
        if (mostrar.length > 50) html += `<div style="text-align:center; color:#666; font-size:0.8em; padding:5px;">Mostrando 50 de ${mostrar.length}.</div>`;
        html += `</div>`;
    }

    drawnHEXPreserveFocus(contenedor, html);
}
