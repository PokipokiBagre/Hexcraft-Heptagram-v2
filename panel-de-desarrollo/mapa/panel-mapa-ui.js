// ============================================================
// panel-mapa-ui.js — Renderizado del Panel Mapa (Dev)
// ============================================================

import { mapaDevState } from './panel-mapa-state.js';
import {
    getNodosFiltrados,
    getAfinidadesUnicas,
    getVisibilidadActual,
    toggleVisibilidadNodo,
    setBusquedaMapa,
    setFiltroAfinidad,
    setFiltroVisibilidad,
    setVistaMapaDev,
    editarColorAfinidad,
    editarMetadatoNodo,
    contarCambiosPendientes
} from './panel-mapa-logic.js';

// ── Exponer funciones necesarias para los onclick inline ──────
window.devMapa = {
    toggleVisibilidad: toggleVisibilidadNodo,
    setBusqueda:       (t) => setBusquedaMapa(t),
    setFiltroAf:       (v) => setFiltroAfinidad(v),
    setFiltroVis:      (v) => setFiltroVisibilidad(v),
    setVista:          (v) => setVistaMapaDev(v),
    editarColor:       (af, hex) => editarColorAfinidad(af, hex),
    editarMeta:        (id, campo, val) => editarMetadatoNodo(id, campo, val),
    abrirMapa:         () => { window.open('../mapa/index.html', '_blank'); }
};

// ── RENDER PRINCIPAL ──────────────────────────────────────────
export function renderColumnaMapa() {
    const contenedor = document.getElementById('content-mapa');
    if (!contenedor) return;

    const pendientes = contarCambiosPendientes();
    const { vistaActiva, busqueda, filtroAfinidad, filtroVisibilidad } = mapaDevState;

    // ── Cabecera con tabs ─────────────────────────────────────
    const tabStyle = (activa) => activa
        ? 'background:#4a1880; color:#fff; border-color:#b060ff;'
        : 'background:#111; color:#888; border-color:#444;';

    let html = `
    <div style="display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap;">
        <button onclick="window.devMapa.setVista('nodos')"
            style="${tabStyle(vistaActiva === 'nodos')} padding:7px 12px; border:1px solid; border-radius:6px; cursor:pointer; font-family:'Cinzel'; font-size:0.8em; font-weight:bold;">
            🗺️ Nodos
        </button>
        <button onclick="window.devMapa.setVista('colores')"
            style="${tabStyle(vistaActiva === 'colores')} padding:7px 12px; border:1px solid; border-radius:6px; cursor:pointer; font-family:'Cinzel'; font-size:0.8em; font-weight:bold;">
            🎨 Colores
        </button>
        <button onclick="window.devMapa.abrirMapa()"
            style="margin-left:auto; background:#003366; color:#00ffff; border:1px solid #00ffff; padding:7px 12px; border-radius:6px; cursor:pointer; font-family:'Cinzel'; font-size:0.8em; font-weight:bold;"
            title="Abrir el mapa completo en nueva pestaña">
            ↗️ Ver Mapa
        </button>
    </div>`;

    if (pendientes > 0) {
        html += `<div style="background:rgba(74,24,128,0.25); border:1px dashed #b060ff; border-radius:6px; padding:8px 12px; margin-bottom:10px; font-size:0.8em; color:#cc88ff;">
            ⏳ ${pendientes} cambio${pendientes > 1 ? 's' : ''} del mapa pendiente${pendientes > 1 ? 's' : ''} de guardar (usa el botón global 🔥)
        </div>`;
    }

    // ── Vista activa ──────────────────────────────────────────
    if (vistaActiva === 'nodos')   html += _renderVistaNodes();
    if (vistaActiva === 'colores') html += _renderVistaColores();

    contenedor.innerHTML = html;
}

// ── VISTA: NODOS ──────────────────────────────────────────────
function _renderVistaNodes() {
    const { busqueda, filtroAfinidad, filtroVisibilidad } = mapaDevState;
    const afinidades = getAfinidadesUnicas();
    const nodos = getNodosFiltrados();

    // Contadores rápidos
    const total    = mapaDevState.nodosDB.length;
    const conocidos = mapaDevState.nodosDB.filter(n =>
        (mapaDevState.colaVisibilidad[n.id] !== undefined
            ? mapaDevState.colaVisibilidad[n.id]
            : n.esConocido)
    ).length;

    let html = `
    <!-- Resumen rápido -->
    <div style="display:flex; gap:8px; margin-bottom:10px; font-size:0.8em; text-align:center;">
        <div style="flex:1; background:#0a0020; border:1px solid #444; border-radius:6px; padding:8px;">
            <div style="color:#b060ff; font-weight:bold; font-size:1.3em;">${total}</div>
            <div style="color:#666;">Total</div>
        </div>
        <div style="flex:1; background:#0a0020; border:1px solid #00cc88; border-radius:6px; padding:8px;">
            <div style="color:#00cc88; font-weight:bold; font-size:1.3em;">${conocidos}</div>
            <div style="color:#666;">Descubiertos</div>
        </div>
        <div style="flex:1; background:#0a0020; border:1px solid #888; border-radius:6px; padding:8px;">
            <div style="color:#aaa; font-weight:bold; font-size:1.3em;">${total - conocidos}</div>
            <div style="color:#666;">Sellados</div>
        </div>
    </div>

    <!-- Buscador -->
    <input type="text" value="${busqueda}" placeholder="🔍 Buscar nodo..."
        oninput="window.devMapa.setBusqueda(this.value)"
        style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; border-radius:6px; padding:8px 10px; margin-bottom:8px; font-family:'Rajdhani'; font-size:0.95em; outline:none;">

    <!-- Filtros inline -->
    <div style="display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap; align-items:center;">
        <select onchange="window.devMapa.setFiltroAf(this.value)"
            style="flex:1; min-width:100px; background:#0a0020; color:#ddd; border:1px solid #555; border-radius:4px; padding:6px; font-family:'Rajdhani'; font-size:0.85em;">
            <option value="">— Afinidad —</option>
            ${afinidades.map(a => `<option value="${a}" ${filtroAfinidad === a ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
        <select onchange="window.devMapa.setFiltroVis(this.value)"
            style="flex:1; min-width:100px; background:#0a0020; color:#ddd; border:1px solid #555; border-radius:4px; padding:6px; font-family:'Rajdhani'; font-size:0.85em;">
            <option value="todos"    ${filtroVisibilidad === 'todos'    ? 'selected' : ''}>Todos</option>
            <option value="conocidos"${filtroVisibilidad === 'conocidos'? 'selected' : ''}>👁️ Descubiertos</option>
            <option value="ocultos"  ${filtroVisibilidad === 'ocultos'  ? 'selected' : ''}>🔒 Sellados</option>
        </select>
    </div>`;

    if (nodos.length === 0) {
        html += `<div style="color:#666; font-style:italic; text-align:center; padding:30px;">
            Sin resultados para el filtro actual.
        </div>`;
        return html;
    }

    // ── Lista de nodos ────────────────────────────────────────
    html += `<div style="display:flex; flex-direction:column; gap:6px;">`;

    for (const nodo of nodos) {
        const esConocido = getVisibilidadActual(nodo.id);
        const cambioVis  = mapaDevState.colaVisibilidad[nodo.id] !== undefined;
        const colorAf    = _getColorAfinidad(nodo.afinidad);
        const safeId     = nodo.id.replace(/'/g, "\\'");

        const badgeVis = esConocido
            ? `<span style="background:rgba(0,180,100,0.2); color:#00cc88; border:1px solid #00aa66; border-radius:4px; padding:2px 6px; font-size:0.75em;">👁️ Desc.</span>`
            : `<span style="background:rgba(100,100,100,0.15); color:#888; border:1px solid #555; border-radius:4px; padding:2px 6px; font-size:0.75em;">🔒 Sellado</span>`;

        const indicadorCambio = cambioVis
            ? `<span style="color:#ffaa00; font-size:0.7em; margin-left:4px;">●</span>`
            : '';

        const hexCosto = nodo.hex ? `<span style="color:#b8860b; font-size:0.75em;">${nodo.hex} HEX</span>` : '';
        const clase    = nodo.clase ? `<span style="color:#666; font-size:0.75em;">${nodo.clase}</span>` : '';

        html += `
        <div style="background:#0a0020; border:1px solid ${esConocido ? '#2a1060' : '#222'}; border-left:3px solid ${colorAf}; border-radius:6px; padding:10px 12px; transition:border-color 0.2s;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:bold; color:#ddd; font-size:0.9em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${nodo.nombreOriginal || nodo.id}${indicadorCambio}
                    </div>
                    <div style="display:flex; gap:6px; margin-top:4px; flex-wrap:wrap; align-items:center;">
                        <span style="color:${colorAf}; font-size:0.75em; font-weight:bold;">${nodo.afinidad || '—'}</span>
                        ${hexCosto}
                        ${clase}
                    </div>
                </div>
                <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
                    ${badgeVis}
                    <button onclick="window.devMapa.toggleVisibilidad('${safeId}')"
                        style="background:${esConocido ? 'rgba(200,60,60,0.2)' : 'rgba(0,180,100,0.2)'}; color:${esConocido ? '#ff6666' : '#00cc88'}; border:1px solid ${esConocido ? '#aa3333' : '#00aa66'}; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:0.8em; font-weight:bold; white-space:nowrap;"
                        title="${esConocido ? 'Sellar este hechizo' : 'Descubrir este hechizo'}">
                        ${esConocido ? '🔒 Sellar' : '👁️ Descubrir'}
                    </button>
                </div>
            </div>
            ${nodo.resumen ? `<div style="color:#888; font-size:0.75em; margin-top:6px; line-height:1.4; font-style:italic;">${nodo.resumen}</div>` : ''}
        </div>`;
    }

    html += `</div>`;
    return html;
}

// ── VISTA: COLORES DE AFINIDAD ────────────────────────────────
function _renderVistaColores() {
    const afinidades = getAfinidadesUnicas();

    if (afinidades.length === 0) {
        return `<div style="color:#666; font-style:italic; text-align:center; padding:30px;">
            No hay afinidades cargadas aún.
        </div>`;
    }

    let html = `
    <div style="color:#888; font-size:0.8em; margin-bottom:12px; line-height:1.4;">
        Los cambios de color se guardan junto al resto de cambios al pulsar 🔥 GUARDAR TODO.
    </div>
    <div style="display:flex; flex-direction:column; gap:6px;">`;

    for (const af of afinidades) {
        const colActual = _getColorAfinidad(af);
        const enCola    = mapaDevState.colaColores[af] !== undefined;
        const safeAf    = af.replace(/'/g, "\\'");

        html += `
        <div style="background:#0a0020; border:1px solid ${enCola ? '#ffaa00' : '#333'}; border-radius:6px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <span style="color:${colActual}; font-weight:bold; font-size:0.9em; flex:1;">${af}</span>
            ${enCola ? `<span style="color:#ffaa00; font-size:0.75em;">● modificado</span>` : ''}
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="color:#666; font-size:0.8em;">${colActual}</span>
                <input type="color" value="${colActual}"
                    onchange="window.devMapa.editarColor('${safeAf}', this.value)"
                    style="width:36px; height:28px; background:none; border:1px solid #555; border-radius:4px; cursor:pointer; padding:2px;">
            </div>
        </div>`;
    }

    html += `</div>`;
    return html;
}

// ── HELPER: Color de afinidad ─────────────────────────────────
function _getColorAfinidad(afinidad) {
    // Prioridad: cola de cambios del dev → window.mapaColores → fallback
    const enCola = mapaDevState.colaColores[afinidad];
    if (enCola) return enCola.t;
    const global = window.mapaColores && window.mapaColores[afinidad];
    if (global) return global.t;
    return '#aaaaaa';
}
