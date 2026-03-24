// ============================================================
// region-ui.js — Paneles de UI: props, regiones, NPCs, misiones, imágenes
// ============================================================

import {
    editor, ui, mapaActual, props, npcsMapaLocal,
    personajesDB, misionesActivas, PROP_TIPOS, CAPAS,
    STORAGE_URL, crearRegion, crearHexData
} from './region-state.js';
import { normKey, guardarProp, eliminarProp, guardarNPC, eliminarNPC, subirImagenProp, listarImagenesBackground } from './region-data.js';
import { setBackground, aplicarHerramienta, hexKey } from './region-engine.js';
import { supabase } from '../hex-auth.js';

const NO_IMG = () => `${STORAGE_URL}/imginterfaz/no_encontrado.png`;

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
    
    const lista = Object.values(props).filter(p => {
        if (busq && !p.nombre.toLowerCase().includes(busq)) return false;
        return true;
    });

    const grid = lista.map(p => {
        const selClase = editor.selectedPropId === p.id ? 'prop-card-sel' : '';
        const esPincel = p.id === 'prop_pintar';
        const icono = esPincel ? `🖌️` : `<img src="${p.imagen || NO_IMG()}" onerror="this.src='${NO_IMG()}'">`;
        return `
        <div class="prop-card ${selClase}" onclick="window.seleccionarPropUI('${p.id}')">
            ${icono} <div class="prop-card-nombre">${p.nombre}</div>
            ${editor.activo && !esPincel && !p.id.startsWith('pj_') ? `<button class="prop-card-del" onclick="event.stopPropagation(); window.eliminarPropUI('${p.id}')">✕</button>` : ''}
        </div>`;
    }).join('');

    return `
    <div class="panel-seccion">
        <div class="panel-buscador-row">
            <input type="text" placeholder="🔍 Buscar prop..." value="${ui.busqueda || ''}" oninput="window.setBusquedaUI(this.value)">
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

        <div style="background:rgba(0,0,0,0.6); border-left:3px solid var(--cyan); border-radius:4px; padding:10px; margin-bottom:15px;">
            <div style="font-size:0.7em;color:#00ffff;font-family:sans-serif;margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">
                🎨 OPCIONES DE PINCEL Y PROPS (Opacidad)
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <input type="color" value="${editor.colorActual||'#4488cc'}" onchange="window.setColorActual(this.value)" style="width:38px;height:32px;border:1px solid #555;border-radius:4px;background:none;cursor:pointer;padding:2px;">
                <span style="font-size:0.7em;color:#888;">Opacidad:</span>
                <input type="range" min="0.1" max="1" step="0.05" value="${editor.opacidadPincel ?? 1.0}" oninput="window.setOpacidadPincel(parseFloat(this.value))" style="flex:1;min-width:60px;accent-color:#00ccff;">
                <button onclick="window.aplicarRuido()" style="background:#0a2a3a;border:1px solid #335566;color:#88ccdd;padding:4px 8px;border-radius:3px;font-size:0.7em;cursor:pointer;">≋ Ruido</button>
            </div>
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
    const listNPCsMap = Object.values(npcsMapaLocal).map(n => `
        <div class="npc-card" onclick="window.seleccionarNPCUI('${n.id}')">
            <img src="${n.icono_url || NO_IMG()}" onerror="this.src='${NO_IMG()}'" class="npc-thumb">
            <div><div class="npc-nombre">${n.nombre}</div> <div class="npc-meta">${n.hex_pos||'No pos'}</div></div>
            ${editor.activo ? `<button class="prop-card-del" onclick="event.stopPropagation(); window.eliminarNPCUI('${n.id}')">✕</button>` : ''}
        </div>`).join('') || '<p class="sin-resultado">No hay NPCs de región.</p>';

    const listJugadoresDB = personajesDB.map(p => {
        const pid = `pj_${normKey(p.nombre)}`;
        const sel = editor.selectedPropId === pid ? 'npc-card-sel' : '';
        return `
        <div class="npc-card ${sel}" onclick="window.seleccionarPropEntidadUI('${pid}')">
            <img src="${STORAGE_URL}/imgpersonajes/${normKey(p.icon)}icon.png" onerror="this.src='${NO_IMG()}'" class="npc-thumb">
            <div><div class="npc-nombre">${p.nombre}</div> <div class="npc-meta">Jugador DB</div></div>
        </div>`;
    }).join('');

    return `
    <div class="panel-seccion">
        ${editor.activo ? `<button class="btn-panel-add" style="width:100%; margin-bottom:8px;" onclick="window.abrirCrearNPCUI()">＋ Nuevo NPC Región</button>` : ''}
        <div class="panel-sub-titulo">NPCs de Región / Locales</div>
        <div class="lista-npcs">${listNPCsMap}</div>
        <div class="panel-sub-titulo" style="margin-top:15px;">Jugadores DB Activos</div>
        <div class="lista-npcs">${listJugadoresDB}</div>
    </div>`;
}

function htmlImagenesPanel() {
    let listaProps = Object.values(props);
    
    if (ui.filtroPropSinImagen) listaProps = listaProps.filter(p => !p.imagen && p.id !== 'prop_pintar');

    const grid = listaProps.map(p => `
        <div style="background:rgba(0,0,0,0.3); padding:5px; text-align:center; position:relative; border-radius:4px; border:1px solid #333;">
            <img src="${p.imagen || NO_IMG()}" onerror="this.src='${NO_IMG()}'" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:3px;">
            <div style="font-size:0.65em; margin-top:3px; word-break:break-word;">${p.nombre}</div>
            ${editor.activo && p.id !== 'prop_pintar' ? `<button class="btn-accion-mini" onclick="window.abrirSubidaPropUI('${p.id}')" style="margin-top:4px; width:100%; font-size:0.7em; padding:2px;">📤 Subir</button>` : ''}
        </div>`).join('');

    return `
    <div class="panel-seccion">
        ${editor.activo ? `
        <div id="upload-form" class="upload-form" style="background:#050510; padding:10px; border-radius:6px; margin-bottom:10px;">
            <div style="font-size:0.8em; color:#00ffff; margin-bottom:5px;">📤 Subir imagen de prop</div>
            <input type="hidden" id="up-prop-id">
            <input type="text" id="up-prop-nombre" placeholder="Nombre prop" style="width:100%; box-sizing:border-box; margin-bottom:5px; padding:4px;">
            <div class="panel-finder-row">
                <select id="up-prop-tipo" style="padding:4px; flex:1;">${PROP_TIPOS.map(t=>`<option value="${t}">${t}</option>`).join('')}</select>
                <div class="drop-zone" id="drop-zone" onclick="document.getElementById('file-input').click()" style="flex:1; padding:4px; cursor:pointer; background:#1a3a6a; text-align:center; border-radius:4px;">🖼️ Subir</div>
            </div>
            <input type="file" id="file-input" accept="image/*" style="display:none" onchange="window.subirPropImagenUI(event)">
        </div>
        
        <hr style="border-color:#333;margin:12px 0;">
        <div class="panel-sub-titulo">👤 Subir imagen de NPC de Región</div>
        <select id="up-npc-id" style="width:100%;box-sizing:border-box;background:#0a0018;border:1px solid #444;color:#fff;padding:6px;border-radius:4px;font-size:0.82em;margin-bottom:6px;">
            <option value="">-- Selecciona un NPC --</option>
            ${Object.values(npcsMapaLocal).map(n => `<option value="${n.id}">${n.nombre}</option>`).join('')}
        </select>
        <div class="drop-zone" id="drop-npc-zone" onclick="document.getElementById('file-npc-input').click()" style="padding:6px; cursor:pointer; background:#3a1a6a; text-align:center; border-radius:4px;">
            👤 Haz clic para subir imagen
        </div>
        <input type="file" id="file-npc-input" accept="image/*" style="display:none" onchange="window.subirNPCImagenUI(event)">
        ` : ''}
        
        <div class="filter-row" style="margin-top:15px;">
            <label style="font-size:0.8em; color:#aaa;"><input type="checkbox" ${ui.filtroPropSinImagen?'checked':''} onchange="window.setFiltroPropSinImagenUI(this.checked)"> Mostrar faltantes (Sin imagen)</label>
        </div>
        
        <div class="panel-sub-titulo" style="margin-top:10px;">Lista de Props y Entidades</div>
        <div class="props-grid-imgs" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px;">${grid}</div>
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

export function renderInfoHexPanel(q, r, key) {
    const hex = mapaActual.hexes[key];
    const el = document.getElementById('panel-info-hex');
    if (!hex) { el.innerHTML = ''; return; }

    const reg = hex.region ? mapaActual.regiones[hex.region] : null;
    const npcsAqui = Object.values(npcsMapaLocal).filter(n => n.hex_pos === key);
    
    const misionesHtml = reg ? (reg.misiones || []).map(mid => {
        const m = misionesActivas.find(x => x.id === mid);
        return m ? `<span class="tag-mision">${m.titulo}</span>` : '';
    }).join('') : '';

    const npcsHtml = npcsAqui.map(n => `
        <div style="display:flex; align-items:center; gap:6px; font-size:0.8em; margin-top:4px;">
            <img src="${n.icono_url || NO_IMG()}" onerror="this.src='${NO_IMG()}'" style="width:28px; height:28px; border-radius:50%; object-fit:cover; border:1px solid #555;">
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
            <span style="color:#aaa; font-size:0.75em;">Elevación (3D):</span>
            <input type="number" value="${hex.elevation || 0}" style="width:50px; background:#000; border:1px solid #444; color:#fff;"
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

export async function cargarListaBG_UI(fonds) {
    const cont = document.getElementById('lista-bg-imgs');
    if (!cont) return;
    if (!fonds || !fonds.length) { cont.innerHTML = ''; return; }
    cont.innerHTML = fonds.map(url => `
        <div class="bg-thumb" onclick="window.aplicarFondUI('${url}')">
            <img src="${url}">
        </div>`).join('');
}
