// ============================================================
// panel-stats-logic.js — Lógica matemática y modificaciones
// ============================================================

import { stState } from './panel-stats-state.js';
import { norm } from '../dev-state.js';

export function initStatsDev(statsGlobal, listaEstados) {
    stState.statsDB = JSON.parse(JSON.stringify(statsGlobal || {}));
    stState.estadosDB = JSON.parse(JSON.stringify(listaEstados || []));
    
    // 🌟 Cargar las notas desde la base de datos al estado local
    stState.notasAfinidad = {};
    for (const pj in stState.statsDB) {
        if (stState.statsDB[pj].notasAfinidad) {
            stState.notasAfinidad[pj] = JSON.parse(JSON.stringify(stState.statsDB[pj].notasAfinidad));
        }
    }
}

export function esSistema(pjNombre) {
    return !!(stState.statsDB[pjNombre]?.isSistema);
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

// ── NOTA POR AFINIDAD ────────────────────────────────────────────────────────
export function setNotaAfinidad(pjNombre, flatKey, nota) {
    if (!stState.notasAfinidad[pjNombre]) stState.notasAfinidad[pjNombre] = {};
    stState.notasAfinidad[pjNombre][flatKey] = nota;
    
    // 🌟 Enviar a la cola para guardar en BD
    if (!stState.colaNotas[pjNombre]) stState.colaNotas[pjNombre] = {};
    stState.colaNotas[pjNombre][flatKey] = nota;
    
    window.dispatchEvent(new Event('devDataChanged')); // Despierta el botón de Sincronizar
}

export function toggleNotaOculta(pjNombre, flatKey) {
    const k = `${pjNombre}|${flatKey}`;
    if (stState.notasOcultasSet.has(k)) stState.notasOcultasSet.delete(k);
    else stState.notasOcultasSet.add(k);
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setSubVistaAfinidades(sub) {
    stState.subVistaAfinidades = sub;
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setSubVistaVida(sub) {
    stState.subVistaVida = sub;
    window.dispatchEvent(new Event('devUIUpdate'));
}

// ── LÓGICA DE CASCADA PARA VIDA AZUL Y GUARDA ──────────────────────────────
export function modVidaGuardaCascada(pjNombre, tipo, variacion) {
    if (!pjNombre) return;
    const baseKey = tipo === 'vidaAzul' ? 'baseVidaAzul' : 'baseGuardaDorada';
    const extraKey = tipo === 'vidaAzul' ? 'vidaAzulExtra' : 'guardaDoradaExtra';

    if (variacion > 0) {
        modPjStat(pjNombre, baseKey, null, variacion);
    } else if (variacion < 0) {
        let restante = Math.abs(variacion);
        const orden = [
            { raiz: 'hechizos', sub: extraKey },
            { raiz: 'buffs', sub: extraKey },
            { raiz: 'hechizosEfecto', sub: extraKey },
            { raiz: baseKey, sub: null }
        ];

        for (const nodo of orden) {
            if (restante <= 0) break;
            const actual = getPjStat(pjNombre, nodo.raiz, nodo.sub);
            if (actual > 0) {
                const aRestar = Math.min(actual, restante);
                modPjStat(pjNombre, nodo.raiz, nodo.sub, -aRestar, false, false);
                restante -= aRestar;
            }
        }
        window.dispatchEvent(new Event('devUIUpdate'));
    }
}

// ── ASISTENCIA ───────────────────────────────────────────────────────────────
export function darAsistencia(pjNombre) {
    const asistActual = getPjStat(pjNombre, 'asistencia');
    let nuevaAsist = asistActual + 1;
    let hexBono = 300;
    let esReinicio = false;

    if (nuevaAsist >= 8) {
        nuevaAsist = 1;
        hexBono += 1000;
        esReinicio = true;
    }

    if (!stState.colaStats[pjNombre]) stState.colaStats[pjNombre] = {};
    stState.colaStats[pjNombre].__asistPrevio = asistActual;
    stState.colaStats[pjNombre].__esReinicio = esReinicio;

    setPjStat(pjNombre, 'asistencia', null, nuevaAsist, false);
    modPjStat(pjNombre, 'hex', null, hexBono, false, true); 
}

export function limpiarLogAsistencia() {
    stState.logAsistencia = "";
    window.dispatchEvent(new Event('devUIUpdate'));
}

function getTotalAfinidad(pj, af) {
    return Number(getPjStat(pj, 'afinidadesBase', af) || 0) +
           Number(getPjStat(pj, 'hechizos', af) || 0) +
           Number(getPjStat(pj, 'hechizosEfecto', af) || 0) +
           Number(getPjStat(pj, 'buffs', af) || 0);
}

export function getTotalAfinidadSmart(pjNombre, af) {
    const base = getPjStat(pjNombre, 'afinidadesBase', af) || 0;
    const hcz  = esSistema(pjNombre) ? 0 : (getPjStat(pjNombre, 'hechizos', af) || 0);
    const alt  = getPjStat(pjNombre, 'hechizosEfecto', af) || 0;
    const buff = getPjStat(pjNombre, 'buffs', af) || 0;
    return base + hcz + alt + buff;
}

export function getVexMax(pjNombre) {
    const calcOscT = getTotalAfinidad(pjNombre, 'oscura');
    return Math.round(((calcOscT * 300) / 4) / 50) * 50; 
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

function mostrarFeedback(msg, color = '#ffaa00') {
    const el = document.getElementById('stats-feedback');
    if (!el) return;
    el.textContent = msg;
    el.style.color = color;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 2500);
}

export function guardarNuevoEstado(nombre, tipo, bgHex, borderHex, desc) {
    const id = norm(nombre); 
    if (!id) { mostrarFeedback('❌ Nombre no válido.', '#ff4444'); return; }
    
    stState.colaEstadosConfig[id] = {
        nombre: nombre,
        tipo: tipo,
        color_bg: bgHex + '55', 
        color_border: borderHex,
        descripcion: desc
    };
    mostrarFeedback(`✅ Estado "${nombre}" en cola.`, '#00ff88');
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

export function calcularVidaRojaMaxTotal(pjNombre) {
    const base   = getPjStat(pjNombre, 'baseVidaRojaMax');
    const hcz    = getPjStat(pjNombre, 'hechizos', 'vidaRojaMaxExtra');
    const alt    = getPjStat(pjNombre, 'hechizosEfecto', 'vidaRojaMaxExtra');
    const ext    = getPjStat(pjNombre, 'buffs', 'vidaRojaMaxExtra');
    const fisBase  = getPjStat(pjNombre, 'afinidadesBase', 'fisica');
    const fisHcz   = getPjStat(pjNombre, 'hechizos',        'fisica');
    const fisAlt   = getPjStat(pjNombre, 'hechizosEfecto',  'fisica');
    const fisExt   = getPjStat(pjNombre, 'buffs',           'fisica');
    const fisTotal = fisBase + fisHcz + fisAlt + fisExt;
    const bonusFisica = Math.floor(fisTotal / 2) - Math.floor(fisBase / 2);
    return base + hcz + alt + ext + bonusFisica;
}

export function calcularVidaAzulTotal(pjNombre) {
    return getPjStat(pjNombre, 'baseVidaAzul') +
           getPjStat(pjNombre, 'hechizos',       'vidaAzulExtra') +
           getPjStat(pjNombre, 'hechizosEfecto', 'vidaAzulExtra') +
           getPjStat(pjNombre, 'buffs',          'vidaAzulExtra');
}

export function calcularGuardaDoradaTotal(pjNombre) {
    return getPjStat(pjNombre, 'baseGuardaDorada') +
           getPjStat(pjNombre, 'hechizos',       'guardaDoradaExtra') +
           getPjStat(pjNombre, 'hechizosEfecto', 'guardaDoradaExtra') +
           getPjStat(pjNombre, 'buffs',          'guardaDoradaExtra');
}

export function calcularDanoRojoTotal(pjNombre) {
    return getPjStat(pjNombre, 'baseDanoRojo') +
           getPjStat(pjNombre, 'hechizos',       'danoRojo') +
           getPjStat(pjNombre, 'hechizosEfecto', 'danoRojo') +
           getPjStat(pjNombre, 'buffs',          'danoRojo');
}

export function calcularDanoAzulTotal(pjNombre) {
    return getPjStat(pjNombre, 'baseDanoAzul') +
           getPjStat(pjNombre, 'hechizos',       'danoAzul') +
           getPjStat(pjNombre, 'hechizosEfecto', 'danoAzul') +
           getPjStat(pjNombre, 'buffs',          'danoAzul');
}

export function calcularElimDoradaTotal(pjNombre) {
    return getPjStat(pjNombre, 'baseElimDorada') +
           getPjStat(pjNombre, 'hechizos',       'elimDorada') +
           getPjStat(pjNombre, 'hechizosEfecto', 'elimDorada') +
           getPjStat(pjNombre, 'buffs',          'elimDorada');
}

export function borrarEstadoGlobal(id) {
    if (!confirm("¿Seguro que deseas eliminar este estado PARA SIEMPRE de la base de datos?")) return;
    stState.colaBorrarEstados.push(id);
    stState.estadosDB = stState.estadosDB.filter(e => e.id !== id);
    window.dispatchEvent(new Event('devUIUpdate'));
}
