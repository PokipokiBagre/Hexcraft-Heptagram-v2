// ============================================================
// panel-hechizos-ui.js — Renderizado de la Columna de Hechizos
// ============================================================

import { hzState } from './panel-hechizos-state.js';
import { asignarHechizo, toggleVisibilidad, setBusquedaHz, setVistaHz, toggleConfigCasteo, setNumFilasCast, modFilaCast, setModoDatalist, calcularConjurosMasivos } from './panel-hechizos-logic.js';
import { norm } from '../dev-state.js';

window.devAsignarHz = asignarHechizo;
window.devToggleVisibilidadHz = toggleVisibilidad;
window.devBusquedaHz = setBusquedaHz;
window.devSetVistaHz = setVistaHz;
window.devToggleConfigHz = toggleConfigCasteo;

window.devSetNumFilasCast = setNumFilasCast;
window.devModFilaCast = modFilaCast;
window.devSetModoDatalist = setModoDatalist;
window.devCalcularConjuros = calcularConjurosMasivos;

function drawnHEXPreserveFocus(containerId, html) {
    const activeEl = document.activeElement;
    const activeId = activeEl ? activeEl.id : null;
    const start = activeEl && activeEl.selectionStart !== undefined ? activeEl.selectionStart : null;
    const end = activeEl && activeEl.selectionEnd !== undefined ? activeEl.selectionEnd : null;

    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = html;
        if (activeId && document.getElementById(activeId)) {
            const newEl = document.getElementById(activeId);
            newEl.focus();
            if (start !== null && newEl.setSelectionRange) {
                try { newEl.setSelectionRange(start, end); } catch(e){}
            }
        }
    }
}

function generarTarjetaAsignar(hechizo, pjNombre, loTiene) {
    const hId = hechizo.ID || hechizo.id;
    const hNom = hechizo.Nombre || hechizo.nombre || 'Hechizo sin nombre';
    const hAf = hechizo.Afinidad || hechizo.afinidad || '-';
    const hClase = hechizo.Clase || hechizo.clase || '-';
    const costo = hechizo.Hex || hechizo.costo || hechizo.Costo || 0;
    const efecto = hechizo.Efecto || hechizo.efecto_desc || hechizo.efecto || '-';
    
    const dbConocido = hechizo.es_conocido === true || hechizo.es_conocido === "TRUE" || hechizo.es_conocido === 1;
    const isKnown = hzState.colaVisibilidad[hId] !== undefined ? hzState.colaVisibilidad[hId] : dbConocido;

    const btnAsignar = loTiene 
        ? `<button onclick="window.devAsignarHz('${pjNombre}', '${hId}')" style="flex:1; background:#4a0000; color:#fff; border:1px solid #ff4444; border-radius:4px; padding:6px; cursor:pointer; font-weight:bold; font-family:'Cinzel';">❌ QUITAR</button>`
        : `<button onclick="window.devAsignarHz('${pjNombre}', '${hId}')" style="flex:1; background:#004a00; color:#fff; border:1px solid #00ff00; border-radius:4px; padding:6px; cursor:pointer; font-weight:bold; font-family:'Cinzel';">➕ ASIGNAR</button>`;

    const btnVisibilidad = `<button onclick="window.devToggleVisibilidadHz('${hId}')" style="background:#111; color:#aaa; border:1px solid #555; border-radius:4px; padding:6px; cursor:pointer; font-size:0.8em; white-space:nowrap;">${isKnown ? '👁️ Ocultar' : '🙈 Hacer Público'}</button>`;

    return `
    <div style="background:#050505; border:1px solid ${loTiene ? '#00ff00' : '#333'}; border-radius:8px; padding:10px; margin-bottom:8px; display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
                <div style="color:#eee; font-weight:bold; font-size:1em;">${hNom}</div>
                <div style="color:#888; font-size:0.75em;">Afinidad: <span style="color:var(--gold);">${hAf}</span> | Clase: ${hClase} | Coste: ${costo} HEX</div>
            </div>
            ${btnVisibilidad}
        </div>
        <div style="color:#aaa; font-size:0.85em; font-style:italic; padding:5px; background:#111; border-left:2px solid var(--cyan-magic);">
            ${efecto}
        </div>
        <div style="display:flex; gap:5px;">
            ${btnAsignar}
        </div>
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
    const pjKey = norm(pjSeleccionado);
    
    // Lista de IDs en tiempo real (DB + Staging)
    const baseIds = hzState.inventariosDB[pjKey] || [];
    const cola = hzState.colaAsignaciones[pjKey] || {};
    const hechizosDelPj = new Set(baseIds);
    Object.entries(cola).forEach(([id, agregar]) => {
        if (agregar) hechizosDelPj.add(id);
        else hechizosDelPj.delete(id);
    });

    let html = `
        <div style="display:flex; gap:5px; margin-bottom:15px; border-bottom: 1px solid #333; padding-bottom:10px;">
            <button onclick="window.devSetVistaHz('castear')" style="flex:1; padding:8px; border-radius:4px; border:1px solid #444; background:${v==='castear'?'linear-gradient(135deg, #1a365d, #4a90e2)':'#111'}; color:${v==='castear'?'#fff':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">⚡ CASTEAR</button>
            <button onclick="window.devSetVistaHz('asignar')" style="flex:1; padding:8px; border-radius:4px; border:1px solid #444; background:${v==='asignar'?'linear-gradient(135deg, #004a00, #00b300)':'#111'}; color:${v==='asignar'?'#fff':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">➕ ASIGNAR DB</button>
        </div>
    `;

    if (v === 'castear') {
        // FORMULARIO DE CASTEO MASIVO (Igual que en inventario-ui.js)
        const dMode = hzState.casteoManual.datalistModo;
        const opcionesDatalist = dMode === 'local' 
            ? hzState.catalogoDB.filter(h => hechizosDelPj.has(h.ID || h.id))
            : hzState.catalogoDB;

        let dlHtml = `<datalist id="dev-dl-hechizos">` + 
            opcionesDatalist.map(h => `<option value="${h.Nombre || h.nombre}"></option>`).join('') + 
            `</datalist>`;

        html += `
        ${dlHtml}
        <div style="background:#1a0f00; border:1px solid var(--gold); border-radius:6px; padding:10px; margin-bottom:15px; text-align:center;">
            <label style="color:var(--gold); font-weight:bold; font-size: 1.1em;">
                CANT. DE HECHIZOS SIMULTÁNEOS: 
                <input type="number" id="dev-cast-num" value="${hzState.casteoManual.numFilas}" min="1" max="50" onchange="window.devSetNumFilasCast(this.value)" style="width:60px; background:#000; color:#fff; border:1px solid var(--gold); border-radius:4px; padding:4px; text-align:center; font-weight:bold; outline:none;">
            </label>
            <div style="display:flex; justify-content:center; gap:10px; margin-top:10px;">
                <label style="color:#ddd; cursor:pointer;"><input type="checkbox" onchange="window.devToggleConfigHz('cobrarAuto', this.checked)" ${hzState.cobrarAuto ? 'checked' : ''}> Cobrar Hex</label>
                <label style="color:#ddd; cursor:pointer;"><input type="checkbox" onchange="window.devToggleConfigHz('mostrarEfectos', this.checked)" ${hzState.mostrarEfectos ? 'checked' : ''}> Imprimir Efectos</label>
            </div>
        </div>

        <div style="display:flex; gap:5px; margin-bottom:15px;">
            <button onclick="window.devSetModoDatalist('local')" style="flex:1; padding:6px; border-radius:4px; background:${dMode==='local'?'var(--cyan-magic)':'#333'}; color:${dMode==='local'?'#000':'#aaa'}; font-weight:bold; cursor:pointer;">Autocompletar: Grimorio</button>
            <button onclick="window.devSetModoDatalist('global')" style="flex:1; padding:6px; border-radius:4px; background:${dMode==='global'?'#9966ff':'#333'}; color:${dMode==='global'?'#fff':'#aaa'}; font-weight:bold; cursor:pointer;">Autocompletar: Global</button>
        </div>

        <div style="overflow-y:auto; padding-right:5px; max-height: 450px;">`;

        for (let i = 0; i < hzState.casteoManual.numFilas; i++) {
            const fila = hzState.casteoManual.filas[i];
            html += `
            <div style="display:flex; gap:5px; margin-bottom:5px;">
                <input type="text" list="dev-dl-hechizos" placeholder="Nombre del Hechizo..." value="${fila.nombre}" oninput="window.devModFilaCast(${i}, 'nombre', this.value)" style="flex:1; background:#111; color:#fff; border:1px solid #555; border-radius:4px; padding:8px; outline:none;">
                <input type="number" value="${fila.cant}" min="1" oninput="window.devModFilaCast(${i}, 'cant', this.value)" style="width:60px; background:#111; color:#fff; border:1px solid #555; border-radius:4px; padding:8px; text-align:center; outline:none;">
            </div>`;
        }

        html += `
        </div>
        <button onclick="window.devCalcularConjuros('${pjSeleccionado.replace(/'/g, "\\'")}')" style="width:100%; margin-top:15px; background:linear-gradient(135deg, #4a004a, #800080); color:white; font-size:1.1em; font-weight:bold; font-family:'Cinzel'; padding:12px; border:1px solid #ff00ff; border-radius:6px; cursor:pointer; text-shadow: 0 0 5px #ff00ff;">⚡ CALCULAR CONJUROS ⚡</button>
        `;

    } else {
        // VISTA ASIGNAR
        html += `
        <div style="background:#001a00; border:1px solid #00ff00; border-radius:6px; padding:10px; margin-bottom:15px; text-align:center; font-size:0.85em;">
            <label style="color:#ddd; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                <input type="checkbox" onchange="window.devToggleConfigHz('cobrarAlAsignar', this.checked)" ${hzState.cobrarAlAsignar ? 'checked' : ''}> 
                <span style="font-weight:bold; color:#00ff00;">Cobrar HEX automáticamente al Enseñar un Hechizo</span>
            </label>
        </div>

        <input type="text" id="dev-search-hz-asig" placeholder="🔍 Buscar nombre o afinidad..." value="${hzState.busquedaAsignar}" oninput="window.devBusquedaHz(this.value)" style="width:100%; box-sizing:border-box; background:#000; color:#00ff00; border:1px solid #00ff00; padding:10px; border-radius:6px; margin-bottom:15px; font-family:'Rajdhani'; outline:none;">`;

        let mostrar = hzState.catalogoDB;
        if (hzState.busquedaAsignar) {
            const bx = norm(hzState.busquedaAsignar);
            mostrar = mostrar.filter(h => 
                norm(h.Nombre || h.nombre || '').includes(bx) || 
                norm(h.Afinidad || h.afinidad || '').includes(bx)
            );
        }

        html += `<div style="overflow-y:auto; padding-right:5px; max-height: 550px;">`;
        const top = mostrar.slice(0, 50); 
        top.forEach(h => { html += generarTarjetaAsignar(h, pjSeleccionado, hechizosDelPj.has(h.ID || h.id)); });
        if (mostrar.length > 50) html += `<div style="text-align:center; color:#666; font-size:0.8em; padding:5px;">Mostrando los primeros 50 de ${mostrar.length} resultados. Usa el buscador para afinar.</div>`;
        html += `</div>`;
    }

    drawnHEXPreserveFocus(contenedor, html);
}
