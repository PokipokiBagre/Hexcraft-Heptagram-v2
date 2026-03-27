// ============================================================
// panel-stats-ui.js — Renderizado de la Columna de Estadísticas
// ============================================================

import { stState, AFINIDADES_LISTA } from './panel-stats-state.js';
import { getPjStat, modPjStat, darAsistencia, limpiarLogAsistencia, recalcularCorazones, toggleEstado, setVistaStats, guardarNuevoEstado } from './panel-stats-logic.js';

// Conectar con el HTML
window.devModStat = modPjStat;
window.devDarAsis = darAsistencia;
window.devLimpAsis = limpiarLogAsistencia;
window.devRecalcularVida = recalcularCorazones;
window.devToggleEstado = toggleEstado;
window.devSetVistaStats = setVistaStats;
window.devGuardarEstadoConfig = guardarNuevoEstado;

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

// ── COMPONENTES UI RECICLABLES ──
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

export function renderColumnaStats(pjSeleccionado) {
    const contenedor = 'content-stats';
    if (!document.getElementById(contenedor)) return;

    if (!pjSeleccionado) {
        drawnHEXPreserveFocus(contenedor, `<div style="text-align:center; color:#666; margin-top:50px; font-style:italic;">Selecciona un personaje para editar sus estadísticas.</div>`);
        return;
    }

    const v = stState.vistaActiva;
    let html = `
        <div style="display:flex; gap:5px; margin-bottom:15px; flex-wrap:wrap;">
            <button onclick="window.devSetVistaStats('hex')" style="flex:1; padding:6px; border-radius:4px; border:1px solid #444; background:${v==='hex'?'var(--gold)':'#111'}; color:${v==='hex'?'#000':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">🪙 HEX</button>
            <button onclick="window.devSetVistaStats('vida')" style="flex:1; padding:6px; border-radius:4px; border:1px solid #444; background:${v==='vida'?'var(--red-life)':'#111'}; color:${v==='vida'?'#fff':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">❤️ Vida</button>
            <button onclick="window.devSetVistaStats('afinidades')" style="flex:1; padding:6px; border-radius:4px; border:1px solid #444; background:${v==='afinidades'?'var(--cyan-magic)':'#111'}; color:${v==='afinidades'?'#000':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">✨ Afin</button>
            <button onclick="window.devSetVistaStats('estados')" style="flex:1; padding:6px; border-radius:4px; border:1px solid #444; background:${v==='estados'?'#9966ff':'#111'}; color:${v==='estados'?'#fff':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">☠️ Est</button>
        </div>
    `;

    // =========================================================
    // VISTA 1: HEX Y ASISTENCIA
    // =========================================================
    if (v === 'hex') {
        const hVal = getPjStat(pjSeleccionado, 'hex');
        const aVal = getPjStat(pjSeleccionado, 'asistencia');
        
        html += `
        <div style="background:#1a1a00; border:1px solid var(--gold); border-radius:8px; padding:15px; text-align:center; margin-bottom:20px;">
            <h3 style="margin:0 0 10px 0; color:var(--gold); font-family:'Cinzel';">HEX ACTUAL</h3>
            <div style="font-size:2.5em; color:#fff; font-weight:bold; margin-bottom:15px;">${hVal}</div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div style="display:flex; flex-direction:column; gap:5px;">
                    ${[10, 50, 100, 300, 500, 1000].map(n => `<button onclick="window.devModStat('${pjSeleccionado}','hex',null,${n})" style="background:#004a00; color:#fff; border:none; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;">+${n}</button>`).join('')}
                </div>
                <div style="display:flex; flex-direction:column; gap:5px;">
                    ${[-10, -50, -100, -300, -500, -1000].map(n => `<button onclick="window.devModStat('${pjSeleccionado}','hex',null,${n})" style="background:#4a0000; color:#fff; border:none; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;">${n}</button>`).join('')}
                </div>
            </div>
        </div>

        <div style="background:#0a1a2a; border:1px solid var(--blue-life); border-radius:8px; padding:15px; text-align:center; margin-bottom:20px;">
            <h3 style="margin:0 0 10px 0; color:var(--blue-life); font-family:'Cinzel';">ASISTENCIA SEMANAL</h3>
            <div style="font-size:2em; color:#fff; font-weight:bold; margin-bottom:10px;">${aVal} / 7</div>
            <div style="display:flex; gap:10px; justify-content:center; margin-bottom:15px;">
                <button onclick="window.devModStat('${pjSeleccionado}','asistencia',null,-1)" style="background:#4a0000; color:#fff; border:none; padding:10px 20px; border-radius:4px; font-weight:bold; cursor:pointer;">-1</button>
                <button onclick="window.devModStat('${pjSeleccionado}','asistencia',null,1)" style="background:#004a00; color:#fff; border:none; padding:10px 20px; border-radius:4px; font-weight:bold; cursor:pointer;">+1</button>
            </div>
            
            <button onclick="window.devDarAsis('${pjSeleccionado}')" style="width:100%; background:linear-gradient(135deg, #1a365d, #4a90e2); color:#fff; border:1px solid #00ffff; padding:12px; border-radius:6px; font-weight:bold; font-family:'Cinzel'; font-size:1.1em; cursor:pointer; box-shadow:0 4px 10px rgba(74,144,226,0.3);">⭐ DAR ASISTENCIA (+200 HEX / +10 VEX)</button>
        </div>

        <div style="background:#000; border:1px dashed #4a90e2; border-radius:8px; padding:10px;">
            <h4 style="margin:0 0 8px 0; color:#4a90e2;">📋 Portapapeles de Asistencia</h4>
            <textarea id="log-asistencia-txt" readonly style="width:100%; height:80px; box-sizing:border-box; background:#111; color:#00ff88; border:1px solid #333; padding:8px; font-family:monospace; resize:none;">${stState.logAsistencia}</textarea>
            <div style="display:flex; gap:10px; margin-top:8px;">
                <button onclick="navigator.clipboard.writeText(document.getElementById('log-asistencia-txt').value); alert('Copiado');" style="flex:3; background:var(--blue-life); color:#fff; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold;">COPIAR</button>
                <button onclick="window.devLimpAsis()" style="flex:1; background:#4a0000; color:#fff; border:none; padding:8px; border-radius:4px; cursor:pointer;">Limpiar</button>
            </div>
        </div>
        `;
    }

    // =========================================================
    // VISTA 2: VIDA Y PUNTOS DE ATAQUE
    // =========================================================
    else if (v === 'vida') {
        html += `
        <div style="background:#1a0505; border:1px solid var(--red-life); border-radius:8px; padding:15px; margin-bottom:15px;">
            <h3 style="margin:0 0 10px 0; color:var(--red-life); font-family:'Cinzel'; text-align:center;">❤️ CURAR / DAÑAR</h3>
            <div style="text-align:center; font-size:2.5em; color:#fff; font-weight:bold; margin-bottom:10px;">${getPjStat(pjSeleccionado, 'vidaRojaActual')}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div style="display:flex; flex-direction:column; gap:5px;">
                    <button onclick="window.devModStat('${pjSeleccionado}','vidaRojaActual',null,-1)" style="background:#800000; color:#fff; border:none; padding:10px; border-radius:4px; font-weight:bold; cursor:pointer;">-1 Daño</button>
                    <button onclick="window.devModStat('${pjSeleccionado}','vidaRojaActual',null,-5)" style="background:#4a0000; color:#fff; border:none; padding:10px; border-radius:4px; font-weight:bold; cursor:pointer;">-5 Daño</button>
                </div>
                <div style="display:flex; flex-direction:column; gap:5px;">
                    <button onclick="window.devModStat('${pjSeleccionado}','vidaRojaActual',null,1)" style="background:#008000; color:#fff; border:none; padding:10px; border-radius:4px; font-weight:bold; cursor:pointer;">+1 Cura</button>
                    <button onclick="window.devModStat('${pjSeleccionado}','vidaRojaActual',null,5)" style="background:#004a00; color:#fff; border:none; padding:10px; border-radius:4px; font-weight:bold; cursor:pointer;">+5 Cura</button>
                </div>
            </div>
            <button onclick="window.devRecalcularVida('${pjSeleccionado}')" style="width:100%; margin-top:15px; background:var(--gold); color:#000; font-weight:bold; font-family:'Cinzel'; padding:12px; border:none; border-radius:6px; cursor:pointer; box-shadow:0 0 10px rgba(212,175,55,0.4);">⚖️ RECALCULAR LÍMITES Y CURAR AL MÁX</button>
        </div>

        <h4 style="color:#aaa; border-bottom:1px solid #333; padding-bottom:5px;">Límites Base</h4>
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:15px;">
            ${genStatRow(pjSeleccionado, 'Límite Rojo', 'baseVidaRojaMax', null, 'var(--red-life)')}
            ${genStatRow(pjSeleccionado, 'C. Azules', 'baseVidaAzul', null, 'var(--blue-life)')}
            ${genStatRow(pjSeleccionado, 'G. Dorada', 'baseGuardaDorada', null, 'var(--gold)')}
        </div>

        <h4 style="color:#aaa; border-bottom:1px solid #333; padding-bottom:5px;">Límites Extra (Buffs)</h4>
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
        </div>
        `;
    }

    // =========================================================
    // VISTA 3: AFINIDADES
    // =========================================================
    else if (v === 'afinidades') {
        const sec = (titulo, campoDb, color) => {
            let sHtml = `<h4 style="color:${color}; border-bottom:1px solid ${color}44; padding-bottom:5px; margin-top:20px;">${titulo}</h4><div style="display:flex; flex-direction:column; gap:8px;">`;
            AFINIDADES_LISTA.forEach(af => {
                sHtml += genStatRow(pjSeleccionado, af.toUpperCase(), campoDb, af, color, true);
            });
            sHtml += `</div>`;
            return sHtml;
        };

        html += sec('✨ Afinidades PERMANENTES (Base)', 'afinidadesBase', '#ffffff');
        html += sec('🔮 Alteración por Hechizos (ALT)', 'hechizosEfecto', 'var(--cyan-magic)');
        html += sec('⏳ Extras Temporales (EXT / Buffs)', 'buffs', '#00ff88');
    }

    // =========================================================
    // VISTA 4: EFECTOS DE ESTADO
    // =========================================================
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
            
            if (e.tipo === 'numero') {
                html += `
                <div style="display:flex; align-items:center; gap:10px;">
                    <button onclick="window.devModStat('${pjSeleccionado}','estados','${e.id}',-1)" style="background:#4a0000; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">-</button>
                    <b style="font-size:1.5em; color:#fff; width:20px; text-align:center;">${val}</b>
                    <button onclick="window.devModStat('${pjSeleccionado}','estados','${e.id}',1)" style="background:#004a00; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">+</button>
                </div>`;
            } else {
                html += `
                <button onclick="window.devToggleEstado('${pjSeleccionado}','${e.id}')" style="background:${val ? e.bg : '#222'}; color:${val ? '#fff' : '#aaa'}; border:2px solid ${val ? e.border : '#444'}; padding:8px 15px; border-radius:6px; font-weight:bold; cursor:pointer; transition:0.2s;">
                    ${val ? 'ACTIVO' : 'INACTIVO'}
                </button>`;
            }
            html += `</div>`;
        });
        html += `</div>`;

        // ZONA DE CREACIÓN GLOBAL
        html += `
        <div style="border-top:2px dashed #444; padding-top:20px;">
            <h3 style="color:#ffaa00; font-family:'Cinzel'; margin:0 0 10px 0;">🌍 Crear Nuevo Estado Global</h3>
            <p style="color:#aaa; font-size:0.8em; margin-top:0;">Aparecerá en la base de datos para todos los jugadores.</p>
            
            <div style="background:#1a0f00; border:1px solid #ff9900; border-radius:8px; padding:15px;">
                <input type="text" id="ne-id" placeholder="ID Interno (ej: veneno_fuerte)" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:8px; border-radius:4px; margin-bottom:10px;">
                
                <input type="text" id="ne-nom" placeholder="Nombre Visible (ej: Veneno Fuerte)" style="width:100%; box-sizing:border-box; background:#000; color:#ffaa00; border:1px solid #ffaa00; padding:8px; border-radius:4px; font-weight:bold; margin-bottom:10px;">
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                    <div>
                        <div style="color:#888; font-size:0.7em;">Tipo</div>
                        <select id="ne-tipo" style="width:100%; background:#000; color:#fff; border:1px solid #444; padding:8px; border-radius:4px;">
                            <option value="booleano">Booleano (Activo/Inactivo)</option>
                            <option value="numero">Numérico (Acumulable 1,2,3...)</option>
                        </select>
                    </div>
                    <div>
                        <div style="color:#888; font-size:0.7em;">Color Borde (CSS)</div>
                        <input type="text" id="ne-b" placeholder="#00ff00" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:8px; border-radius:4px;">
                    </div>
                </div>

                <div style="color:#888; font-size:0.7em;">Color Fondo Opcional (CSS)</div>
                <input type="text" id="ne-bg" placeholder="rgba(0,255,0,0.3)" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:8px; border-radius:4px; margin-bottom:10px;">

                <div style="color:#888; font-size:0.7em;">Descripción del Efecto</div>
                <textarea id="ne-desc" rows="2" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:8px; border-radius:4px; resize:vertical; margin-bottom:15px;"></textarea>

                <button onclick="window.devGuardarEstadoConfig(
                    document.getElementById('ne-id').value,
                    document.getElementById('ne-nom').value,
                    document.getElementById('ne-tipo').value,
                    document.getElementById('ne-bg').value,
                    document.getElementById('ne-b').value,
                    document.getElementById('ne-desc').value
                )" style="width:100%; background:linear-gradient(135deg, #804000, #cc6600); color:#fff; font-weight:bold; border:none; padding:10px; border-radius:4px; cursor:pointer; font-family:'Cinzel';">➕ Guardar en Cola de Base de Datos</button>
            </div>
        </div>
        `;
    }

    drawnHEXPreserveFocus(contenedor, html);
}
