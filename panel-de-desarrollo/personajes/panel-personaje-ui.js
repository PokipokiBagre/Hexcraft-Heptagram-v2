// ============================================================
// panel-personaje-ui.js — Render del Panel Personajes
// ============================================================

import { pjEditorState } from './panel-personaje-state.js';
import { crearPersonaje, editarNombrePersonaje, subirImagenPersonaje } from './panel-personaje-logic.js';
import { devState, STORAGE_URL, norm } from '../dev-state.js';

// ── API global ────────────────────────────────────────────────
window.pjEditor = {

    cambiarTab(tab) {
        pjEditorState.tabActiva    = tab;
        pjEditorState.busquedaNPC  = '';
        pjEditorState.editandoNombre = null;
        renderColumnaPersonaje();
    },

    setBusqueda(texto) {
        pjEditorState.busquedaNPC = texto.toLowerCase();
        _refreshGrid();
    },

    toggleFormCrear() {
        pjEditorState.mostrarFormCrear = !pjEditorState.mostrarFormCrear;
        _refreshFormCrear();
    },

    async crearPersonaje() {
        const nombre = document.getElementById('pje-nombre')?.value?.trim();
        const tipo   = document.querySelector('input[name="pje-tipo"]:checked')?.value || 'npc-sistema';

        const esJugador = tipo === 'jugador';
        const npcTipo   = tipo === 'npc-jugador' ? 'jugador' : 'sistema';

        _setFeedback('pje-feedback', '⏳ Creando personaje...', '#aaa');

        const result = await crearPersonaje(nombre, esJugador, npcTipo);

        if (result.error) {
            _setFeedback('pje-feedback', `❌ ${result.error}`, '#ff4444');
            return;
        }

        _setFeedback('pje-feedback', `✅ "${nombre}" creado correctamente.`, '#00ff88');
        pjEditorState.tabActiva      = esJugador ? 'jugadores' : 'npcs';
        pjEditorState.mostrarFormCrear = false;

        // 🔥 FIX REACTIVIDAD: Forzamos la barra superior a cambiar a la tab donde se creó el PJ
        if (window.cambiarFiltroRol) {
            window.cambiarFiltroRol(esJugador ? 'jugadores' : 'npcs');
        }

        setTimeout(() => renderColumnaPersonaje(), 800);
    },

    iniciarUpload(nombre, keyNorm) {
        pjEditorState.uploadTarget = { nombre, keyNorm };
        pjEditorState.uploadFase   = null;
        pjEditorState.uploadMsg    = '';
        _refreshUpload();
        document.getElementById('pje-upload-panel')
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    cancelarUpload() {
        pjEditorState.uploadTarget = null;
        pjEditorState.uploadFase   = null;
        _refreshUpload();
    },

    async handleDrop(e) {
        e.preventDefault();
        document.getElementById('pje-drop-zone')?.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file?.type.startsWith('image/')) await _ejecutarSubida(file);
    },

    async handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) await _ejecutarSubida(file);
        e.target.value = '';
    },

    iniciarEdicion(nombre) {
        pjEditorState.editandoNombre = nombre;
        _refreshGrid();
        // Foco al input
        setTimeout(() => {
            document.getElementById(`pje-ei-${norm(nombre)}`)?.focus();
        }, 50);
    },

    cancelarEdicion() {
        pjEditorState.editandoNombre = null;
        _refreshGrid();
    },

    async guardarEdicion(nombreActual) {
        const key   = norm(nombreActual);
        const input = document.getElementById(`pje-ei-${key}`);
        const nuevo = input?.value?.trim();
        _setFeedback(`pje-ef-${key}`, '⏳', '#aaa');

        const result = await editarNombrePersonaje(nombreActual, nuevo);

        if (result.error) {
            _setFeedback(`pje-ef-${key}`, `❌ ${result.error}`, '#ff4444');
            return;
        }
        pjEditorState.editandoNombre = null;
        renderColumnaPersonaje();
        // 🔥 FIX REACTIVIDAD: El evento devPersonajesUpdate lanzado en _logic ahora garantiza la reactividad completa
    },
};

// ── Helpers de refreshes parciales ───────────────────────────
function _refreshFormCrear() {
    const el = document.getElementById('pje-form-crear');
    if (el) el.innerHTML = pjEditorState.mostrarFormCrear ? _htmlFormCrear() : '';
}

function _refreshUpload() {
    const el = document.getElementById('pje-upload-panel');
    if (el) el.innerHTML = _htmlUpload();
}

function _refreshGrid() {
    const el = document.getElementById('pje-grid');
    if (el) el.innerHTML = _htmlGrid();
}

async function _ejecutarSubida(file) {
    if (!pjEditorState.uploadTarget) return;
    const { keyNorm } = pjEditorState.uploadTarget;

    pjEditorState.uploadFase = 'subiendo';
    _refreshUpload();

    try {
        await subirImagenPersonaje(file, keyNorm, (pct, msg) => {
            pjEditorState.uploadMsg = msg;
            const bar    = document.getElementById('pje-prog-bar');
            const status = document.getElementById('pje-prog-msg');
            if (bar)    bar.style.width = pct + '%';
            if (status) {
                status.textContent  = msg;
                status.style.color  = pct === 100 ? '#00ff88' : '#aaa';
            }
        });

        pjEditorState.uploadFase = 'ok';
        setTimeout(() => {
            pjEditorState.uploadTarget = null;
            pjEditorState.uploadFase   = null;
            renderColumnaPersonaje(); // re-render para mostrar la nueva imagen
        }, 1500);

    } catch (e) {
        pjEditorState.uploadFase = 'error';
        pjEditorState.uploadMsg  = '❌ ' + (e.message || 'Error al subir.');
        _refreshUpload();
        setTimeout(() => {
            if (pjEditorState.uploadFase === 'error') {
                pjEditorState.uploadTarget = null;
                pjEditorState.uploadFase   = null;
                _refreshUpload();
            }
        }, 3500);
    }
}

// ── RENDER PRINCIPAL ──────────────────────────────────────────
export function renderColumnaPersonaje() {
    const contenedor = document.getElementById('content-personaje');
    if (!contenedor) return;

    const { tabActiva, mostrarFormCrear } = pjEditorState;
    const esJ = tabActiva === 'jugadores';

    const jugadores = devState.listaPersonajes.filter(p =>  p.is_player);
    const npcs      = devState.listaPersonajes.filter(p => !p.is_player);

    const btnTab = (id, activo, colorActivo, borderActivo, icon, label, count) => `
        <button onclick="window.pjEditor.cambiarTab('${id}')"
            style="padding:9px 20px;border:2px solid;border-radius:6px;cursor:pointer;
                   font-family:'Cinzel';font-weight:bold;font-size:0.82em;transition:0.2s;
                   ${activo
                       ? `background:${colorActivo};color:#fff;border-color:${borderActivo};`
                       : 'background:#111;color:#666;border-color:#333;'}">
            ${icon} ${label} <span style="opacity:0.7;font-size:0.85em;">(${count})</span>
        </button>`;

    contenedor.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap;">
        ${btnTab('jugadores', esJ,  '#1a4000','#00e676', '⚔️','JUGADORES', jugadores.length)}
        ${btnTab('npcs',     !esJ,  '#3a0000','#ff4444', '🎭','NPCs',      npcs.length)}
        <button onclick="window.pjEditor.toggleFormCrear()"
            style="margin-left:auto;padding:9px 18px;border:1px solid;border-radius:6px;cursor:pointer;
                   font-family:'Cinzel';font-weight:bold;font-size:0.78em;transition:0.2s;
                   ${mostrarFormCrear
                       ? 'background:#1a003a;color:#cc88ff;border-color:#9060cc;'
                       : 'background:#111;color:#666;border-color:#333;'}">
            ${mostrarFormCrear ? '✕ Cerrar' : '✨ Crear Nuevo'}
        </button>
    </div>

    <div id="pje-form-crear">${mostrarFormCrear ? _htmlFormCrear() : ''}</div>

    <div id="pje-upload-panel">${_htmlUpload()}</div>

    <div id="pje-grid">${_htmlGrid()}</div>`;
}

// ── HTML: Form de creación ────────────────────────────────────
function _htmlFormCrear() {
    return `
    <div style="background:rgba(20,0,40,0.75);border:1px solid #6a20a0;border-radius:10px;
                padding:18px;margin-bottom:16px;">
        <h4 style="margin:0 0 14px 0;color:#cc88ff;font-family:'Cinzel';font-size:0.88em;
                   text-transform:uppercase;letter-spacing:0.05em;">
            ✨ Nuevo Personaje
        </h4>
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;">

            <div style="flex:1;min-width:200px;">
                <label style="display:block;color:#aaa;font-size:0.72em;font-weight:bold;
                              margin-bottom:5px;letter-spacing:0.05em;">NOMBRE</label>
                <input id="pje-nombre" type="text" placeholder="Nombre del personaje..."
                    style="width:100%;box-sizing:border-box;background:#000;color:#fff;
                           border:1px solid #555;border-radius:5px;padding:9px;
                           font-family:'Rajdhani';font-size:1em;outline:none;"
                    onkeydown="if(event.key==='Enter') window.pjEditor.crearPersonaje()">
            </div>

            <div>
                <label style="display:block;color:#aaa;font-size:0.72em;font-weight:bold;
                              margin-bottom:7px;letter-spacing:0.05em;">TIPO</label>
                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;
                                  color:#00e676;font-family:'Rajdhani';font-size:0.88em;">
                        <input type="radio" name="pje-tipo" value="jugador"> ⚔️ Jugador
                    </label>
                    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;
                                  color:#ff6666;font-family:'Rajdhani';font-size:0.88em;">
                        <input type="radio" name="pje-tipo" value="npc-sistema" checked> 🎭 NPC Sistema
                    </label>
                    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;
                                  color:#ff9900;font-family:'Rajdhani';font-size:0.88em;">
                        <input type="radio" name="pje-tipo" value="npc-jugador"> 🧩 NPC Jugador
                    </label>
                </div>
            </div>

            <button onclick="window.pjEditor.crearPersonaje()"
                style="background:linear-gradient(135deg,#1a0040,#4a0080);color:#cc88ff;
                       border:1px solid #9060cc;border-radius:6px;padding:9px 22px;
                       cursor:pointer;font-family:'Cinzel';font-weight:bold;font-size:0.82em;
                       transition:0.2s;"
                onmouseover="this.style.filter='brightness(1.25)'"
                onmouseout="this.style.filter='brightness(1)'">
                CREAR →
            </button>
        </div>
        <div id="pje-feedback" style="margin-top:10px;font-size:0.82em;font-family:'Rajdhani';
                                       min-height:1.2em;"></div>
    </div>`;
}

// ── HTML: Panel de upload ─────────────────────────────────────
function _htmlUpload() {
    const { uploadTarget, uploadFase, uploadMsg } = pjEditorState;
    if (!uploadTarget) return '';

    const mostrarBarra = uploadFase !== null;

    return `
    <div style="background:rgba(0,15,35,0.9);border:1px solid #0066cc;border-radius:10px;
                padding:16px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div style="line-height:1.5;">
                <span style="color:#aaa;font-size:0.78em;">📤 Subiendo imagen para:</span>
                <strong style="color:#fff;margin-left:6px;font-family:'Rajdhani';">
                    ${_esc(uploadTarget.nombre)}
                </strong>
                <div style="color:#444;font-size:0.68em;font-family:monospace;">
                    imgpersonajes/${uploadTarget.keyNorm}.png
                </div>
            </div>
            <button onclick="window.pjEditor.cancelarUpload()"
                style="background:#330000;border:1px solid #aa2222;color:#cc4444;
                       border-radius:4px;padding:5px 12px;cursor:pointer;font-size:0.78em;">
                × Cancelar
            </button>
        </div>

        <div id="pje-drop-zone"
            onclick="document.getElementById('pje-file-input').click()"
            ondragover="event.preventDefault();this.style.borderColor='#0099ff';this.style.background='rgba(0,50,100,0.3)'"
            ondragleave="this.style.borderColor='#0066cc';this.style.background='rgba(0,20,50,0.3)'"
            ondrop="window.pjEditor.handleDrop(event)"
            style="border:2px dashed #0066cc;border-radius:8px;padding:26px;text-align:center;
                   cursor:pointer;background:rgba(0,20,50,0.3);transition:0.2s;">
            <div style="font-size:2.2em;margin-bottom:8px;">🖼️</div>
            <p style="margin:0;color:#4499ee;font-family:'Cinzel';font-size:0.84em;font-weight:bold;">
                Arrastra aquí o haz clic para seleccionar
            </p>
            <p style="margin:5px 0 0 0;color:#444;font-size:0.72em;">
                JPG · PNG · WEBP — se redimensiona a 512px máx.
            </p>
        </div>
        <input type="file" id="pje-file-input" accept="image/*" style="display:none"
            onchange="window.pjEditor.handleFileSelect(event)">

        ${mostrarBarra ? `
        <div style="margin-top:12px;">
            <div style="height:5px;background:#111;border-radius:3px;overflow:hidden;margin-bottom:6px;">
                <div id="pje-prog-bar" style="height:100%;background:#0088ff;width:${uploadFase==='ok'?100:0}%;
                     transition:width 0.3s;box-shadow:0 0 8px #0088ff;"></div>
            </div>
            <p id="pje-prog-msg" style="color:${uploadFase==='error'?'#ff4444':uploadFase==='ok'?'#00ff88':'#aaa'};
               font-size:0.8em;font-family:'Rajdhani';text-align:center;margin:0;">
                ${_esc(uploadMsg)}
            </p>
        </div>` : ''}
    </div>`;
}

// ── HTML: Grid de personajes ──────────────────────────────────
function _htmlGrid() {
    const { tabActiva, busquedaNPC, editandoNombre, uploadTarget } = pjEditorState;
    const esJ = tabActiva === 'jugadores';
    const imgFallback = `${STORAGE_URL}/imginterfaz/no_encontrado.png`;

    let lista = devState.listaPersonajes
        .filter(p => esJ ? p.is_player : !p.is_player)
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

    let html = '';

    // ── Barra de búsqueda para NPCs ────────────────────────────
    if (!esJ) {
        html += `
        <div style="margin-bottom:14px;">
            <input type="text" value="${_esc(busquedaNPC)}" placeholder="🔍 Buscar NPC por nombre..."
                oninput="window.pjEditor.setBusqueda(this.value)"
                style="width:100%;box-sizing:border-box;background:#0a0015;color:#fff;
                       border:1px solid #444;border-radius:6px;padding:9px 14px;
                       font-family:'Rajdhani';font-size:0.95em;outline:none;">
        </div>`;
        if (busquedaNPC) lista = lista.filter(p => p.nombre.toLowerCase().includes(busquedaNPC));
    }

    if (!lista.length) {
        return html + `
        <div style="color:#444;font-style:italic;text-align:center;padding:40px;font-family:'Rajdhani';">
            ${busquedaNPC ? `Sin resultados para "${_esc(busquedaNPC)}"` : 'No hay personajes en esta categoría.'}
        </div>`;
    }

    const borderBase = esJ ? '#00e676' : '#ff4444';
    const colSize    = esJ ? '140px' : '130px';

    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(${colSize},1fr));gap:12px;">`;

    lista.forEach(p => {
        const keyNorm    = norm(p.icono_override || p.nombre) + 'icon';
        const imgUrl     = `${STORAGE_URL}/imgpersonajes/${keyNorm}.png`;
        const imgErr     = `this.onerror=null;this.src='${imgFallback}'`;
        const safeName   = p.nombre.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        const k          = norm(p.nombre);
        const isEditando = editandoNombre === p.nombre;
        const isUploading = uploadTarget?.nombre === p.nombre;

        // Badge de tipo NPC
        let tipoBadge = '';
        if (!p.is_player && p.npc_tipo) {
            const esNPCJ = p.npc_tipo === 'jugador';
            tipoBadge = `
            <div style="position:absolute;top:5px;left:5px;
                        font-size:0.58em;padding:2px 5px;border-radius:3px;font-weight:bold;
                        font-family:'Rajdhani';letter-spacing:0.03em;
                        background:${esNPCJ ? 'rgba(255,153,0,0.25)' : 'rgba(80,0,0,0.4)'};
                        color:${esNPCJ ? '#ff9900' : '#ff6666'};
                        border:1px solid ${esNPCJ ? '#ff9900' : '#aa3333'};">
                ${esNPCJ ? 'NPC-J' : 'SIS'}
            </div>`;
        }

        // Botón de subir imagen (encima del retrato)
        const uploadBtn = `
        <button onclick="window.pjEditor.iniciarUpload('${safeName}','${keyNorm}')"
            title="Subir / cambiar imagen"
            style="position:absolute;bottom:-3px;right:-3px;
                   background:${isUploading ? '#0066cc' : '#000d1a'};
                   border:1px solid ${isUploading ? '#0099ff' : '#0055aa'};
                   color:${isUploading ? '#fff' : '#4499cc'};
                   border-radius:50%;width:22px;height:22px;font-size:0.68em;
                   cursor:pointer;display:flex;align-items:center;justify-content:center;
                   line-height:1;">
            ${isUploading ? '⏳' : '📤'}
        </button>`;

        // Zona de nombre (edición inline o texto)
        const nombreZona = isEditando ? `
        <div style="margin:6px 0 4px 0;">
            <input id="pje-ei-${k}" type="text" value="${_esc(p.nombre)}"
                style="width:100%;box-sizing:border-box;background:#000;color:#fff;
                       border:1px solid #9060cc;border-radius:4px;padding:5px;
                       font-size:0.8em;text-align:center;outline:none;font-family:'Rajdhani';"
                onkeydown="
                    if(event.key==='Enter')  window.pjEditor.guardarEdicion('${safeName}');
                    if(event.key==='Escape') window.pjEditor.cancelarEdicion();">
            <div id="pje-ef-${k}" style="font-size:0.68em;min-height:1.1em;margin-top:3px;
                                          text-align:center;font-family:'Rajdhani';"></div>
            <div style="display:flex;gap:4px;justify-content:center;margin-top:4px;">
                <button onclick="window.pjEditor.guardarEdicion('${safeName}')"
                    style="background:#002200;border:1px solid #00aa44;color:#00dd66;
                           border-radius:4px;padding:3px 9px;cursor:pointer;font-size:0.72em;">✓</button>
                <button onclick="window.pjEditor.cancelarEdicion()"
                    style="background:#220000;border:1px solid #aa2222;color:#cc4444;
                           border-radius:4px;padding:3px 9px;cursor:pointer;font-size:0.72em;">✕</button>
            </div>
        </div>` : `
        <div style="font-size:0.78em;color:#ddd;margin:6px 0;font-family:'Rajdhani';
                    word-break:break-word;line-height:1.25;min-height:2.5em;
                    display:flex;align-items:center;justify-content:center;">
            ${_esc(p.nombre)}
        </div>`;

        const renombrarBtn = isEditando ? '' : `
        <button onclick="window.pjEditor.iniciarEdicion('${safeName}')"
            style="background:#0a0020;border:1px solid #2a1060;color:#7a6aaa;
                   border-radius:4px;padding:3px 10px;cursor:pointer;
                   font-size:0.68em;font-family:'Rajdhani';transition:0.15s;width:100%;"
            onmouseover="this.style.borderColor='#6a40cc';this.style.color='#cc88ff'"
            onmouseout="this.style.borderColor='#2a1060';this.style.color='#7a6aaa'">
            ✏️ Renombrar
        </button>`;

        html += `
        <div style="background:rgba(8,0,18,0.85);border:1px solid ${borderBase}22;
                    border-radius:10px;padding:10px;text-align:center;
                    position:relative;transition:0.2s;"
             onmouseover="this.style.borderColor='${borderBase}55'"
             onmouseout="this.style.borderColor='${borderBase}22'">
            ${tipoBadge}
            <div style="position:relative;display:inline-block;margin-bottom:2px;">
                <img src="${imgUrl}" onerror="${imgErr}"
                    style="width:72px;height:72px;object-fit:cover;border-radius:50%;
                           border:2px solid ${borderBase}55;display:block;">
                ${uploadBtn}
            </div>
            ${nombreZona}
            ${renombrarBtn}
        </div>`;
    });

    html += '</div>';
    return html;
}

// ── Helpers ───────────────────────────────────────────────────
function _setFeedback(id, msg, color) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.color = color; }
}

function _esc(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
