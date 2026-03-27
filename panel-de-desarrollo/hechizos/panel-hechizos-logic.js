// ============================================================
// panel-hechizos-logic.js — Lógica de Casteo y Asignación
// ============================================================

import { hzState } from './panel-hechizos-state.js';
import { getPjStat, modPjStat, getVexMax } from '../estadisticas/panel-stats-logic.js';
import { norm } from '../dev-state.js';

export function initHechizosDev(catalogo, inventarios_pj) {
    hzState.catalogoDB = catalogo || [];
    hzState.inventariosDB = {};
    
    (inventarios_pj || []).forEach(item => {
        const pj = norm(item.personaje_nombre || item.Personaje || ""); 
        const hzId = norm(item.hechizo_nombre || item.hechizo_id || item.Hechizo || item.ID || item.id);
        
        if (!pj || !hzId) return;
        if (!hzState.inventariosDB[pj]) hzState.inventariosDB[pj] = [];
        hzState.inventariosDB[pj].push(hzId);
    });
}

function obtenerAfinidadTotal(pjNombre, afNombreRaw) {
    const af = norm(afNombreRaw || '');
    const mapa = {
        'fisica': 'fisica', 'energetica': 'energetica', 'espiritual': 'espiritual',
        'mando': 'mando', 'psiquica': 'psiquica', 'oscura': 'oscura'
    };
    const key = mapa[af];
    if (!key) return 0;
    
    return (getPjStat(pjNombre, 'afinidadesBase', key) || 0) +
           (getPjStat(pjNombre, 'hechizos', key) || 0) +
           (getPjStat(pjNombre, 'hechizosEfecto', key) || 0) +
           (getPjStat(pjNombre, 'buffs', key) || 0);
}

// ── FORMULARIO DE CASTEO MASIVO ──
export function setNumFilasCast(num) {
    hzState.casteoManual.numFilas = parseInt(num) || 1;
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function modFilaCast(index, campo, valor, pjNombre) {
    const oldValue = hzState.casteoManual.filas[index][campo];
    hzState.casteoManual.filas[index][campo] = valor;
    
    if (campo === 'nombre' && pjNombre) {
        const hechizo = hzState.catalogoDB.find(h => 
            norm(h.Nombre || h.nombre || '') === norm(valor) || 
            norm(h.ID || h.id || '') === norm(valor)
        );
        
        const afInput = document.getElementById(`dev-afinidad-${index}`);

        if (hechizo) {
            const nuevaAfinidad = obtenerAfinidadTotal(pjNombre, hechizo.Afinidad);
            hzState.casteoManual.filas[index].afinidad = nuevaAfinidad;
            if (afInput) afInput.value = nuevaAfinidad;
        } else if (oldValue && !hechizo) {
            hzState.casteoManual.filas[index].afinidad = '';
            if (afInput) afInput.value = '';
        }
    }
}

export function setModoDatalist(modo) { hzState.casteoManual.datalistModo = modo; window.dispatchEvent(new Event('devUIUpdate')); }

export function copiarPrimerHechizo() {
    const fila = hzState.casteoManual.filas[0];
    if (!fila.nombre) return alert("La primera fila está vacía.");
    const num = hzState.casteoManual.numFilas;
    for (let i = 1; i < num; i++) {
        hzState.casteoManual.filas[i].nombre = fila.nombre;
        hzState.casteoManual.filas[i].afinidad = fila.afinidad;
        const elNombre = document.getElementById(`dev-spell-${i}`);
        const elAf = document.getElementById(`dev-afinidad-${i}`);
        if (elNombre) elNombre.value = fila.nombre;
        if (elAf) elAf.value = fila.afinidad;
    }
    navigator.clipboard.writeText(`Casteando: ${fila.nombre}`).then(() => alert(`"${fila.nombre}" copiado a todas las filas.`));
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function copiarPrimerDado() {
    const fila = hzState.casteoManual.filas[0];
    if (!fila.dado && fila.dado !== 0) return alert("El primer dado está vacío.");
    const dado = fila.dado;
    const num = hzState.casteoManual.numFilas;
    for (let i = 1; i < num; i++) {
        hzState.casteoManual.filas[i].dado = dado;
        const el = document.getElementById(`dev-dado-${i}`);
        if (el) el.value = dado;
    }
    navigator.clipboard.writeText(`!r 1d100 + ${fila.afinidad || 0} // ${fila.nombre || '?'}`).then(() => alert(`Dado ${dado} copiado a todas las filas.`));
}

export function calcularConjurosMasivos(pjNombre) {
    let totalCost = 0;
    let logsArr = [];
    let validSpells = 0;

    for (let i = 0; i < hzState.casteoManual.numFilas; i++) {
        const fila = hzState.casteoManual.filas[i];
        if (!fila.nombre || fila.nombre.trim() === '') continue;

        const hechizo = hzState.catalogoDB.find(h => 
            norm(h.Nombre || h.nombre || '') === norm(fila.nombre) || 
            norm(h.ID || h.id || '') === norm(fila.nombre)
        );

        const cant = parseInt(fila.cant) || 1;
        const dado = parseInt(fila.dado) || 0;
        const afin = parseInt(fila.afinidad) || 0;

        if (hechizo) {
            const costoU = parseInt(hechizo.HEX || hechizo.Hex || hechizo.costo || hechizo.Costo || 0) || 0;
            totalCost += (costoU * cant);
            validSpells += cant;

            const nc = dado * afin;
            let outcome = "";
            let efeToPrint = hechizo.Efecto || hechizo.efecto_desc || hechizo.efecto || '';
            const outcastProp = hechizo.Overcast || hechizo.overcast || hechizo.Overcast_desc || '';

            if (nc < costoU) {
                outcome = "❌ FALLO";
            } else if (outcastProp && nc >= (costoU * 2)) {
                outcome = "🌟 OVERCAST";
                efeToPrint = outcastProp; 
            } else {
                outcome = "✅ ÉXITO";
            }

            const realName = hechizo.Nombre || hechizo.nombre;
            const efectoFinal = (hzState.mostrarEfectos && efeToPrint && !outcome.includes('FALLO')) ? ` | ${efeToPrint}` : '';
            logsArr.push(`Casteo | ${realName} x${cant} | NC: ${nc} | ${outcome}${efectoFinal}`);
        } else {
            logsArr.push(`[!] Hechizo no encontrado: ${fila.nombre} x${cant}`);
        }
    }

    if (validSpells === 0 && logsArr.length === 0) return alert("Llena al menos una casilla de hechizo válida.");

    let stringCobro = "";
    if (hzState.cobrarAuto && totalCost > 0) {
        const vexMax = getVexMax(pjNombre);
        const vexUsado = hzState.vexGastadoPorPj[pjNombre] || 0;
        const vexDisponible = Math.max(0, vexMax - vexUsado);

        if (vexDisponible >= totalCost) {
            hzState.vexGastadoPorPj[pjNombre] = vexUsado + totalCost;
            stringCobro = `Hexcast | -${totalCost} Vex`;
        } else {
            const hexAFacturar = totalCost - vexDisponible;
            hzState.vexGastadoPorPj[pjNombre] = vexMax; 
            modPjStat(pjNombre, 'hex', null, -hexAFacturar, true, false);
            
            const hexActual = getPjStat(pjNombre, 'hex'); 
            const textoVex = vexDisponible > 0 ? `-${vexDisponible} Vex y ` : '';
            stringCobro = `Hexcast | ${textoVex}-${hexAFacturar} Hex (${hexActual})`;
        }
    }

    if (stringCobro) hzState.logCasteosSession.push({ pj: pjNombre, msg: stringCobro });
    logsArr.forEach(l => hzState.logCasteosSession.push({ pj: pjNombre, msg: l }));

    hzState.casteoManual.filas = Array.from({ length: 50 }, () => ({ dado: '', nombre: '', afinidad: '', cant: 1 }));
    window.dispatchEvent(new Event('devUIUpdate'));
}

// ── ASIGNACIÓN Y VISIBILIDAD ──
export function asignarHechizo(pjNombre, hechizoId) {
    const pjKey = norm(pjNombre);
    const idNorm = norm(hechizoId);
    
    if (!hzState.colaAsignaciones[pjKey]) hzState.colaAsignaciones[pjKey] = {};
    
    const yaLoTiene = hzState.colaAsignaciones[pjKey][hechizoId] ?? (hzState.inventariosDB[pjKey] || []).includes(idNorm);
    const accionDar = !yaLoTiene;
    
    hzState.colaAsignaciones[pjKey][hechizoId] = accionDar;

    const hechizo = hzState.catalogoDB.find(h => norm(h.ID || h.id) === idNorm);
    const costo = parseInt(hechizo ? (hechizo.HEX || hechizo.Hex || hechizo.costo || hechizo.Costo || 0) : 0) || 0;
    const nombreHechizo = hechizo ? (hechizo.Nombre || hechizo.nombre || hechizoId) : hechizoId;

    if (accionDar && hzState.cobrarAlAsignar && costo > 0) {
        modPjStat(pjNombre, 'hex', null, -costo, true, false); 
    }

    const hexActual = getPjStat(pjNombre, 'hex');
    const accionStr = accionDar ? "Hechizo Aprendido" : "Hechizo Olvidado";
    const strCobro = (accionDar && hzState.cobrarAlAsignar && costo > 0) ? ` | -${costo} Hex (${hexActual})` : "";
    
    hzState.logCasteosSession.push({ pj: pjNombre, msg: `${accionStr} | ${nombreHechizo}${strCobro}` });
    
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function toggleVisibilidad(hechizoId) {
    const currentQ = hzState.colaVisibilidad[hechizoId];
    const dbHech = hzState.catalogoDB.find(h => (h.ID || h.id) === hechizoId);
    if (!dbHech) return;

    const isPublicBase = dbHech.Conocido && dbHech.Conocido.toString().trim().toLowerCase() === 'si';

    if (currentQ !== undefined) {
        delete hzState.colaVisibilidad[hechizoId]; 
    } else {
        hzState.colaVisibilidad[hechizoId] = !isPublicBase; 
    }
    
    window.dispatchEvent(new Event('devDataChanged')); 
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setBusquedaHz(texto) { hzState.busquedaAsignar = texto.toLowerCase(); window.dispatchEvent(new Event('devUIUpdate')); }
export function setVistaHz(vista) { hzState.vistaActiva = vista; window.dispatchEvent(new Event('devUIUpdate')); }
export function toggleConfigCasteo(campo, valor) { hzState[campo] = valor; }
