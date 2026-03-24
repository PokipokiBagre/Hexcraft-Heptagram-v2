// ============================================================
// region-ui.js — Paneles de UI
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
        case 'props':    contenido.innerHTML = htmlProps();    break;
        case 'regiones': contenido.innerHTML = htmlRegiones(); break;
        case 'npcs':     contenido.innerHTML = htmlNPCs();     break;
        case 'misiones': contenido.innerHTML = htmlMisiones(); break;
        case 'imagenes': contenido.innerHTML = htmlImagenes(); break;
        default:         contenido.innerHTML = '';
    }

    actualizarTabsBotones();
}

function htmlProps() {
    const busq = (ui.busqueda || '').toLowerCase();
    const lista = Object.values(props).filter(p => {
        if (busq && !p.nombre.toLowerCase().includes(busq)) return false;
        return true;
    });

    const grid = lista.map(p => {
        const selClase = editor.propSeleccionado?.id === p.id ? 'prop-card-sel' : '';
        const esPincel = p.id === 'prop_pintar';
        const icono = esPincel ? `<div style="font-size: 2em; line-height: 1;">🖌️</div>` : `<img src="${p.imagen || NO_IMG()}" onerror="this.src='${NO_IMG()}'">`;
        
        return `
        <div class="prop-card ${selClase}" onclick="window.seleccionarProp('${p.id}')" title="${p.nombre}">
            ${icono}
            <div class="prop-card-nombre">${p.nombre}</div>
            <div class="prop-card-meta">${p.tipo}</div>
            ${editor.activo && !esPincel && !p.id.startsWith('pj_') ? `<button class="prop-card-del" onclick="event.stopPropagation(); window.eliminarPropUI('${p.id}')">✕</button>` : ''}
        </div>`;
    }).join('') || '<p class="sin-resultado">Sin props. Crea uno con el botón +</p>';

    return `
    <div class="panel-seccion">
        <div class="panel-buscador-row">
            <input type="text" placeholder="🔍 Buscar prop o NPC..." value="${ui.busqueda || ''}"
                oninput="window.setBusquedaUI(this.value)"
                style="flex:1; background:#0a0018; border:1px solid #444; color:#fff; padding:6px 10px; border-radius:4px; font-size:0.82em;">
            ${editor.activo ? `<button class="btn-panel-add" onclick="window.abrirCrearProp()">＋ Nuevo</button>` : ''}
        </div>

        ${editor.activo ? `
        <div class="capa-selector" style="margin-bottom: 8px;">
            <span style="color:#888; font-size:0.78em; font-family:sans-serif;">AGREGAR EN CAPA:</span>
            ${CAPAS.map(c => `<button class="filtro-pill capa-btn ${editor.capaActual === c ? 'activo' : ''}" onclick="window.setCapaActual('${c}')">${c}</button>`).join('')}
        </div>
        <div class="brush-row" style="margin-bottom: 12px;">
            <span style="color:#888; font-size:0.78em;">TAMAÑO BRUSH:</span>
            ${[1,2,3,4].map(n => `<button class="filtro-pill ${editor.brushSize===n?'activo':''}" onclick="window.setBrushSize(${n})">${n}</button>`).join('')}
        </div>
        
        <div style="background:rgba(0,0,0,0.6); border-left:3px solid var(--cyan); border-radius:4px; padding:10px; margin-bottom:15px;">
            <div style="font-size:0.7em;color:#00ffff;font-family:sans-serif;margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">
                🎨 Opciones de Color (Solo activo con Pincel)
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <input type="color" value="${editor.colorActual||'#4488cc'}"
                    onchange="window.setColorActual(this.value)"
                    style="width:38px;height:32px;border:1px solid #555;border-radius:4px;background:none;cursor:pointer;padding:2px;">
                <span style="font-size:0.7em;color:#888;">Opacidad:</span>
                <input type="range" min="0.1" max="1" step="0.05" value="${editor.opacidadPincel??0.7}"
                    oninput="window.setOpacidadPincel(parseFloat(this.value))"
                    style="flex:1;min-width:60px;accent-color:#00ccff;">
                <button onclick="window.aplicarRuido()" style="background:#0a2a3a;border:1px solid #335566;color:#88ccdd;padding:4px 8px;border-radius:3px;font-size:0.7em;cursor:pointer;" title="Ruido de color">≋ Ruido</button>
            </div>
        </div>
        ` : ''}

        <div class="props-grid" style="grid-template-columns: repeat(5, 1fr); gap: 4px;">${grid}</div>
    </div>`;
}

export function abrirModal(contenidoHtml, titulo = '') {
    document.getElementById('modal-titulo').innerText = titulo;
    document.getElementById('modal-cuerpo').innerHTML = contenidoHtml;
    document.getElementById('modal-region').classList.remove('oculto');
}

export function cerrarModal() {
    document.getElementById('modal-region').classList.add('oculto');
}

export function htmlFormProp(propData = null) {
    const p = propData || { id:'', nombre:'', tipo:'terreno', imagen:'' };
    return `
    <div style="display:flex; flex-direction:column; gap:10px;">
        <input type="hidden" id="fp-id" value="${p.id||''}">
        <label>Nombre
            <input type="text" id="fp-nombre" value="${p.nombre}" class="form-input">
        </label>
        <label>Tipo (Categoría visual)
            <select id="fp-tipo" class="form-input">
                ${PROP_TIPOS.map(t => `<option value="${t}" ${p.tipo===t?'selected':''}>${t}</option>`).join('')}
            </select>
        </label>
        <label>Imagen URL (o sube una imagen desde la pestaña Imgs)
            <input type="text" id="fp-imagen" value="${p.imagen||''}" placeholder="https://..." class="form-input">
        </label>
        <button class="btn-accion" style="background:var(--gold); color:#000;" onclick="window.guardarPropUI()">💾 Guardar Prop</button>
    </div>`;
}

function htmlRegiones() {
    const regs = Object.values(mapaActual.regiones);
    const lista = regs.map(reg => {
        const selClase = ui.selectedRegion === reg.id ? 'region-card-sel' : '';
        const tieneInt = reg.tieneInterior ? '🏠' : '';
        return `
        <div class="region-card ${selClase}" onclick="window.seleccionarRegion('${reg.id}')">
            <div class="region-color-dot" style="background:${reg.color}"></div>
            <div class="region-info">
                <div class="region-nombre">${tieneInt} ${reg.nombre}</div>
                <div class="region-meta">${reg.hexes.length} hexes · ${reg.controlador || 'Sin control'}</div>
            </div>
        </div>`;
    }).join('') || '<p class="sin-resultado">No hay regiones.</p>';

    const regSel = ui.selectedRegion ? mapaActual.regiones[ui.selectedRegion] : null;
    const detalleHtml = regSel ? htmlDetalleRegion(regSel) : '';

    return `
    <div class="panel-seccion">
        ${editor.activo ? `<button class="btn-panel-add" style="width:100%; margin-bottom:10px;" onclick="window.crearRegionUI()">＋ Nueva Región</button>` : ''}
        ${!regSel ? `<div class="lista-regiones">${lista}</div>` : detalleHtml}
    </div>`;
}

function htmlDetalleRegion(reg) {
    if (!editor.activo) {
        const misls = (reg.misiones || []).map(mid => {
            const m = misionesActivas.find(x => x.id === mid);
            return m ? `<span class="tag-mision">${m.titulo}</span>` : '';
        }).join('');

        const npcsRegion = Object.values(npcsMapaLocal).filter(n => (reg.hexes || []).includes(n.hex));
        const npcsHtml = npcsRegion.map(n => `
            <div style="display:flex; align-items:center; gap:6px; font-size:0.78em; margin-top:4px;">
                <img src="${n.icono || NO_IMG()}" onerror="this.src='${NO_IMG()}'"
                    style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:1px solid #555;">
                <span>${n.nombre}</span>
            </div>`).join('');

        return `
        <div class="region-detalle">
            <button onclick="window.deseleccionarRegion()" style="background:none;border:none;color:var(--cyan);cursor:pointer;margin-bottom:8px;font-size:0.8em;">⬅ Volver a lista</button>
            <div class="detalle-titulo">${reg.nombre}</div>
            <div class="detalle-fila"><b>Control:</b> ${reg.controlador || '—'}</div>
            <div class="detalle-fila"><b>Accesible:</b> ${reg.accesible ? 'Sí' : 'No'}</div>
            ${misls ? `<div class="detalle-fila" style="margin-top:6px;"><b>Misiones:</b><br>${misls}</div>` : ''}
            ${npcsHtml ? `<div class="detalle-fila" style="margin-top:8px;"><b>Personajes presentes:</b>${npcsHtml}</div>` : '<div class="detalle-fila" style="margin-top:8px;color:#666;font-size:0.8em;">(Nota: Los jugadores aún no se posicionan en el mapa general)</div>'}
            ${reg.tieneInterior ? `
            <button class="btn-accion" style="width:100%;margin-top:8px;" onclick="window.entrarInterior('${reg.id}')">
                🚪 Entrar al interior
            </button>` : ''}
        </div>`;
    }

    const misionChecks = misionesActivas.map(m => {
        const checked = (reg.misiones || []).includes(m.id) ? 'checked' : '';
        const safeId  = m.id.replace(/'/g, "\\'");
        return `
        <label style="display:flex; align-items:center; gap:6px; font-size:0.78em; padding:3px 0; cursor:pointer;">
            <input type="checkbox" ${checked}
                onchange="window.toggleMisionRegion('${reg.id}','${safeId}',this.checked)"
                style="accent-color:var(--gold);">
            <span style="color:#ccc;">${m.titulo}</span>
            <span style="color:#666; font-size:0.85em;">(${m.tipo})</span>
        </label>`;
    }).join('') || '<p style="font-size:0.75em;color:#666;">Sin misiones activas</p>';

    const npcsRegion = Object.values(npcsMapaLocal).filter(n => (reg.hexes || []).includes(n.hex));

    return `
    <div class="region-detalle edit">
        <button onclick="window.deseleccionarRegion()" style="background:none;border:none;color:var(--cyan);cursor:pointer;margin-bottom:8px;font-size:0.8em;">⬅ Volver a lista</button>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div class="detalle-titulo" style="color:var(--gold); margin:0;">✏️ Editando Región</div>
            <button onclick="window.eliminarRegionUI('${reg.id}')"
                style="background:#4a0000; border:1px solid #ff4444; color:#fff; padding:3px 8px; border-radius:4px; font-size:0.72em; cursor:pointer;">
                🗑️ Eliminar
            </button>
        </div>
        <label>Nombre
            <input type="text" value="${reg.nombre.replace(/"/g,'&quot;')}"
                oninput="window.actualizarRegion('${reg.id}','nombre',this.value)"
                style="width:100%;box-sizing:border-box;background:#0a0018;border:1px solid #444;color:#fff;padding:5px 8px;border-radius:4px;font-size:0.85em;margin-top:3px;">
        </label>
        <label style="margin-top:8px; display:block;">Controlador
            <input type="text" value="${(reg.controlador||'').replace(/"/g,'&quot;')}"
                oninput="window.actualizarRegion('${reg.id}','controlador',this.value)"
                style="width:100%;box-sizing:border-box;background:#0a0018;border:1px solid #444;color:#fff;padding:5px 8px;border-radius:4px;font-size:0.85em;margin-top:3px;">
        </label>
        <div style="display:flex; align-items:center; gap:10px; margin-top:8px; flex-wrap:wrap;">
            <label style="font-size:0.78em; color:#aaa; display:flex; align-items:center; gap:6px;">
                Color
                <input type="color" value="${reg.color}"
                    oninput="window.actualizarRegion('${reg.id}','color',this.value)"
                    style="width:32px;height:26px;border:none;background:none;cursor:pointer;padding:0;">
            </label>
            <label style="font-size:0.78em; color:#aaa; flex:1; min-width:120px; display:flex; align-items:center; gap:6px;">
                Opacidad
                <input type="range" min="0.05" max="0.75" step="0.05" value="${reg.opacidad||0.3}"
                    oninput="window.actualizarRegion('${reg.id}','opacidad',parseFloat(this.value))"
                    style="flex:1; accent-color:var(--cyan);">
            </label>
        </div>
        <label style="display:flex; align-items:center; gap:8px; font-size:0.78em; color:#aaa; margin-top:8px; cursor:pointer;">
            <input type="checkbox" ${reg.accesible ? 'checked' : ''}
                onchange="window.actualizarRegion('${reg.id}','accesible',this.checked)"
                style="accent-color:var(--gold);">
            Accesible (clickable para jugadores)
        </label>

        <div style="margin-top:10px;">
            <div style="font-size:0.72em; color:#888; font-family:sans-serif; text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px;">
                Misiones activas
            </div>
            <div style="background:rgba(0,0,0,0.3); border:1px solid #333; border-radius:5px; padding:6px 8px; max-height:110px; overflow-y:auto;">
                ${misionChecks}
            </div>
        </div>

        ${npcsRegion.length ? `
        <div style="margin-top:8px; font-size:0.72em; color:#888; font-family:sans-serif;">
            PERSONAJES EN LA REGIÓN (${npcsRegion.length}):
            ${npcsRegion.map(n=>`<div style="font-size:1em;color:#aaa;padding:2px 0;">${n.nombre}</div>`).join('')}
        </div>` : '<div style="margin-top:8px; font-size:0.72em; color:#666; font-family:sans-serif;">(Los jugadores no figuran con hex específico)</div>'}

        <div style="display:flex; gap:6px; margin-top:12px; flex-wrap:wrap;">
            <button class="btn-accion" style="flex:1;" onclick="window.activarHerramientaRegion('${reg.id}')">
                🖊️ Pintar hexes
            </button>
            <button class="btn-accion" style="flex:1; background:#003344; border-color:#00aacc;" onclick="window.abrirInterior('${reg.id}')">
                🏠 ${reg.tieneInterior ? 'Editor Interior' : 'Crear Interior'}
            </button>
        </div>
    </div>`;
}

function htmlNPCs() {
    const todos = Object.values(npcsMapaLocal);
    const jugadores = personajesDB.filter(p => p.isPlayer || p.npcTipo === 'jugador');

    const listaLocal = todos.map(n => {
        const safeId = n.id.replace(/'/g, "\\'");
        return `
        <div class="npc-card" onclick="window.seleccionarNPCUI('${safeId}')">
            <img src="${n.icono || NO_IMG()}" onerror="this.src='${NO_IMG()}'" class="npc-thumb">
            <div>
                <div class="npc-nombre">${n.nombre}</div>
                <div class="npc-meta">${n.tipo} · ${n.hex||'Sin posición'}</div>
            </div>
            ${editor.activo ? `<button class="prop-card-del" onclick="event.stopPropagation(); window.eliminarNPCUI('${safeId}')">✕</button>` : ''}
        </div>`;
    }).join('') || '<p class="sin-resultado">No hay NPCs en el mapa.</p>';

    const listaJug = jugadores.map(p => `
        <div class="npc-card npc-db">
            <img src="${STORAGE_URL}/imgpersonajes/${normKey(p.icon)}icon.png" onerror="this.src='${NO_IMG()}'" class="npc-thumb">
            <div>
                <div class="npc-nombre">${p.nombre}</div>
                <div class="npc-meta">${p.isPlayer ? 'Jugador' : 'NPC Jugador'}</div>
            </div>
        </div>`).join('') || '<p class="sin-resultado sin-resultado-sm">Ninguno activo.</p>';

    return `
    <div class="panel-seccion">
        <div class="panel-sub-titulo">NPCs del Mapa (Sistema y Región)</div>
        ${editor.activo ? `<button class="btn-panel-add" style="width:100%; margin-bottom:8px;" onclick="window.abrirCrearNPC()">＋ Nuevo NPC</button>` : ''}
        <div class="lista-npcs">${listaLocal}</div>

        <div class="panel-sub-titulo" style="margin-top:15px;">Jugadores de DB</div>
        <div class="lista-npcs">${listaJug}</div>
    </div>`;
}

function htmlMisiones() {
    const activas = misionesActivas;
    if (!activas.length) return `<div class="panel-seccion"><p class="sin-resultado">No hay misiones activas.</p></div>`;

    const items = activas.map(m => `
        <div class="mision-item">
            <span class="mision-estado mision-estado-${m.estado}">${m.estado === 1 ? 'Pendiente' : 'En curso'}</span>
            <div class="mision-titulo">${m.titulo}</div>
            <div class="mision-tipo">${m.tipo} · Clase ${m.clase}</div>
        </div>`).join('');

    return `<div class="panel-seccion"><div class="lista-misiones-panel">${items}</div></div>`;
}

function htmlImagenes() {
    let todosProps = Object.values(props);
    const imgFallback = `${STORAGE_URL}/imginterfaz/no_encontrado.png`;

    // Filtro por imagen
    if (ui.filtroImgs === 'con') todosProps = todosProps.filter(p => p.imagen);
    if (ui.filtroImgs === 'sin') todosProps = todosProps.filter(p => !p.imagen);

    const gridProps = todosProps.length === 0
        ? '<p class="sin-resultado">No hay resultados para este filtro.</p>'
        : todosProps.map(p => {
            const tieneImg = !!p.imagen;
            const badge = tieneImg
                ? `<div style="position:absolute;top:4px;right:4px;background:#00aa44;color:#fff;font-size:0.55em;padding:1px 4px;border-radius:3px;font-weight:bold;">✓</div>`
                : `<div style="position:absolute;top:4px;right:4px;background:#ff4444;color:#fff;font-size:0.55em;padding:1px 4px;border-radius:3px;font-weight:bold;">!</div>`;
            const src = tieneImg ? p.imagen : imgFallback;
            const safeId = p.id.replace(/'/g,"\\'");
            return `
            <div style="background:${tieneImg?'rgba(0,40,10,0.35)':'rgba(80,0,0,0.25)'};border:1px solid ${tieneImg?'#00aa44':'#ff4444'};border-radius:6px;padding:6px;text-align:center;position:relative;">
                ${badge}
                <img src="${src}" onerror="this.src='${imgFallback}'"
                    style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:4px;display:block;">
                <div style="font-size:0.62em;color:#ccc;margin-top:4px;word-break:break-word;font-family:sans-serif;">${p.nombre}</div>
                <div style="font-size:0.57em;color:#666;">${p.tipo}</div>
                ${editor.activo ? `<button onclick="window.abrirSubidaProp('${safeId}')"
                    style="margin-top:4px;background:${tieneImg?'#004a00':'#4a0000'};border:1px solid ${tieneImg?'#00ff00':'#ff4444'};color:#fff;padding:2px 6px;border-radius:3px;font-size:0.65em;cursor:pointer;width:100%;">
                    ${tieneImg?'🔄 Cambiar':'📤 Subir'}
                </button>` : ''}
            </div>`;
        }).join('');

    return `
    <div class="panel-seccion">
        ${editor.activo ? `
        <div class="panel-sub-titulo">📤 Subir imagen de prop</div>
        <div id="upload-prop-form">
            <input type="hidden" id="up-prop-id">
            <input type="text" id="up-prop-nombre" placeholder="Nombre del prop"
                style="width:100%;box-sizing:border-box;background:#0a0018;border:1px solid #444;color:#fff;padding:6px;border-radius:4px;font-size:0.82em;margin-bottom:6px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;">
                <select id="up-prop-tipo" style="background:#0a0018;border:1px solid #444;color:#fff;padding:5px;border-radius:4px;font-size:0.8em;">
                    ${PROP_TIPOS.map(t => `<option value="${t}">${t}</option>`).join('')}
                </select>
            </div>
            <div class="drop-prop" id="drop-prop-zone"
                onclick="document.getElementById('file-prop-input').click()"
                ondragover="event.preventDefault(); this.classList.add('drag-sobre')"
                ondragleave="this.classList.remove('drag-sobre')"
                ondrop="window.dropPropImagen(event)">
                🖼️ Arrastra o haz clic para subir imagen al Prop
            </div>
            <input type="file" id="file-prop-input" accept="image/*" style="display:none" onchange="window.subirPropImagen(event)">
            <div id="up-prop-progress" style="display:none;margin-top:6px;">
                <div style="height:4px;background:#0a0018;border-radius:2px;overflow:hidden;">
                    <div id="up-prop-fill" style="height:100%;background:var(--cyan,#00ffff);width:0%;transition:width 0.3s;"></div>
                </div>
                <p id="up-prop-status" style="font-size:0.75em;color:#aaa;text-align:center;margin:3px 0;"></p>
            </div>
        </div>

        <hr style="border-color:#333;margin:12px 0;">
        <div class="panel-sub-titulo">👤 Subir imagen de NPC de Región</div>
        <select id="up-npc-id" style="width:100%;box-sizing:border-box;background:#0a0018;border:1px solid #444;color:#fff;padding:6px;border-radius:4px;font-size:0.82em;margin-bottom:6px;">
            <option value="">-- Selecciona un NPC --</option>
            ${Object.values(npcsMapaLocal).map(n => `<option value="${n.id}">${n.nombre}</option>`).join('')}
        </select>
        <div class="drop-prop" id="drop-npc-zone"
            onclick="document.getElementById('file-npc-input').click()"
            ondragover="event.preventDefault(); this.classList.add('drag-sobre')"
            ondragleave="this.classList.remove('drag-sobre')"
            ondrop="window.dropNPCImagen(event)">
            👤 Haz clic para subir imagen al NPC
        </div>
        <input type="file" id="file-npc-input" accept="image/*" style="display:none" onchange="window.subirNPCImagen(event)">
        <div id="up-npc-progress" style="display:none;margin-top:6px;">
            <div style="height:4px;background:#0a0018;border-radius:2px;overflow:hidden;"><div id="up-npc-fill" style="height:100%;background:#00ffff;width:0%;"></div></div>
            <p id="up-npc-status" style="font-size:0.75em;color:#aaa;text-align:center;margin:3px 0;"></p>
        </div>

        <hr style="border-color:#333;margin:12px 0;">
        <div class="panel-sub-titulo">🌄 Fondo del mapa</div>
        <div class="drop-prop" id="drop-bg-zone"
            onclick="document.getElementById('file-bg-input').click()"
            ondragover="event.preventDefault(); this.classList.add('drag-sobre')"
            ondragleave="this.classList.remove('drag-sobre')"
            ondrop="window.dropBGImagen(event)">
            🌄 Subir nueva imagen de fondo
        </div>
        <input type="file" id="file-bg-input" accept="image/*" style="display:none" onchange="window.subirBGImagen(event)">
        ` : ''}

        <div class="panel-sub-titulo" style="margin-top:12px;">Fondos disponibles</div>
        <div id="lista-bg-imgs" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
            <p class="sin-resultado sin-resultado-sm">Cargando...</p>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
            <div class="panel-sub-titulo" style="margin:0;">🧱 Props </div>
            <select style="background:#0a0018;border:1px solid #444;color:#fff;padding:2px 5px;border-radius:4px;font-size:0.7em;" onchange="window.setFiltroImagenUI(this.value)">
                <option value="todos" ${ui.filtroImgs === 'todos' ? 'selected' : ''}>Todos</option>
                <option value="con" ${ui.filtroImgs === 'con' ? 'selected' : ''}>Con Imagen</option>
                <option value="sin" ${ui.filtroImgs === 'sin' ? 'selected' : ''}>Sin Imagen</option>
            </select>
        </div>
        
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:5px;margin-top:6px;">
            ${gridProps}
        </div>
    </div>`;
}

export function renderInfoHex(q, r, key) {
    const panel = document.getElementById('panel-info-hex');
    if (!panel) return;

    const hex = mapaActual.hexes[key];
    if (!hex) { panel.innerHTML = `<p class="sin-resultado">Hex vacío (${q},${r})</p>`; return; }

    const regionId = hex.region;
    const reg = regionId ? mapaActual.regiones[regionId] : null;

    const npcsAqui = Object.values(npcsMapaLocal).filter(n => n.hex === key);

    const misHtml = reg ? (reg.misiones||[]).map(mid => {
        const m = misionesActivas.find(x => x.id === mid);
        return m ? `<span class="tag-mision">${m.titulo}</span>` : '';
    }).join('') : '';

    const npcsHtml = npcsAqui.map(n => `
        <div class="npc-card mini" style="margin-bottom:4px;">
            <img src="${n.icono||NO_IMG()}" onerror="this.src='${NO_IMG()}'" class="npc-thumb" style="width:32px;height:32px;">
            <div>
                <div class="npc-nombre">${n.nombre}</div>
                ${n.desc ? `<div class="npc-meta">${n.desc}</div>` : ''}
            </div>
        </div>`).join('');

    panel.innerHTML = `
        <div style="padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:10px;">
                <div style="color:var(--gold); font-family:'Cinzel'; font-weight:bold; font-size:1em;">
                    ${reg ? reg.nombre : `Hex (${q},${r})`}
                </div>
                <button onclick="document.getElementById('panel-info-hex').innerHTML=''" style="background:none;border:none;color:#666;font-size:1em;cursor:pointer;">✕</button>
            </div>
            ${reg ? `
            <div style="font-size:0.8em; color:#aaa; font-family:sans-serif; margin-bottom:8px;">
                Control: <span style="color:#fff;">${reg.controlador||'—'}</span><br>
                Acceso: <span style="color:${reg.accesible?'#00ff88':'#ff4444'}">${reg.accesible?'Abierto':'Cerrado'}</span>
            </div>` : ''}
            ${misHtml ? `<div style="margin-bottom:8px;">${misHtml}</div>` : ''}
            ${npcsHtml ? `<div class="panel-sub-titulo" style="margin-bottom:5px;">Presentes</div>${npcsHtml}` : ''}
            ${reg?.tieneInterior ? `
            <button class="btn-accion" style="width:100%; margin-top:8px;" onclick="window.entrarInterior('${reg.id}')">
                🚪 Entrar al interior
            </button>` : ''}
        </div>`;
}

export function htmlFormNPC(npcData = null) {
    const n = npcData || { id:'', nombre:'', tipo:'sistema', icono:'', hex:'', capa:'mid', desc:'', stats:{} };
    return `
    <div style="display:flex; flex-direction:column; gap:10px;">
        <label>Nombre
            <input type="text" id="fn-nombre" value="${n.nombre}" class="form-input">
        </label>
        <label>Tipo
            <select id="fn-tipo" class="form-input">
                <option value="sistema" ${n.tipo==='sistema'?'selected':''}>NPC Sistema (solo mapa)</option>
                <option value="jugador" ${n.tipo==='jugador'?'selected':''}>NPC Jugador (tiene ficha)</option>
            </select>
        </label>
        <label>Icono URL (o sube imagen desde la pestaña Imgs)
            <input type="text" id="fn-icono" value="${n.icono||''}" class="form-input" placeholder="URL de imagen">
        </label>
        <label>Posición (hex q,r) — deja en blanco para sin posición
            <input type="text" id="fn-hex" value="${n.hex||''}" class="form-input" placeholder="ej: 3,2">
        </label>
        <label>Descripción
            <textarea id="fn-desc" class="form-input" rows="3">${n.desc||''}</textarea>
        </label>
        <button class="btn-accion" style="background:var(--gold); color:#000;" onclick="window.guardarNPCUI('${n.id||''}')">💾 Guardar NPC</button>
    </div>`;
}

function actualizarTabsBotones() {
    document.querySelectorAll('.tab-panel-btn').forEach(b => {
        b.classList.toggle('activo', b.dataset.panel === ui.panelActual);
    });
}

export async function cargarListaBG() {
    const cont = document.getElementById('lista-bg-imgs');
    if (!cont) return;
    const imgs = await listarImagenesBackground();
    if (!imgs.length) { cont.innerHTML = '<p class="sin-resultado sin-resultado-sm">Ningún fondo subido aún.</p>'; return; }
    cont.innerHTML = imgs.map(img => `
        <div class="bg-thumb" onclick="window.aplicarBG('${img.url}')" title="${img.nombre}">
            <img src="${img.url}" onerror="this.src='${NO_IMG()}'">
            <div style="font-size:0.6em; color:#888; word-break:break-all;">${img.nombre.replace('region_bg_','')}</div>
        </div>`).join('');
}
