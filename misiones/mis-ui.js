import { misGlobal, jugadoresActivos, estadoUI, RECOMPENSAS_CLASE } from './mis-state.js';
import { removerJugador, guardarMision, eliminarPersonalizada } from './mis-logic.js';

const normalizar = (str) => str.toString().trim().toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/\s+/g,'_').replace(/[^a-z0-9ñ_]/g,'');

function getAfColor(af) {
    const colors = { 'Física': '#e2a673', 'Energética': '#f3b67a', 'Espiritual': '#7df0a7', 'Mando': '#a4d3f2', 'Psíquica': '#dcb1f0', 'Oscura': '#c285ff' };
    return colors[af] || '#888';
}

export function dibujarRoster() {
    const container = document.getElementById('roster-jugadores');
    let html = '';
    jugadoresActivos.forEach(j => {
        const color = getAfColor(j.afinidad);
        html += `<img src="../img/imgpersonajes/${normalizar(j.icon)}icon.png" 
                      class="drag-char" 
                      style="border-color:${color};"
                      title="${j.nombre} (Af. Primaria: ${j.afinidad})" 
                      draggable="true" 
                      ondragstart="window.dragStart(event, '${j.nombre}', 'roster')" 
                      onerror="this.src='../img/imgobjetos/no_encontrado.png'">`;
    });
    container.innerHTML = html;
}

function renderBadgeEstado(estado) {
    if (estado === 0) return `<span class="estado-badge st-0">Inactiva</span>`;
    if (estado === 1) return `<span class="estado-badge st-1">Pendiente</span>`;
    if (estado === 2) return `<span class="estado-badge st-2">En Proceso</span>`;
    if (estado === 3) return `<span class="estado-badge st-3">Finalizada</span>`;
    return '';
}

function generarHTMLMision(m) {
    // BLINDAJE CONTRA COMILLAS SIMPLES EN LOS TÍTULOS (Ej: "Howl's Moving Castle")
    const safeId = m.id.replace(/'/g, "\\'"); 

    const btnEditar = (estadoUI.esAdmin || m.tipo === 'Personalizada') 
        ? `<button onclick="window.abrirModalEditar('${safeId}')" style="background:#111; border:1px solid #555; color:var(--gold); padding:4px 8px; font-size:0.75em; cursor:pointer; border-radius:4px; font-family:'Cinzel';">✏️ Editar</button>` : '';
    const btnBorrar = (m.tipo === 'Personalizada' || estadoUI.esAdmin)
        ? `<button onclick="window.eliminarMis('${safeId}')" style="background:#4a0000; border:1px solid #ff4444; padding:4px 8px; font-size:0.75em; color:white; cursor:pointer; border-radius:4px;">🗑️</button>` : '';

    let htmlJugadores = '';
    m.jugadores.forEach(j => {
        const targetJug = jugadoresActivos.find(jug => jug.nombre === j);
        const icon = targetJug?.icon || j;
        const color = getAfColor(targetJug?.afinidad);
        
        htmlJugadores += `<div class="assigned-char" title="Clic o arrastrar fuera para quitar a ${j}" draggable="true" ondragstart="window.dragStart(event, '${j}', '${safeId}')" onclick="window.quitarJugador('${safeId}', '${j}')">
                            <img src="../img/imgpersonajes/${normalizar(icon)}icon.png" style="border-color:${color}" onerror="this.src='../img/imgobjetos/no_encontrado.png'">
                          </div>`;
    });

    const isReady = m.cupos > 0 && m.jugadores.length >= m.cupos;
    const cuposColor = isReady ? 'var(--green-ok)' : '#888';
    const textCupo = m.cupos; 

    const notaHTML = (estadoUI.esAdmin && m.notaOP) ? `<div style="background:#2e004f; padding:5px; border-left:3px solid var(--purple-magic); font-size:0.75em; margin-bottom:5px;"><b>OP:</b> ${m.notaOP}</div>` : '';

    return `
    <div class="mision-card">
        <div class="mision-header">
            <h3 class="mision-titulo" title="${m.titulo}">${m.titulo}</h3>
            <span class="mision-clase" title="Clase ${m.clase}">C-${m.clase}</span>
        </div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
            ${renderBadgeEstado(m.estado)}
            <span style="font-size:0.75em; color:#aaa; font-family:monospace;">Jugadores: <b style="color:${cuposColor}">${m.jugadores.length}/${textCupo}</b></span>
        </div>
        
        <details class="mision-details">
            <summary>Ver Detalles y Recompensas</summary>
            <div class="mision-meta">Autor: <span style="color:#aaa">${m.autor}</span></div>
            <div class="mision-desc">${m.desc}</div>
            ${notaHTML}
        </details>
        
        <div class="drop-zone" ondragover="window.dragOver(event)" ondrop="window.dropPlayer(event, '${safeId}')" ondragleave="window.dragLeave(event)">
            ${htmlJugadores}
        </div>
        
        <div style="display:flex; justify-content:flex-end; gap:5px; margin-top:8px;">
            ${btnEditar}
            ${btnBorrar}
        </div>
    </div>`;
}

export function dibujarTablero() {
    let contGrandes = 0; let contNormales = 0;
    let htmlGrandes = ''; let htmlNormales = ''; let htmlPerso = ''; let htmlOP = '';

    misGlobal.forEach(m => {
        if (!estadoUI.verFinalizadas && m.estado === 3) return; 

        if (m.estado === 1 || m.estado === 2) {
            if (m.tipo.trim() === 'Grande') contGrandes++;
            if (m.tipo.trim() === 'Normal') contNormales++;
        }

        const htmlCard = generarHTMLMision(m);
        
        if (m.tipo === 'Grande') htmlGrandes += htmlCard;
        else if (m.tipo === 'Normal') htmlNormales += htmlCard;
        else if (m.tipo === 'Personalizada') htmlPerso += htmlCard;
        else if (m.tipo === 'OP' && estadoUI.esAdmin) htmlOP += htmlCard;
    });

    document.getElementById('lista-grandes').innerHTML = htmlGrandes || '<p style="color:#666; font-style:italic;">No hay misiones publicadas.</p>';
    document.getElementById('lista-normales').innerHTML = htmlNormales || '<p style="color:#666; font-style:italic;">No hay misiones publicadas.</p>';
    document.getElementById('lista-perso').innerHTML = htmlPerso || '<p style="color:#666; font-style:italic;">No hay misiones de jugadores.</p>';
    document.getElementById('lista-op').innerHTML = htmlOP;

    document.getElementById('count-grandes').innerText = contGrandes;
    document.getElementById('count-normales').innerText = contNormales;

    const colOP = document.getElementById('col-op');
    if(estadoUI.esAdmin) { colOP.classList.remove('oculto'); } else { colOP.classList.add('oculto'); }
}

export function actualizarBotonSync() {
    const btn = document.getElementById('btn-sync-global'); if(!btn) return;
    const statsChanges = Object.keys(estadoUI.colaCambios.misiones || {}).length;
    if (statsChanges > 0) {
        btn.classList.remove('oculto');
        btn.innerText = `🔥 GUARDAR CAMBIOS (${statsChanges}) 🔥`;
    } else {
        btn.classList.add('oculto');
    }
}

export function renderFormularioModal(mision = null) {
    const isEdit = mision !== null;
    const m = mision || { titulo:'', desc:'', autor:'', clase:'1', tipo:'Personalizada', estado:1, cupos:2, notaOP:'' };
    
    let tipoOptions = `<option value="Personalizada" ${m.tipo === 'Personalizada' ? 'selected' : ''}>Personalizada</option>`;
    if (estadoUI.esAdmin) {
        tipoOptions += `
            <option value="Grande" ${m.tipo === 'Grande' ? 'selected' : ''}>Grande</option>
            <option value="Normal" ${m.tipo === 'Normal' ? 'selected' : ''}>Normal</option>
            <option value="OP" ${m.tipo === 'OP' ? 'selected' : ''}>Idea OP</option>
        `;
    }

    const estadoDisabled = (!estadoUI.esAdmin && !isEdit) ? 'disabled' : '';

    const infoGuia = `
    <div class="modal-guide">
        <h4>💡 Sugerencias de Recompensas por Clase</h4>
        <div class="guide-grid">
            <div><b>Clase 1:</b> 600-1200 Hex<br>2 a 4 Puntos de Afinidad</div>
            <div><b>Clase 2:</b> 1000-1800 Hex<br>3 a 6 Puntos de Afinidad</div>
            <div><b>Clase 3:</b> 1500-2200 Hex<br>4 a 8 Puntos de Afinidad</div>
            <div><b>Clase 4:</b> 2000-3000 Hex<br>5 a 10 Puntos de Afinidad</div>
            <div><b>Clase 5:</b> 2500-3600 Hex<br>6 a 12 Puntos de Afinidad</div>
        </div>
        <p class="guide-warning">Recomendación: Se sugiere que la clase del hechizo a brindar sea igual que la de la misión.</p>
    </div>`;

    return `
    <input type="hidden" id="form-id" value="${m.id || 'MIS_' + new Date().getTime()}">
    
    ${infoGuia}

    <div class="form-group">
        <label>Título de la Misión</label>
        <input type="text" id="form-titulo" class="form-input" value="${m.titulo}">
    </div>
    
    <div style="display:flex; gap:15px; flex-wrap:wrap;">
        <div class="form-group" style="flex:1; min-width:120px;">
            <label>Tipo</label>
            <select id="form-tipo" class="form-input" ${!estadoUI.esAdmin ? 'disabled' : ''}>
                ${tipoOptions}
            </select>
        </div>
        <div class="form-group" style="flex:1; min-width:120px;">
            <label>Clase de Dificultad</label>
            <select id="form-clase" class="form-input">
                ${[1,2,3,4,5].map(c => `<option value="${c}" ${parseInt(m.clase) === c ? 'selected' : ''}>Clase ${c}</option>`).join('')}
            </select>
        </div>
    </div>

    <div style="display:flex; gap:15px; flex-wrap:wrap;">
        <div class="form-group" style="flex:1; min-width:120px;">
            <label>Estado Inicial</label>
            <select id="form-estado" class="form-input" ${estadoDisabled}>
                <option value="0" ${m.estado === 0 ? 'selected' : ''}>Inactiva</option>
                <option value="1" ${m.estado === 1 ? 'selected' : ''}>Pendiente (Activa)</option>
                <option value="2" ${m.estado === 2 ? 'selected' : ''}>En Proceso</option>
                <option value="3" ${m.estado === 3 ? 'selected' : ''}>Finalizada</option>
            </select>
        </div>
        <div class="form-group" style="flex:1; min-width:120px;">
            <label>Umbral Detonador (Inicio: 2)</label>
            <input type="number" id="form-cupos" class="form-input" value="${m.cupos || 2}" min="1">
        </div>
    </div>

    <div class="form-group">
        <label>Autor</label>
        <input type="text" id="form-autor" class="form-input" value="${m.autor}">
    </div>

    <div class="form-group">
        <label>Descripción de la Misión</label>
        <textarea id="form-desc" class="form-input">${m.desc}</textarea>
    </div>

    ${estadoUI.esAdmin ? `
    <div class="form-group">
        <label style="color:var(--purple-magic);">Nota Interna OP (Invisible para jugadores)</label>
        <textarea id="form-notaOP" class="form-input" style="border-color:var(--purple-magic);">${m.notaOP}</textarea>
    </div>` : ''}

    <button onclick="window.ejecutarGuardarMision()" style="width:100%; background:var(--gold); color:#000; padding:15px; font-size:1.1em; border-radius:4px; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">💾 GUARDAR MISIÓN</button>
    `;
}
