// ============================================================
// panel-stats-ui.js — Renderizado de la Columna de Estadísticas
// ============================================================

import { stState, AFINIDADES_LISTA } from './panel-stats-state.js';
import {
    getPjStat, modPjStat, darAsistencia, limpiarLogAsistencia, recalcularCorazones,
    toggleEstado, setVistaStats, guardarNuevoEstado, cargarEstadoParaEditar, borrarEstadoGlobal,
    getVexMax, calcularVidaRojaMaxTotal, calcularVidaAzulTotal, calcularGuardaDoradaTotal,
    calcularDanoRojoTotal, calcularDanoAzulTotal, calcularElimDoradaTotal,
    esSistema, getTotalAfinidadSmart, setNotaAfinidad, toggleNotaAbierta, setSubVistaAfinidades
} from './panel-stats-logic.js';

window.devModStat           = modPjStat;
window.devDarAsis           = darAsistencia;
window.devLimpAsis          = limpiarLogAsistencia;
window.devRecalcularVida    = recalcularCorazones;
window.devToggleEstado      = toggleEstado;
window.devSetVistaStats     = setVistaStats;
window.devGuardarEstadoConfig = guardarNuevoEstado;
window.devEditarEstadoGlobal  = cargarEstadoParaEditar;
window.devBorrarEstadoGlobal  = borrarEstadoGlobal;
window.devSetNotaAf         = setNotaAfinidad;
window.devToggleNota        = toggleNotaAbierta;
window.devSubVistaAf        = setSubVistaAfinidades;

function drawnHEXPreserveFocus(containerId, html) {
    const activeEl = document.activeElement;
    const activeId = activeEl ? activeEl.id : null;
    const start = activeEl && activeEl.selectionStart !== undefined ? activeEl.selectionStart : null;
    const end   = activeEl && activeEl.selectionEnd   !== undefined ? activeEl.selectionEnd   : null;
    
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

// ── Fila stat editable ────────────────────────────────────────────────────────
function genStatRow(pj, label, campoRaiz, subCampo, color = 'var(--gold)', esAfinidad = false) {
    const val = getPjStat(pj, campoRaiz, subCampo);
    const flatKey = subCampo ? `${campoRaiz}.${subCampo}` : campoRaiz;
    const modified = stState.colaStats[pj] && stState.colaStats[pj][flatKey] !== undefined;
    const bgGlow = modified ? `box-shadow: inset 0 0 15px ${color}44; border-color:${color};` : 'border-color:#333;';
    const scJS = subCampo === null ? 'null' : `'${subCampo}'`;

    let botonesHTML = '';
    if (esAfinidad) {
        botonesHTML = `
            <div style="display:flex; gap:2px;">
                <button onclick="window.devModStat('${pj}','${campoRaiz}',${scJS},-10,true)" style="background:#4a0000; color:#fff; border:none; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.7em;">-10</button>
                <button onclick="window.devModStat('${pj}','${campoRaiz}',${scJS},-5,true)"  style="background:#660000; color:#fff; border:none; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.7em;">-5</button>
                <button onclick="window.devModStat('${pj}','${campoRaiz}',${scJS},-1,true)"  style="background:#a00000; color:#fff; border:none; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.7em;">-1</button>
            </div>
            <div style="display:flex; gap:2px;">
                <button onclick="window.devModStat('${pj}','${campoRaiz}',${scJS},1,true)"   style="background:#006600; color:#fff; border:none; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.7em;">+1</button>
                <button onclick="window.devModStat('${pj}','${campoRaiz}',${scJS},5,true)"   style="background:#00a000; color:#fff; border:none; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.7em;">+5</button>
                <button onclick="window.devModStat('${pj}','${campoRaiz}',${scJS},10,true)"  style="background:#00cc00; color:#fff; border:none; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.7em;">+10</button>
            </div>`;
    } else {
        botonesHTML = `
            <div style="display:flex; gap:2px;">
                <button onclick="window.devModStat('${pj}','${campoRaiz}',${scJS},-5)"  style="background:#660000; color:#fff; border:none; padding:4px 8px; cursor:pointer; font-weight:bold; font-size:0.8em;">-5</button>
                <button onclick="window.devModStat('${pj}','${campoRaiz}',${scJS},-1)"  style="background:#a00000; color:#fff; border:none; padding:4px 8px; cursor:pointer; font-weight:bold; font-size:0.8em;">-1</button>
            </div>
            <div style="display:flex; gap:2px;">
                <button onclick="window.devModStat('${pj}','${campoRaiz}',${scJS},1)"   style="background:#006600; color:#fff; border:none; padding:4px 8px; cursor:pointer; font-weight:bold; font-size:0.8em;">+1</button>
                <button onclick="window.devModStat('${pj}','${campoRaiz}',${scJS},5)"   style="background:#00a000; color:#fff; border:none; padding:4px 8px; cursor:pointer; font-weight:bold; font-size:0.8em;">+5</button>
            </div>`;
    }

    return `
    <div style="background:#050505; border:1px solid; ${bgGlow} border-radius:6px; padding:8px; display:flex; justify-content:space-between; align-items:center;">
        <div style="color:#aaa; font-size:0.85em; font-weight:bold; min-width:70px;">${label}</div>
        <div style="color:${color}; font-size:1.4em; font-weight:bold; font-family:'Cinzel';">${val}</div>
        <div style="display:flex; flex-direction:column; gap:4px;">${botonesHTML}</div>
    </div>`;
}

// ── Fila afinidad editable CON NOTA ─────────────────────────────────────────
function genAfRow(pj, af, campoRaiz, color) {
    const label = af.charAt(0).toUpperCase() + af.slice(1);
    const val   = getPjStat(pj, campoRaiz, af);
    const flatKey = `${campoRaiz}.${af}`;
    const modified = stState.colaStats[pj]?.[flatKey] !== undefined;
    const bgGlow = modified ? `box-shadow: inset 0 0 15px ${color}44; border-color:${color};` : 'border-color:#333;';
    const scJS = `'${af}'`;
    const pjEsc = pj.replace(/'/g, "\\'");

    const notaKey = `${pjEsc}|${flatKey}`;
    const notaAbierta = stState.notasAbiertasSet.has(`${pj}|${flatKey}`);
    const notaActual  = stState.notasAfinidad[pj]?.[flatKey] || '';
    const notaBtnColor = notaActual ? '#a07800' : '#333';
    const notaBtnTextColor = notaActual ? '#d4af37' : '#888';

    const notaHtml = notaAbierta ? `
        <div style="margin-top:5px; display:flex; gap:5px; align-items:center;">
            <input type="text" id="nota-${pj}-${campoRaiz}-${af}" value="${notaActual.replace(/"/g,'&quot;')}"
                placeholder="Razón del cambio..."
                oninput="window.devSetNotaAf('${pjEsc}','${flatKey}',this.value)"
                style="flex:1; background:#0a0a0a; color:#d4af37; border:1px solid #5a3800; border-radius:4px; padding:4px 8px; font-size:0.8em; outline:none; font-family:'Rajdhani';">
        </div>` : '';

    return `
    <div style="background:#050505; border:1px solid; ${bgGlow} border-radius:6px; padding:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="color:#aaa; font-size:0.85em; font-weight:bold; min-width:70px;">${label}</div>
            <div style="color:${color}; font-size:1.4em; font-weight:bold; font-family:'Cinzel';">${val}</div>
            <div style="display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; gap:2px;">
                    <button onclick="window.devModStat('${pjEsc}','${campoRaiz}',${scJS},-10,true)" style="background:#4a0000; color:#fff; border:none; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.7em;">-10</button>
                    <button onclick="window.devModStat('${pjEsc}','${campoRaiz}',${scJS},-5,true)"  style="background:#660000; color:#fff; border:none; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.7em;">-5</button>
                    <button onclick="window.devModStat('${pjEsc}','${campoRaiz}',${scJS},-1,true)"  style="background:#a00000; color:#fff; border:none; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.7em;">-1</button>
                </div>
                <div style="display:flex; gap:2px;">
                    <button onclick="window.devToggleNota('${pjEsc}','${flatKey}')"
                        title="${notaActual ? 'Nota: ' + notaActual : 'Agregar nota a este cambio'}"
                        style="background:${notaBtnColor}; color:${notaBtnTextColor}; border:none; padding:4px 6px; cursor:pointer; font-size:0.7em; border-radius:2px; min-width:22px;">📝</button>
                    <button onclick="window.devModStat('${pjEsc}','${campoRaiz}',${scJS},1,true)"   style="background:#006600; color:#fff; border:none; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.7em;">+1</button>
                    <button onclick="window.devModStat('${pjEsc}','${campoRaiz}',${scJS},5,true)"   style="background:#00a000; color:#fff; border:none; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.7em;">+5</button>
                    <button onclick="window.devModStat('${pjEsc}','${campoRaiz}',${scJS},10,true)"  style="background:#00cc00; color:#fff; border:none; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.7em;">+10</button>
                </div>
            </div>
        </div>
        ${notaHtml}
    </div>`;
}

// ── Fila solo lectura ────────────────────────────────────────────────────────
function genStatRowReadOnly(pj, label, campoRaiz, subCampo, color = 'var(--gold)') {
    const val = getPjStat(pj, campoRaiz, subCampo);
    return `
    <div style="background:#050505; border:1px solid #1e1e1e; border-radius:6px; padding:8px; display:flex; justify-content:space-between; align-items:center; opacity:0.8;">
        <div style="color:#666; font-size:0.85em; font-weight:bold; min-width:70px;">${label}</div>
        <div style="color:${color}; font-size:1.4em; font-weight:bold; font-family:'Cinzel';">${val}</div>
        <div style="color:#444; font-size:0.7em; font-style:italic; padding-right:10px;">(Solo lectura)</div>
    </div>`;
}

// ── Sub-tabs de afinidades ───────────────────────────────────────────────────
const SUB_TABS = [
    { id: 'totales', label: '∑ Totales',  color: '#ffffff' },
    { id: 'base',    label: '✨ Base',     color: '#ffffff' },
    { id: 'alt',     label: '🔮 Alt',      color: '#00e5ff' },
    { id: 'buff',    label: '⏳ Buff',     color: '#00ff88' },
    { id: 'hcz',     label: '📖 Hcz',     color: '#ffaa00' },
];

function renderAfSubTabs(sub) {
    let tabs = `<div style="display:flex; gap:4px; margin-bottom:12px; flex-wrap:wrap;">`;
    SUB_TABS.forEach(t => {
        const active = sub === t.id;
        tabs += `<button onclick="window.devSubVistaAf('${t.id}')"
            style="flex:1; min-width:50px; padding:5px 4px; border-radius:4px; border:1px solid ${active ? t.color : '#333'};
                   background:${active ? t.color + '22' : '#111'}; color:${active ? t.color : '#555'};
                   font-weight:bold; cursor:pointer; font-size:0.75em; font-family:'Rajdhani'; transition:0.15s;">
            ${t.label}
        </button>`;
    });
    tabs += `</div>`;
    return tabs;
}

function renderAfTotales(pj) {
    const sistema = esSistema(pj);
    const pjEsc   = pj.replace(/'/g, "\\'");

    const NOMBRES = {
        fisica: 'Física', energetica: 'Energética', espiritual: 'Espiritual',
        mando: 'Mando', psiquica: 'Psíquica', oscura: 'Oscura'
    };
    const COLORS = {
        fisica: '#e2a673', energetica: '#f3e57a', espiritual: '#7df0a7',
        mando: '#6eb8e6', psiquica: '#a26ee6', oscura: '#ff526f'
    };

    let html = `<div style="background:#0a0514; border:1px solid #4a1880; border-radius:8px; padding:12px;">`;
    if (sistema) {
        html += `<div style="font-size:0.7em; color:#ff8800; margin-bottom:8px; font-style:italic;">⚠️ NPC Sistema — Grimorio excluido del total</div>`;
    }
    html += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">`;

    AFINIDADES_LISTA.forEach(af => {
        const total = getTotalAfinidadSmart(pj, af);
        const col   = COLORS[af];
        const nom   = NOMBRES[af];

        const base = getPjStat(pj, 'afinidadesBase', af);
        const hcz  = esSistema(pj) ? null : getPjStat(pj, 'hechizos', af);
        const alt  = getPjStat(pj, 'hechizosEfecto', af);
        const buff = getPjStat(pj, 'buffs', af);

        const parts = [];
        parts.push(`Base: ${base}`);
        if (!sistema) parts.push(`Hcz: ${hcz}`);
        parts.push(`Alt: ${alt}`);
        parts.push(`Buff: ${buff}`);
        const tooltip = parts.join(' | ');

        html += `
        <div style="background:#0d0d16; border:1px solid ${col}44; border-radius:6px; padding:10px; display:flex; flex-direction:column; align-items:center; gap:4px;">
            <div style="color:#888; font-size:0.7em; font-weight:bold;">${nom}</div>
            <div style="color:${col}; font-size:2em; font-weight:bold; font-family:'Cinzel'; line-height:1;">${total}</div>
            <div style="color:#555; font-size:0.65em; text-align:center;">${tooltip}</div>
            <button onclick="navigator.clipboard.writeText('${total}').then(()=>{ const el=document.getElementById('copy-${af}'); el.textContent='✅'; setTimeout(()=>el.textContent='📋',1000); })"
                style="background:${col}22; color:${col}; border:1px solid ${col}44; border-radius:4px; padding:2px 8px; cursor:pointer; font-size:0.7em; margin-top:2px;">
                <span id="copy-${af}">📋</span> Copiar
            </button>
        </div>`;
    });

    html += `</div></div>`;
    return html;
}

export function renderColumnaStats(pjSeleccionado) {
    const contenedor = 'content-stats';
    if (!document.getElementById(contenedor)) return;

    if (!pjSeleccionado) {
        drawnHEXPreserveFocus(contenedor, `<div style="text-align:center; color:#666; margin-top:50px; font-style:italic;">Selecciona un personaje para editar sus estadísticas.</div>`);
        return;
    }

    const v   = stState.vistaActiva;
    const sub = stState.subVistaAfinidades;
    const sPj = pjSeleccionado.replace(/'/g, "\\'");
    const sistema = esSistema(pjSeleccionado);

    let html = `
        <div style="display:flex; gap:5px; margin-bottom:15px; flex-wrap:wrap;">
            <button onclick="window.devSetVistaStats('hex')" style="flex:1; padding:6px; border-radius:4px; border:1px solid #444; background:${v==='hex'?'var(--gold)':'#111'}; color:${v==='hex'?'#000':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">🪙 HEX</button>
            <button onclick="window.devSetVistaStats('vida')" style="flex:1; padding:6px; border-radius:4px; border:1px solid #444; background:${v==='vida'?'var(--red-life)':'#111'}; color:${v==='vida'?'#fff':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">❤️ Vida</button>
            <button onclick="window.devSetVistaStats('afinidades')" style="flex:1; padding:6px; border-radius:4px; border:1px solid #444; background:${v==='afinidades'?'var(--cyan-magic)':'#111'}; color:${v==='afinidades'?'#000':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">✨ Afin</button>
            <button onclick="window.devSetVistaStats('estados')" style="flex:1; padding:6px; border-radius:4px; border:1px solid #444; background:${v==='estados'?'#9966ff':'#111'}; color:${v==='estados'?'#fff':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">☠️ Est</button>
        </div>
        <div id="stats-feedback" style="font-size:0.8em; text-align:center; height:16px; transition:opacity 0.5s; opacity:0; margin-bottom:4px;"></div>
    `;

    // ── HEX ────────────────────────────────────────────────────────────────
    if (v === 'hex') {
        const hexVal = getPjStat(pjSeleccionado, 'hex');
        const hexModified = stState.colaStats[pjSeleccionado]?.['hex'] !== undefined;
        const hexColor = hexVal < 0 ? '#ff4444' : (hexVal === 0 ? '#888' : '#00ff88');
        const vexMax = getVexMax(pjSeleccionado);

        html += `
        <div style="background:#0a0a0a; border:1px solid ${hexModified ? '#d4af37' : '#333'}; border-radius:10px; padding:20px; text-align:center; margin-bottom:15px; ${hexModified ? 'box-shadow:inset 0 0 20px rgba(212,175,55,0.15)' : ''}">
            <div style="color:#aaa; font-size:0.75em; font-weight:bold; text-transform:uppercase; letter-spacing:2px; margin-bottom:5px;">HEX ACTUAL</div>
            <div style="color:${hexColor}; font-size:3em; font-weight:bold; font-family:'Cinzel';">${hexVal.toLocaleString()}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:15px;">
                <div style="display:flex; flex-direction:column; gap:5px;">
                    ${[10,50,100,300,500,1000].map(n => `<button onclick="window.devModStat('${sPj}','hex',null,${n},true)" style="background:linear-gradient(90deg,#003a00,#006600); color:#00ff88; border:1px solid #00aa00; padding:5px; cursor:pointer; border-radius:4px; font-weight:bold; font-family:'Cinzel';">+${n}</button>`).join('')}
                </div>
                <div style="display:flex; flex-direction:column; gap:5px;">
                    ${[10,50,100,300,500,1000].map(n => `<button onclick="window.devModStat('${sPj}','hex',null,-${n},true)" style="background:linear-gradient(90deg,#3a0000,#660000); color:#ff4444; border:1px solid #aa0000; padding:5px; cursor:pointer; border-radius:4px; font-weight:bold; font-family:'Cinzel';">-${n}</button>`).join('')}
                </div>
            </div>
        </div>

        <div style="background:#0a0a0a; border:1px solid #333; border-radius:10px; padding:15px; text-align:center; margin-bottom:15px;">
            <div style="color:#aaa; font-size:0.75em; font-weight:bold; text-transform:uppercase; letter-spacing:2px; margin-bottom:5px;">ASISTENCIA SEMANAL</div>
            <div style="color:#d4af37; font-size:2em; font-weight:bold; font-family:'Cinzel';">${getPjStat(pjSeleccionado,'asistencia')} / 7</div>
            <div style="display:flex; gap:10px; justify-content:center; margin-top:10px;">
                <button onclick="window.devModStat('${sPj}','asistencia',null,-1)" style="background:#3a0000; color:#ff6666; border:1px solid #660000; padding:5px 15px; cursor:pointer; border-radius:4px; font-weight:bold;">-1</button>
                <button onclick="window.devModStat('${sPj}','asistencia',null,1)"  style="background:#003a00; color:#66ff66; border:1px solid #006600; padding:5px 15px; cursor:pointer; border-radius:4px; font-weight:bold;">+1</button>
            </div>
            <button onclick="window.devDarAsis('${sPj}')" style="width:100%; margin-top:10px; background:linear-gradient(135deg,#7a5c00,#d4af37); color:#000; font-weight:bold; border:none; padding:10px; border-radius:6px; cursor:pointer; font-family:'Cinzel';">⭐ DAR ASISTENCIA (+300 HEX)</button>
        </div>

        <div style="background:#050505; border:1px solid #4a1880; border-radius:10px; padding:15px; text-align:center;">
            <div style="color:#aaa; font-size:0.75em; font-weight:bold; text-transform:uppercase; letter-spacing:2px; margin-bottom:5px;">VEX (Lectura)</div>
            <div style="color:#b060ff; font-size:2em; font-weight:bold; font-family:'Cinzel';">${vexMax.toLocaleString()}</div>
        </div>`;
    }

    // ── VIDA ────────────────────────────────────────────────────────────────
    else if (v === 'vida') {
        const rojaActual = getPjStat(pjSeleccionado, 'vidaRojaActual');
        const rojaMax = calcularVidaRojaMaxTotal(pjSeleccionado);
        const azulTotal = calcularVidaAzulTotal(pjSeleccionado);
        const guardaTotal = calcularGuardaDoradaTotal(pjSeleccionado);
        const danoRojoTotal = calcularDanoRojoTotal(pjSeleccionado);
        const danoAzulTotal = calcularDanoAzulTotal(pjSeleccionado);
        const elimTotal = calcularElimDoradaTotal(pjSeleccionado);

        html += `
        <div style="background:#1a0000; border:1px solid #660000; border-radius:8px; padding:10px; text-align:center; margin-bottom:15px;">
            <div style="color:#ff6666; font-size:0.8em; font-weight:bold; margin-bottom:5px;">VIDA ROJA ACTUAL / MÁX</div>
            <div style="color:#ff4444; font-size:2.5em; font-weight:bold; font-family:'Cinzel';">${rojaActual} / ${rojaMax}</div>
            <div style="display:flex; gap:5px; justify-content:center; margin-top:10px;">
                ${[-5,-1,1,5].map(n => `<button onclick="window.devModStat('${sPj}','vidaRojaActual',null,${n})" style="background:${n<0?'#3a0000':'#003a00'}; color:${n<0?'#ff4444':'#44ff44'}; border:1px solid ${n<0?'#660000':'#006600'}; padding:5px 10px; cursor:pointer; border-radius:4px; font-weight:bold;">${n>0?'+':''}${n}</button>`).join('')}
            </div>
        </div>
        <button onclick="window.devRecalcularVida('${sPj}')" style="width:100%; background:linear-gradient(135deg,#1a0a3a,#4a1880); color:#c080ff; border:1px solid #6a30b0; padding:8px; border-radius:6px; cursor:pointer; font-weight:bold; font-family:'Cinzel'; margin-bottom:15px;">🔄 RECALCULAR DESDE AFINIDADES</button>
        <div style="display:flex; flex-direction:column; gap:8px;">
            ${genStatRow(pjSeleccionado,'Vida Roja Máx','baseVidaRojaMax',null,'var(--red-life)')}
            ${genStatRow(pjSeleccionado,'Vida Azul Base','baseVidaAzul',null,'var(--blue-life)')}
            ${genStatRow(pjSeleccionado,'Guarda Dorada','baseGuardaDorada',null,'var(--gold)')}
            ${genStatRow(pjSeleccionado,'Daño Rojo','baseDanoRojo',null,'var(--red-life)')}
            ${genStatRow(pjSeleccionado,'Daño Azul','baseDanoAzul',null,'var(--blue-life)')}
            ${genStatRow(pjSeleccionado,'Elim. Dorada','baseElimDorada',null,'var(--gold)')}
            <h4 style="color:#00ff88; margin:10px 0 5px; font-family:'Cinzel';">Buffs (Vida/Daño)</h4>
            ${genStatRow(pjSeleccionado,'VR Extra','buffs','vidaRojaMaxExtra','var(--red-life)')}
            ${genStatRow(pjSeleccionado,'VA Extra','buffs','vidaAzulExtra','var(--blue-life)')}
            ${genStatRow(pjSeleccionado,'GD Extra','buffs','guardaDoradaExtra','var(--gold)')}
            ${genStatRow(pjSeleccionado,'DR Extra','buffs','danoRojo','var(--red-life)')}
            ${genStatRow(pjSeleccionado,'DA Extra','buffs','danoAzul','var(--blue-life)')}
            ${genStatRow(pjSeleccionado,'Elim Extra','buffs','elimDorada','var(--gold)')}
            <h4 style="color:#ffaa00; margin:10px 0 5px; font-family:'Cinzel';">Hcz (Vida/Daño)</h4>
            ${genStatRow(pjSeleccionado,'VR Extra','hechizos','vidaRojaMaxExtra','var(--red-life)')}
            ${genStatRow(pjSeleccionado,'VA Extra','hechizos','vidaAzulExtra','var(--blue-life)')}
            ${genStatRow(pjSeleccionado,'GD Extra','hechizos','guardaDoradaExtra','var(--gold)')}
            ${genStatRow(pjSeleccionado,'DR Extra','hechizos','danoRojo','var(--red-life)')}
            ${genStatRow(pjSeleccionado,'DA Extra','hechizos','danoAzul','var(--blue-life)')}
            ${genStatRow(pjSeleccionado,'Elim Extra','hechizos','elimDorada','var(--gold)')}
        </div>`;
    }

    // ── AFINIDADES (con sub-tabs) ────────────────────────────────────────────
    else if (v === 'afinidades') {
        html += renderAfSubTabs(sub);

        if (sub === 'totales') {
            html += renderAfTotales(pjSeleccionado);
        }

        else if (sub === 'base') {
            html += `<h4 style="color:#fff; border-bottom:1px solid #ffffff22; padding-bottom:5px; margin-top:0;">✨ Afinidades PERMANENTES (Base)</h4>`;
            html += `<div style="display:flex; flex-direction:column; gap:8px;">`;
            AFINIDADES_LISTA.forEach(af => { html += genAfRow(pjSeleccionado, af, 'afinidadesBase', '#ffffff'); });
            html += `</div>`;
        }

        else if (sub === 'alt') {
            html += `<h4 style="color:#00e5ff; border-bottom:1px solid #00e5ff22; padding-bottom:5px; margin-top:0;">🔮 Alteración por Hechizos (ALT)</h4>`;
            html += `<div style="display:flex; flex-direction:column; gap:8px;">`;
            AFINIDADES_LISTA.forEach(af => { html += genAfRow(pjSeleccionado, af, 'hechizosEfecto', 'var(--cyan-magic)'); });
            html += `</div>`;
        }

        else if (sub === 'buff') {
            html += `<h4 style="color:#00ff88; border-bottom:1px solid #00ff8822; padding-bottom:5px; margin-top:0;">⏳ Extras Temporales (EXT / Buffs)</h4>`;
            html += `<div style="display:flex; flex-direction:column; gap:8px;">`;
            AFINIDADES_LISTA.forEach(af => { html += genAfRow(pjSeleccionado, af, 'buffs', '#00ff88'); });
            html += `</div>`;
        }

        else if (sub === 'hcz') {
            html += `<h4 style="color:#ffaa00; border-bottom:1px solid #ffaa0022; padding-bottom:5px; margin-top:0;">📖 Aportado por Grimorio (Hcz)</h4>`;
            if (sistema) {
                html += `<div style="background:#1a0f00; border:1px solid #ff8800; border-radius:6px; padding:10px; margin-bottom:10px; font-size:0.8em; color:#ff9900;">⚠️ NPC tipo Sistema: el Grimorio NO se suma al total de afinidades ni se usa en casteos.</div>`;
            }
            html += `<div style="display:flex; flex-direction:column; gap:8px;">`;
            AFINIDADES_LISTA.forEach(af => { html += genStatRowReadOnly(pjSeleccionado, af.charAt(0).toUpperCase() + af.slice(1), 'hechizos', af, '#ffaa00'); });
            html += `</div>`;
        }
    }

    // ── ESTADOS ──────────────────────────────────────────────────────────────
    else if (v === 'estados') {
        html += `<h3 style="color:#9966ff; font-family:'Cinzel'; margin-top:0;">Aplicar al Personaje</h3>
                 <div style="display:flex; flex-direction:column; gap:8px; max-height:300px; overflow-y:auto; padding-right:5px; margin-bottom:20px;">`;
        
        stState.estadosDB.forEach(e => {
            const val = getPjStat(pjSeleccionado, 'estados', e.id);
            const modified = stState.colaStats[pjSeleccionado]?.[`estados.${e.id}`] !== undefined;
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
                    <button onclick="window.devModStat('${sPj}','estados','${e.id}',1)"  style="background:#004a00; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">+</button>
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
            <div style="display:flex; flex-direction:column; gap:5px; max-height:150px; overflow-y:auto; margin-bottom:15px; padding-right:5px;">`;
        stState.estadosDB.forEach(e => {
            html += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:6px 10px; border:1px solid #333; border-radius:4px;">
                <span style="color:${e.border}; font-weight:bold; font-size:0.9em;">${e.nombre}</span>
                <div style="display:flex; gap:5px;">
                    <button onclick="window.devEditarEstadoGlobal('${e.id}')" style="background:#004a4a; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8em;">✏️</button>
                    <button onclick="window.devBorrarEstadoGlobal('${e.id}')" style="background:#4a0000; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8em;">🗑️</button>
                </div>
            </div>`;
        });
        html += `</div>
            <div style="background:#1a0f00; border:1px solid #ff9900; border-radius:8px; padding:15px;">
                <input type="text" id="ne-nom" placeholder="Nombre Visible" style="width:100%; box-sizing:border-box; background:#000; color:#ffaa00; border:1px solid #ffaa00; padding:8px; border-radius:4px; font-weight:bold; margin-bottom:10px; outline:none;">
                <select id="ne-tipo" style="width:100%; background:#000; color:#fff; border:1px solid #444; padding:8px; border-radius:4px; margin-bottom:10px; outline:none;">
                    <option value="booleano">Booleano (Activo/Inactivo)</option>
                    <option value="numero">Numérico (Acumulable)</option>
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
                <textarea id="ne-desc" rows="2" placeholder="Descripción..." style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:8px; border-radius:4px; resize:vertical; margin-bottom:10px; outline:none;"></textarea>
                <button onclick="window.devGuardarEstadoConfig(
                    document.getElementById('ne-nom').value,
                    document.getElementById('ne-tipo').value,
                    document.getElementById('ne-bg').value,
                    document.getElementById('ne-b').value,
                    document.getElementById('ne-desc').value
                )" style="width:100%; background:linear-gradient(135deg,#804000,#cc6600); color:#fff; font-weight:bold; border:none; padding:10px; border-radius:4px; cursor:pointer; font-family:'Cinzel';">➕ Guardar Estado en la BD</button>
                <div id="stats-feedback-est" style="font-size:0.8em; text-align:center; height:14px; margin-top:6px; color:#00ff88;"></div>
            </div>
        </div>`;
    }

    drawnHEXPreserveFocus(contenedor, html);
}
