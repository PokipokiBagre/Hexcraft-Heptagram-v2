// ============================================================
// panel-stats-logic.js — Lógica matemática y modificaciones
// ============================================================

import { stState } from './panel-stats-state.js';
import { norm } from '../dev-state.js';

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

    if (subCampo) return (p[campoRaiz] && p[campoRaiz][subCampo] !== undefined) ? p[campoRaiz][subCampo] : 0;
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

    // 🌟 VÍNCULO MÁGICO: Si sube el Límite Rojo, sube la Vida Roja automáticamente
    if (campoRaiz === 'baseVidaRojaMax' && variacion !== 0) {
        const vidaActual = getPjStat(pjNombre, 'vidaRojaActual');
        stState.colaStats[pjKey]['vidaRojaActual'] = Math.max(0, vidaActual + variacion);
    }
    
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
    modPjStat(pjNombre, 'asistencia', null, 1, false, false);
    modPjStat(pjNombre, 'hex', null, 200, false, false);
    modPjStat(pjNombre, 'vex', null, 10, false, true);
    window.dispatchEvent(new Event('devUIUpdate')); // Fuerza el log
}

export function limpiarLogAsistencia() {
    stState.logAsistencia = "";
    window.dispatchEvent(new Event('devUIUpdate'));
}

function getTotalAfinidad(pj, af) {
    return getPjStat(pj, 'afinidadesBase', af) +
           getPjStat(pj, 'hechizos', af) +
           getPjStat(pj, 'hechizosEfecto', af) +
           getPjStat(pj, 'buffs', af);
}

export function recalcularCorazones(pjNombre) {
    const fis = getTotalAfinidad(pjNombre, 'fisica');
    const magiaTotal = getTotalAfinidad(pjNombre, 'energetica') + getTotalAfinidad(pjNombre, 'espiritual') + 
                       getTotalAfinidad(pjNombre, 'mando') + getTotalAfinidad(pjNombre, 'psiquica') + getTotalAfinidad(pjNombre, 'oscura');

    const nuevaRojaMax = 10 + Math.floor(fis / 2);
    const nuevaAzul = Math.floor(magiaTotal / 4);

    setPjStat(pjNombre, 'baseVidaRojaMax', null, nuevaRojaMax, false);
    setPjStat(pjNombre, 'baseVidaAzul', null, nuevaAzul, false);
    setPjStat(pjNombre, 'vidaRojaActual', null, nuevaRojaMax + getPjStat(pjNombre, 'buffs', 'vidaRojaMaxExtra') + getPjStat(pjNombre, 'hechizos', 'vidaRojaMaxExtra'), true); 
}

export function setVistaStats(vista) {
    stState.vistaActiva = vista;
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function toggleEstado(pjNombre, estadoId) {
    const actual = getPjStat(pjNombre, 'estados', estadoId);
    setPjStat(pjNombre, 'estados', estadoId, !actual);
}

// 🌟 GESTIÓN DE ESTADOS GLOBALES
export function guardarNuevoEstado(nombre, tipo, bgHex, borderHex, desc) {
    const id = norm(nombre); // Se genera solo
    if (!id) return alert("El nombre no es válido.");
    
    stState.colaEstadosConfig[id] = {
        nombre: nombre,
        tipo: tipo,
        color_bg: bgHex + '55', // Transparencia automática
        color_border: borderHex,
        descripcion: desc
    };
    alert(`Estado "${nombre}" guardado en la cola.`);
    window.dispatchEvent(new Event('devUIUpdate')); 
}

export function cargarEstadoParaEditar(id) {
    const e = stState.estadosDB.find(x => x.id === id) || stState.colaEstadosConfig[id];
    if (e) {
        document.getElementById('ne-nom').value = e.nombre;
        document.getElementById('ne-tipo').value = e.tipo;
        document.getElementById('ne-b').value = e.border || e.color_border || '#ff4444';
        document.getElementById('ne-bg').value = (e.bg || e.color_bg || '#800000').slice(0,7); 
        document.getElementById('ne-desc').value = e.desc || e.descripcion || '';
    }
}

export function borrarEstadoGlobal(id) {
    if (!confirm("¿Seguro que deseas eliminar este estado PARA SIEMPRE de la base de datos?")) return;
    stState.colaBorrarEstados.push(id);
    stState.estadosDB = stState.estadosDB.filter(e => e.id !== id);
    window.dispatchEvent(new Event('devUIUpdate'));
}
