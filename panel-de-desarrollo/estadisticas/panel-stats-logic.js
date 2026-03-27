// ============================================================
// panel-stats-logic.js — Lógica matemática y modificaciones
// ============================================================

import { stState } from './panel-stats-state.js';

export function initStatsDev(statsGlobal, listaEstados) {
    stState.statsDB = JSON.parse(JSON.stringify(statsGlobal || {}));
    stState.estadosDB = JSON.parse(JSON.stringify(listaEstados || []));
}

export function getPjStat(pjNombre, campoRaiz, subCampo = null) {
    if (!pjNombre) return 0;
    const pjKey = pjNombre; 
    
    const flatKey = subCampo ? `${campoRaiz}.${subCampo}` : campoRaiz;
    if (stState.colaStats[pjKey] && stState.colaStats[pjKey][flatKey] !== undefined) {
        return stState.colaStats[pjKey][flatKey];
    }
    
    const p = stState.statsDB[pjKey];
    if (!p) return 0;

    if (subCampo) {
        return (p[campoRaiz] && p[campoRaiz][subCampo] !== undefined) ? p[campoRaiz][subCampo] : 0;
    }
    return p[campoRaiz] !== undefined ? p[campoRaiz] : 0;
}

export function modPjStat(pjNombre, campoRaiz, subCampo, variacion, allowNegative = false, reRender = true) {
    if (!pjNombre) return;
    const pjKey = pjNombre;
    const flatKey = subCampo ? `${campoRaiz}.${subCampo}` : campoRaiz;
    
    const actual = getPjStat(pjNombre, campoRaiz, subCampo);
    let nuevoValor = actual + variacion;
    if (!allowNegative) nuevoValor = Math.max(0, nuevoValor);

    if (!stState.colaStats[pjKey]) stState.colaStats[pjKey] = {};
    stState.colaStats[pjKey][flatKey] = nuevoValor;
    
    if (reRender) window.dispatchEvent(new Event('devUIUpdate'));
    else window.dispatchEvent(new Event('devDataChanged'));
}

export function setPjStat(pjNombre, campoRaiz, subCampo, valor, reRender = true) {
    if (!pjNombre) return;
    const pjKey = pjNombre;
    const flatKey = subCampo ? `${campoRaiz}.${subCampo}` : campoRaiz;
    
    if (!stState.colaStats[pjKey]) stState.colaStats[pjKey] = {};
    stState.colaStats[pjKey][flatKey] = valor;
    
    if (reRender) window.dispatchEvent(new Event('devUIUpdate'));
    else window.dispatchEvent(new Event('devDataChanged'));
}

export function darAsistencia(pjNombre) {
    modPjStat(pjNombre, 'asistencia', null, 1);
    modPjStat(pjNombre, 'hex', null, 200);
    modPjStat(pjNombre, 'vex', null, 10);
    
    stState.logAsistencia += `<${pjNombre} | Asistencia | +200 HEX | +10 VEX>\n`;
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function limpiarLogAsistencia() {
    stState.logAsistencia = "";
    window.dispatchEvent(new Event('devUIUpdate'));
}

// 🌟 FÓRMULA PERFECTA: Suma Todo (Base + Alteración + Hechizos + Buffs)
function getTotalAfinidad(pj, af) {
    return getPjStat(pj, 'afinidadesBase', af) +
           getPjStat(pj, 'hechizos', af) +
           getPjStat(pj, 'hechizosEfecto', af) +
           getPjStat(pj, 'buffs', af);
}

export function recalcularCorazones(pjNombre) {
    const fis = getTotalAfinidad(pjNombre, 'fisica');
    const ene = getTotalAfinidad(pjNombre, 'energetica');
    const esp = getTotalAfinidad(pjNombre, 'espiritual');
    const man = getTotalAfinidad(pjNombre, 'mando');
    const psi = getTotalAfinidad(pjNombre, 'psiquica');
    const osc = getTotalAfinidad(pjNombre, 'oscura');

    const nuevaRojaMax = 10 + Math.floor(fis / 2);
    const magiaTotal = ene + esp + man + psi + osc;
    const nuevaAzul = Math.floor(magiaTotal / 4);

    setPjStat(pjNombre, 'baseVidaRojaMax', null, nuevaRojaMax, false);
    setPjStat(pjNombre, 'baseVidaAzul', null, nuevaAzul, false);
    setPjStat(pjNombre, 'vidaRojaActual', null, nuevaRojaMax, true); 
}

export function setVistaStats(vista) {
    stState.vistaActiva = vista;
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function toggleEstado(pjNombre, estadoId) {
    const actual = getPjStat(pjNombre, 'estados', estadoId);
    setPjStat(pjNombre, 'estados', estadoId, !actual);
}

// Color picker envía HEX, le agregamos transparencia 55 a los fondos
export function guardarNuevoEstado(id, nombre, tipo, bgHex, borderHex, desc) {
    const safeId = id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!safeId) return alert("ID inválido.");
    
    stState.colaEstadosConfig[safeId] = {
        nombre: nombre || safeId,
        tipo: tipo,
        color_bg: bgHex + '55', 
        color_border: borderHex,
        descripcion: desc
    };
    alert(`Estado "${nombre}" agregado a la cola de base de datos. Se subirá al guardar.`);
    window.dispatchEvent(new Event('devDataChanged')); 
}
