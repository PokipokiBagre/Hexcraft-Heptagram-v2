// ============================================================
// panel-clonar-ui.js — Render del Panel Clonar
// ============================================================

import { clonarState }                                     from './panel-clonar-state.js';
import { devState, STORAGE_URL, norm }                     from '../dev-state.js';
import {
    ejecutarClonado,
    getHechizosOrigen,
    getHechizosDestinoSet,
    getObjetosOrigen,
    getPreview,
}                                                          from './panel-clonar-logic.js';

// ── API global ────────────────────────────────────────────────
window.clonar = {

    selOrigen(nombre) {
        clonarState.pjOrigen = nombre;
        clonarState.hechizosSeleccionados.clear();
        clonarState.objetosCantidades = {};
        clonarState.feedback = null;
        _refresh();
    },

    selDestino(nombre) {
        clonarState.pjDestino = nombre;
        clonarState.feedback = null;
        _refresh();
    },

    setFiltroOrigen(rol) {
        clonarState.filtroOrigenRol   = rol;
        clonarState.busquedaOrigen    = '';
        clonarState.pjOrigen          = null;
        _refresh();
    },

    setFiltroDestino(rol) {
        clonarState.filtroDestinoRol  = rol;
        clonarState.busquedaDestino   = '';
        clonarState.pjDestino         = null;
        _refresh();
    },

    setBusquedaOrigen(t)  { clonarState.busquedaOrigen  = t.toLowerCase(); _refreshSelector('origen'); },
    setBusquedaDestino(t) { clonarState.busquedaDestino = t.toLowerCase(); _refreshSelector('destino'); },

    toggleModulo(key) {
        clonarState.modulos[key] = !clonarState.modulos[key];
        clonarState.feedback = null;
        _refreshConfigPanel();
    },

    // Hechizos
    setModoHz(mode)    { clonarState.hechizosMode = mode; _refreshConfigPanel(); },
    setBusqHz(t)       { clonarState.hechizoBusqueda = t.toLowerCase(); _refreshListaHz(); },
    toggleHz(idNorm)   {
        if (clonarState.hechizosSeleccionados.has(idNorm)) clonarState.hechizosSeleccionados.delete(idNorm);
        else clonarState.hechizosSeleccionados.add(idNorm);
        _actualizarRowHz(idNorm);
        _refreshPreview();
    },
    selTodosHz(v) {
        if (v) getHechizosOrigen(clonarState.pjOrigen).forEach(h => clonarState.hechizosSeleccionados.add(h.idNorm));
        else   clonarState.hechizosSeleccionados.clear();
        _refreshListaHz();
        _refreshPreview();
    },
    toggleCobrarHz(v) { clonarState.cobrarHexHechizos = v; _refreshPreview(); },

    // Objetos
    setModoObj(mode)       { clonarState.objetosMode = mode; _refreshConfigPanel(); },
    setCantObjeto(nom, v)  {
        const c = Math.max(0, parseInt(v) || 0);
        if (c === 0) delete clonarState.objetosCantidades[nom];
        else         clonarState.objetosCantidades[nom] = c;
        _refreshPreview();
    },

    async ejecutar() {
        if (clonarState.ejecutando) return;
        const preview = getPreview();
        if (!preview || !preview.length) {
            clonarState.feedback = { ok: false, msg: '⚠️ Selecciona al menos un módulo y completa origen + destino.' };
            _refreshFeedback();
            return;
        }

        _setEjecutandoUI(true);
        const result = await ejecutarClonado();
        _setEjecutandoUI(false);

        _refreshFeedback();
    },

    resetear() {
        clonarState.pjOrigen          = null;
        clonarState.pjDestino         = null;
        clonarState.hechizosSeleccionados.clear();
        clonarState.objetosCantidades = {};
        clonarState.feedback          = null;
        Object.assign(clonarState.modulos, { statsBase:true, buffsEfectos:false, hex:false, estados:false, hechizos:true, objetos:false, imagen:false });
        renderColumnaClonar();
    },
};

// ── Helpers de refresh parcial ────────────────────────────────
function _refresh()                { renderColumnaClonar(); }
function _refreshSelector(lado)    {
    const el = document.getElementById(`clonar-sel-${lado}`);
    if (el) el.innerHTML = _htmlSelector(lado);
}
function _refreshConfigPanel()     {
    const el = document.getElementById('clonar-config');
    if (el) el.innerHTML = _htmlConfigPanel();
    _refreshPreview();
}
function _refreshPreview()         {
    const el = document.getElementById('clonar-preview');
    if (el) el.innerHTML = _htmlPreview();
}
function _refreshListaHz()         {
    const el = document.getElementById('clonar-hz-lista');
    if (el) el.innerHTML = _htmlListaHz();
}
function _refreshFeedback()        {
    const el = document.getElementById('clonar-feedback');
    if (el) el.innerHTML = _htmlFeedback();
}

function _actualizarRowHz(idNorm) {
    const row = document.getElementById(`clonar-hz-row-${_safeId(idNorm)}`);
    if (!row) return;
    const marcado = clonarState.hechizosSeleccionados.has(idNorm);
    row.style.background   = marcado ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.03)';
    row.style.borderColor  = marcado ? '#8a5a00' : '#1a1030';
    const check = row.querySelector('input[type=checkbox]');
    if (check) check.checked = marcado;
}

function _setEjecutandoUI(v) {
    const btn = document.getElementById('clonar-btn-ejecutar');
    if (btn) {
        btn.disabled      = v;
        btn.style.opacity = v ? '0.6' : '1';
        btn.textContent   = v ? '⏳ Clonando...' : '🔁 EJECUTAR CLONADO';
    }
}

// ── RENDER PRINCIPAL ──────────────────────────────────────────
export function renderColumnaClonar() {
    const contenedor = document.getElementById('content-acciones');
    if (!contenedor) return;

    contenedor.innerHTML = `
    <!-- HEADER -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <div>
            <h3 style="margin:0;color:#d4af37;font-family:'Cinzel';font-size:0.95em;text-transform:uppercase;letter-spacing:0.06em;">
                🔁 Clonar Personaje
            </h3>
            <p style="margin:4px 0 0 0;color:#555;font-family:'Rajdhani';font-size:0.82em;">
                Copia stats, hechizos, objetos o imagen de un personaje a otro. El origen no se modifica.
            </p>
        </div>
        <button onclick="window.clonar.resetear()"
            style="background:#0a0018;border:1px solid #333;color:#555;border-radius:5px;
                   padding:6px 14px;cursor:pointer;font-family:'Cinzel';font-size:0.72em;transition:0.2s;"
            onmouseover="this.style.color='#aaa';this.style.borderColor='#666'"
            onmouseout="this.style.color='#555';this.style.borderColor='#333'">
            ↺ Resetear
        </button>
    </div>

    <!-- GRID PRINCIPAL: origen | config | destino -->
    <div style="display:grid;grid-template-columns:1fr 320px 1fr;gap:14px;align-items:start;">

        <!-- ORIGEN -->
        <div>
            <div style="font-size:0.72em;color:#888;font-family:'Cinzel';letter-spacing:0.08em;
                        margin-bottom:6px;text-transform:uppercase;">📤 Origen (de quién)</div>
            <div id="clonar-sel-origen">${_htmlSelector('origen')}</div>
        </div>

        <!-- PANEL DE CONFIGURACIÓN (centro) -->
        <div id="clonar-config">${_htmlConfigPanel()}</div>

        <!-- DESTINO -->
        <div>
            <div style="font-size:0.72em;color:#888;font-family:'Cinzel';letter-spacing:0.08em;
                        margin-bottom:6px;text-transform:uppercase;">📥 Destino (a quién)</div>
            <div id="clonar-sel-destino">${_htmlSelector('destino')}</div>
        </div>
    </div>

    <!-- PREVIEW + BOTÓN -->
    <div style="margin-top:18px;">
        <div id="clonar-preview">${_htmlPreview()}</div>
        <div id="clonar-feedback">${_htmlFeedback()}</div>
        <button id="clonar-btn-ejecutar" onclick="window.clonar.ejecutar()"
            style="width:100%;margin-top:10px;padding:14px;
                   background:linear-gradient(135deg,#3a1800,#8a4400,#3a1800);
                   color:#d4af37;border:2px solid #d4af37;border-radius:8px;
                   cursor:pointer;font-family:'Cinzel';font-weight:bold;font-size:1em;
                   letter-spacing:0.05em;transition:0.2s;text-transform:uppercase;"
            onmouseover="this.style.filter='brightness(1.3)'"
            onmouseout="this.style.filter='brightness(1)'">
            🔁 EJECUTAR CLONADO
        </button>
    </div>`;
}

// ── HTML: Selector de personaje (origen o destino) ────────────
function _htmlSelector(lado) {
    const esOrigen    = lado === 'origen';
    const rolKey      = esOrigen ? 'filtroOrigenRol'   : 'filtroDestinoRol';
    const busqKey     = esOrigen ? 'busquedaOrigen'     : 'busquedaDestino';
    const selKey      = esOrigen ? 'pjOrigen'           : 'pjDestino';
    const rol         = clonarState[rolKey];
    const busq        = clonarState[busqKey];
    const seleccionado = clonarState[selKey];
    const imgFallback = `${STORAGE_URL}/imginterfaz/no_encontrado.png`;

    const esJ     = rol === 'jugadores';
    const btnJOk  = esJ  ? '#004a00' : '#111';
    const btnNOk  = !esJ ? '#3a0000' : '#111';
    const colJ    = esJ  ? '#00e676' : '#444';
    const colN    = !esJ ? '#ff4444' : '#444';
    const txtJ    = esJ  ? 'white'   : '#666';
    const txtN    = !esJ ? 'white'   : '#666';

    const fnFiltro  = esOrigen ? 'setFiltroOrigen' : 'setFiltroDestino';
    const fnBusq    = esOrigen ? 'setBusquedaOrigen' : 'setBusquedaDestino';
    const fnSel     = esOrigen ? 'selOrigen' : 'selDestino';

    let lista = devState.listaPersonajes
        .filter(p => esJ ? p.is_player : !p.is_player)
        .filter(p => !busq || p.nombre.toLowerCase().includes(busq))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

    // El destino no puede ser el mismo que el origen
    if (!esOrigen && clonarState.pjOrigen) {
        lista = lista.filter(p => p.nombre !== clonarState.pjOrigen);
    }

    let html = `
    <div style="background:rgba(8,0,18,0.85);border:1px solid #2a1060;border-radius:10px;padding:10px;min-height:280px;">
        <div style="display:flex;gap:5px;margin-bottom:7px;">
            <button onclick="window.clonar.${fnFiltro}('jugadores')"
                style="flex:1;padding:5px;border-radius:4px;cursor:pointer;font-family:'Cinzel';
                       font-size:0.68em;font-weight:bold;background:${btnJOk};color:${txtJ};border:1px solid ${colJ};">
                ⚔️ PJ
            </button>
            <button onclick="window.clonar.${fnFiltro}('npcs')"
                style="flex:1;padding:5px;border-radius:4px;cursor:pointer;font-family:'Cinzel';
                       font-size:0.68em;font-weight:bold;background:${btnNOk};color:${txtN};border:1px solid ${colN};">
                🎭 NPC
            </button>
        </div>
        <input type="text" value="${_esc(busq)}" placeholder="🔍 Buscar..."
            oninput="window.clonar.${fnBusq}(this.value)"
            style="width:100%;box-sizing:border-box;background:#000;color:#fff;
                   border:1px solid #333;border-radius:5px;padding:6px;
                   font-family:'Rajdhani';font-size:0.85em;outline:none;margin-bottom:7px;">
        <div style="display:flex;flex-direction:column;gap:4px;max-height:420px;overflow-y:auto;">`;

    if (!lista.length) {
        html += `<div style="color:#444;text-align:center;padding:20px;font-size:0.8em;font-style:italic;">
            ${busq ? 'Sin coincidencias' : 'Sin personajes en esta categoría'}
        </div>`;
    } else {
        lista.forEach(p => {
            const activo    = seleccionado === p.nombre;
            const keyNorm   = norm(p.icono_override || p.nombre) + 'icon';
            const imgUrl    = `${STORAGE_URL}/imgpersonajes/${keyNorm}.png`;
            const borderCol = p.is_player ? '#00e676' : '#ff4444';
            const safeName  = p.nombre.replace(/'/g, "\\'");

            html += `
            <button onclick="window.clonar.${fnSel}('${safeName}')"
                style="display:flex;align-items:center;gap:8px;width:100%;
                       background:${activo ? 'rgba(212,175,55,0.15)' : 'transparent'};
                       border:1px solid ${activo ? '#8a5a00' : 'transparent'};
                       border-radius:6px;padding:5px 7px;cursor:pointer;text-align:left;transition:0.15s;"
                onmouseover="this.style.background='rgba(212,175,55,0.07)'"
                onmouseout="this.style.background='${activo ? 'rgba(212,175,55,0.15)' : 'transparent'}'">
                <img src="${imgUrl}" onerror="this.src='${imgFallback}'"
                    style="width:30px;height:30px;border-radius:50%;object-fit:cover;
                           border:1px solid ${borderCol}44;flex-shrink:0;">
                <span style="color:${activo ? '#d4af37' : '#bbb'};font-family:'Rajdhani';
                             font-size:0.85em;font-weight:bold;overflow:hidden;
                             text-overflow:ellipsis;white-space:nowrap;flex:1;">
                    ${_esc(p.nombre)}
                </span>
                ${activo ? `<span style="color:#d4af37;font-size:0.7em;">✓</span>` : ''}
            </button>`;
        });
    }

    html += `</div></div>`;
    return html;
}

// ── HTML: Panel de configuración (centro) ─────────────────────
function _htmlConfigPanel() {
    const { modulos, hechizosMode, objetosMode, cobrarHexHechizos, pjOrigen, pjDestino } = clonarState;
    const listo = pjOrigen && pjDestino;

    const _modCard = (key, icon, label, desc, color, extraHTML = '') => {
        const activo = modulos[key];
        return `
        <div style="background:${activo ? `rgba(${color},0.12)` : 'rgba(255,255,255,0.02)'};
                    border:1px solid ${activo ? `rgba(${color},0.5)` : '#1a1030'};
                    border-radius:8px;padding:10px;transition:0.2s;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;">
                <input type="checkbox" ${activo ? 'checked' : ''}
                    onchange="window.clonar.toggleModulo('${key}')"
                    style="accent-color:${activo ? `rgb(${color})` : '#888'};width:15px;height:15px;cursor:pointer;">
                <span style="font-size:0.9em;">${icon}</span>
                <div style="flex:1;">
                    <div style="color:${activo ? `rgb(${color})` : '#666'};font-family:'Cinzel';
                                font-size:0.76em;font-weight:bold;transition:0.2s;">${label}</div>
                    <div style="color:#444;font-size:0.68em;font-family:'Rajdhani';">${desc}</div>
                </div>
            </label>
            ${activo ? extraHTML : ''}
        </div>`;
    };

    // Extra HTML para hechizos
    const hzExtra = `
    <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #2a1060;">
        <div style="display:flex;gap:5px;margin-bottom:6px;">
            <button onclick="window.clonar.setModoHz('todos')"
                style="flex:1;padding:4px;border-radius:4px;cursor:pointer;font-size:0.68em;
                       font-family:'Cinzel';background:${hechizosMode==='todos'?'#2a0e5a':'#0a0015'};
                       color:${hechizosMode==='todos'?'#cc88ff':'#555'};
                       border:1px solid ${hechizosMode==='todos'?'#6a30aa':'#222'};">
                Todos
            </button>
            <button onclick="window.clonar.setModoHz('selectivo')"
                style="flex:1;padding:4px;border-radius:4px;cursor:pointer;font-size:0.68em;
                       font-family:'Cinzel';background:${hechizosMode==='selectivo'?'#2a0e5a':'#0a0015'};
                       color:${hechizosMode==='selectivo'?'#cc88ff':'#555'};
                       border:1px solid ${hechizosMode==='selectivo'?'#6a30aa':'#222'};">
                Selectivo
            </button>
        </div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.72em;
                      color:#888;font-family:'Rajdhani';margin-bottom:${hechizosMode==='selectivo'?'6px':'0'};">
            <input type="checkbox" ${cobrarHexHechizos?'checked':''}
                onchange="window.clonar.toggleCobrarHz(this.checked)"
                style="accent-color:#d4af37;cursor:pointer;">
            Descontar HEX al clonar
        </label>
        ${hechizosMode === 'selectivo' && pjOrigen ? `
        <div style="display:flex;gap:4px;margin-bottom:4px;">
            <button onclick="window.clonar.selTodosHz(true)"
                style="flex:1;padding:3px;border-radius:3px;cursor:pointer;font-size:0.65em;
                       background:#1a0a2a;color:#d4af37;border:1px solid #5a3000;font-family:'Cinzel';">✅ Todos</button>
            <button onclick="window.clonar.selTodosHz(false)"
                style="flex:1;padding:3px;border-radius:3px;cursor:pointer;font-size:0.65em;
                       background:#111;color:#555;border:1px solid #222;font-family:'Cinzel';">☐ Ninguno</button>
        </div>
        <input type="text" placeholder="🔍 Filtrar hechizos..."
            oninput="window.clonar.setBusqHz(this.value)"
            style="width:100%;box-sizing:border-box;background:#000;color:#fff;
                   border:1px solid #2a1060;border-radius:4px;padding:4px 7px;
                   font-family:'Rajdhani';font-size:0.78em;outline:none;margin-bottom:4px;">
        <div id="clonar-hz-lista" style="max-height:200px;overflow-y:auto;
             display:flex;flex-direction:column;gap:3px;">
            ${_htmlListaHz()}
        </div>` : ''}
    </div>`;

    // Extra HTML para objetos
    const objExtra = `
    <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #2a1060;">
        <div style="display:flex;gap:5px;margin-bottom:6px;">
            <button onclick="window.clonar.setModoObj('todos')"
                style="flex:1;padding:4px;border-radius:4px;cursor:pointer;font-size:0.68em;
                       font-family:'Cinzel';background:${objetosMode==='todos'?'#1a3000':'#0a0015'};
                       color:${objetosMode==='todos'?'#88ff88':'#555'};
                       border:1px solid ${objetosMode==='todos'?'#3a8000':'#222'};">
                Todos
            </button>
            <button onclick="window.clonar.setModoObj('selectivo')"
                style="flex:1;padding:4px;border-radius:4px;cursor:pointer;font-size:0.68em;
                       font-family:'Cinzel';background:${objetosMode==='selectivo'?'#1a3000':'#0a0015'};
                       color:${objetosMode==='selectivo'?'#88ff88':'#555'};
                       border:1px solid ${objetosMode==='selectivo'?'#3a8000':'#222'};">
                Selectivo
            </button>
        </div>
        ${objetosMode === 'selectivo' && pjOrigen ? _htmlListaObjetos() : ''}
    </div>`;

    return `
    <div style="background:rgba(5,0,15,0.9);border:1px solid #3a1060;border-radius:10px;
                padding:12px;display:flex;flex-direction:column;gap:8px;">
        <div style="text-align:center;color:#b060ff;font-family:'Cinzel';font-size:0.75em;
                    font-weight:bold;letter-spacing:0.08em;margin-bottom:2px;">
            ⚙️ QUÉ CLONAR
        </div>
        ${!listo ? `<div style="color:#333;text-align:center;font-size:0.78em;font-family:'Rajdhani';padding:10px;">
            ← Selecciona origen y destino →
        </div>` : ''}
        ${_modCard('statsBase',    '📊','Stats Base',         'Afinidades + vida/daño base',       '0,255,160')}
        ${_modCard('buffsEfectos', '⚡','Buffs & Efectos',    'Hechizos/buffs/efectos de stats',   '100,180,255')}
        ${_modCard('hex',          '💎','HEX',                'Cantidad total de puntos HEX',       '212,175,55')}
        ${_modCard('estados',      '🔮','Estados',            'Estados activos del personaje',       '255,140,200')}
        ${_modCard('hechizos',     '📖','Hechizos',           'Grimorio completo o seleccionado',   '180,100,255', hzExtra)}
        ${_modCard('objetos',      '🎒','Objetos',            'Inventario completo o parcial',       '100,220,100', objExtra)}
        ${_modCard('imagen',       '🖼️','Imagen',             'Foto de perfil (copia en Storage)',   '100,180,255')}
    </div>`;
}

// ── HTML: Lista de hechizos selectivos ────────────────────────
function _htmlListaHz() {
    if (!clonarState.pjOrigen || !clonarState.modulos.hechizos) return '';
    const hzOrigen  = getHechizosOrigen(clonarState.pjOrigen);
    const hzDestSet = clonarState.pjDestino ? getHechizosDestinoSet(clonarState.pjDestino) : new Set();
    const busq      = clonarState.hechizoBusqueda;

    const filtrados = hzOrigen
        .filter(h => !hzDestSet.has(h.idNorm))
        .filter(h => !busq || h.nombre.toLowerCase().includes(busq) || h.afinidad.toLowerCase().includes(busq));

    if (!filtrados.length) return `<div style="color:#444;font-size:0.75em;text-align:center;padding:10px;">
        ${busq ? 'Sin coincidencias' : 'El destino ya posee todos los hechizos del origen'}
    </div>`;

    return filtrados.map(h => {
        const marcado   = clonarState.hechizosSeleccionados.has(h.idNorm);
        const safeId    = _safeId(h.idNorm);
        const safeIdNorm = h.idNorm.replace(/'/g, "\\'");
        return `
        <div id="clonar-hz-row-${safeId}"
            onclick="window.clonar.toggleHz('${safeIdNorm}')"
            style="display:flex;align-items:center;gap:7px;border-radius:5px;padding:5px 7px;
                   cursor:pointer;transition:0.12s;
                   background:${marcado?'rgba(212,175,55,0.12)':'rgba(255,255,255,0.03)'};
                   border:1px solid ${marcado?'#8a5a00':'#1a1030'};">
            <input type="checkbox" ${marcado?'checked':''}
                onclick="event.stopPropagation();window.clonar.toggleHz('${safeIdNorm}')"
                style="accent-color:#d4af37;width:12px;height:12px;cursor:pointer;flex-shrink:0;">
            <span style="flex:1;color:${marcado?'#fff':'#aaa'};font-size:0.78em;font-family:'Rajdhani';
                         font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${_esc(h.nombre)}
            </span>
            ${h.afinidad ? `<span style="color:#888;font-size:0.65em;">${_esc(h.afinidad)}</span>` : ''}
            ${h.hex ? `<span style="color:#d4af37;font-size:0.65em;font-weight:bold;">${h.hex}</span>` : ''}
        </div>`;
    }).join('');
}

// ── HTML: Lista de objetos con cantidades ─────────────────────
function _htmlListaObjetos() {
    if (!clonarState.pjOrigen) return '';
    const objs = getObjetosOrigen(clonarState.pjOrigen);

    if (!objs.length) return `<div style="color:#444;font-size:0.75em;text-align:center;padding:8px;">
        El origen no tiene objetos
    </div>`;

    return `<div style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:3px;">` +
        objs.map(o => {
            const cantOverride = clonarState.objetosCantidades[o.nombre];
            const safeNom = o.nombre.replace(/'/g, "\\'");
            return `
            <div style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.03);
                        border:1px solid #1a1030;border-radius:5px;padding:4px 7px;">
                <span style="flex:1;color:#aaa;font-size:0.76em;font-family:'Rajdhani';font-weight:bold;
                             overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                    ${_esc(o.nombre)}
                </span>
                <span style="color:#555;font-size:0.68em;">×${o.cant}</span>
                <input type="number" min="0" max="${o.cant}" value="${cantOverride ?? o.cant}"
                    onchange="window.clonar.setCantObjeto('${safeNom}', this.value)"
                    style="width:44px;background:#000;color:#d4af37;border:1px solid #4a3000;
                           border-radius:3px;padding:2px 4px;font-size:0.75em;text-align:center;
                           font-family:'Rajdhani';outline:none;">
            </div>`;
        }).join('') + '</div>';
}

// ── HTML: Preview de lo que se clonará ───────────────────────
function _htmlPreview() {
    const { pjOrigen, pjDestino } = clonarState;
    if (!pjOrigen || !pjDestino) return '';

    const preview = getPreview();
    if (!preview || !preview.length) return `
    <div style="background:rgba(80,0,0,0.15);border:1px dashed #550000;border-radius:8px;
                padding:12px;text-align:center;color:#664444;font-size:0.82em;font-family:'Rajdhani';">
        ⚠️ Activa al menos un módulo para ver el resumen.
    </div>`;

    return `
    <div style="background:rgba(0,30,15,0.3);border:1px solid #1a4020;border-radius:8px;padding:12px;">
        <div style="color:#00aa66;font-family:'Cinzel';font-size:0.75em;font-weight:bold;
                    margin-bottom:8px;letter-spacing:0.05em;">
            📋 RESUMEN: <span style="color:#fff;">${_esc(pjOrigen)}</span>
            <span style="color:#555;margin:0 6px;">→</span>
            <span style="color:#fff;">${_esc(pjDestino)}</span>
        </div>
        ${preview.map(l => `
        <div style="display:flex;align-items:center;gap:7px;padding:3px 0;
                    border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-size:0.9em;">${l.icon}</span>
            <span style="color:#aaa;font-size:0.8em;font-family:'Rajdhani';">${_esc(l.texto)}</span>
        </div>`).join('')}
    </div>`;
}

// ── HTML: Feedback del último resultado ───────────────────────
function _htmlFeedback() {
    const { feedback } = clonarState;
    if (!feedback) return '';
    const bg  = feedback.ok ? 'rgba(0,60,30,0.4)'  : 'rgba(60,0,0,0.4)';
    const brd = feedback.ok ? '#1a6030'              : '#660000';
    const col = feedback.ok ? '#00cc88'              : '#ff6666';
    return `
    <div style="background:${bg};border:1px solid ${brd};border-radius:8px;
                padding:12px 16px;margin-top:8px;">
        ${feedback.msg.split('\n').map(l => `
        <div style="color:${col};font-size:0.82em;font-family:'Rajdhani';
                    font-weight:bold;padding:2px 0;">${_esc(l)}</div>`).join('')}
    </div>`;
}

// ── Helpers ───────────────────────────────────────────────────
function _safeId(str) { return (str || '').replace(/[^a-z0-9]/gi, '_'); }
function _esc(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
        .replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
