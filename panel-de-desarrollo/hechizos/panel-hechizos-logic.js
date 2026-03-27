// ============================================================
// panel-hechizos-logic.js — Lógica de Casteo y Asignación
// ============================================================

import { hzState } from './panel-hechizos-state.js';
import { getPjStat, modPjStat, getVexMax } from '../estadisticas/panel-stats-logic.js';

export function initHechizosDev(catalogo, inventarios_pj) {
    hzState.catalogoDB = catalogo || [];
    hzState.inventariosDB = {};
    (inventarios_pj || []).forEach(item => {
        // En getDataCompleta pueden venir como Personaje/Hechizo o personaje_nombre/hechizo_id
        const pj = (item.Personaje || item.personaje_nombre || "").toLowerCase();
        const hzId = item.Hechizo || item.hechizo_id || item.ID;
        
        if (!pj || !hzId) return;
        if (!hzState.inventariosDB[pj]) hzState.inventariosDB[pj] = [];
        hzState.inventariosDB[pj].push(hzId);
    });
}

// ── ASIGNACIÓN ──
export function asignarHechizo(pjNombre, hechizoId) {
    const pjKey = pjNombre.toLowerCase();
    if (!hzState.colaAsignaciones[pjKey]) hzState.colaAsignaciones[pjKey] = {};
    
    const yaLoTiene = hzState.colaAsignaciones[pjKey][hechizoId] ?? (hzState.inventariosDB[pjKey] || []).includes(hechizoId);
    const accionDar = !yaLoTiene;
    
    hzState.colaAsignaciones[pjKey][hechizoId] = accionDar;

    const hechizo = hzState.catalogoDB.find(h => h.ID === hechizoId);
    const costoStrVal = hechizo ? (hechizo.Hex || hechizo.Costo || 0) : 0;
    const costo = parseInt(costoStrVal) || 0;

    if (accionDar && hzState.cobrarAlAsignar && costo > 0) {
        modPjStat(pjNombre, 'hex', null, -costo, true, false); 
    }

    const accionStr = accionDar ? "Adquirió" : "Olvidó";
    const strCobro = (accionDar && hzState.cobrarAlAsignar && costo > 0) ? ` (-${costo} HEX)` : "";
    
    hzState.logCasteosSession.push(`[${pjNombre}] ${accionStr} el hechizo: ${hechizo ? hechizo.Nombre : hechizoId}${strCobro}`);
    
    window.dispatchEvent(new Event('devUIUpdate'));
}

// ── CASTEO RÁPIDO (VEX -> HEX) ──
export function castearHechizo(pjNombre, hechizoId, cantInputId) {
    const inputEl = document.getElementById(cantInputId);
    const cantidad = parseInt(inputEl.value) || 1;
    if (cantidad <= 0) return;

    const hechizo = hzState.catalogoDB.find(h => h.ID === hechizoId);
    if (!hechizo) return;

    const costoUnitario = parseInt(hechizo.Hex || hechizo.Costo || 0) || 0;
    const costoTotal = costoUnitario * cantidad;
    let stringCobro = "";

    if (hzState.cobrarAuto && costoTotal > 0) {
        const vexMax = getVexMax(pjNombre);
        const vexUsado = hzState.vexGastadoPorPj[pjNombre] || 0;
        const vexDisponible = Math.max(0, vexMax - vexUsado);

        if (vexDisponible >= costoTotal) {
            hzState.vexGastadoPorPj[pjNombre] = vexUsado + costoTotal;
            stringCobro = `(Pagado con ${costoTotal} VEX)`;
        } else {
            const hexAFacturar = costoTotal - vexDisponible;
            hzState.vexGastadoPorPj[pjNombre] = vexMax; 
            modPjStat(pjNombre, 'hex', null, -hexAFacturar, true, false);
            stringCobro = vexDisponible > 0 
                ? `(Pagado con ${vexDisponible} VEX y ${hexAFacturar} HEX)` 
                : `(-${hexAFacturar} HEX)`;
        }
    }

    let logText = `[${pjNombre}] Casteó ${hechizo.Nombre} x${cantidad} ${stringCobro}`;
    if (hzState.mostrarEfectos && hechizo.Efecto) {
        logText += `\n   ↳ Efecto: ${hechizo.Efecto}`;
    }
    
    hzState.logCasteosSession.push(logText);
    
    inputEl.value = 1; 
    window.dispatchEvent(new Event('devUIUpdate'));
}

// ── PORTAPAPELES ──
export function copiarDadoHechizo(nombre, afinidad) {
    const texto = `!r 1d20 + [Afinidad: ${afinidad}] // Casteando: ${nombre}`;
    navigator.clipboard.writeText(texto).then(() => alert(`Dado de ${nombre} copiado.`));
}

export function copiarInfoHechizo(hechizo) {
    const texto = `📜 **${hechizo.Nombre}**\nCoste: ${hechizo.Hex || 0}\nAfinidad: ${hechizo.Afinidad}\nEfecto: ${hechizo.Efecto}`;
    navigator.clipboard.writeText(texto).then(() => alert(`Info de ${hechizo.Nombre} copiada.`));
}

// ── CONTROLES DE UI ──
export function setBusquedaHz(texto, tipo) {
    if (tipo === 'castear') hzState.busquedaCastear = texto.toLowerCase();
    else hzState.busquedaAsignar = texto.toLowerCase();
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setVistaHz(vista) {
    hzState.vistaActiva = vista;
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function toggleConfigCasteo(campo, valor) {
    hzState[campo] = valor;
}
