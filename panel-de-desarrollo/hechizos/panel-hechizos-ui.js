// ============================================================
// panel-hechizos-ui.js — Renderizado de la Columna de Hechizos
// ============================================================

import { hzState } from './panel-hechizos-state.js';
import {
    asignarHechizo, toggleVisibilidad, setBusquedaHz, setVistaHz, toggleConfigCasteo,
    setNumFilasCast, modFilaCast, setModoDatalist, calcularConjurosMasivos,
    copiarPrimerDado, copiarPrimerHechizo,
    toggleFilaCobrar, toggleFilaNoFalla, toggleFilaContrarrestada
} from './panel-hechizos-logic.js';
import { modPjStat } from '../estadisticas/panel-stats-logic.js';
import { norm } from '../dev-state.js';

window.devAsignarHz            = asignarHechizo;

// Asignar con costo manual (override del costo base):
// costoOverride = 0 → gratis, costo/2 → descuento, costo*2 → sobrecosto
window.devAsignarHzCosto = (pjNombre, hechizoId, costoOverride) => {
    const cobrarOriginal = hzState.cobrarAlAsignar;
    hzState.cobrarAlAsignar = false; // Apagar cobro automático
    if (costoOverride > 0) modPjStat(pjNombre, 'hex', null, -costoOverride, true, false);
    asignarHechizo(pjNombre, hechizoId);
    hzState.cobrarAlAsignar = cobrarOriginal;
};
window.devToggleVisibilidadHz  = toggleVisibilidad;
window.devBusquedaHz           = setBusquedaHz;
window.devSetVistaHz           = setVistaHz;
window.devToggleConfigHz       = toggleConfigCasteo;

window.devSetNumFilasCast      = setNumFilasCast;
window.devModFilaCast          = modFilaCast;
window.devSetModoDatalist      = setModoDatalist;
window.devCalcularConjuros     = calcularConjurosMasivos;
window.devCopiarPrimerDado     = copiarPrimerDado;
window.devCopiarPrimerHechizo  = copiarPrimerHechizo;
window.devToggleFilaCobrar     = toggleFilaCobrar;
window.devToggleFilaNoFalla        = toggleFilaNoFalla;
window.devToggleFilaContrarrestada = toggleFilaContrarrestada;

// 🌟 UTILIDAD DE EXTRACCIÓN DIRECTA
const getVal = (v) => {
    if (v === undefined || v === null) return '';
    let s = Array.isArray(v) ? v.join(', ') : String(v);
    s = s.trim();
    if (s === '0' || s === '-' || s.toLowerCase() === 'null' || s === '') return '';
    return s;
};

const getValKeys = (obj, keys) => {
    if (!obj) return '';
    const actualKeys = Object.keys(obj);
    for (const pk of keys) {
        const matched = actualKeys.find(k => k.trim().toLowerCase() === pk.toLowerCase());
        if (matched) {
            const val = getVal(obj[matched]);
            if (val) return val;
        }
    }
    return '';
};

function getSpellDetailsHTML(dbSpell) {
    if (!dbSpell) return '';
    
    const efe   = getValKeys(dbSpell, ['efecto_desc', 'efecto', 'desc', 'descripcion']);
    const over  = getValKeys(dbSpell, ['overcast 100%', 'overcast', 'efecto_overcast']);
    const under = getValKeys(dbSpell, ['undercast 50%', 'undercast', 'efecto_undercast']);
    const esp   = getValKeys(dbSpell, ['especial', 'especiales']);

    let dHtml = '';
    if (efe || over || under || esp) {
        dHtml += `<div style="background:#0a0514; border:1px solid #4a1880; border-radius:4px; padding:10px; margin-top:6px; font-size:0.85em; line-height:1.4; box-shadow:inset 0 0 10px rgba(74,24,128,0.2);">`;
        if (efe)   dHtml += `<div style="color:#ddd; margin-bottom:5px;"><b style="color:var(--cyan-magic);">Efecto:</b> ${efe}</div>`;
        if (over)  dHtml += `<div style="color:#ddd; margin-bottom:5px;"><b style="color:var(--gold);">🌟 Overcast:</b> ${over}</div>`;
        if (under) dHtml += `<div style="color:#ddd; margin-bottom:5px;"><b style="color:#ff4444;">⚠️ Undercast:</b> ${under}</div>`;
        if (esp)   dHtml += `<div style="color:#ddd; margin-bottom:2px;"><b style="color:#00ff88;">✨ Especial:</b> ${esp}</div>`;
        dHtml += `</div>`;
    }
    return dHtml;
}

window.devSpellInputHelper = (row, val, pj) => {
    window.devModFilaCast(row, 'nombre', val, pj);

    const detailsDiv = document.getElementById(`dev-spell-details-${row}`);
    if (!detailsDiv) return;

    const dbSpell = hzState.catalogoDB.find(h =>
        norm(h.Nombre || h.nombre || '') === norm(val) ||
        norm(h.ID || h.id || '') === norm(val)
    );

    detailsDiv.innerHTML = getSpellDetailsHTML(dbSpell);
};

window.devOnGridKeydown = (e, row, col, pjSeleccionado) => {
    const num = hzState.casteoManual.numFilas;

    if (e.key === 'Tab' && col === 1) {
        const input = document.getElementById(`dev-spell-${row}`);
        const val = input.value.toLowerCase();
        
        if (val) {
            const pjKey = norm(pjSeleccionado);
            const baseIds = hzState.inventariosDB[pjKey] || [];
            const cola = hzState.colaAsignaciones[pjKey] || {};
            const hechizosDelPj = new Set(baseIds.map(norm));
            Object.entries(cola).forEach(([id, agregar]) => {
                if (agregar) hechizosDelPj.add(norm(id));
                else hechizosDelPj.delete(norm(id));
            });
            
            const dMode = hzState.casteoManual.datalistModo;
            const opciones = dMode === 'local'
                ? hzState.catalogoDB.filter(h => hechizosDelPj.has(norm(h.ID || h.id)) || hechizosDelPj.has(norm(h.Nombre || h.nombre)))
                : hzState.catalogoDB;
                
            const invNombres = opciones.map(h => h.Nombre || h.nombre || h.ID || h.id).sort((a, b) => a.localeCompare(b));
            const match = invNombres.find(h => h.toLowerCase().includes(val));
            
            if (match && match.toLowerCase() !== val) {
                e.preventDefault();
                input.value = match;
                window.devSpellInputHelper(row, match, pjSeleccionado); 
                
                const nextSpellInput = document.getElementById(`dev-spell-${row + 1}`);
                if (nextSpellInput) {
                    nextSpellInput.focus();
                } else {
                    document.getElementById(`dev-afinidad-${row}`)?.focus();
                }
                return;
            }
        }
    }

    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (row === 0) {
            document.getElementById('dev-cast-num')?.focus();
        } else {
            const mapCol = { 0: 'dev-dado', 1: 'dev-spell', 2: 'dev-afinidad', 3: 'dev-cant' };
            document.getElementById(`${mapCol[col]}-${row - 1}`)?.focus();
        }
    }
    else if (e.key === 'ArrowDown') {
        e.preventDefault();
        let nextRow = Math.min(num - 1, row + 1);
        const mapCol = { 0: 'dev-dado', 1: 'dev-spell', 2: 'dev-afinidad', 3: 'dev-cant' };
        document.getElementById(`${mapCol[col]}-${nextRow}`)?.focus();
    }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const target = e.target;
        let shouldMove = false;
        if (target.type === 'number') {
            shouldMove = true;
        } else if (target.type === 'text') {
            if (e.key === 'ArrowLeft' && target.selectionStart === 0) shouldMove = true;
            if (e.key === 'ArrowRight' && target.selectionEnd === target.value.length) shouldMove = true;
        }
        if (shouldMove) {
            e.preventDefault();
            const mapCol = { 0: 'dev-dado', 1: 'dev-spell', 2: 'dev-afinidad', 3: 'dev-cant' };
            let nextCol = e.key === 'ArrowLeft' ? Math.max(0, col - 1) : Math.min(3, col + 1);
            document.getElementById(`${mapCol[nextCol]}-${row}`)?.focus();
        }
    }
};

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
                try { newEl.setSelectionRange(start, end); } catch (e) { }
            }
        }
    }
}

function getColorAfinidad(af) {
    if (af === 'Física')     return { b: '#b36a2f', t: '#e2a673' };
    if (af === 'Energética') return { b: '#bba71b', t: '#f3e57a' };
    if (af === 'Espiritual') return { b: '#2ba85e', t: '#7df0a7' };
    if (af === 'Mando')      return { b: '#3a87b3', t: '#6eb8e6' };
    if (af === 'Psíquica')   return { b: '#6b3ab3', t: '#a26ee6' };
    if (af === 'Oscura')     return { b: '#b32d43', t: '#ff526f' };
    return { b: '#555', t: '#aaa' };
}

function generarTarjetaAsignar(hechizo, pjNombre, loTiene) {
    const hId = hechizo.ID || hechizo.id;
    const hNom = hechizo.Nombre || hechizo.nombre || 'Hechizo sin nombre';
    const hAf = hechizo.Afinidad || hechizo.afinidad || '-';
    const hClase = hechizo.Clase || hechizo.clase || '-';
    const costo = parseInt(hechizo.HEX || hechizo.Hex || hechizo.costo || hechizo.Costo || 0) || 0;
    
    const efecto = getValKeys(hechizo, ['efecto_desc', 'efecto', 'desc', 'descripcion']) || '-';

    let isPublicBase;
    if (hechizo.es_conocido !== undefined && hechizo.es_conocido !== null) {
        isPublicBase = hechizo.es_conocido !== false && hechizo.es_conocido !== "FALSE"
                    && hechizo.es_conocido !== 0    && hechizo.es_conocido !== "0";
    } else if (hechizo.Conocido !== undefined && hechizo.Conocido !== null) {
        isPublicBase = hechizo.Conocido.toString().trim().toLowerCase() === 'si';
    } else {
        isPublicBase = true;
    }
    const isKnown = hzState.colaVisibilidad[hId] !== undefined ? hzState.colaVisibilidad[hId] : isPublicBase;
    const isHidden = !isKnown;

    const col = getColorAfinidad(hAf);
    const borderColor = isHidden ? '#333' : col.b;
    const titleColor  = isHidden ? '#666' : col.t;

    const cardStyle = loTiene
        ? `border: 1px solid #003300; border-top: 3px solid ${borderColor}; box-shadow: inset 0 0 15px rgba(0,255,0,0.08);`
        : `border: 1px solid #222; border-top: 3px solid ${borderColor};`;

    const safePN  = pjNombre.replace(/'/g, "\\'");
    const costoMitad  = Math.round(costo * 0.5);
    const costoDoble  = costo * 2;

    const btnAsignar = loTiene
        ? `<button onclick="window.devAsignarHz('${safePN}', '${hId}')" style="width:100%; background:rgba(255,0,0,0.1); color:#ff5555; border:1px solid rgba(255,0,0,0.3); border-radius:4px; padding:6px; cursor:pointer; font-weight:bold; font-family:'Cinzel'; transition:0.2s;">❌ DEASIGNAR</button>`
        : `<div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button onclick="window.devAsignarHz('${safePN}', '${hId}')"
                style="flex:1;min-width:100px;background:rgba(0,255,0,0.05);color:#44ff44;border:1px solid rgba(0,255,0,0.3);border-radius:4px;padding:6px;cursor:pointer;font-weight:bold;font-family:'Cinzel';font-size:0.82em;transition:0.2s;">
                ✅ ENSEÑAR
            </button>
            ${costo > 0 ? `
            <button onclick="window.devAsignarHzCosto('${safePN}', '${hId}', ${costoMitad})"
                style="flex:1;min-width:100px;background:rgba(0,120,200,0.1);color:#66aaff;border:1px solid rgba(0,120,200,0.4);border-radius:4px;padding:6px;cursor:pointer;font-weight:bold;font-family:'Cinzel';font-size:0.82em;transition:0.2s;">
                🔵 −${costoMitad} HEX
            </button>
            <button onclick="window.devAsignarHzCosto('${safePN}', '${hId}', ${costo})"
                style="flex:1;min-width:100px;background:rgba(180,140,0,0.1);color:#d4af37;border:1px solid rgba(180,140,0,0.4);border-radius:4px;padding:6px;cursor:pointer;font-weight:bold;font-family:'Cinzel';font-size:0.82em;transition:0.2s;">
                💰 −${costo} HEX
            </button>
            <button onclick="window.devAsignarHzCosto('${safePN}', '${hId}', ${costoDoble})"
                style="flex:1;min-width:100px;background:rgba(200,60,0,0.1);color:#ff8844;border:1px solid rgba(200,60,0,0.4);border-radius:4px;padding:6px;cursor:pointer;font-weight:bold;font-family:'Cinzel';font-size:0.82em;transition:0.2s;">
                🔴 −${costoDoble} HEX
            </button>` : ''}
           </div>`;

    const btnVisibilidad = `<button onclick="window.devToggleVisibilidadHz('${hId}')" style="background:#111; color:#aaa; border:1px solid #555; border-radius:4px; padding:6px; cursor:pointer; font-size:0.8em; white-space:nowrap;">${isKnown ? '👁️ Ocultar Globalmente' : '🙈 Hacer Público'}</button>`;

    return `
    <div style="background:#0a0a0a; ${cardStyle} border-radius:8px; padding:10px; margin-bottom:10px; display:flex; flex-direction:column; gap:8px; opacity: ${isHidden ? '0.7' : '1'}; transition:0.3s;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
                <h3 style="color:${titleColor}; margin:0 0 6px 0; font-family:'Cinzel', serif;">${hNom}</h3>
                <div style="display:flex; gap:6px; font-size:0.75em; font-weight:bold; font-family:'Rajdhani', sans-serif;">
                    <span style="background:#111; color:#aaa; border:1px solid #444; padding:2px 8px; border-radius:12px;">HEX: ${costo}</span>
                    <span style="background:#111; color:${col.t}; border:1px solid ${col.b}; padding:2px 8px; border-radius:12px;">${hAf}</span>
                    <span style="background:#111; color:#888; border:1px solid #333; padding:2px 8px; border-radius:12px;">${hClase}</span>
                </div>
            </div>
            ${btnVisibilidad}
        </div>
        <div style="color:#bbb; font-size:0.85em; font-style:italic; padding:8px; background:#000; border-left:2px solid ${borderColor}; border-radius:4px;">
            ${efecto}
        </div>
        ${btnAsignar}
    </div>`;
}

// ── RENDER PRINCIPAL ──────────────────────────────────────────────────────────
export function renderColumnaHechizos(pjSeleccionado) {
    const contenedor = 'content-spells';
    if (!document.getElementById(contenedor)) return;

    if (!pjSeleccionado) {
        drawnHEXPreserveFocus(contenedor, `<div style="text-align:center; color:#666; margin-top:50px; font-style:italic;">Selecciona un personaje para gestionar sus Hechizos.</div>`);
        return;
    }

    const v = hzState.vistaActiva;
    const pjKey = norm(pjSeleccionado);

    const baseIds = hzState.inventariosDB[pjKey] || [];
    const cola = hzState.colaAsignaciones[pjKey] || {};
    const hechizosDelPj = new Set(baseIds.map(norm));
    Object.entries(cola).forEach(([id, agregar]) => {
        if (agregar) hechizosDelPj.add(norm(id));
        else hechizosDelPj.delete(norm(id));
    });

    let html = `
        <div style="display:flex; gap:5px; margin-bottom:15px; border-bottom: 1px solid #333; padding-bottom:10px;">
            <button onclick="window.devSetVistaHz('castear')" style="flex:1; padding:8px; border-radius:4px; border:1px solid #444; background:${v === 'castear' ? 'linear-gradient(135deg, #1a365d, #4a90e2)' : '#111'}; color:${v === 'castear' ? '#fff' : '#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">⚡ CASTEAR</button>
            <button onclick="window.devSetVistaHz('asignar')" style="flex:1; padding:8px; border-radius:4px; border:1px solid #444; background:${v === 'asignar' ? 'linear-gradient(135deg, #004a00, #00b300)' : '#111'}; color:${v === 'asignar' ? '#fff' : '#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">➕ GESTIÓN BD</button>
        </div>
    `;

    if (v === 'castear') {
        const dMode = hzState.casteoManual.datalistModo;
        const escapedPj = pjSeleccionado.replace(/'/g, "\\'");

        const fuenteDatalist = dMode === 'local' 
            ? hzState.catalogoDB.filter(h => hechizosDelPj.has(norm(h.ID || h.id)) || hechizosDelPj.has(norm(h.Nombre || h.nombre)))
            : hzState.catalogoDB;

        let datalistOptions = '';
        const nombresUnicos = new Set();
        fuenteDatalist.forEach(h => {
            const n = h.Nombre || h.nombre || h.ID || h.id;
            if (n) nombresUnicos.add(n);
        });
        nombresUnicos.forEach(n => {
            datalistOptions += `<option value="${n.replace(/"/g, '&quot;')}">`;
        });

        html += `<datalist id="dev-spells-list-${pjKey}">${datalistOptions}</datalist>`;

        // ── Panel de controles globales ───────────────────────────────────────
        html += `
        <div style="background:#1a0f00; border:1px solid var(--gold); border-radius:6px; padding:10px; margin-bottom:15px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <label style="color:var(--gold); font-weight:bold; font-size:0.9em;">
                    FILAS:&nbsp;
                    <input type="number" id="dev-cast-num" value="${hzState.casteoManual.numFilas}" min="1" max="50"
                        onchange="window.devSetNumFilasCast(this.value)"
                        onkeydown="if(event.key==='ArrowDown'){event.preventDefault();document.getElementById('dev-spell-0')?.focus();}"
                        style="width:50px; background:#000; color:#fff; border:1px solid var(--gold); border-radius:4px; padding:4px; text-align:center; font-weight:bold; outline:none;">
                </label>
                <div style="display:flex; gap:5px;">
                    <button onclick="window.devCopiarPrimerHechizo()" style="background:#333; color:#fff; border:1px solid #555; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:0.8em;">📋 1er Hechizo</button>
                    <button onclick="window.devCopiarPrimerDado()"    style="background:#333; color:#fff; border:1px solid #555; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:0.8em;">📋 1er Dado</button>
                </div>
            </div>
            <div style="display:flex; justify-content:center; gap:10px;">
                <button onclick="window.devToggleConfigHz('cobrarAuto', !${hzState.cobrarAuto}); window.dispatchEvent(new Event('devUIUpdate'));"
                    title="Si está activo, todas las filas cobran por defecto. Puedes desactivarlo individualmente por fila."
                    style="padding:7px 14px; border-radius:6px; cursor:pointer; font-weight:bold; font-family:'Rajdhani'; font-size:0.9em; border:2px solid ${hzState.cobrarAuto ? '#d4af37' : '#444'}; background:${hzState.cobrarAuto ? 'rgba(212,175,55,0.15)' : '#111'}; color:${hzState.cobrarAuto ? '#d4af37' : '#666'}; transition:0.2s;">
                    ${hzState.cobrarAuto ? '✅' : '☐'} Cobrar Hex
                </button>
                <button onclick="window.devToggleConfigHz('mostrarEfectos', !${hzState.mostrarEfectos}); window.dispatchEvent(new Event('devUIUpdate'));"
                    style="padding:7px 14px; border-radius:6px; cursor:pointer; font-weight:bold; font-family:'Rajdhani'; font-size:0.9em; border:2px solid ${hzState.mostrarEfectos ? '#00e5ff' : '#444'}; background:${hzState.mostrarEfectos ? 'rgba(0,229,255,0.1)' : '#111'}; color:${hzState.mostrarEfectos ? '#00e5ff' : '#666'}; transition:0.2s;">
                    ${hzState.mostrarEfectos ? '✅' : '☐'} Imprimir Efectos
                </button>
            </div>
        </div>

        <div style="display:flex; gap:5px; margin-bottom:15px;">
            <button onclick="window.devSetModoDatalist('local')"  style="flex:1; padding:6px; border-radius:4px; background:${dMode === 'local'  ? 'var(--cyan-magic)' : '#333'}; color:${dMode === 'local'  ? '#000' : '#aaa'}; font-weight:bold; cursor:pointer;">Autocompletar: Grimorio</button>
            <button onclick="window.devSetModoDatalist('global')" style="flex:1; padding:6px; border-radius:4px; background:${dMode === 'global' ? '#9966ff' : '#333'}; color:${dMode === 'global' ? '#fff' : '#aaa'}; font-weight:bold; cursor:pointer;">Autocompletar: DB Global</button>
        </div>

        <div style="overflow-y:auto; padding-right:5px; max-height:450px;">`;

        // ── Filas de hechizos ─────────────────────────────────────────────────
        for (let i = 0; i < hzState.casteoManual.numFilas; i++) {
            const fila = hzState.casteoManual.filas[i];

            // Estado efectivo del cobro para esta fila
            const efectivoCobrar = fila.cobrarHex !== null ? fila.cobrarHex : hzState.cobrarAuto;
            // ¿Tiene override explícito respecto al global?
            const esOverride     = fila.cobrarHex !== null;

            const ajusteCostoVal = parseInt(fila.ajusteCosto) || 0;
            const ajusteColor    = ajusteCostoVal > 0 ? '#ff8888' : ajusteCostoVal < 0 ? '#88ff88' : '#777';
            const ajusteBorder   = ajusteCostoVal !== 0 ? (ajusteCostoVal > 0 ? '#aa3333' : '#338833') : '#2a2a2a';

            let detallesHTML = '';
            if (fila.nombre) {
                const dbSpell = hzState.catalogoDB.find(h =>
                    norm(h.Nombre || h.nombre || '') === norm(fila.nombre) ||
                    norm(h.ID || h.id || '') === norm(fila.nombre)
                );
                detallesHTML = getSpellDetailsHTML(dbSpell);
            }

            html += `
            <div style="margin-bottom:14px; border:1px solid #1e1e1e; border-radius:6px; padding:8px 10px; background:#080810;">

                <!-- Fila principal: dados + nombre + afinidad + cant -->
                <div style="display:flex; gap:5px; align-items:center;">
                    <button onclick="const d=Math.floor(Math.random()*100)+1; document.getElementById('dev-dado-${i}').value=d; window.devModFilaCast(${i},'dado',d,'${escapedPj}')"
                        style="background:#333; color:#fff; border:1px solid #555; border-radius:4px; padding:8px; cursor:pointer; flex-shrink:0;" title="Tirar dado aleatorio">🎲</button>

                    <input type="number" id="dev-dado-${i}" placeholder="Dado" value="${fila.dado}"
                        oninput="window.devModFilaCast(${i},'dado',this.value,'${escapedPj}')"
                        onkeydown="window.devOnGridKeydown(event,${i},0,'${escapedPj}')"
                        style="width:55px; background:#111; color:#fff; border:1px solid #555; border-radius:4px; padding:8px; text-align:center; outline:none; flex-shrink:0;" title="NC Base (Dado)">

                    <div style="position:relative; flex:1;">
                        <input type="text" list="dev-spells-list-${pjKey}" id="dev-spell-${i}" placeholder="Nombre Hechizo..." value="${fila.nombre}"
                            autocomplete="off"
                            oninput="window.devSpellInputHelper(${i},this.value,'${escapedPj}')"
                            onkeydown="window.devOnGridKeydown(event,${i},1,'${escapedPj}')"
                            style="width:100%; box-sizing:border-box; background:#111; color:#fff; border:1px solid #555; border-radius:4px; padding:8px; outline:none;">
                    </div>

                    <input type="number" id="dev-afinidad-${i}" placeholder="Af." value="${fila.afinidad}"
                        oninput="window.devModFilaCast(${i},'afinidad',this.value,'${escapedPj}')"
                        onkeydown="window.devOnGridKeydown(event,${i},2,'${escapedPj}')"
                        style="width:58px; background:#111; color:var(--gold); border:1px solid var(--gold); border-radius:4px; padding:8px; text-align:center; outline:none; flex-shrink:0;" title="Afinidad Total">

                    <input type="number" id="dev-cant-${i}" placeholder="x" value="${fila.cant}" min="1"
                        oninput="window.devModFilaCast(${i},'cant',this.value,'${escapedPj}')"
                        onkeydown="window.devOnGridKeydown(event,${i},3,'${escapedPj}')"
                        style="width:40px; background:#111; color:#fff; border:1px solid #555; border-radius:4px; padding:8px; text-align:center; outline:none; flex-shrink:0;" title="Cantidad">
                </div>

                <!-- Sub-fila: controles individuales por hechizo -->
                <div style="display:flex; gap:6px; align-items:center; margin-top:6px; padding-top:6px; border-top:1px solid #141414;">

                    <!-- 💰 Cobrar HEX individual -->
                    <button onclick="window.devToggleFilaCobrar(${i})"
                        title="${efectivoCobrar
                            ? (esOverride ? 'Cobro ON (override manual — clic para desactivar)' : 'Cobro ON (sigue global — clic para desactivar solo este)')
                            : (esOverride ? 'Cobro OFF (override manual — clic para activar)'   : 'Cobro OFF (sigue global — clic para activar solo este)')}"
                        style="padding:3px 9px; border-radius:4px; cursor:pointer; font-size:0.78em; font-weight:bold; font-family:'Rajdhani'; white-space:nowrap;
                               border:1px solid ${efectivoCobrar ? (esOverride ? '#ffcc00' : '#a07800') : (esOverride ? '#555' : '#252525')};
                               background:${efectivoCobrar ? (esOverride ? 'rgba(255,204,0,0.18)' : 'rgba(180,130,0,0.1)') : '#0d0d0d'};
                               color:${efectivoCobrar ? (esOverride ? '#ffcc00' : '#c49a00') : (esOverride ? '#555' : '#3a3a3a')};
                               transition:0.15s;">
                        ${efectivoCobrar ? '💰' : '⬜'} HEX${esOverride ? '*' : ''}
                    </button>

                    <!-- 🎯 Infalible (No falla) -->
                    <button onclick="window.devToggleFilaNoFalla(${i})"
                        title="${fila.noFalla ? 'Infalible ACTIVO — ignora NC, siempre éxito (sin overcast). Clic para desactivar.' : 'Activar Infalible — ignora NC completamente, siempre éxito.'}"
                        style="padding:3px 9px; border-radius:4px; cursor:pointer; font-size:0.78em; font-weight:bold; font-family:'Rajdhani'; white-space:nowrap;
                               border:1px solid ${fila.noFalla ? '#00aacc' : '#252525'};
                               background:${fila.noFalla ? 'rgba(0,180,220,0.12)' : '#0d0d0d'};
                               color:${fila.noFalla ? '#00ccee' : '#3a3a3a'};
                               transition:0.15s;">
                        ${fila.noFalla ? '🎯' : '⬜'} Infalible
                    </button>

                    <!-- 🛡️ Contrarrestado -->
                    <button onclick="window.devToggleFilaContrarrestada(${i})"
                        title="${fila.contrarrestado ? 'Contrarrestado ACTIVO — el hechizo falla sin gastar recursos. Clic para desactivar.' : 'Marcar como Contrarrestado — fallo forzado sin consumir Hex.'}"
                        style="padding:3px 9px; border-radius:4px; cursor:pointer; font-size:0.78em; font-weight:bold; font-family:'Rajdhani'; white-space:nowrap;
                               border:1px solid ${fila.contrarrestado ? '#cc4400' : '#252525'};
                               background:${fila.contrarrestado ? 'rgba(220,80,0,0.12)' : '#0d0d0d'};
                               color:${fila.contrarrestado ? '#ff6622' : '#3a3a3a'};
                               transition:0.15s;">
                        ${fila.contrarrestado ? '🛡️' : '⬜'} Contrarrestado
                    </button>

                    <!-- ±HEX: Sobrecosto / Descuento -->
                    <div style="display:flex; align-items:center; gap:4px; margin-left:auto;">
                        <span style="color:#444; font-size:0.72em; white-space:nowrap; font-family:'Rajdhani';">±HEX</span>
                        <input type="number" id="dev-ajuste-${i}"
                            value="${ajusteCostoVal || ''}" placeholder="0"
                            oninput="window.devModFilaCast(${i},'ajusteCosto',this.value,'${escapedPj}'); const v=parseInt(this.value)||0; this.style.color=v>0?'#ff8888':v<0?'#88ff88':'#777'; this.style.borderColor=v>0?'#aa3333':v<0?'#338833':'#2a2a2a';"
                            style="width:60px; background:#0d0d0d; color:${ajusteColor}; border:1px solid ${ajusteBorder}; border-radius:4px; padding:3px 5px; text-align:center; outline:none; font-size:0.82em;"
                            title="Ajuste de costo HEX: positivo = sobrecosto, negativo = descuento">
                    </div>
                </div>

                <!-- Detalles del hechizo (efecto, overcast, etc.) -->
                <div id="dev-spell-details-${i}">${detallesHTML}</div>
            </div>`;
        }

        html += `
        </div>
        <button onclick="window.devCalcularConjuros('${escapedPj}')"
            style="width:100%; margin-top:15px; background:linear-gradient(135deg,#4a004a,#800080); color:white; font-size:1.1em; font-weight:bold; font-family:'Cinzel'; padding:12px; border:1px solid #ff00ff; border-radius:6px; cursor:pointer; text-shadow:0 0 5px #ff00ff; transition:0.2s;"
            onmouseover="this.style.filter='brightness(1.2)'" onmouseout="this.style.filter='brightness(1)'">
            ⚡ CALCULAR CONJUROS ⚡
        </button>`;

    } else {
        // ── Vista GESTIÓN BD ──────────────────────────────────────────────────
        html += `
        <div style="margin-bottom:15px;">
            <button onclick="window.devToggleConfigHz('cobrarAlAsignar', !${hzState.cobrarAlAsignar}); window.dispatchEvent(new Event('devUIUpdate'));"
                style="width:100%; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold; font-family:'Cinzel'; font-size:0.9em; border:2px solid ${hzState.cobrarAlAsignar ? '#00ff00' : '#444'}; background:${hzState.cobrarAlAsignar ? 'rgba(0,255,0,0.08)' : '#111'}; color:${hzState.cobrarAlAsignar ? '#00ff00' : '#666'}; transition:0.2s;">
                ${hzState.cobrarAlAsignar ? '✅' : '☐'} Cobrar HEX automáticamente al Enseñar
            </button>
        </div>

        <input type="text" id="dev-search-hz-asig" placeholder="🔍 Buscar nombre, ID, afinidad o clase..." value="${hzState.busquedaAsignar}"
            oninput="window.devBusquedaHz(this.value)"
            style="width:100%; box-sizing:border-box; background:#000; color:#00ff00; border:1px solid #00ff00; padding:10px; border-radius:6px; margin-bottom:15px; font-family:'Rajdhani'; outline:none;">`;

        let mostrar = hzState.catalogoDB;
        if (hzState.busquedaAsignar) {
            const bx = norm(hzState.busquedaAsignar);
            mostrar = mostrar.filter(h =>
                norm(h.Nombre || h.nombre || '').includes(bx) ||
                norm(h.Afinidad || h.afinidad || '').includes(bx) ||
                norm(h.ID || h.id || '').includes(bx) ||
                norm(h.Clase || h.clase || '').includes(bx)
            );
        }

        html += `<div style="overflow-y:auto; padding-right:5px; max-height:550px;">`;
        const top = mostrar.slice(0, 50);
        top.forEach(h => {
            const loTiene = hechizosDelPj.has(norm(h.ID || h.id)) || hechizosDelPj.has(norm(h.Nombre || h.nombre));
            html += generarTarjetaAsignar(h, pjSeleccionado, loTiene);
        });
        if (mostrar.length > 50) html += `<div style="text-align:center; color:#666; font-size:0.8em; padding:5px;">Mostrando los primeros 50 resultados.</div>`;
        html += `</div>`;
    }

    drawnHEXPreserveFocus(contenedor, html);
}
