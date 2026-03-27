// ============================================================
// panel-stats-logic.js — Lógica matemática y modificaciones
// ============================================================

import { stState } from './panel-stats-state.js';

export function initStatsDev(statsGlobal, listaEstados) {
    stState.statsDB = JSON.parse(JSON.stringify(statsGlobal || {})); // Deep copy de seguridad
    stState.estadosDB = JSON.parse(JSON.stringify(listaEstados || []));
}

// ── LECTOR DE DATOS (Prioriza la Cola Temporal) ──
export function getPjStat(pjNombre, campoRaiz, subCampo = null) {
    if (!pjNombre) return 0;
    const pjKey = pjNombre; // Mantenemos el case original para stats
    
    // 1. Revisar si está modificado en la Cola Temporal
    const flatKey = subCampo ? `${campoRaiz}.${subCampo}` : campoRaiz;
    if (stState.colaStats[pjKey] && stState.colaStats[pjKey][flatKey] !== undefined) {
        return stState.colaStats[pjKey][flatKey];
    }
    
    // 2. Si no, extraer de la Base de Datos
    const p = stState.statsDB[pjKey];
    if (!p) return 0;

    if (subCampo) {
        return (p[campoRaiz] && p[campoRaiz][subCampo] !== undefined) ? p[campoRaiz][subCampo] : 0;
    }
    return p[campoRaiz] !== undefined ? p[campoRaiz] : 0;
}

// ── MODIFICADOR DE DATOS ──
export function modPjStat(pjNombre, campoRaiz, subCampo, variacion, allowNegative = false) {
    if (!pjNombre) return;
    const pjKey = pjNombre;
    const flatKey = subCampo ? `${campoRaiz}.${subCampo}` : campoRaiz;
    
    const actual = getPjStat(pjNombre, campoRaiz, subCampo);
    let nuevoValor = actual + variacion;
    if (!allowNegative) nuevoValor = Math.max(0, nuevoValor);

    if (!stState.colaStats[pjKey]) stState.colaStats[pjKey] = {};
    stState.colaStats[pjKey][flatKey] = nuevoValor;
    
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setPjStat(pjNombre, campoRaiz, subCampo, valor) {
    if (!pjNombre) return;
    const pjKey = pjNombre;
    const flatKey = subCampo ? `${campoRaiz}.${subCampo}` : campoRaiz;
    
    if (!stState.colaStats[pjKey]) stState.colaStats[pjKey] = {};
    stState.colaStats[pjKey][flatKey] = valor;
    
    window.dispatchEvent(new Event('devUIUpdate'));
}

// ── FUNCIONES ESPECIALES ──
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

export function recalcularCorazones(pjNombre) {
    const fis = getPjStat(pjNombre, 'afinidadesBase', 'fisica');
    const ene = getPjStat(pjNombre, 'afinidadesBase', 'energetica');
    const esp = getPjStat(pjNombre, 'afinidadesBase', 'espiritual');
    const man = getPjStat(pjNombre, 'afinidadesBase', 'mando');
    const psi = getPjStat(pjNombre, 'afinidadesBase', 'psiquica');
    const osc = getPjStat(pjNombre, 'afinidadesBase', 'oscura');

    const nuevaRojaMax = 10 + Math.floor(fis / 2);
    const magiaTotal = ene + esp + man + psi + osc;
    const nuevaAzul = Math.floor(magiaTotal / 4);

    setPjStat(pjNombre, 'baseVidaRojaMax', null, nuevaRojaMax);
    setPjStat(pjNombre, 'baseVidaAzul', null, nuevaAzul);
    setPjStat(pjNombre, 'vidaRojaActual', null, nuevaRojaMax); // Cura total
}

export function toggleEstado(pjNombre, estadoId) {
    const actual = getPjStat(pjNombre, 'estados', estadoId);
    setPjStat(pjNombre, 'estados', estadoId, !actual);
}

export function setVistaStats(vista) {
    stState.vistaActiva = vista;
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function guardarNuevoEstado(id, nombre, tipo, bg, border, desc) {
    const safeId = id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!safeId) return alert("ID inválido.");
    
    stState.colaEstadosConfig[safeId] = {
        nombre: nombre || safeId,
        tipo: tipo,
        color_bg: bg,
        color_border: border,
        descripcion: desc
    };
    alert("Estado agregado a la cola. Clic en 'Guardar Todo' para enviarlo a la BD.");
    window.dispatchEvent(new Event('devUIUpdate'));
}
