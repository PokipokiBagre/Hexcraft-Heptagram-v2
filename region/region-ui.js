// ============================================================
// region-ui.js — Gestión de Paneles UI y Filtros (Isométrico 3D)
// ============================================================

import {
    editor, ui, mapaActual, props, npcsMapaLocal,
    personajesDB, misionesActivas, PROP_TIPOS, CAPAS,
    STORAGE_URL
} from './region-state.js';
import { setBackground } from './region-render.js';
import {
    htmlFormProp, htmlFormNPC, abrirModalUI, cerrarModalUI, mostrarToastUI
} from './region-ui-elements.js';
import { hexKey } from './region-utils.js';

const NO_IMG = `${STORAGE_URL}/imginterfaz/no_encontrado.png`;

export function renderPanel() {
    const contenido = document.getElementById('panel-contenido');
    if (!contenido) return;

    switch (ui.panelActual) {
        case 'props':    contenido.innerHTML = htmlPropsPanel(); break;
        case 'regiones': contenido.innerHTML = htmlRegionesPanel(); break;
        case 'npcs':     contenido.innerHTML = htmlNPCsPanel(); break;
        case 'misiones': contenido.innerHTML = htmlMisionesPanel(); break;
        case 'imagenes': contenido.innerHTML = htmlImagenesPanel(); break;
    }

    actualizarTabsBotones();
}

function htmlPropsPanel() {
    const busq = (ui.busqueda || '').toLowerCase();
    
    // Filtrar props de DB de personajes para no duplicarlos
    const lista = Object.values(props).filter(p => {
        if (p.id.startsWith('pj_')) return false; // No mostrar PJs de DB en grid props
        if (busq && !p.nombre.toLowerCase().includes(busq)) return false;
        return true;
    });

    const grid = lista.map(p => {
        const selClase = editor.selectedPropId === p.id ? 'prop-card-sel' : '';
        const esPincel = p.id === 'prop_pintar';
        const icono = esPincel ? `🖌️` : `<img src="${p.imagen || NO_IMG}" onerror="this.src='${NO_IMG}'">`;
        return `
        <div class="prop-card ${selClase}" onclick="window.seleccionarPropUI('${p.id}')">
            ${icono} <div class="prop-card-nombre">${p.nombre}</div>
            ${editor.activo && !esPincel ? `<button class="prop-card-del" onclick="event.stopPropagation(); window.eliminarPropUI('${p.id}')">✕</button>` : ''}
        </div>`;
    }).join('');

    return `
    <div class="panel-seccion">
        <div class="panel-buscador-row">
            <input type="text" placeholder="🔍 Buscar prop..." value="${ui.busqueda}" oninput="window.setBusquedaUI(this.value)">
            ${editor.activo ? `<button class="btn-panel-add" onclick="window.abrirCrearPropUI()">＋</button>` : ''}
        </div>

        ${editor.activo ? `
        <div class="capa-selector" style="margin-bottom:8px;">
            <span style="color:#888; font-size:0.8em;">Capa:</span>
            ${CAPAS.map(c => `<button class="filtro-pill capa-btn ${editor.capaActual === c ? 'activo' : ''}" onclick="window.setCapaActualUI('${c}')">${c}</button>`).join('')}
        </div>
        <div class="brush-row" style="margin-bottom:12px;">
            <span style="color:#888; font-size:0.8em;">Brush:</span>
            ${[1,2,3,4].map(n => `<button class="filtro-pill ${editor.brushSize===n?'activo':''}" onclick="window.setBrushSizeUI(${n})">${n}</button>`).join('')}
        </div>
        ` : ''}

        <div class="props-grid">${grid}</div>
    </div>`;
}

function htmlRegionesPanel() {
    const regs = Object.values(mapaActual.regiones);
    const lista = regs.map(reg => `
        <div class="region-card ${ui.selectedRegion === reg.id ? 'region-card-sel' : ''}" onclick="window.seleccionarRegionUI('${reg.id}')">
            <div class="region-color-dot" style="background:${reg.color}"></div>
            <div class="region-info">
                <div class="region-nombre">${reg.nombre} ${reg.tieneInterior ? '🏠' : ''}</div>
                <div class="region-meta">${reg.hexes.length} hexes</div>
            </div>
            ${editor.activo ? `<button class="prop-card-del" onclick="event.stopPropagation(); window.eliminarRegionUI('${reg.id}')">✕</button>` : ''}
        </div>`).join('');

    return `<div class="panel-seccion">
        ${editor.activo ? `<button class="btn-panel-add" style="width:100%; margin-bottom:10px;" onclick="window.crearRegionUI()">＋ Nueva Región</button>` : ''}
        <div class="lista-regiones">${lista}</div>
    </div>`;
}

function htmlNPCsPanel() {
    // NPCs locales y Jugadores de DB (PropGrid Entidades)
    const listNPCsMap = Object.values(npcsMapaLocal).map(n => `
        <div class="npc-card" onclick="window.seleccionarNPCUI('${n.id}')">
            <img src="${n.icono_url || NO_IMG}" onerror="this.src='${NO_IMG}'" class="npc-thumb">
            <div><div class="npc-nombre">${n.nombre}</div> <div class="npc-meta">${n.hex_pos||'No pos'}</div></div>
            ${editor.activo ? `<button class="prop-card-del" onclick="event.stopPropagation(); window.eliminarNPCUI('${n.id}')">✕</button>` : ''}
        </div>`).join('');

    const listJugadoresDB = personajesDB.map(p => {
        const pid = `pj_${normKey(p.nombre)}`;
        const sel = editor.selectedPropId === pid ? 'npc-card-sel' : '';
        return `
        <div class="npc-card ${sel}" onclick="window.seleccionarPropEntidadUI('${pid}')">
            <img src="${STORAGE_URL}/imgpersonajes/${normKey(p.icon)}icon.png" class="npc-thumb">
            <div><div class="npc-nombre">${p.nombre}</div> <div class="npc-meta">Jugador DB</div></div>
        </div>`;
    }).join('');

    return `
    <div class="panel-seccion">
        ${editor.activo ? `<button class="btn-panel-add" style="width:100%; margin-bottom:8px;" onclick="window.abrirCrearNPCUI()">＋ Nuevo NPC Región</button>` : ''}
        <div class="panel-sub-titulo">NPCs de Región / Locales</div>
        <div class="lista-npcs">${listNPCsMap}</div>
        <div class="panel-sub-titulo" style="margin-top:15px;">Jugadores DB Activos (Props)</div>
        <div class="lista-npcs">${listJugadoresDB}</div>
    </div>`;
}

function htmlImagenesPanel() {
    let listaProps = Object.values(props);
    
    // Filtro "faltantes" (Props sin imagen)
    if (ui.filtroPropSinImagen) listaProps = listaProps.filter(p => !p.imagen);

    const grid = listaProps.map(p => `
        <div style="background:rgba(0,0,0,0.3); padding:5px; text-align:center; position:relative;">
            <img src="${p.imagen || NO_IMG}" style="width:100%; aspect-ratio:1; object-fit:cover;">
            <div style="font-size:0.65em; margin-top:3px;">${p.nombre}</div>
            ${editor.activo ? `<button class="btn-accion-mini" onclick="window.abrirSubidaPropUI('${p.id}')">📤 Subir</button>` : ''}
        </div>`).join('');

    return `
    <div class="panel-seccion">
        ${editor.activo ? `
        <div id="upload-form" class="upload-form">
            <input type="hidden" id="up-prop-id">
            <input type="text" id="up-prop-nombre" placeholder="Nombre prop">
            <div class="panel-finder-row">
                <select id="up-prop-tipo">${PROP_TIPOS.map(t=>`<option value="${t}">${t}</option>`).join('')}</select>
                <div class="drop-zone" id="drop-zone" onclick="document.getElementById('file-input').click()">🖼️ Subir</div>
            </div>
            <input type="file" id="file-input" accept="image/*" style="display:none" onchange="window.subirPropImagenUI(event)">
        </div>` : ''}
        <div class="filter-row">
            <label><input type="checkbox" ${ui.filtroPropSinImagen?'checked':''} onchange="window.setFiltroPropSinImagenUI(this.checked)"> Mostrar faltantes (Sin imagen)</label>
        </div>
        <div class="panel-sub-titulo">Lista de Props y Fondos</div>
        <div class="bg-imgs" id="lista-bg-imgs">Cargando fondos...</div>
        <div class="props-grid-imgs">${grid}</div>
    </div>`;
}

export function htmlMisionesPanel() {
    const list = misionesActivas.map(m => `
        <div class="mision-item">
            <span class="mision-estado m-${m.estado}">${m.estado===1?'Pendiente':'En curso'}</span>
            <div class="mision-titulo">${m.titulo}</div>
            <div class="mision-tipo">${m.tipo} · Clase ${m.clase}</div>
        </div>`).join('');
    return `<div class="panel-seccion"><div class="lista-misiones-panel">${list}</div></div>`;
}

// Muestra información del hexágono seleccionado, incluyendo NPCs presentes y misiones.
export function renderInfoHexPanel(q, r, key) {
    const hex = mapaActual.hexes[key];
    const el = document.getElementById('panel-info-hex');
    if (!hex) { el.innerHTML = ''; return; }

    const reg = hex.region ? mapaActual.regiones[hex.region] : null;
    const npcsAqui = Object.values(npcsMapaLocal).filter(n => n.hex_pos === key);
    
    // Misiones activas en la región del hex
    const misionesHtml = reg ? (reg.misiones || []).map(mid => {
        const m = misionesActivas.find(x => x.id === mid);
        return m ? `<span class="tag-mision">${m.titulo}</span>` : '';
    }).join('') : '';

    // NPCs presentes en el hex
    const npcsHtml = npcsAqui.map(n => `
        <div style="display:flex; align-items:center; gap:6px; font-size:0.8em; margin-top:4px;">
            <img src="${n.icono_url || NO_IMG}" style="width:28px; height:28px; border-radius:50%; object-fit:cover; border:1px solid #555;">
            <div><div style="font-weight:bold;">${n.nombre}</div> ${n.descripcion||''}</div>
        </div>`).join('');

    el.innerHTML = `
    <div style="padding:10px;">
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;">
            <div class="info-hex-titulo">
                ${reg ? reg.nombre : `Hex (${q},${r})`}
            </div>
            <button onclick="document.getElementById('panel-info-hex').innerHTML=''" style="background:none; border:none; color:#666; font-size:1em;">✕</button>
        </div>
        
        ${reg ? `<div class="detalle-fila">Control: ${reg.controlador || '—'}</div>
                 <div class="detalle-fila">Accesible: ${reg.accesible?'Sí':'No'}</div>` : ''}
        
        <div class="divider"></div>
        ${misionesHtml ? `<div class="detalle-fila"><b>Misiones:</b><br>${misionesHtml}</div>` : ''}
        ${npcsHtml ? `<div class="detalle-fila"><b>Presentes:</b>${npcsHtml}</div>` : ''}

        ${editor.activo ? `
        <div class="divider"></div>
        <div class="brush-row" style="margin-top:5px;">
            <span style="color:#aaa; font-size:0.75em;">Elevación:</span>
            <input type="number" value="${hex.elevation}" style="width:50px; background:#000; border:1px solid #444; color:#fff;"
                onchange="window.actualizarElevacionUI('${key}', this.value)">
        </div>
        ` : ''}
    </div>`;
}

function actualizarTabsBotones() {
    document.querySelectorAll('.tab-panel-btn').forEach(b => {
        b.classList.toggle('activo', b.dataset.panel === ui.panelActual);
    });
}

// Carga simbólica de fondos para UI ( region-render.js maneja la imagen real)
export async function cargarListaBG_UI(fonds) {
    const cont = document.getElementById('lista-bg-imgs');
    if (!cont) return;
    if (!fonds || !fonds.length) { cont.innerHTML = ''; return; }
    cont.innerHTML = fonds.map(url => `
        <div class="bg-thumb" onclick="window.aplicarFondUI('${url}')">
            <img src="${url}">
        </div>`).join('');
}
