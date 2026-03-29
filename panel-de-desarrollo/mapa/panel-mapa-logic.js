// ============================================================
// panel-mapa-logic.js — Lógica del Panel Mapa (Dev)
// ============================================================

import { mapaDevState } from './panel-mapa-state.js';

// ── INICIALIZACIÓN ────────────────────────────────────────────
// Se llama desde dev-main.js pasando los datos ya cargados por el mapa.
// Acepta tanto el estadoMapa vivo como una lista plana de nodos/enlaces.
export function initMapaDev(nodos, enlaces, colores) {
    mapaDevState.nodosDB = nodos || [];
    mapaDevState.enlacesDB = enlaces || [];
    mapaDevState.coloresDB = JSON.parse(JSON.stringify(colores || {}));

    // Limpiar colas en cada re-init (por si se recarga)
    mapaDevState.colaVisibilidad  = {};
    mapaDevState.colaPosiciones   = {};
    mapaDevState.colaMetadatos    = {};
    mapaDevState.colaNuevosNodos  = [];
    mapaDevState.colaNuevosEnlaces = [];
    mapaDevState.colaEliminados   = { nodos: new Set(), enlaces: [] };
    mapaDevState.colaColores      = {};
    mapaDevState.logSesion        = [];
}

// ── ACCESO A DATOS ────────────────────────────────────────────
export function getNodoActual(hechizoId) {
    // Primero revisa la cola de metadatos pendientes
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

    const nodo = mapaDevState.nodosDB.find(n => n.id === hechizoId);
    const nombre = nodo ? (nodo.nombreOriginal || nodo.id) : hechizoId;
    const accion = nuevo ? 'Hechizo Descubierto' : 'Hechizo Sellado';
    mapaDevState.logSesion.push({ msg: `${accion} | ${nombre}` });

    // Propagar al mapa vivo si está disponible en memoria (mismo contexto de módulo)
    _propagarVisibilidadAlMapaVivo(hechizoId, nuevo, nodo);

    window.dispatchEvent(new Event('devDataChanged'));
    window.dispatchEvent(new Event('devUIUpdate'));
}

function _propagarVisibilidadAlMapaVivo(hechizoId, nuevoValor, nodoRef) {
    // Si el mapa está activo en la misma sesión, actualizamos el nodo en memoria
    // para que al navegar al mapa el cambio ya esté reflejado sin recargar.
    try {
        // estadoMapa se importa dinámicamente para no crear dependencia circular
        // si el módulo no está cargado, simplemente no hace nada.
        const mapaVivo = window.__mapaEstadoVivo;
        if (!mapaVivo) return;
        const nodoVivo = mapaVivo.nodos.find(n => n.id === hechizoId);
        if (!nodoVivo) return;
        nodoVivo.esConocido = nuevoValor;
        nodoVivo.modificado = true;
        if (nuevoValor) {
            nodoVivo.radio = 35;
            const base = nodoVivo.nombreOriginal.replace(/\s*\(\d+\)$/, '').trim();
            nodoVivo.nombre = `${base} (${nodoVivo.hex})`;
        } else {
            nodoVivo.radio = 28;
            const maskName = nodoVivo.id.toLowerCase().includes('hechizo')
                ? nodoVivo.id
                : `Hechizo ${nodoVivo.id}`;
            nodoVivo.nombre = `${maskName} (${nodoVivo.hex})`;
        }
    } catch (_) { /* silencioso */ }
}

// ── EDICIÓN DE METADATOS DE UN NODO ───────────────────────────
export function editarMetadatoNodo(hechizoId, campo, valor) {
    if (!mapaDevState.colaMetadatos[hechizoId]) {
        mapaDevState.colaMetadatos[hechizoId] = {};
    }
    mapaDevState.colaMetadatos[hechizoId][campo] = valor;

    // Propagar al nodo vivo si el campo es crítico para el render
    if (['nombreOriginal', 'hex', 'esConocido'].includes(campo)) {
        try {
            const mapaVivo = window.__mapaEstadoVivo;
            if (mapaVivo) {
                const nodoVivo = mapaVivo.nodos.find(n => n.id === hechizoId);
                if (nodoVivo) {
                    nodoVivo[campo] = valor;
                    nodoVivo.modificado = true;
                    if (campo === 'nombreOriginal' || campo === 'hex') {
                        nodoVivo.nombre = `${nodoVivo.nombreOriginal} (${nodoVivo.hex})`;
                    }
                }
            }
        } catch (_) {}
    }

    window.dispatchEvent(new Event('devDataChanged'));
}

// ── MODIFICAR COLOR DE AFINIDAD ───────────────────────────────
export function editarColorAfinidad(afinidad, hexColor) {
    // Calcular color de borde oscurecido (igual que en mapa-edicion.js)
    const c = hexColor.substring(1);
    const rgb = parseInt(c, 16);
    const r = Math.max(0, (rgb >> 16) - 50);
    const g = Math.max(0, ((rgb >> 8) & 0x00FF) - 50);
    const b = Math.max(0, (rgb & 0x0000FF) - 50);
    const borderHex = `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;

    mapaDevState.colaColores[afinidad] = { t: hexColor, b: borderHex };

    // Propagar a window.mapaColores si está disponible
    if (window.mapaColores) {
        window.mapaColores[afinidad] = { t: hexColor, b: borderHex };
    }

    mapaDevState.logSesion.push({ msg: `Color ${afinidad} → ${hexColor}` });
    window.dispatchEvent(new Event('devDataChanged'));
    window.dispatchEvent(new Event('devUIUpdate'));
}

// ── FILTROS Y VISTA ───────────────────────────────────────────
export function setVistaMapaDev(vista) {
    mapaDevState.vistaActiva = vista;
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setBusquedaMapa(texto) {
    mapaDevState.busqueda = texto.toLowerCase();
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setFiltroAfinidad(af) {
    mapaDevState.filtroAfinidad = af;
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setFiltroVisibilidad(v) {
    mapaDevState.filtroVisibilidad = v;
    window.dispatchEvent(new Event('devUIUpdate'));
}

// ── HELPERS DE CONSULTA ───────────────────────────────────────
export function getNodosFiltrados() {
    const { nodosDB, busqueda, filtroAfinidad, filtroVisibilidad, colaVisibilidad, colaEliminados } = mapaDevState;

    return nodosDB
        .filter(n => !colaEliminados.nodos.has(n.id))
        .filter(n => {
            if (!busqueda) return true;
            return (
                (n.nombreOriginal || '').toLowerCase().includes(busqueda) ||
                (n.id || '').toLowerCase().includes(busqueda) ||
                (n.afinidad || '').toLowerCase().includes(busqueda)
            );
        })
        .filter(n => {
            if (!filtroAfinidad) return true;
            return (n.afinidad || '').toLowerCase() === filtroAfinidad.toLowerCase();
        })
        .filter(n => {
            const vis = colaVisibilidad[n.id] !== undefined ? colaVisibilidad[n.id] : n.esConocido;
            if (filtroVisibilidad === 'conocidos') return vis;
            if (filtroVisibilidad === 'ocultos')   return !vis;
            return true;
        })
        .sort((a, b) => {
            // Ordenar por afinidad, luego por nombre
            const afCmp = (a.afinidad || '').localeCompare(b.afinidad || '');
            if (afCmp !== 0) return afCmp;
            return (a.nombreOriginal || a.id).localeCompare(b.nombreOriginal || b.id);
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
