// ============================================================
// panel-mapa-logic.js — Lógica del Panel Mapa (Dev)
// ============================================================

import { mapaDevState } from './panel-mapa-state.js';

// ── INICIALIZACIÓN ────────────────────────────────────────────
export function initMapaDev(nodos, enlaces, colores) {
    mapaDevState.nodosDB   = nodos  || [];
    mapaDevState.enlacesDB = enlaces || [];
    mapaDevState.coloresDB = JSON.parse(JSON.stringify(colores || {}));

    // Limpiar todo el estado de edición
    mapaDevState.herramienta       = 'cursor';
    mapaDevState.seleccionMultiple = new Set();
    mapaDevState.tempLink          = null;
    mapaDevState.boxStart          = null;
    mapaDevState.boxCurrent        = null;
    mapaDevState.lassoPuntos       = [];
    mapaDevState.lassoActivo       = false;

    mapaDevState.colaVisibilidad   = {};
    mapaDevState.colaPosiciones    = {};
    mapaDevState.colaMetadatos     = {};
    mapaDevState.colaNuevosNodos   = [];
    mapaDevState.colaNuevosEnlaces = [];
    mapaDevState.colaEliminados    = { nodos: new Set(), enlaces: [] };
    mapaDevState.colaColores       = {};
    mapaDevState.logSesion         = [];
}

// ── ACCESO A DATOS ────────────────────────────────────────────
export function getNodoActual(hechizoId) {
    const meta = mapaDevState.colaMetadatos[hechizoId];
    const base = mapaDevState.nodosDB.find(n => n.id === hechizoId);
    if (!base) return null;
    return meta ? { ...base, ...meta } : { ...base };
}

export function getVisibilidadActual(hechizoId) {
    if (mapaDevState.colaVisibilidad[hechizoId] !== undefined) {
        return mapaDevState.colaVisibilidad[hechizoId];
    }
    const nodo = mapaDevState.nodosDB.find(n => n.id === hechizoId);
    return nodo ? nodo.esConocido : false;
}

// ── TOGGLE VISIBILIDAD ────────────────────────────────────────
export function toggleVisibilidadNodo(hechizoId) {
    const actual = getVisibilidadActual(hechizoId);
    const nuevo  = !actual;
    mapaDevState.colaVisibilidad[hechizoId] = nuevo;

    // Actualizar nodo en memoria para que el canvas lo refleje de inmediato
    const nodo = mapaDevState.nodosDB.find(n => n.id === hechizoId);
    if (nodo) {
        nodo.esConocido = nuevo;
        nodo.radio = nuevo ? 35 : 28;
    }

    const nombre = nodo ? (nodo.nombreOriginal || nodo.id) : hechizoId;
    mapaDevState.logSesion.push({ msg: `${nuevo ? 'Hechizo Descubierto' : 'Hechizo Sellado'} | ${nombre}` });

    _propagarVisibilidadAlMapaVivo(hechizoId, nuevo);
    window.dispatchEvent(new Event('devDataChanged'));
    window.dispatchEvent(new Event('devUIUpdate'));
}

function _propagarVisibilidadAlMapaVivo(hechizoId, nuevoValor) {
    try {
        const mapaVivo = window.__mapaEstadoVivo;
        if (!mapaVivo) return;
        const nodoVivo = mapaVivo.nodos.find(n => n.id === hechizoId);
        if (!nodoVivo) return;
        nodoVivo.esConocido = nuevoValor;
        nodoVivo.modificado = true;
        nodoVivo.radio = nuevoValor ? 35 : 28;
    } catch (_) { /* silencioso */ }
}

// ── CREAR NODO ────────────────────────────────────────────────
export function getNextIdDev() {
    const usedIds = new Set();
    mapaDevState.nodosDB.forEach(n => {
        const match = String(n.id || '').match(/\d+/);
        if (match) usedIds.add(parseInt(match[0]));
    });
    let i = 1;
    while (usedIds.has(i)) i++;
    return i;
}

export function crearNodoDev(worldX, worldY) {
    const newIdNum = getNextIdDev();
    const id = `Hechizo ${newIdNum}`;

    const nuevo = {
        id,
        nombreOriginal: id,
        nombre:         `${id} (0)`,
        afinidad:       '',
        clase:          'Clase 1',
        hex:            0,
        resumen:        '',
        efecto:         '',
        overcast:       '',
        undercast:      '',
        especial:       '',
        esConocido:     false,
        x:              worldX || 0,
        y:              worldY || 0,
        radio:          28,
        incomingSources: [],
    };

    mapaDevState.nodosDB.push(nuevo);
    mapaDevState.colaNuevosNodos.push(id);
    // Pre-registrar en colaMetadatos para que el guardado lo tome
    mapaDevState.colaMetadatos[id] = { ...nuevo };

    mapaDevState.logSesion.push({ msg: `Nodo Creado | ${id}` });
    window.dispatchEvent(new Event('devDataChanged'));
    return nuevo;
}

// ── CREAR ENLACE ──────────────────────────────────────────────
export function crearEnlaceDev(source, target) {
    if (mapaDevState.enlacesDB.some(e => e.source === source && e.target === target)) return false;
    if (source === target) return false;

    mapaDevState.enlacesDB.push({ source, target });
    mapaDevState.colaNuevosEnlaces.push({ source: source.id, target: target.id });
    mapaDevState.logSesion.push({ msg: `Enlace | ${source.id} → ${target.id}` });
    window.dispatchEvent(new Event('devDataChanged'));
    return true;
}

// ── ELIMINAR ENLACE ───────────────────────────────────────────
export function eliminarEnlaceDev(source, target) {
    const idx = mapaDevState.enlacesDB.findIndex(e => e.source === source && e.target === target);
    if (idx > -1) {
        mapaDevState.enlacesDB.splice(idx, 1);
        mapaDevState.colaEliminados.enlaces.push({ source: source.id, target: target.id });
        window.dispatchEvent(new Event('devDataChanged'));
        return true;
    }
    // Intentar dirección inversa
    const idxR = mapaDevState.enlacesDB.findIndex(e => e.source === target && e.target === source);
    if (idxR > -1) {
        mapaDevState.enlacesDB.splice(idxR, 1);
        mapaDevState.colaEliminados.enlaces.push({ source: target.id, target: source.id });
        window.dispatchEvent(new Event('devDataChanged'));
        return true;
    }
    return false;
}

// ── ELIMINAR NODOS ────────────────────────────────────────────
export function eliminarNodosDev(nodosSet) {
    nodosSet.forEach(n => {
        // Eliminar enlaces conectados
        const eliminadosConectados = [];
        mapaDevState.enlacesDB = mapaDevState.enlacesDB.filter(e => {
            if (e.source === n || e.target === n) {
                eliminadosConectados.push({ source: e.source.id, target: e.target.id });
                return false;
            }
            return true;
        });
        mapaDevState.colaEliminados.enlaces.push(...eliminadosConectados);

        // Eliminar nodo
        mapaDevState.nodosDB = mapaDevState.nodosDB.filter(x => x !== n);
        mapaDevState.colaEliminados.nodos.add(n.id);

        // Si era un nodo nuevo, sacarlo también de colaNuevosNodos
        mapaDevState.colaNuevosNodos = mapaDevState.colaNuevosNodos.filter(id => id !== n.id);

        mapaDevState.logSesion.push({ msg: `Nodo Eliminado | ${n.id}` });
    });

    window.dispatchEvent(new Event('devDataChanged'));
}

// ── ACTUALIZAR DATO DE NODO ───────────────────────────────────
export function actualizarDatoNodoDev(hechizoId, campo, valor) {
    const nodo = mapaDevState.nodosDB.find(n => n.id === hechizoId);
    if (!nodo) return;

    nodo[campo] = valor;
    if (campo === 'nombreOriginal' || campo === 'hex') {
        nodo.nombre = `${nodo.nombreOriginal} (${nodo.hex})`;
    }
    if (campo === 'esConocido') {
        nodo.radio = valor ? 35 : 28;
    }

    if (!mapaDevState.colaMetadatos[hechizoId]) mapaDevState.colaMetadatos[hechizoId] = {};
    mapaDevState.colaMetadatos[hechizoId][campo] = valor;

    window.dispatchEvent(new Event('devDataChanged'));
}

// ── COLOR DE AFINIDAD ─────────────────────────────────────────
export function editarColorAfinidad(afinidad, hexColor) {
    const c   = hexColor.substring(1);
    const rgb = parseInt(c, 16);
    const r   = Math.max(0, (rgb >> 16) - 50);
    const g   = Math.max(0, ((rgb >> 8) & 0x00FF) - 50);
    const b   = Math.max(0, (rgb & 0x0000FF) - 50);
    const borderHex = `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;

    mapaDevState.colaColores[afinidad] = { t: hexColor, b: borderHex };
    if (window.mapaColores) window.mapaColores[afinidad] = { t: hexColor, b: borderHex };

    mapaDevState.logSesion.push({ msg: `Color ${afinidad} → ${hexColor}` });
    window.dispatchEvent(new Event('devDataChanged'));
    window.dispatchEvent(new Event('devUIUpdate'));
}

// ── FILTROS Y VISTA ───────────────────────────────────────────
export function setVistaMapaDev(vista)      { mapaDevState.vistaActiva = vista; window.dispatchEvent(new Event('devUIUpdate')); }
export function setBusquedaMapa(texto)      { mapaDevState.busqueda = texto.toLowerCase(); window.dispatchEvent(new Event('devUIUpdate')); }
export function setFiltroAfinidad(af)       { mapaDevState.filtroAfinidad = af; window.dispatchEvent(new Event('devUIUpdate')); }
export function setFiltroVisibilidad(v)     { mapaDevState.filtroVisibilidad = v; window.dispatchEvent(new Event('devUIUpdate')); }

// ── HELPERS DE CONSULTA ───────────────────────────────────────
export function getNodosFiltrados() {
    const { nodosDB, busqueda, filtroAfinidad, filtroVisibilidad, colaVisibilidad, colaEliminados } = mapaDevState;

    return nodosDB
        .filter(n => !colaEliminados.nodos.has(n.id))
        .filter(n => {
            if (!busqueda) return true;
            return (
                (n.nombreOriginal || '').toLowerCase().includes(busqueda) ||
                (n.id  || '').toLowerCase().includes(busqueda) ||
                (n.afinidad || '').toLowerCase().includes(busqueda)
            );
        })
        .filter(n => !filtroAfinidad || (n.afinidad || '').toLowerCase() === filtroAfinidad.toLowerCase())
        .filter(n => {
            const vis = colaVisibilidad[n.id] !== undefined ? colaVisibilidad[n.id] : n.esConocido;
            if (filtroVisibilidad === 'conocidos') return vis;
            if (filtroVisibilidad === 'ocultos')   return !vis;
            return true;
        })
        .sort((a, b) => {
            const afCmp = (a.afinidad || '').localeCompare(b.afinidad || '');
            return afCmp !== 0 ? afCmp : (a.nombreOriginal || a.id).localeCompare(b.nombreOriginal || b.id);
        });
}

export function getAfinidadesUnicas() {
    const set = new Set();
    mapaDevState.nodosDB.forEach(n => { if (n.afinidad && n.afinidad !== '-') set.add(n.afinidad); });
    return Array.from(set).sort();
}

export function contarCambiosPendientes() {
    return (
        Object.keys(mapaDevState.colaVisibilidad).length +
        Object.keys(mapaDevState.colaPosiciones).length +
        Object.keys(mapaDevState.colaMetadatos).length +
        mapaDevState.colaNuevosNodos.length +
        mapaDevState.colaNuevosEnlaces.length +
        mapaDevState.colaEliminados.nodos.size +
        mapaDevState.colaEliminados.enlaces.length +
        Object.keys(mapaDevState.colaColores).length
    );
}
