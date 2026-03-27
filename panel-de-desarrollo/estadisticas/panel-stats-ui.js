// ============================================================
// panel-stats-ui.js — Renderizado de la Columna de Estadísticas
// ============================================================

import { stState, AFINIDADES_LISTA } from './panel-stats-state.js';
import { getPjStat, modPjStat, darAsistencia, limpiarLogAsistencia, recalcularCorazones, toggleEstado, setVistaStats, guardarNuevoEstado, cargarEstadoParaEditar, borrarEstadoGlobal } from './panel-stats-logic.js';

window.devModStat = modPjStat;
window.devDarAsis = darAsistencia;
window.devLimpAsis = limpiarLogAsistencia;
window.devRecalcularVida = recalcularCorazones;
window.devToggleEstado = toggleEstado;
window.devSetVistaStats = setVistaStats;
window.devGuardarEstadoConfig = guardarNuevoEstado;
window.devEditarEstadoGlobal = cargarEstadoParaEditar;
window.devBorrarEstadoGlobal = borrarEstadoGlobal;

function drawnHEXPreserveFocus(containerId, html) {
    const activeEl = document.activeElement;
    const activeId = activeEl ? activeEl.id : null;
    const start = activeEl && activeEl.selectionStart !== undefined ? activeEl.selectionStart : null;
    const end = activeEl && activeEl.selectionEnd !== undefined ? activeEl.selectionEnd : null;
    
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = html;
        if (activeId) {
            const newEl = document.getElementById(activeId);
            if (newEl) {
                newEl.focus();
                if (start !== null && newEl.setSelectionRange) newEl.setSelectionRange(start, end);
            }
        }
    }
}

function genStatRow(pj, label, campoRaiz, subCampo, color = 'var(--gold)', esAfinidad = false) {
    const val = getPjStat(pj, campoRaiz, subCampo);
    const modified = (subCampo) 
        ? (stState.colaStats[pj] && stState.colaStats[pj][`${campoRaiz}.${subCampo}`] !== undefined)
        : (stState.colaStats[pj] && stState.colaStats[pj][campoRaiz] !== undefined);
        
    const bgGlow = modified ? `box-shadow: inset 0 0 15px ${color}44; border-color:${color};` : 'border-color:#333;';

    let botonesHTML = '';
    if (esAfinidad) {
        botonesHTML = `
            <div style="display:flex; gap:2px;">
                <button onclick="window.devModStat('${pj}','${campoRaiz}','${subCampo}',-10, true)" style="background:#4a0000; color:#fff; border:none; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.7em;">-10</button>
                <button onclick="window.devModStat('${pj}','${campoRaiz}','${subCampo}',-5, true)" style="background:#660000; color:#fff; border:none; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.7em;">-5</button>
                <button onclick="window.devModStat('${pj}','${campoRaiz}','${subCampo}',-1, true)" style="background:#a00000; color:#fff; border:none; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.7em;">-1</button>
            </div>
            <div style="display:flex; gap:2px;">
                <button onclick="window.devModStat('${pj}','${campoRaiz}','${subCampo}',1, true)" style="background:#006600; color:#fff; border:none; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.7em;">+1</button>
                <button onclick="window.devModStat('${pj}','${campoRaiz}','${subCampo}',5, true)" style="background:#00a000; color:#fff; border:none; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.7em;">+5</button>
                <button onclick="window.devModStat('${pj}','${campoRaiz}','${subCampo}',10, true)" style="background:#00cc00; color:#fff; border:none; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.7em;">+10</button>
            </div>`;
    } else {
        botonesHTML = `
            <div style="display:flex; gap:2px;">
                <button onclick="window.devModStat('${pj}','${campoRaiz}','${subCampo}',-5)" style="background:#660000; color:#fff; border:none; padding:4px 8px; cursor:pointer; font-weight:bold; font-size:0.8em;">-5</button>
                <button onclick="window.devModStat('${pj}','${campoRaiz}','${subCampo}',-1)" style="background:#a00000; color:#fff; border:none; padding:4px 8px; cursor:pointer; font-weight:bold; font-size:0.8em;">-1</button>
            </div>
            <div style="display:flex; gap:2px;">
                <button onclick="window.devModStat('${pj}','${campoRaiz}','${subCampo}',1)" style="background:#006600; color:#fff; border:none; padding:4px 8px; cursor:pointer; font-weight:bold; font-size:0.8em;">+1</button>
                <button onclick="window.devModStat('${pj}','${campoRaiz}','${subCampo}',5)" style="background:#00a000; color:#fff; border:none; padding:4px 8px; cursor:pointer; font-weight:bold; font-size:0.8em;">+5</button>
            </div>`;
    }

    return `
    <div style="background:#050505; border:1px solid; ${bgGlow} border-radius:6px; padding:8px; display:flex; justify-content:space-between; align-items:center;">
        <div style="color:#aaa; font-size:0.85em; font-weight:bold;">${label}</div>
        <div style="color:${color}; font-size:1.4em; font-weight:bold; font-family:'Cinzel';">${val}</div>
        <div style="display:flex; flex-direction:column; gap:4px;">${botonesHTML}</div>
    </div>`;
}

function genStatRowReadOnly(pj, label, campoRaiz, subCampo, color = 'var(--gold)') {
    const val = getPjStat(pj, campoRaiz, subCampo);
    return `
    <div style="background:#050505; border:1px solid #333; border-radius:6px; padding:8px; display:flex; justify-content:space-between; align-items:center; opacity:0.8;">
        <div style="color:#aaa; font-size:0.85em; font-weight:bold;">${label}</div>
        <div style="color:${color}; font-size:1.4em; font-weight:bold; font-family:'Cinzel';">${val}</div>
        <div style="color:#666; font-size:0.7em; font-style:italic; padding-right:10px;">(Solo lectura)</div>
    </div>`;
}

export function renderColumnaStats(pjSeleccionado) {
    const contenedor = 'content-stats';
    if (!document.getElementById(contenedor)) return;

    if (!pjSeleccionado) {
        drawnHEXPreserveFocus(contenedor, `<div style="text-align:center; color:#666; margin-top:50px; font-style:italic;">Selecciona un personaje para editar sus estadísticas.</div>`);
        return;
    }

    const v = stState.vistaActiva;
    const sPj = pjSeleccionado.replace(/'/g, "\\'"); 

    let html = `
        <div style="display:flex; gap:5px; margin-bottom:15px; flex-wrap:wrap;">
            <button onclick="window.devSetVistaStats('hex')" style="flex:1; padding:6px; border-radius:4px; border:1px solid #444; background:${v==='hex'?'var(--gold)':'#111'}; color:${v==='hex'?'#000':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">🪙 HEX</button>
            <button onclick="window.devSetVistaStats('vida')" style="flex:1; padding:6px; border-radius:4px; border:1px solid #444; background:${v==='vida'?'var(--red-life)':'#111'}; color:${v==='vida'?'#fff':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">❤️ Vida</button>
            <button onclick="window.devSetVistaStats('afinidades')" style="flex:1; padding:6px; border-radius:4px; border:1px solid #444; background:${v==='afinidades'?'var(--cyan-magic)':'#111'}; color:${v==='afinidades'?'#000':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">✨ Afin</button>
            <button onclick="window.devSetVistaStats('estados')" style="flex:1; padding:6px; border-radius:4px; border:1px solid #444; background:${v==='estados'?'#9966ff':'#111'}; color:${v==='estados'?'#fff':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">☠️ Est</button>
        </div>
    `;

    if (v === 'hex') {
        const hVal = getPjStat(pjSeleccionado, 'hex');
        const aVal = getPjStat(pjSeleccionado, 'asistencia');
        const vVal = getPjStat(pjSeleccionado, 'vex'); // VEX en lectura
        
        html += `
        <div style="background:#1a1a00; border:1px solid var(--gold); border-radius:8px; padding:15px; text-align:center; margin-bottom:20px;">
            <h3 style="margin:0 0 10px 0; color:var(--gold); font-family:'Cinzel';">HEX ACTUAL</h3>
            <div onclick="navigator.clipboard.writeText('Hex: ${hVal}'); alert('¡Hex Copiado!');" style="font-size:2.5em; color:#fff; font-weight:bold; margin-bottom:15px; cursor:pointer;" title="Click para copiar">${hVal}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div style="display:flex; flex-direction:column; gap:5px;">
                    ${[10, 50, 100, 300, 500, 1000].map(n => `<button onclick="window.devModStat('${sPj}','hex',null,${n})" style="background:#004a00; color:#fff; border:none; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;">+${n}</button>`).join('')}
                </div>
                <div style="display:flex; flex-direction:column; gap:5px;">
                    ${[-10, -50, -100, -300, -500, -1000].map(n => `<button onclick="window.devModStat('${sPj}','hex',null,${n})" style="background:#4a0000; color:#fff; border:none; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;">${n}</button>`).join('')}
                </div>
            </div>
        </div>

        <div style="background:#0a1a2a; border:1px solid var(--blue-life); border-radius:8px; padding:15px; text-align:center; margin-bottom:20px;">
            <h3 style="margin:0 0 10px 0; color:var(--blue-life); font-family:'Cinzel';">ASISTENCIA SEMANAL</h3>
            <div onclick="navigator.clipboard.writeText('Asistencia ${aVal}/7'); alert('¡Asistencia Copiada!');" style="font-size:2em; color:#fff; font-weight:bold; margin-bottom:10px; cursor:pointer;" title="Click para copiar">${aVal} / 7</div>
            <div style="display:flex; gap:10px; justify-content:center; margin-bottom:15px;">
                <button onclick="window.devModStat('${sPj}','asistencia',null,-1)" style="background:#4a0000; color:#fff; border:none; padding:10px 20px; border-radius:4px; font-weight:bold; cursor:pointer;">-1</button>
                <button onclick="window.devModStat('${sPj}','asistencia',null,1)" style="background:#004a00; color:#fff; border:none; padding:10px 20px; border-radius:4px; font-weight:bold; cursor:pointer;">+1</button>
            </div>
            <button onclick="window.devDarAsis('${sPj}')" style="width:100%; background:linear-gradient(135deg, #1a365d, #4a90e2); color:#fff; border:1px solid #00ffff; padding:12px; border-radius:6px; font-weight:bold; font-family:'Cinzel'; font-size:1.1em; cursor:pointer; box-shadow:0 4px 10px rgba(74,144,226,0.3);">⭐ DAR ASISTENCIA (+300 HEX)</button>
        </div>

        <div style="background:#1a0033; border:1px solid #9966ff; border-radius:8px; padding:15px; text-align:center; margin-bottom:20px;">
            <h3 style="margin:0 0 10px 0; color:#9966ff; font-family:'Cinzel';">VEX (Lectura)</h3>
            <div onclick="navigator.clipboard.writeText('Vex: ${vVal}'); alert('¡Vex Copiado!');" style="font-size:2.5em; color:#fff; font-weight:bold; cursor:pointer;" title="Click para copiar">${vVal}</div>
        </div>`;
    }

    else if (v === 'vida') {
        const vAct = getPjStat(pjSeleccionado, 'vidaRojaActual');
        const topeVida = getPjStat(pjSeleccionado, 'baseVidaRojaMax') + getPjStat(pjSeleccionado, 'buffs', 'vidaRojaMaxExtra') + getPjStat(pjSeleccionado, 'hechizos', 'vidaRojaMaxExtra') + getPjStat(pjSeleccionado, 'hechizosEfecto', 'vidaRojaMaxExtra');

        html += `
        <div style="background:#1a0505; border:1px solid var(--red-life); border-radius:8px; padding:15px; margin-bottom:15px;">
            <h3 style="margin:0 0 10px 0; color:var(--red-life); font-family:'Cinzel'; text-align:center;">❤️ CURAR / DAÑAR</h3>
            <div style="text-align:center; font-size:2.5em; color:#fff; font-weight:bold; margin-bottom:10px;">${vAct} <span style="font-size:0.5em; color:#888;">/ ${topeVida}</span></div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div style="display:flex; flex-direction:column; gap:5px;">
                    <button onclick="window.devModStat('${sPj}','vidaRojaActual',null,-1)" style="background:#800000; color:#fff; border:none; padding:10px; border-radius:4px; font-weight:bold; cursor:pointer;">-1 Daño</button>
                    <button onclick="window.devModStat('${sPj}','vidaRojaActual',null,-5)" style="background:#4a0000; color:#fff; border:none; padding:10px; border-radius:4px; font-weight:bold; cursor:pointer;">-5 Daño</button>
                </div>
                <div style="display:flex; flex-direction:column; gap:5px;">
                    <button onclick="window.devModStat('${sPj}','vidaRojaActual',null,1)" style="background:#008000; color:#fff; border:none; padding:10px; border-radius:4px; font-weight:bold; cursor:pointer;">+1 Cura</button>
                    <button onclick="window.devModStat('${sPj}','vidaRojaActual',null,5)" style="background:#004a00; color:#fff; border:none; padding:10px; border-radius:4px; font-weight:bold; cursor:pointer;">+5 Cura</button>
                </div>
            </div>
            <button onclick="window.devRecalcularVida('${sPj}')" style="width:100%; margin-top:15px; background:var(--gold); color:#000; font-weight:bold; font-family:'Cinzel'; padding:12px; border:none; border-radius:6px; cursor:pointer; box-shadow:0 0 10px rgba(212,175,55,0.4);">⚖️ RECALCULAR LÍMITES Y CURAR AL MÁX</button>
        </div>

        <h4 style="color:#aaa; border-bottom:1px solid #333; padding-bottom:5px;">Límites Base</h4>
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:15px;">
            ${genStatRow(pjSeleccionado, 'Límite Rojo', 'baseVidaRojaMax', null, 'var(--red-life)')}
            ${genStatRow(pjSeleccionado, 'C. Azules', 'baseVidaAzul', null, 'var(--blue-life)')}
            ${genStatRow(pjSeleccionado, 'G. Dorada', 'baseGuardaDorada', null, 'var(--gold)')}
        </div>
        <h4 style="color:#aaa; border-bottom:1px solid #333; padding-bottom:5px;">Límites Extra (Buffs Temporales)</h4>
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:15px;">
            ${genStatRow(pjSeleccionado, 'Extra Rojo', 'buffs', 'vidaRojaMaxExtra', '#ff8888')}
            ${genStatRow(pjSeleccionado, 'Extra Azul', 'buffs', 'vidaAzulExtra', '#88ccff')}
            ${genStatRow(pjSeleccionado, 'Extra Dorada', 'buffs', 'guardaDoradaExtra', '#ffea88')}
        </div>
        <h4 style="color:#aaa; border-bottom:1px solid #333; padding-bottom:5px;">Puntos de Daño Base</h4>
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:15px;">
            ${genStatRow(pjSeleccionado, 'Daño Rojo', 'baseDanoRojo', null, 'var(--red-life)')}
            ${genStatRow(pjSeleccionado, 'Daño Azul', 'baseDanoAzul', null, 'var(--blue-life)')}
            ${genStatRow(pjSeleccionado, 'Elim. Dorada', 'baseElimDorada', null, 'var(--gold)')}
        </div>`;
    }

    else if (v === 'afinidades') {
        const sec = (titulo, campoDb, color) => {
            let sHtml = `<h4 style="color:${color}; border-bottom:1px solid ${color}44; padding-bottom:5px; margin-top:20px;">${titulo}</h4><div style="display:flex; flex-direction:column; gap:8px;">`;
            AFINIDADES_LISTA.forEach(af => { sHtml += genStatRow(pjSeleccionado, af.charAt(0).toUpperCase() + af.slice(1), campoDb, af, color, true); });
            sHtml += `</div>`;
            return sHtml;
        };
        const secReadOnly = (titulo, campoDb, color) => {
            let sHtml = `<h4 style="color:${color}; border-bottom:1px solid ${color}44; padding-bottom:5px; margin-top:20px;">${titulo}</h4><div style="display:flex; flex-direction:column; gap:8px;">`;
            AFINIDADES_LISTA.forEach(af => { sHtml += genStatRowReadOnly(pjSeleccionado, af.charAt(0).toUpperCase() + af.slice(1), campoDb, af, color); });
            sHtml += `</div>`;
            return sHtml;
        };

        html += sec('✨ Afinidades PERMANENTES (Base)', 'afinidadesBase', '#ffffff');
        html += secReadOnly('📖 Aportado por Grimorio (Hcz)', 'hechizos', '#ffaa00');
        html += sec('🔮 Alteración por Hechizos (ALT)', 'hechizosEfecto', 'var(--cyan-magic)');
        html += sec('⏳ Extras Temporales (EXT / Buffs)', 'buffs', '#00ff88');
    }

    else if (v === 'estados') {
        html += `<h3 style="color:#9966ff; font-family:'Cinzel'; margin-top:0;">Aplicar al Personaje</h3>
                 <div style="display:flex; flex-direction:column; gap:8px; max-height:300px; overflow-y:auto; padding-right:5px; margin-bottom:20px;">`;
        
        stState.estadosDB.forEach(e => {
            const val = getPjStat(pjSeleccionado, 'estados', e.id);
            const modified = (stState.colaStats[pjSeleccionado] && stState.colaStats[pjSeleccionado][`estados.${e.id}`] !== undefined);
            const bgGlow = modified ? `border-color:${e.border}; box-shadow:inset 0 0 10px ${e.border}55;` : 'border-color:#333;';

            html += `<div style="background:#050505; border:1px solid; ${bgGlow} border-radius:6px; padding:10px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="color:${e.border}; font-weight:bold; font-size:1.1em;">${e.nombre}</div>
                            <div style="color:#888; font-size:0.75em;">${e.desc}</div>
                        </div>`;
            
            if (e.tipo && e.tipo.toLowerCase().includes('num')) {
                html += `
                <div style="display:flex; align-items:center; gap:10px;">
                    <button onclick="window.devModStat('${sPj}','estados','${e.id}',-1)" style="background:#4a0000; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">-</button>
                    <b style="font-size:1.5em; color:#fff; width:20px; text-align:center;">${val}</b>
                    <button onclick="window.devModStat('${sPj}','estados','${e.id}',1)" style="background:#004a00; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">+</button>
                </div>`;
            } else {
                html += `
                <button onclick="window.devToggleEstado('${sPj}','${e.id}')" style="background:${val ? e.bg : '#222'}; color:${val ? '#fff' : '#aaa'}; border:2px solid ${val ? e.border : '#444'}; padding:8px 15px; border-radius:6px; font-weight:bold; cursor:pointer; transition:0.2s;">
                    ${val ? 'ACTIVO' : 'INACTIVO'}
                </button>`;
            }
            html += `</div>`;
        });
        html += `</div>`;

        html += `
        <div style="border-top:2px dashed #444; padding-top:20px;">
            <h3 style="color:#ffaa00; font-family:'Cinzel'; margin:0 0 10px 0;">🌍 Gestión de Estados Globales</h3>
            
            <div style="display:flex; flex-direction:column; gap:5px; max-height:150px; overflow-y:auto; margin-bottom: 15px; padding-right:5px;">`;
            stState.estadosDB.forEach(e => {
                html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:6px 10px; border:1px solid #333; border-radius:4px;">
                    <span style="color:${e.border}; font-weight:bold; font-size:0.9em;">${e.nombre}</span>
                    <div style="display:flex; gap:5px;">
                        <button onclick="window.devEditarEstadoGlobal('${e.id}')" style="background:#004a4a; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8em;">✏️ EDITAR</button>
                        <button onclick="window.devBorrarEstadoGlobal('${e.id}')" style="background:#4a0000; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8em;">🗑️ BORRAR</button>
                    </div>
                </div>`;
            });
        html += `</div>

            <div style="background:#1a0f00; border:1px solid #ff9900; border-radius:8px; padding:15px;">
                <input type="text" id="ne-nom" placeholder="Nombre Visible (ej: Veneno Fuerte)" style="width:100%; box-sizing:border-box; background:#000; color:#ffaa00; border:1px solid #ffaa00; padding:8px; border-radius:4px; font-weight:bold; margin-bottom:10px; outline:none;">
                
                <div style="color:#888; font-size:0.7em; margin-bottom:2px;">Tipo de Efecto</div>
                <select id="ne-tipo" style="width:100%; background:#000; color:#fff; border:1px solid #444; padding:8px; border-radius:4px; margin-bottom:10px; outline:none;">
                    <option value="booleano">Booleano (Activo/Inactivo)</option>
                    <option value="numero">Numérico (Acumulable 1,2,3...)</option>
                </select>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                    <div>
                        <div style="color:#888; font-size:0.7em; margin-bottom:2px;">Color Borde</div>
                        <input type="color" id="ne-b" value="#ff4444" style="width:100%; height:40px; border:1px solid #444; border-radius:4px; cursor:pointer;">
                    </div>
                    <div>
                        <div style="color:#888; font-size:0.7em; margin-bottom:2px;">Color Fondo</div>
                        <input type="color" id="ne-bg" value="#800000" style="width:100%; height:40px; border:1px solid #444; border-radius:4px; cursor:pointer;">
                    </div>
                </div>

                <div style="color:#888; font-size:0.7em; margin-bottom:2px;">Descripción del Efecto</div>
                <textarea id="ne-desc" rows="2" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:8px; border-radius:4px; resize:vertical; margin-bottom:15px; outline:none;"></textarea>

                <button onclick="window.devGuardarEstadoConfig(
                    document.getElementById('ne-nom').value,
                    document.getElementById('ne-tipo').value,
                    document.getElementById('ne-bg').value,
                    document.getElementById('ne-b').value,
                    document.getElementById('ne-desc').value
                )" style="width:100%; background:linear-gradient(135deg, #804000, #cc6600); color:#fff; font-weight:bold; border:none; padding:10px; border-radius:4px; cursor:pointer; font-family:'Cinzel';">➕ Guardar Estado en la BD</button>
            </div>
        </div>
        `;
    }

    drawnHEXPreserveFocus(contenedor, html);
}
