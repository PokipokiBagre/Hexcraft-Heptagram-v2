// ============================================================
// panel-hechizos-logic.js — Lógica de Casteo y Asignación
// ============================================================

import { hzState } from './panel-hechizos-state.js';
import { getPjStat, modPjStat, getVexMax } from '../estadisticas/panel-stats-logic.js';

export function initHechizosDev(catalogo, inventarios_pj) {
    hzState.catalogoDB = catalogo || [];
    hzState.inventariosDB = {};
    (inventarios_pj || []).forEach(item => {
        // Soporta tanto el formato de inventario local como el de Supabase directo
        const pj = (item.Personaje || item.personaje_nombre || "").toLowerCase();
        const hzId = item.Hechizo || item.hechizo_id || item.ID || item.id;
        
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

    const hechizo = hzState.catalogoDB.find(h => (h.ID || h.id) === hechizoId);
    const costoStrVal = hechizo ? (hechizo.Hex || hechizo.costo || hechizo.Costo || 0) : 0;
    const costo = parseInt(costoStrVal) || 0;
    const nombreHechizo = hechizo ? (hechizo.Nombre || hechizo.nombre || hechizoId) : hechizoId;

    if (accionDar && hzState.cobrarAlAsignar && costo > 0) {
        modPjStat(pjNombre, 'hex', null, -costo, true, false); 
    }

    const accionStr = accionDar ? "Adquirió" : "Olvidó";
    const strCobro = (accionDar && hzState.cobrarAlAsignar && costo > 0) ? ` (-${costo} HEX)` : "";
    
    hzState.logCasteosSession.push(`[${pjNombre}] ${accionStr} el hechizo: ${nombreHechizo}${strCobro}`);
    
    window.dispatchEvent(new Event('devUIUpdate'));
}

// ── CASTEO RÁPIDO (VEX -> HEX) ──
export function castearHechizo(pjNombre, hechizoId, cantInputId) {
    const inputEl = document.getElementById(cantInputId);
    const cantidad = parseInt(inputEl.value) || 1;
    if (cantidad <= 0) return;

    const hechizo = hzState.catalogoDB.find(h => (h.ID || h.id) === hechizoId);
    if (!hechizo) return;

    const costoUnitario = parseInt(hechizo.Hex || hechizo.costo || hechizo.Costo || 0) || 0;
    const costoTotal = costoUnitario * cantidad;
    const nombreHechizo = hechizo.Nombre || hechizo.nombre || 'Hechizo Desconocido';
    const efecto = hechizo.Efecto || hechizo.efecto_desc || hechizo.efecto || '';
    
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

    let logText = `[${pjNombre}] Casteó ${nombreHechizo} x${cantidad} ${stringCobro}`;
    if (hzState.mostrarEfectos && efecto) {
        logText += `\n   ↳ Efecto: ${efecto}`;
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
    const nombre = hechizo.Nombre || hechizo.nombre || 'Hechizo';
    const costo = hechizo.Hex || hechizo.costo || hechizo.Costo || 0;
    const afinidad = hechizo.Afinidad || hechizo.afinidad || '-';
    const efecto = hechizo.Efecto || hechizo.efecto_desc || hechizo.efecto || '-';
    
    const texto = `📜 **${nombre}**\nCoste: ${costo}\nAfinidad: ${afinidad}\nEfecto: ${efecto}`;
    navigator.clipboard.writeText(texto).then(() => alert(`Info de ${nombre} copiada.`));
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
