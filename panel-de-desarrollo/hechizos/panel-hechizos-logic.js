// ============================================================
// panel-hechizos-logic.js — Lógica de Casteo y Asignación
// ============================================================

import { hzState } from './panel-hechizos-state.js';
import { getPjStat, modPjStat, getVexMax } from '../estadisticas/panel-stats-logic.js';
import { norm } from '../dev-state.js'; // Importamos tu normalizador para arreglar las tildes

export function initHechizosDev(catalogo, inventarios_pj) {
    hzState.catalogoDB = catalogo || [];
    hzState.inventariosDB = {};
    (inventarios_pj || []).forEach(item => {
        const pj = norm(item.Personaje || item.personaje_nombre || ""); // Normalizado!
        const hzId = item.Hechizo || item.hechizo_id || item.ID || item.id;
        
        if (!pj || !hzId) return;
        if (!hzState.inventariosDB[pj]) hzState.inventariosDB[pj] = [];
        hzState.inventariosDB[pj].push(hzId);
    });
}

// ── FORMULARIO DE CASTEO MASIVO ──
export function setNumFilasCast(num) {
    hzState.casteoManual.numFilas = parseInt(num) || 1;
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function modFilaCast(index, campo, valor) {
    hzState.casteoManual.filas[index][campo] = valor;
    // NO disparamos UI Update aquí para no interrumpir tu escritura en el input
}

export function setModoDatalist(modo) {
    hzState.casteoManual.datalistModo = modo;
    window.dispatchEvent(new Event('devUIUpdate'));
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

        if (hechizo) {
            const costoU = parseInt(hechizo.Hex || hechizo.costo || hechizo.Costo || 0) || 0;
            totalCost += costoU * cant;
            validSpells++;
            const efecto = hechizo.Efecto || hechizo.efecto_desc || hechizo.efecto || '';
            const realName = hechizo.Nombre || hechizo.nombre;
            logsArr.push(` - ${realName} x${cant} ${hzState.mostrarEfectos && efecto ? `\n   ↳ ${efecto}` : ''}`);
        } else {
            logsArr.push(` - [!] Hechizo no encontrado: "${fila.nombre}" x${cant}`);
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
            stringCobro = `(Pagado todo con ${totalCost} VEX)`;
        } else {
            const hexAFacturar = totalCost - vexDisponible;
            hzState.vexGastadoPorPj[pjNombre] = vexMax; 
            modPjStat(pjNombre, 'hex', null, -hexAFacturar, true, false);
            stringCobro = vexDisponible > 0 
                ? `(Pagado con ${vexDisponible} VEX y ${hexAFacturar} HEX)` 
                : `(-${hexAFacturar} HEX)`;
        }
    }

    let mainLog = `[${pjNombre}] Lanza ${validSpells} conjuros simultáneos ${stringCobro}\n` + logsArr.join("\n");
    hzState.logCasteosSession.push(mainLog);

    // Limpiar formulario tras castear
    hzState.casteoManual.filas = Array.from({ length: 50 }, () => ({ nombre: '', cant: 1 }));
    window.dispatchEvent(new Event('devUIUpdate'));
}

// ── ASIGNACIÓN Y VISIBILIDAD ──
export function asignarHechizo(pjNombre, hechizoId) {
    const pjKey = norm(pjNombre);
    if (!hzState.colaAsignaciones[pjKey]) hzState.colaAsignaciones[pjKey] = {};
    
    const yaLoTiene = hzState.colaAsignaciones[pjKey][hechizoId] ?? (hzState.inventariosDB[pjKey] || []).includes(hechizoId);
    const accionDar = !yaLoTiene;
    
    hzState.colaAsignaciones[pjKey][hechizoId] = accionDar;

    const hechizo = hzState.catalogoDB.find(h => (h.ID || h.id) === hechizoId);
    const costo = parseInt(hechizo ? (hechizo.Hex || hechizo.costo || hechizo.Costo || 0) : 0) || 0;
    const nombreHechizo = hechizo ? (hechizo.Nombre || hechizo.nombre || hechizoId) : hechizoId;

    if (accionDar && hzState.cobrarAlAsignar && costo > 0) {
        modPjStat(pjNombre, 'hex', null, -costo, true, false); 
    }

    const accionStr = accionDar ? "Adquirió" : "Olvidó";
    const strCobro = (accionDar && hzState.cobrarAlAsignar && costo > 0) ? ` (-${costo} HEX)` : "";
    hzState.logCasteosSession.push(`[${pjNombre}] ${accionStr} el hechizo: ${nombreHechizo}${strCobro}`);
    
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function toggleVisibilidad(hechizoId) {
    const currentQ = hzState.colaVisibilidad[hechizoId];
    const dbHech = hzState.catalogoDB.find(h => (h.ID || h.id) === hechizoId);
    if (!dbHech) return;

    // Asumimos que la BD guarda true/false, o 1/0, o "TRUE"
    const isKnownDb = dbHech.es_conocido === true || dbHech.es_conocido === "TRUE" || dbHech.es_conocido === 1;

    if (currentQ !== undefined) {
        delete hzState.colaVisibilidad[hechizoId]; // Revertir a como está en BD
    } else {
        hzState.colaVisibilidad[hechizoId] = !isKnownDb; // Alternar estado
    }
    
    window.dispatchEvent(new Event('devDataChanged')); 
    window.dispatchEvent(new Event('devUIUpdate'));
}

// ── CONTROLES UI GENERALES ──
export function setBusquedaHz(texto) {
    hzState.busquedaAsignar = texto.toLowerCase();
    window.dispatchEvent(new Event('devUIUpdate'));
}
export function setVistaHz(vista) {
    hzState.vistaActiva = vista;
    window.dispatchEvent(new Event('devUIUpdate'));
}
export function toggleConfigCasteo(campo, valor) {
    hzState[campo] = valor;
}
