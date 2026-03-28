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

// ── TOGGLE COBRAR HEX INDIVIDUAL ──────────────────────────────────────────────
// null = sigue el global | true/false = override individual
// Al hacer click: si el nuevo estado coincide con el global, vuelve a null (sin override).
export function toggleFilaCobrar(i) {
    const fila = hzState.casteoManual.filas[i];
    const efectivo = fila.cobrarHex !== null ? fila.cobrarHex : hzState.cobrarAuto;
    const nuevo = !efectivo;
    // Si el nuevo valor iguala al global, no hace falta override → reset a null
    fila.cobrarHex = (nuevo === hzState.cobrarAuto) ? null : nuevo;
    window.dispatchEvent(new Event('devUIUpdate'));
}

// ── TOGGLE INFALIBLE (NO FALLA) INDIVIDUAL ─────────────────────────────────────
// Cuando está activo el hechizo ignora la lógica de NC: siempre acierta (sin overcast).
export function toggleFilaNoFalla(i) {
    hzState.casteoManual.filas[i].noFalla = !hzState.casteoManual.filas[i].noFalla;
    window.dispatchEvent(new Event('devUIUpdate'));
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

// 🌟 UTILIDAD DE EXTRACCIÓN (Filtrando ceros y vacíos)
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

export function calcularConjurosMasivos(pjNombre) {
    let totalCost = 0;
    let logsArr = [];
    let validSpells = 0;
    let ajusteNotes = []; // Notas de sobrecosto/descuento para la línea Hexcast

    for (let i = 0; i < hzState.casteoManual.numFilas; i++) {
        const fila = hzState.casteoManual.filas[i];
        if (!fila.nombre || fila.nombre.trim() === '') continue;

        const hechizo = hzState.catalogoDB.find(h => 
            norm(h.Nombre || h.nombre || '') === norm(fila.nombre) || 
            norm(h.ID || h.id || '') === norm(fila.nombre)
        );

        const cant       = parseInt(fila.cant)       || 1;
        const dado       = parseInt(fila.dado)       || 0;
        const afin       = parseInt(fila.afinidad)   || 0;
        const noFalla    = fila.noFalla === true;
        const ajusteCosto = parseInt(fila.ajusteCosto) || 0;

        // ── Cobro efectivo para esta fila ──────────────────────────────────────
        // null → sigue global | true/false → override individual
        const debeCobrarse = fila.cobrarHex !== null ? fila.cobrarHex : hzState.cobrarAuto;

        if (hechizo) {
            const baseCosto = parseInt(hechizo.HEX || hechizo.Hex || hechizo.Costo || hechizo.costo || 0) || 0;
            // El costo efectivo nunca baja de 0
            const costoEfectivo = Math.max(0, baseCosto + ajusteCosto);

            if (debeCobrarse) {
                totalCost += costoEfectivo * cant;
                // Registrar nota de ajuste si la hay
                if (ajusteCosto !== 0) {
                    const realNameNota = hechizo.Nombre || hechizo.nombre;
                    const totalAjuste  = ajusteCosto * cant;
                    const tipoAjuste   = ajusteCosto > 0 ? 'Sobrecosto' : 'Descuento';
                    const signo        = ajusteCosto > 0 ? '+' : '';
                    ajusteNotes.push(`${tipoAjuste}: ${signo}${totalAjuste} (${realNameNota})`);
                }
            }
            validSpells += cant;

            const nc = dado * afin;

            let efeToPrint  = getValKeys(hechizo, ['efecto_desc', 'efecto', 'desc', 'descripcion']);
            const outcastProp = getValKeys(hechizo, ['overcast 100%', 'overcast', 'efecto_overcast']);

            // El overcast no aplica cuando el hechizo es infalible
            const isOvercast = !noFalla && !!outcastProp && costoEfectivo > 0 && nc >= (costoEfectivo * 2);
            const isFallo    = !noFalla && nc < costoEfectivo;

            const realName = hechizo.Nombre || hechizo.nombre;

            let lineLog = `Casteo | ${realName} x${cant} | `;

            if (noFalla) {
                // ── Hechizo Infalible ────────────────────────────────────────────
                lineLog += `Infalible | ✅ ÉXITO`;
                if (hzState.mostrarEfectos && efeToPrint) lineLog += ` | ${efeToPrint}`;
            } else if (isFallo) {
                lineLog += `NC: ${nc} | ❌ FALLO`;
            } else {
                lineLog += `NC: ${nc} | `;
                if (hzState.mostrarEfectos) {
                    lineLog += `✅ ÉXITO`;
                    if (efeToPrint) lineLog += ` | ${efeToPrint}`;
                    if (isOvercast && outcastProp) lineLog += ` | 🌟 Overcast: ${outcastProp}`;
                } else {
                    lineLog += isOvercast ? `✅ ÉXITO (Overcast)` : `✅ ÉXITO`;
                }
            }

            logsArr.push(lineLog);
        } else {
            logsArr.push(`[!] Hechizo no encontrado: ${fila.nombre} x${cant}`);
        }
    }

    if (validSpells === 0 && logsArr.length === 0) return alert("Llena al menos una casilla de hechizo válida.");

    // ── Cobro de Vex/HEX ─────────────────────────────────────────────────────
    // Ya no depende de cobrarAuto global: totalCost solo acumula filas con debeCobrarse=true
    let stringCobro = "";
    if (totalCost > 0) {
        const ajusteSuffix = ajusteNotes.length > 0 ? ` | ${ajusteNotes.join(' | ')}` : '';

        const vexMax = getVexMax(pjNombre);
        const vexUsado = hzState.vexGastadoPorPj[pjNombre] || 0;
        const vexDisponible = Math.max(0, vexMax - vexUsado);

        if (vexDisponible >= totalCost) {
            hzState.vexGastadoPorPj[pjNombre] = vexUsado + totalCost;
            stringCobro = `Hexcast | -${totalCost} Vex${ajusteSuffix}`;
        } else {
            const hexAFacturar = totalCost - vexDisponible;
            hzState.vexGastadoPorPj[pjNombre] = vexMax;
            modPjStat(pjNombre, 'hex', null, -hexAFacturar, true, false);
            
            const hexActual   = getPjStat(pjNombre, 'hex');
            const textoVex    = vexDisponible > 0 ? `-${vexDisponible} Vex y ` : '';
            stringCobro = `Hexcast | ${textoVex}-${hexAFacturar} Hex (${hexActual})${ajusteSuffix}`;
        }
    }

    if (stringCobro) hzState.logCasteosSession.push({ pj: pjNombre, msg: stringCobro });
    logsArr.forEach(l => hzState.logCasteosSession.push({ pj: pjNombre, msg: l }));

    // Reset filas con los nuevos campos
    hzState.casteoManual.filas = Array.from({ length: 50 }, () => ({
        dado: '', nombre: '', afinidad: '', cant: 1,
        cobrarHex: null, noFalla: false, ajusteCosto: 0
    }));
    window.dispatchEvent(new Event('devUIUpdate'));
}

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
    const dbHech = hzState.catalogoDB.find(h => (h.ID || h.id) === hechizoId);
    if (!dbHech) return;

    const enCola = hzState.colaVisibilidad[hechizoId];
    const isKnownDb = dbHech.es_conocido !== false && dbHech.es_conocido !== "FALSE" 
                   && dbHech.es_conocido !== 0    && dbHech.es_conocido !== "0"
                   && dbHech.es_conocido !== null  && dbHech.es_conocido !== undefined;
    const estadoActual = enCola !== undefined ? enCola : isKnownDb;
    const nuevoEstado  = !estadoActual;

    hzState.colaVisibilidad[hechizoId] = nuevoEstado;

    const nombreHechizo = dbHech.Nombre || dbHech.nombre || hechizoId;
    const accionStr = nuevoEstado ? "Hechizo Descubierto" : "Hechizo Sellado";
    hzState.logCasteosSession.push({ pj: '—', msg: `${accionStr} | ${nombreHechizo}` });

    window.dispatchEvent(new Event('devDataChanged')); 
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setBusquedaHz(texto) { hzState.busquedaAsignar = texto.toLowerCase(); window.dispatchEvent(new Event('devUIUpdate')); }
export function setVistaHz(vista) { hzState.vistaActiva = vista; window.dispatchEvent(new Event('devUIUpdate')); }
export function toggleConfigCasteo(campo, valor) { hzState[campo] = valor; }
