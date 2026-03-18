// ============================================================
// extra-logic.js — Lógica de filtrado y búsqueda
// ============================================================

import { estadoUI, itemsPersonajes, itemsObjetos, itemsInterfaz } from './extra-state.js';

export function getItemsActivos() {
    if (estadoUI.tab === 'personajes') return itemsPersonajes;
    if (estadoUI.tab === 'objetos') return itemsObjetos;
    return itemsInterfaz; // Para la nueva pestaña
}

export function getItemsFiltrados() {
    const items = getItemsActivos();
    const busq  = estadoUI.busqueda.toLowerCase();

    return items.filter(item => {
        if (busq && !item.nombre.toLowerCase().includes(busq)) return false;
        if (estadoUI.filtro === 'falta' &&  item.existe) return false;
        if (estadoUI.filtro === 'ok'    && !item.existe) return false;
        // Filtros de propuesta (solo aplican a tab objetos)
        if (estadoUI.filtro === 'propuesta'  && !item.esPropuesta) return false;
        if (estadoUI.filtro === 'aprobado'   &&  item.esPropuesta) return false;
        return true;
    });
}

export function getEstadisticas() {
    const items  = getItemsActivos();
    const total  = items.length;
    const ok     = items.filter(i => i.existe).length;
    const faltan = total - ok;
    const pct    = total > 0 ? Math.round(ok / total * 100) : 0;
    return { total, ok, faltan, pct };
}

export function marcarExiste(keyNorm, tipoIcono, nuevaUrl) {
    let items;
    if (tipoIcono === 'imgpersonajes') items = itemsPersonajes;
    else if (tipoIcono === 'imgobjetos') items = itemsObjetos;
    else items = itemsInterfaz;

    const item  = items.find(i => i.keyNorm === keyNorm);
    if (item) {
        item.existe     = true;
        item.urlStorage = nuevaUrl;
    }
}
