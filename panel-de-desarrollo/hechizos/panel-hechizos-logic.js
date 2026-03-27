// ============================================================
// panel-hechizos-logic.js — Lógica de Casteo y Asignación
// ============================================================

import { hzState } from './panel-hechizos-state.js';
import { getPjStat, modPjStat, getVexMax } from './estadisticas/panel-stats-logic.js';

export function initHechizosDev(catalogo, inventarios_pj) {
    hzState.catalogoDB = catalogo || [];
    hzState.inventariosDB = {};
    (inventarios_pj || []).forEach(item => {
        const pj = item.personaje_nombre.toLowerCase();
        if (!hzState.inventariosDB[pj]) hzState.inventariosDB[pj] = [];
        hzState.inventariosDB[pj].push(item.hechizo_id);
    });
}

// ── ASIGNACIÓN ──
export function asignarHechizo(pjNombre, hechizoId, cobrar, costo) {
    const pjKey = pjNombre.toLowerCase();
    if (!hzState.colaAsignaciones[pjKey]) hzState.colaAsignaciones[pjKey] = {};
    
    const yaLoTiene = hzState.colaAsignaciones[pjKey][hechizoId] ?? (hzState.inventariosDB[pjKey] || []).includes(hechizoId);
    
    // Toggle: Si lo tiene, se lo quitamos. Si no, se lo damos.
    const accionDar = !yaLoTiene;
    hzState.colaAsignaciones[pjKey][hechizoId] = accionDar;

    if (accionDar && cobrar) {
        modPjStat(pjNombre, 'hex', null, -costo, true, false); // Permite negativos, no rerenderiza UI entera
    }

    const accionStr = accionDar ? "Adquirió" : "Olvidó";
    const costoStr = (accionDar && cobrar) ? ` (-${costo} HEX)` : "";
    hzState.logCasteosSession.push(`[${pjNombre}] ${accionStr} el hechizo: ${hechizoId}${costoStr}`);
    
    window.dispatchEvent(new Event('devUIUpdate'));
}

// ── CASTEO RÁPIDO (VEX -> HEX) ──
export function castearHechizo(pjNombre, hechizoId, cantInputId) {
    const inputEl = document.getElementById(cantInputId);
    const cantidad = parseInt(inputEl.value) || 1;
    if (cantidad <= 0) return;

    const hechizo = hzState.catalogoDB.find(h => h.id === hechizoId);
    if (!hechizo) return;

    const costoTotal = (hechizo.costo || 0) * cantidad;
    let stringCobro = "";

    if (hzState.cobrarAuto && costoTotal > 0) {
        const vexMax = getVexMax(pjNombre);
        const vexUsado = hzState.vexGastadoPorPj[pjNombre] || 0;
        const vexDisponible = Math.max(0, vexMax - vexUsado);

        if (vexDisponible >= costoTotal) {
            // Se paga todo con VEX
            hzState.vexGastadoPorPj[pjNombre] = vexUsado + costoTotal;
            stringCobro = `(Pagado con ${costoTotal} VEX)`;
        } else {
            // Se gasta el VEX restante y el resto en HEX
            const hexAFacturar = costoTotal - vexDisponible;
            hzState.vexGastadoPorPj[pjNombre] = vexMax; // Vex agotado
            modPjStat(pjNombre, 'hex', null, -hexAFacturar, true, false);
            stringCobro = vexDisponible > 0 
                ? `(Pagado con ${vexDisponible} VEX y ${hexAFacturar} HEX)` 
                : `(-${hexAFacturar} HEX)`;
        }
    }

    let logText = `[${pjNombre}] Casteó ${hechizo.nombre} x${cantidad} ${stringCobro}`;
    if (hzState.mostrarEfectos && hechizo.efecto_desc) {
        logText += `\n   ↳ Efecto: ${hechizo.efecto_desc}`;
    }
    
    hzState.logCasteosSession.push(logText);
    
    // Resetear el input para el siguiente casteo rápido y actualizar UI general
    inputEl.value = 1; 
    window.dispatchEvent(new Event('devUIUpdate'));
}

// ── PORTAPAPELES ──
export function copiarDadoHechizo(nombre, afinidad) {
    // Formato estándar de rol (ajustable a tu bot de Discord)
    const texto = `!r 1d20 + [Afinidad: ${afinidad}] // Casteando: ${nombre}`;
    navigator.clipboard.writeText(texto).then(() => alert(`Dado de ${nombre} copiado.`));
}

export function copiarInfoHechizo(hechizo) {
    const texto = `📜 **${hechizo.nombre}**\nCoste: ${hechizo.costo}\nAfinidad: ${hechizo.afinidad}\nEfecto: ${hechizo.efecto_desc}`;
    navigator.clipboard.writeText(texto).then(() => alert(`Info de ${hechizo.nombre} copiada.`));
}

// ── CONTROLES DE UI ──
export function setBusquedaHz(texto, tipo) {
    if (tipo === 'local') hzState.busquedaLocal = texto.toLowerCase();
    else hzState.busquedaGlobal = texto.toLowerCase();
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setVistaHz(vista) {
    hzState.vistaActiva = vista;
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function toggleConfigCasteo(campo, valor) {
    hzState[campo] = valor;
}
