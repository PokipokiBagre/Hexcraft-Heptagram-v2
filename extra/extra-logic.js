// ============================================================
// extra-logic.js — Lógica de filtrado y búsqueda
// ============================================================

import { estadoUI, itemsPersonajes, itemsObjetos } from './extra-state.js';

export function getItemsActivos() {
    return estadoUI.tab === 'personajes' ? itemsPersonajes : itemsObjetos;
}

export function getItemsFiltrados() {
    const items = getItemsActivos();
    const busq  = estadoUI.busqueda.toLowerCase();

    return items.filter(item => {
        if (busq && !item.nombre.toLowerCase().includes(busq)) return false;
        if (estadoUI.filtro === 'falta' &&  item.existe) return false;
        if (estadoUI.filtro === 'ok'    && !item.existe) return false;
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
    const items = tipoIcono === 'imgpersonajes' ? itemsPersonajes : itemsObjetos;
    const item  = items.find(i => i.keyNorm === keyNorm);
    if (item) {
        item.existe     = true;
        item.urlStorage = nuevaUrl;
    }
}
