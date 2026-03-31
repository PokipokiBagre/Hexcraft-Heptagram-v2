// ============================================================
// panel-hechizos-logic.js — Lógica de Casteo y Asignación
// ============================================================

import { hzState } from './panel-hechizos-state.js';
import { getPjStat, modPjStat, getVexMax, esSistema } from '../estadisticas/panel-stats-logic.js';
import { norm } from '../dev-state.js';

export function initHechizosDev(catalogo, inventarios_pj) {
    hzState.catalogoDB = catalogo || [];
    hzState.inventariosDB = {};
    (inventarios_pj || []).forEach(item => {
        const pj   = norm(item.personaje_nombre || item.Personaje || ""); 
        const hzId = norm(item.hechizo_nombre || item.hechizo_id || item.Hechizo || item.ID || item.id);
        if (!pj || !hzId) return;
        if (!hzState.inventariosDB[pj]) hzState.inventariosDB[pj] = [];
        hzState.inventariosDB[pj].push(hzId);
    });
}

// Total de afinidad respetando regla sistema (sin grimorio para NPCs sistema)
function obtenerAfinidadTotal(pjNombre, afNombreRaw) {
    const af   = norm(afNombreRaw || '');
    const mapa = { fisica:'fisica', energetica:'energetica', espiritual:'espiritual', mando:'mando', psiquica:'psiquica', oscura:'oscura' };
    const key  = mapa[af];
    if (!key) return 0;
    const base = getPjStat(pjNombre, 'afinidadesBase', key) || 0;
    const hcz  = esSistema(pjNombre) ? 0 : (getPjStat(pjNombre, 'hechizos', key) || 0);
    const alt  = getPjStat(pjNombre, 'hechizosEfecto', key) || 0;
    const buff = getPjStat(pjNombre, 'buffs', key) || 0;
    return base + hcz + alt + buff;
}

export function setNumFilasCast(num) { hzState.casteoManual.numFilas = parseInt(num) || 1; window.dispatchEvent(new Event('devUIUpdate')); }

export function modFilaCast(index, campo, valor, pjNombre) {
    const oldValue = hzState.casteoManual.filas[index][campo];
    hzState.casteoManual.filas[index][campo] = valor;
    if (campo === 'nombre' && pjNombre) {
        const hechizo = hzState.catalogoDB.find(h => norm(h.Nombre||h.nombre||'') === norm(valor) || norm(h.ID||h.id||'') === norm(valor));
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

export function toggleFilaCobrar(i) {
    const fila     = hzState.casteoManual.filas[i];
    const efectivo = fila.cobrarHex !== null ? fila.cobrarHex : hzState.cobrarAuto;
    const nuevo    = !efectivo;
    fila.cobrarHex = (nuevo === hzState.cobrarAuto) ? null : nuevo;
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function toggleFilaNoFalla(i) { hzState.casteoManual.filas[i].noFalla = !hzState.casteoManual.filas[i].noFalla; window.dispatchEvent(new Event('devUIUpdate')); }

export function toggleFilaContrarrestada(i) {
    const fila = hzState.casteoManual.filas[i];
    fila.contrarrestado = !fila.contrarrestado;
    // Contrarrestado y noFalla son mutuamente excluyentes
    if (fila.contrarrestado) fila.noFalla = false;
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setModoDatalist(modo) { hzState.casteoManual.datalistModo = modo; window.dispatchEvent(new Event('devUIUpdate')); }

export function copiarPrimerHechizo() {
    const fila = hzState.casteoManual.filas[0];
    if (!fila.nombre) return alert("La primera fila está vacía.");
    const num = hzState.casteoManual.numFilas;
    for (let i = 1; i < num; i++) {
        hzState.casteoManual.filas[i].nombre   = fila.nombre;
        hzState.casteoManual.filas[i].afinidad = fila.afinidad;
        const elN = document.getElementById(`dev-spell-${i}`);
        const elA = document.getElementById(`dev-afinidad-${i}`);
        if (elN) elN.value = fila.nombre;
        if (elA) elA.value = fila.afinidad;
    }
    navigator.clipboard.writeText(`Casteando: ${fila.nombre}`).then(() => alert(`"${fila.nombre}" copiado a todas las filas.`));
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function copiarPrimerDado() {
    const fila = hzState.casteoManual.filas[0];
    if (!fila.dado && fila.dado !== 0) return alert("El primer dado está vacío.");
    const dado = fila.dado; const num = hzState.casteoManual.numFilas;
    for (let i = 1; i < num; i++) {
        hzState.casteoManual.filas[i].dado = dado;
        const el = document.getElementById(`dev-dado-${i}`);
        if (el) el.value = dado;
    }
    navigator.clipboard.writeText(`!r 1d100 + ${fila.afinidad || 0} // ${fila.nombre || '?'}`).then(() => alert(`Dado ${dado} copiado a todas las filas.`));
}

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
        if (matched) { const val = getVal(obj[matched]); if (val) return val; }
    }
    return '';
};

// ─────────────────────────────────────────────────────────────────────────────
// CALCULAR CONJUROS — Simula balance de recursos hechizo a hechizo.
// Los hechizos fallidos (NC bajo o sin fondos) NO gastan Vex ni Hex.
// Si al cobrar quedaría Hex negativo → el hechizo falla directamente.
// ─────────────────────────────────────────────────────────────────────────────
export function calcularConjurosMasivos(pjNombre) {
    let logsArr = [], validSpells = 0, ajusteNotes = [];

    // Balance inicial
    const vexMax    = getVexMax(pjNombre);
    const vexUsado  = hzState.vexGastadoPorPj[pjNombre] || 0;
    let vexRestante = Math.max(0, vexMax - vexUsado);
    let hexRestante = getPjStat(pjNombre, 'hex');
    let totalVexGastado = 0, totalHexGastado = 0;

    for (let i = 0; i < hzState.casteoManual.numFilas; i++) {
        const fila = hzState.casteoManual.filas[i];
        if (!fila.nombre || fila.nombre.trim() === '') continue;

        const hechizo = hzState.catalogoDB.find(h =>
            norm(h.Nombre||h.nombre||'') === norm(fila.nombre) ||
            norm(h.ID||h.id||'') === norm(fila.nombre)
        );

        const cant        = parseInt(fila.cant)        || 1;
        const dado        = parseInt(fila.dado)        || 0;
        const afin        = parseInt(fila.afinidad)    || 0;
        const noFalla     = fila.noFalla === true;
        // fila.contrarrestado se lee directamente donde se necesita
        const ajusteCosto = parseInt(fila.ajusteCosto) || 0;
        const debeCobrarse = fila.cobrarHex !== null ? fila.cobrarHex : hzState.cobrarAuto;

        if (hechizo) {
            const baseCosto  = parseInt(hechizo.HEX || hechizo.Hex || hechizo.Costo || hechizo.costo || 0) || 0;
            const costoUnit  = Math.max(0, baseCosto + ajusteCosto);
            const costoTotal = costoUnit * cant;
            const nc         = dado * afin;

            const efeToPrint  = getValKeys(hechizo, ['efecto_desc','efecto','desc','descripcion']);
            const outcastProp = getValKeys(hechizo, ['overcast 100%','overcast','efecto_overcast']);
            const realName    = hechizo.Nombre || hechizo.nombre;

            // Prefijo del log: usar afinidad del hechizo en lugar de "Casteo"
            const afHechizo   = hechizo.Afinidad || hechizo.afinidad || 'Casteo';
            let lineLog = `${afHechizo} | ${realName} x${cant} | `;
            let resultado = 'exito';

            if (fila.contrarrestado) {
                resultado = 'contrarrestado';
            } else if (!noFalla) {
                if (nc < costoUnit) {
                    resultado = 'fallo_nc';
                } else if (debeCobrarse && costoTotal > 0) {
                    if ((vexRestante + hexRestante) < costoTotal) resultado = 'fallo_fondos';
                }
            }

            if (resultado === 'contrarrestado') {
                lineLog += `NC: ${nc} | Contrarrestado | FALLO`;

            } else if (resultado === 'fallo_nc') {
                lineLog += `NC: ${nc} | FALLO`;

            } else if (resultado === 'fallo_fondos') {
                const disponible = vexRestante + hexRestante;
                lineLog += `NC: ${nc} | FALLO (Sin Hex: necesita ${costoTotal}, disponible ${disponible})`;

            } else {
                // ÉXITO — cobrar
                if (debeCobrarse && costoTotal > 0) {
                    const vexAGastar = Math.min(vexRestante, costoTotal);
                    const hexAGastar = costoTotal - vexAGastar;
                    vexRestante -= vexAGastar; hexRestante -= hexAGastar;
                    totalVexGastado += vexAGastar; totalHexGastado += hexAGastar;
                    if (ajusteCosto !== 0) {
                        const tipo  = ajusteCosto > 0 ? 'Sobrecosto' : 'Descuento';
                        const signo = ajusteCosto > 0 ? '+' : '';
                        ajusteNotes.push(`${tipo}: ${signo}${ajusteCosto * cant} (${realName})`);
                    }
                }
                const isOvercast = !noFalla && !!outcastProp && costoUnit > 0 && nc >= (costoUnit * 2);
                if (noFalla) {
                    lineLog += `Infalible | ÉXITO`;
                    if (hzState.mostrarEfectos && efeToPrint) lineLog += ` | ${efeToPrint}`;
                } else {
                    lineLog += `NC: ${nc} | `;
                    if (hzState.mostrarEfectos) {
                        lineLog += `ÉXITO`;
                        if (efeToPrint) lineLog += ` | ${efeToPrint}`;
                        if (isOvercast && outcastProp) lineLog += ` | Overcast: ${outcastProp}`;
                    } else {
                        lineLog += isOvercast ? `ÉXITO (Overcast)` : `ÉXITO`;
                    }
                }
                validSpells += cant;
            }
            logsArr.push(lineLog);
        } else {
            logsArr.push(`[!] Hechizo no encontrado: ${fila.nombre} x${cant}`);
        }
    }

    if (validSpells === 0 && logsArr.length === 0) return alert("Llena al menos una casilla de hechizo válida.");

    // Aplicar gasto real
    hzState.vexGastadoPorPj[pjNombre] = vexUsado + totalVexGastado;
    if (totalHexGastado > 0) modPjStat(pjNombre, 'hex', null, -totalHexGastado, true, false);

    // Línea Hexcast (solo si hubo gasto efectivo)
    if (totalVexGastado > 0 || totalHexGastado > 0) {
        const ajusteSuffix = ajusteNotes.length > 0 ? ` | ${ajusteNotes.join(' | ')}` : '';
        const hexActual    = getPjStat(pjNombre, 'hex');
        let   stringCobro  = '';
        if      (totalHexGastado === 0) stringCobro = `Hexcast | -${totalVexGastado} Vex${ajusteSuffix}`;
        else if (totalVexGastado === 0) stringCobro = `Hexcast | -${totalHexGastado} Hex (${hexActual})${ajusteSuffix}`;
        else                            stringCobro = `Hexcast | -${totalVexGastado} Vex y -${totalHexGastado} Hex (${hexActual})${ajusteSuffix}`;
        hzState.logCasteosSession.push({ pj: pjNombre, msg: stringCobro });
    }

    logsArr.forEach(l => hzState.logCasteosSession.push({ pj: pjNombre, msg: l }));

    hzState.casteoManual.filas = Array.from({ length: 50 }, () => ({ dado:'', nombre:'', afinidad:'', cant:1, cobrarHex:null, noFalla:false, contrarrestado:false, ajusteCosto:0 }));
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function asignarHechizo(pjNombre, hechizoId) {
    const pjKey = norm(pjNombre); const idNorm = norm(hechizoId);
    if (!hzState.colaAsignaciones[pjKey]) hzState.colaAsignaciones[pjKey] = {};
    const yaLoTiene = hzState.colaAsignaciones[pjKey][hechizoId] ?? (hzState.inventariosDB[pjKey] || []).includes(idNorm);
    const accionDar = !yaLoTiene;
    hzState.colaAsignaciones[pjKey][hechizoId] = accionDar;
    const hechizo       = hzState.catalogoDB.find(h => norm(h.ID||h.id) === idNorm);
    const costo         = parseInt(hechizo ? (hechizo.HEX||hechizo.Hex||hechizo.costo||hechizo.Costo||0) : 0) || 0;
    const nombreHechizo = hechizo ? (hechizo.Nombre||hechizo.nombre||hechizoId) : hechizoId;
    if (accionDar && hzState.cobrarAlAsignar && costo > 0) modPjStat(pjNombre, 'hex', null, -costo, true, false);
    const hexActual = getPjStat(pjNombre, 'hex');
    const accionStr = accionDar ? "Hechizo Aprendido" : "Hechizo Olvidado";
    const strCobro  = (accionDar && hzState.cobrarAlAsignar && costo > 0) ? ` | -${costo} Hex (${hexActual})` : "";
    hzState.logCasteosSession.push({ pj: pjNombre, msg: `${accionStr} | ${nombreHechizo}${strCobro}` });
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function toggleVisibilidad(hechizoId) {
    const dbHech = hzState.catalogoDB.find(h => (h.ID||h.id) === hechizoId);
    if (!dbHech) return;
    const enCola      = hzState.colaVisibilidad[hechizoId];
    const isKnownDb   = dbHech.es_conocido !== false && dbHech.es_conocido !== "FALSE" && dbHech.es_conocido !== 0 && dbHech.es_conocido !== "0" && dbHech.es_conocido !== null && dbHech.es_conocido !== undefined;
    const estadoActual = enCola !== undefined ? enCola : isKnownDb;
    hzState.colaVisibilidad[hechizoId] = !estadoActual;
    const nombreHechizo = dbHech.Nombre||dbHech.nombre||hechizoId;
    hzState.logCasteosSession.push({ pj: '—', msg: `${!estadoActual ? "Hechizo Descubierto" : "Hechizo Sellado"} | ${nombreHechizo}` });
    window.dispatchEvent(new Event('devDataChanged'));
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setBusquedaHz(texto)  { hzState.busquedaAsignar = texto.toLowerCase(); window.dispatchEvent(new Event('devUIUpdate')); }
export function setVistaHz(vista)     { hzState.vistaActiva = vista; window.dispatchEvent(new Event('devUIUpdate')); }
export function toggleConfigCasteo(campo, valor) { hzState[campo] = valor; }
