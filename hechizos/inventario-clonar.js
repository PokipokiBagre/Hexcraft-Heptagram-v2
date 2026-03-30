// ============================================================
// inventario-clonar.js — Modal Clonado de Hechizos (solo OP)
// Permite importar todos o algunos hechizos de un personaje
// origen al personaje actualmente seleccionado.
// ============================================================

import { db, estadoUI } from './inventario-state.js';
import { getInventarioCombinado } from './inventario-logic.js';

// ── Estado local del modal ────────────────────────────────────
const clonarState = {
    pjOrigen:       null,   // nombre del personaje fuente
    seleccionados:  new Set(), // nombres de hechizos marcados para clonar
    cobrarHex:      false,
    modoFiltro:     'todos',  // 'todos' | 'jugadores' | 'npcs'
    busqueda:       '',
};

// ── Inyectar estilos del modal (solo una vez) ─────────────────
function _inyectarEstilos() {
    if (document.getElementById('clonar-modal-styles')) return;
    const style = document.createElement('style');
    style.id = 'clonar-modal-styles';
    style.textContent = `
        #clonar-modal-overlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.82);
            z-index: 9000;
            display: flex; align-items: center; justify-content: center;
        }
        #clonar-modal-box {
            background: #0a0018;
            border: 2px solid var(--gold, #d4af37);
            border-radius: 14px;
            width: min(820px, 96vw);
            max-height: 88vh;
            display: flex; flex-direction: column;
            box-shadow: 0 0 40px rgba(212,175,55,0.25);
            font-family: 'Rajdhani', 'Cinzel', sans-serif;
            overflow: hidden;
        }
        #clonar-modal-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid #3a2060;
            background: #060012;
            flex-shrink: 0;
        }
        #clonar-modal-header h3 {
            margin: 0; color: var(--gold, #d4af37);
            font-family: 'Cinzel', serif; font-size: 1.05em; letter-spacing: 1px;
        }
        #clonar-modal-body {
            display: flex; flex: 1; overflow: hidden;
        }
        #clonar-sidebar {
            width: 220px; flex-shrink: 0;
            background: #060010;
            border-right: 1px solid #2a1060;
            display: flex; flex-direction: column;
            overflow: hidden;
        }
        #clonar-sidebar-list {
            overflow-y: auto; flex: 1; padding: 8px 6px;
        }
        .clonar-pj-btn {
            width: 100%; text-align: left; background: transparent;
            border: 1px solid transparent; border-radius: 6px;
            color: #aaa; padding: 7px 10px; cursor: pointer;
            font-size: 0.82em; font-family: 'Rajdhani', sans-serif;
            font-weight: bold; transition: 0.15s; margin-bottom: 3px;
            display: flex; align-items: center; gap: 8px;
        }
        .clonar-pj-btn:hover { background: rgba(212,175,55,0.08); color: #fff; }
        .clonar-pj-btn.activo { background: rgba(212,175,55,0.15); color: var(--gold, #d4af37); border-color: #6a3a00; }
        #clonar-panel {
            flex: 1; display: flex; flex-direction: column; overflow: hidden;
        }
        #clonar-panel-top {
            padding: 12px 16px; border-bottom: 1px solid #2a1060;
            flex-shrink: 0; background: #080014;
        }
        #clonar-lista-hechizos {
            flex: 1; overflow-y: auto; padding: 10px 14px;
            display: flex; flex-direction: column; gap: 5px;
        }
        .clonar-hz-row {
            display: flex; align-items: center; gap: 10px;
            background: rgba(255,255,255,0.03);
            border: 1px solid #1a1030; border-radius: 6px;
            padding: 7px 10px; cursor: pointer; transition: 0.15s;
        }
        .clonar-hz-row:hover { background: rgba(212,175,55,0.07); border-color: #4a2a00; }
        .clonar-hz-row.marcado { background: rgba(212,175,55,0.12); border-color: #8a5a00; }
        .clonar-hz-check {
            width: 16px; height: 16px; flex-shrink: 0;
            accent-color: var(--gold, #d4af37);
        }
        #clonar-modal-footer {
            padding: 12px 20px;
            border-top: 1px solid #3a2060;
            display: flex; align-items: center; justify-content: space-between;
            flex-shrink: 0; gap: 10px; flex-wrap: wrap;
            background: #060012;
        }
        .clonar-btn-accion {
            padding: 10px 22px; border-radius: 7px; cursor: pointer;
            font-family: 'Cinzel', serif; font-weight: bold; font-size: 0.88em;
            transition: 0.2s; border: 2px solid;
        }
    `;
    document.head.appendChild(style);
}

// ── Abrir modal ───────────────────────────────────────────────
export function abrirModalClonar() {
    if (!estadoUI.esAdmin) return;
    _inyectarEstilos();

    // Reset state
    clonarState.pjOrigen      = null;
    clonarState.seleccionados  = new Set();
    clonarState.cobrarHex      = false;
    clonarState.modoFiltro     = 'todos';
    clonarState.busqueda       = '';

    _montarOverlay();
    _renderSidebar();
    _renderPanel();
}

function _cerrarModal() {
    const overlay = document.getElementById('clonar-modal-overlay');
    if (overlay) overlay.remove();
}

// ── Montar estructura HTML del modal ─────────────────────────
function _montarOverlay() {
    // Eliminar si ya existe
    const viejo = document.getElementById('clonar-modal-overlay');
    if (viejo) viejo.remove();

    const overlay = document.createElement('div');
    overlay.id = 'clonar-modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) _cerrarModal(); };

    overlay.innerHTML = `
    <div id="clonar-modal-box">
        <!-- HEADER -->
        <div id="clonar-modal-header">
            <h3>📋 CLONAR HECHIZOS → <span id="clonar-destino-label" style="color:#fff;">${estadoUI.personajeSeleccionado || '—'}</span></h3>
            <button onclick="document.getElementById('clonar-modal-overlay').remove()"
                style="background:rgba(180,0,0,0.4);border:1px solid #aa3333;color:#fff;
                       border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:1.1em;
                       display:flex;align-items:center;justify-content:center;">✕</button>
        </div>

        <!-- BODY -->
        <div id="clonar-modal-body">

            <!-- SIDEBAR: lista de personajes origen -->
            <div id="clonar-sidebar">
                <div style="padding:10px 8px 6px 8px; flex-shrink:0;">
                    <div style="display:flex;gap:4px;margin-bottom:6px;">
                        <button onclick="window.__clonarSetFiltro('todos')" id="cfil-todos"
                            style="flex:1;font-size:0.7em;padding:4px;border-radius:4px;cursor:pointer;background:#1a0a2a;color:#d4af37;border:1px solid #6a3a00;font-family:'Cinzel';">Todos</button>
                        <button onclick="window.__clonarSetFiltro('jugadores')" id="cfil-jug"
                            style="flex:1;font-size:0.7em;padding:4px;border-radius:4px;cursor:pointer;background:#111;color:#888;border:1px solid #333;font-family:'Cinzel';">PJ</button>
                        <button onclick="window.__clonarSetFiltro('npcs')" id="cfil-npc"
                            style="flex:1;font-size:0.7em;padding:4px;border-radius:4px;cursor:pointer;background:#111;color:#888;border:1px solid #333;font-family:'Cinzel';">NPC</button>
                    </div>
                    <input id="clonar-search-pj" type="text" placeholder="Buscar personaje..."
                        oninput="window.__clonarBuscarPj(this.value)"
                        style="width:100%;box-sizing:border-box;background:#000;color:#fff;
                               border:1px solid #3a1060;border-radius:5px;padding:5px 8px;
                               font-family:'Rajdhani';font-size:0.8em;outline:none;">
                </div>
                <div id="clonar-sidebar-list"></div>
            </div>

            <!-- PANEL PRINCIPAL -->
            <div id="clonar-panel">
                <div id="clonar-panel-top">
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                        <input id="clonar-search-hz" type="text" placeholder="🔍 Filtrar hechizos..."
                            oninput="window.__clonarBuscarHz(this.value)"
                            style="flex:1;background:#000;color:#fff;border:1px solid #3a1060;
                                   border-radius:5px;padding:6px 10px;font-family:'Rajdhani';
                                   font-size:0.85em;outline:none;">
                        <button onclick="window.__clonarSelTodos(true)"
                            style="background:#1a0a2a;color:#d4af37;border:1px solid #6a3a00;
                                   border-radius:5px;padding:6px 10px;cursor:pointer;font-size:0.78em;font-family:'Cinzel';">
                            ✅ Todos
                        </button>
                        <button onclick="window.__clonarSelTodos(false)"
                            style="background:#111;color:#888;border:1px solid #333;
                                   border-radius:5px;padding:6px 10px;cursor:pointer;font-size:0.78em;font-family:'Cinzel';">
                            ☐ Ninguno
                        </button>
                    </div>
                    <div id="clonar-counter" style="font-size:0.78em;color:#888;margin-top:6px;"></div>
                </div>
                <div id="clonar-lista-hechizos"></div>
            </div>
        </div>

        <!-- FOOTER -->
        <div id="clonar-modal-footer">
            <label style="display:flex;align-items:center;gap:8px;color:#aaa;font-size:0.85em;cursor:pointer;">
                <input type="checkbox" id="clonar-cobrar-hex" onchange="window.__clonarToggleCobrar(this.checked)"
                    style="accent-color:var(--gold,#d4af37);width:16px;height:16px;">
                Descontar HEX al clonar
            </label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button onclick="document.getElementById('clonar-modal-overlay').remove()"
                    class="clonar-btn-accion"
                    style="background:#111;color:#888;border-color:#444;">
                    Cancelar
                </button>
                <button onclick="window.__clonarEjecutar()"
                    class="clonar-btn-accion"
                    style="background:linear-gradient(135deg,#4a2a00,#8a5500);color:#fff;border-color:var(--gold,#d4af37);">
                    📋 CLONAR SELECCIONADOS
                </button>
            </div>
        </div>
    </div>`;

    document.body.appendChild(overlay);

    // Exponer helpers globales temporales
    window.__clonarSetFiltro = (f) => { clonarState.modoFiltro = f; _renderSidebar(); };
    window.__clonarBuscarPj  = (t) => { clonarState.busqueda   = t.toLowerCase(); _renderSidebar(); };
    window.__clonarBuscarHz  = (t) => { _renderListaHechizos(t.toLowerCase()); };
    window.__clonarSelTodos  = (v) => {
        const items = _getHechizosOrigen();
        if (v) items.forEach(h => clonarState.seleccionados.add(h.Hechizo));
        else    clonarState.seleccionados.clear();
        _renderListaHechizos();
    };
    window.__clonarToggleCobrar = (v) => { clonarState.cobrarHex = v; };
    window.__clonarToggleHz     = (nombre) => {
        if (clonarState.seleccionados.has(nombre)) clonarState.seleccionados.delete(nombre);
        else clonarState.seleccionados.add(nombre);
        _actualizarRowMarcado(nombre);
        _actualizarCounter();
    };
    window.__clonarEjecutar = _ejecutarClonado;
}

// ── Sidebar: lista de personajes ──────────────────────────────
function _renderSidebar() {
    const container = document.getElementById('clonar-sidebar-list');
    if (!container) return;

    const destino = estadoUI.personajeSeleccionado;
    const todos   = Object.keys(db.personajes)
        .filter(nombre => nombre !== destino)
        .filter(nombre => {
            const p = db.personajes[nombre];
            if (clonarState.modoFiltro === 'jugadores' && !p.isPlayer) return false;
            if (clonarState.modoFiltro === 'npcs'      && p.isPlayer)  return false;
            if (clonarState.busqueda && !nombre.toLowerCase().includes(clonarState.busqueda)) return false;
            return true;
        })
        .sort((a, b) => {
            const pa = db.personajes[a]; const pb = db.personajes[b];
            if (pa.isPlayer !== pb.isPlayer) return pa.isPlayer ? -1 : 1;
            return a.localeCompare(b);
        });

    // Actualizar estilos de tabs
    ['todos','jugadores','npcs'].forEach(f => {
        const btn = document.getElementById(`cfil-${f === 'jugadores' ? 'jug' : f === 'npcs' ? 'npc' : f}`);
        if (!btn) return;
        const activo = clonarState.modoFiltro === f;
        btn.style.background    = activo ? '#1a0a2a' : '#111';
        btn.style.color         = activo ? '#d4af37' : '#888';
        btn.style.borderColor   = activo ? '#6a3a00' : '#333';
    });

    if (!todos.length) {
        container.innerHTML = `<div style="color:#555;padding:14px;font-size:0.8em;text-align:center;">Sin personajes.</div>`;
        return;
    }

    container.innerHTML = todos.map(nombre => {
        const p      = db.personajes[nombre];
        const activo = clonarState.pjOrigen === nombre;
        const inv    = getInventarioCombinado(nombre);
        const tipo   = p.isPlayer ? '⚔️' : '🎭';
        return `<button class="clonar-pj-btn ${activo ? 'activo' : ''}"
                    onclick="window.__clonarSelectPj('${nombre.replace(/'/g, "\\'")}')">
                    <span style="font-size:1.1em;">${tipo}</span>
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nombre}</span>
                    <span style="color:#555;font-size:0.8em;">${inv.length}</span>
                </button>`;
    }).join('');

    window.__clonarSelectPj = (nombre) => {
        clonarState.pjOrigen = nombre;
        clonarState.seleccionados.clear();
        _renderSidebar();
        _renderPanel();
    };
}

// ── Panel principal: header + lista hechizos ──────────────────
function _renderPanel() {
    const panelTop = document.getElementById('clonar-panel-top');
    if (!panelTop) return;

    if (!clonarState.pjOrigen) {
        document.getElementById('clonar-lista-hechizos').innerHTML =
            `<div style="color:#3a3a4a;text-align:center;padding:40px;font-size:0.9em;">
                Selecciona un personaje a la izquierda para ver sus hechizos.
             </div>`;
        _actualizarCounter();
        return;
    }
    _renderListaHechizos();
}

function _getHechizosOrigen() {
    if (!clonarState.pjOrigen) return [];
    const invOrigen  = getInventarioCombinado(clonarState.pjOrigen);
    const invDestino = new Set(
        getInventarioCombinado(estadoUI.personajeSeleccionado).map(h => h.Hechizo.trim().toLowerCase())
    );
    // Excluir los que el destino ya tiene
    return invOrigen.filter(h => !invDestino.has(h.Hechizo.trim().toLowerCase()));
}

function _renderListaHechizos(busqueda = '') {
    const lista = document.getElementById('clonar-lista-hechizos');
    if (!lista) return;

    const hechizos = _getHechizosOrigen().filter(h =>
        !busqueda || h.Hechizo.toLowerCase().includes(busqueda)
    );

    if (!clonarState.pjOrigen) {
        lista.innerHTML = `<div style="color:#3a3a4a;text-align:center;padding:40px;">Selecciona un personaje.</div>`;
        return;
    }
    if (!hechizos.length) {
        const msg = busqueda ? 'Sin coincidencias.' : 'Este personaje no tiene hechizos que clonar (el destino ya los posee todos).';
        lista.innerHTML = `<div style="color:#555;text-align:center;padding:30px;font-size:0.85em;">${msg}</div>`;
        _actualizarCounter();
        return;
    }

    const todosNodos = [...(db.hechizos.nodos || []), ...(db.hechizos.nodosOcultos || [])];

    lista.innerHTML = hechizos.map(h => {
        const marcado = clonarState.seleccionados.has(h.Hechizo);
        const info    = todosNodos.find(n =>
            n.Nombre?.trim().toLowerCase() === h.Hechizo.trim().toLowerCase() ||
            n.ID?.trim().toLowerCase()     === h.Hechizo.trim().toLowerCase()
        );
        const af      = h['Hechizo Afinidad'] || info?.Afinidad || '';
        const hexCost = h['Hechizo Hex']      || parseInt(info?.HEX) || 0;
        const clase   = info?.Clase || '';

        // Color de afinidad
        const colorMap = db.colorMap || {};
        const color    = colorMap[af] || '#888';

        const safeNombre = h.Hechizo.replace(/'/g, "\\'");

        return `<div class="clonar-hz-row ${marcado ? 'marcado' : ''}" id="clonar-row-${_safeId(h.Hechizo)}"
                     onclick="window.__clonarToggleHz('${safeNombre}')">
                    <input type="checkbox" class="clonar-hz-check"
                        ${marcado ? 'checked' : ''}
                        onclick="event.stopPropagation(); window.__clonarToggleHz('${safeNombre}')">
                    <span style="flex:1;color:${marcado ? '#fff' : '#aaa'};font-size:0.88em;font-weight:bold;
                                 overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        ${h.Hechizo}
                    </span>
                    ${af ? `<span style="color:${color};font-size:0.74em;border:1px solid ${color}33;
                                         border-radius:3px;padding:1px 6px;">${af}</span>` : ''}
                    ${clase ? `<span style="color:#555;font-size:0.72em;">${clase}</span>` : ''}
                    ${hexCost ? `<span style="color:#d4af37;font-size:0.74em;font-weight:bold;">${hexCost} HEX</span>` : ''}
                </div>`;
    }).join('');

    _actualizarCounter();
}

function _actualizarRowMarcado(nombre) {
    const row   = document.getElementById(`clonar-row-${_safeId(nombre)}`);
    if (!row) return;
    const marcado  = clonarState.seleccionados.has(nombre);
    row.className  = `clonar-hz-row ${marcado ? 'marcado' : ''}`;
    const check    = row.querySelector('.clonar-hz-check');
    if (check) check.checked = marcado;
    const label    = row.querySelector('span');
    if (label) label.style.color = marcado ? '#fff' : '#aaa';
}

function _actualizarCounter() {
    const el = document.getElementById('clonar-counter');
    if (!el) return;
    const total = _getHechizosOrigen().length;
    const sel   = clonarState.seleccionados.size;
    el.textContent = clonarState.pjOrigen
        ? `${sel} seleccionado${sel !== 1 ? 's' : ''} de ${total} disponible${total !== 1 ? 's' : ''}`
        : 'Selecciona un personaje origen';
}

// ── Ejecutar clonado ──────────────────────────────────────────
function _ejecutarClonado() {
    const destino = estadoUI.personajeSeleccionado;
    const origen  = clonarState.pjOrigen;

    if (!origen) return alert('Selecciona un personaje de origen.');
    if (!clonarState.seleccionados.size) return alert('Selecciona al menos un hechizo.');

    const invOrigen  = getInventarioCombinado(origen);
    const todosNodos = [...(db.hechizos.nodos || []), ...(db.hechizos.nodosOcultos || [])];
    const charDest   = db.personajes[destino];

    let totalHexRestar = 0;
    const nombresClonados = [];

    clonarState.seleccionados.forEach(nombreHz => {
        const itemOrigen = invOrigen.find(h => h.Hechizo === nombreHz);
        const info       = todosNodos.find(n =>
            n.Nombre?.trim().toLowerCase() === nombreHz.trim().toLowerCase() ||
            n.ID?.trim().toLowerCase()     === nombreHz.trim().toLowerCase()
        );

        const af      = itemOrigen?.['Hechizo Afinidad'] || info?.Afinidad || '';
        const hexCost = itemOrigen?.['Hechizo Hex']      || parseInt(info?.HEX) || 0;
        const tipo    = itemOrigen?.Tipo || 'Normal';
        const origen2 = `Clonado de ${origen}`;

        // Agregar a la cola
        estadoUI.colaCambios.agregar.push([destino, nombreHz, af, hexCost, tipo, origen2]);

        // Log OP
        estadoUI.logOP.aprendidos.push({
            spell:  nombreHz,
            cost:   hexCost,
            cobrado: clonarState.cobrarHex
        });

        if (clonarState.cobrarHex) totalHexRestar += hexCost;

        nombresClonados.push(nombreHz);

        // Auto-descubrir si está sellado (mismo comportamiento que accionCola)
        if (info && estadoUI.esAdmin && (!info.Conocido || info.Conocido.toString().trim().toLowerCase() !== 'si')) {
            estadoUI.colaCambios.toggleConocido.push({ ID: info.ID, Nombre: info.Nombre, Estado: 'si' });
            info.Conocido = 'si';
        }
    });

    // Descontar HEX si corresponde
    if (clonarState.cobrarHex && totalHexRestar > 0 && charDest) {
        charDest.hex = Math.max(0, (charDest.hex || 0) - totalHexRestar);
        estadoUI.logOP.hexGastado += totalHexRestar;
        if (!estadoUI.colaCambios.stats)        estadoUI.colaCambios.stats        = {};
        if (!estadoUI.colaCambios.stats[destino]) estadoUI.colaCambios.stats[destino] = {};
        estadoUI.colaCambios.stats[destino].hex = charDest.hex;
    }

    _cerrarModal();

    // Notificación
    const n = nombresClonados.length;
    const nota = document.createElement('div');
    nota.style.cssText = `position:fixed;top:30px;left:50%;transform:translateX(-50%);
        background:var(--gold,#d4af37);color:#000;padding:14px 30px;
        border-radius:8px;font-weight:bold;font-size:1.1em;
        z-index:9999;box-shadow:0 0 20px rgba(212,175,55,0.5);
        font-family:'Cinzel',serif;pointer-events:none;`;
    nota.textContent = `✅ ${n} hechizo${n !== 1 ? 's' : ''} clonado${n !== 1 ? 's' : ''} a ${destino}`;
    document.body.appendChild(nota);
    setTimeout(() => nota.remove(), 2500);

    // Disparar re-render y botón de guardar
    window.dispatchEvent(new Event('inventario-changed'));
}

// ── Helpers ───────────────────────────────────────────────────
function _safeId(str) {
    return (str || '').replace(/[^a-z0-9]/gi, '_');
}
