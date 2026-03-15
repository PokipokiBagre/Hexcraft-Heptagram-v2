import { db, estadoUI } from './inventario-state.js';
import { getInventarioCombinado, obtenerHechizosAprendibles } from './inventario-logic.js';
import { db as hexDB } from '../hex-db.js';

const normalizar = (str) => str ? str.toString().trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') : '';
const textNorm   = (str) => str ? str.toString().trim().toLowerCase() : '';
const safeStr    = (str) => str ? str.toString().replace(/'/g, "\\'") : '';

// Fallback único — igual que en el resto del proyecto
const NO_ENCONTRADO = () => `${hexDB.storage.urlBase}/imginterfaz/no_encontrado.png`;

function getColorAfinidad(af) {
    if(af === 'Física')     return { b: '#b36a2f', t: '#e2a673' };
    if(af === 'Energética') return { b: '#bba71b', t: '#f3e57a' };
    if(af === 'Espiritual') return { b: '#2ba85e', t: '#7df0a7' };
    if(af === 'Mando')      return { b: '#3a87c2', t: '#a4d3f2' };
    if(af === 'Psíquica')   return { b: '#9648b8', t: '#dcb1f0' };
    if(af === 'Oscura')     return { b: '#b3152f', t: '#ff526f' };
    return { b: '#555', t: '#fff' };
}

const getSortValue = (p) => {
    if (p.isPlayer && p.isActive)   return 1;
    if (!p.isPlayer && p.isActive)  return 2;
    if (!p.isPlayer && !p.isActive) return 3;
    if (p.isPlayer && !p.isActive)  return 4;
    return 5;
};

export function getValInfo(info, possibleKeys) {
    if(!info) return null;
    const actualKeys = Object.keys(info);
    for(let pk of possibleKeys) {
        const matched = actualKeys.find(k => k.trim().toLowerCase() === pk.toLowerCase());
        if(matched && info[matched] && info[matched] !== '0' && info[matched] !== 0 && info[matched] !== 'Desconocido' && info[matched] !== 'null') {
            return info[matched];
        }
    }
    return null;
}

function generarDetalles(info) {
    const ov = getValInfo(info, ['overcast 100%', 'overcast']);
    const un = getValInfo(info, ['undercast 50%', 'undercast']);
    const es = getValInfo(info, ['especial', 'especiales']);
    if (!ov && !un && !es) return '';
    return `
    <details class="spell-details">
        <summary>Ver Detalles Adicionales</summary>
        <div class="details-content">
            ${ov ? `<div class="spell-extra"><strong>Overcast:</strong> ${ov}</div>` : ''}
            ${un ? `<div class="spell-extra"><strong>Undercast:</strong> ${un}</div>` : ''}
            ${es ? `<div class="spell-extra"><strong>Especial:</strong> ${es}</div>` : ''}
        </div>
    </details>`;
}

export function dibujarCatalogo() {
    let html = `<div class="catalogo-grid">`;
    Object.keys(db.personajes).sort((a, b) => {
        const valA = getSortValue(db.personajes[a]); const valB = getSortValue(db.personajes[b]);
        if (valA !== valB) return valA - valB; return a.localeCompare(b);
    }).forEach(nombre => {
        const p = db.personajes[nombre];
        if (estadoUI.filtroRol === 'Jugador' && !p.isPlayer)  return;
        if (estadoUI.filtroRol === 'NPC'     && p.isPlayer)   return;
        if (estadoUI.filtroAct === 'Activo'  && !p.isActive)  return;
        if (estadoUI.filtroAct === 'Inactivo' && p.isActive)  return;

        const style = p.isPlayer && p.isActive ? 'player-active' : (p.isPlayer ? 'player-card' : '');

        html += `<div class="char-card ${style} ${p.isActive ? '' : 'inactive-card'}" onclick="window.abrirGrimorio('${nombre}')">
                    <img src="${hexDB.storage.urlBase}/imgpersonajes/${normalizar(p.iconoOverride)}icon.png"
                         onerror="this.onerror=null; this.src='${NO_ENCONTRADO()}'">
                    <h3>${nombre}</h3>
                    <p class="char-stats"><strong style="color:var(--gold)">HEX:</strong> ${p.hex}</p>
                    <p class="char-stats"><strong>Grimorio:</strong> ${getInventarioCombinado(nombre).length} Hechizos</p>
                    <p class="char-stats"><strong>Af. Primaria:</strong> <span style="color:${getColorAfinidad(p.mayorAfinidad).t}">${p.mayorAfinidad}</span></p>
                 </div>`;
    });
    document.getElementById('grid-catalogo').innerHTML = html + `</div>`;
}

export function renderHeaders() {
    const pj = estadoUI.personajeSeleccionado; if(!pj) return;
    const char = db.personajes[pj];

    const inv = getInventarioCombinado(pj);
    const todosNodos = [...(db.hechizos.nodos || []), ...(db.hechizos.nodosOcultos || [])];
    const conteo = { 'Física': 0, 'Energética': 0, 'Espiritual': 0, 'Mando': 0, 'Psíquica': 0, 'Oscura': 0 };

    inv.forEach(item => {
        const itemNorm = textNorm(item.Hechizo);
        const info = todosNodos.find(n => textNorm(n.Nombre) === itemNorm || textNorm(n.ID) === itemNorm) || {};
        const af = item["Hechizo Afinidad"] || info.Afinidad;
        if(conteo[af] !== undefined) conteo[af]++;
    });

    let statsHTML = `<div style="display:flex; gap:10px; flex-wrap:wrap; font-size:0.75em; margin-top:8px; background:rgba(0,0,0,0.5); padding:6px 12px; border-radius:4px; border:1px solid #333; align-items:center;">`;
    statsHTML += `<span style="color:#aaa; font-weight:bold; letter-spacing:1px; margin-right:5px;">CANTIDAD DE HECHIZOS:</span>`;
    Object.keys(conteo).forEach(af => {
        const c = conteo[af]; const color = getColorAfinidad(af).t;
        statsHTML += `<span style="color:${color}; ${c === 0 ? 'opacity:0.3;' : `font-weight:bold; text-shadow: 0 0 5px ${color};`}">${af.toUpperCase()}: ${c}</span>`;
    });
    statsHTML += `</div>`;

    const btnArbol   = char.isPlayer ? `<button onclick="window.cambiarVista('aprendizaje')" class="btn-nav" style="background:#004a4a; border-color:var(--cyan-magic);">✨ Árbol de Aprendizaje</button>` : '';
    const btnCastear = `<button onclick="window.cambiarVista('casteo')" class="btn-nav" style="background:#3a005a; border-color:#ff00ff; color:white;">🎲 Castear Hechizo</button>`;

    // VEX calculado desde afinidad oscura total (sin rawRow)
    const afOscura = char.afinidades?.oscura || 0;
    const maxVex   = Math.round(((afOscura * 300) / 4) / 50) * 50;

    let logCasteoGlobalHTML = '';
    if (estadoUI.esAdmin) {
        const isConsumoChecked = estadoUI.consumoCast !== false ? 'checked' : '';
        const isEfectosChecked = estadoUI.efectosCast !== false ? 'checked' : '';

        logCasteoGlobalHTML = `
        <div style="background:#1a0033; border:1px solid var(--gold); border-radius:8px; padding:15px; margin-top:15px;">
            <h4 style="color:#00ffff; margin:0 0 5px 0;">📋 Log de Conjuros (OP)</h4>
            <textarea id="log-casteo-textarea" readonly style="width:100%; height:100px; background:#000; color:#fff; border:1px dashed var(--gold); padding:10px; font-family:monospace; box-sizing:border-box;"></textarea>
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button onclick="window.copiarLogCasteo()" style="flex:3; background:var(--gold); color:black; font-weight:bold; padding:8px; border:none; cursor:pointer; border-radius:4px;">COPIAR LOG</button>
                <button onclick="window.limpiarLogCasteo()" style="flex:1; background:#8b0000; color:white; padding:8px; border:none; cursor:pointer; border-radius:4px;">LIMPIAR LOG</button>
            </div>
            <div style="margin-top:15px; border-top: 1px dashed #555; padding-top:15px; display:flex; flex-direction:column; gap:10px;">
                <label class="toggle-hex" style="margin-bottom:0; display:inline-flex;">
                    <input type="checkbox" id="toggle-cast-consumo" ${isConsumoChecked} onchange="window.toggleCastConsumo(this.checked)">
                    MODO OP: CONSUMIR VEX/HEX AL CALCULAR
                </label>
                <label class="toggle-hex" style="margin-bottom:0; display:inline-flex;">
                    <input type="checkbox" id="toggle-cast-efectos" ${isEfectosChecked} onchange="window.toggleCastEfectos(this.checked)">
                    MOSTRAR EFECTO Y EXTRAS EN EL LOG
                </label>
            </div>
        </div>`;
    }

    const linkStats  = `../estadisticas/index.html?pj=${encodeURIComponent(pj)}`;
    const portraitHTML = `<a href="${linkStats}" target="_blank" title="Ver ficha de estado de ${pj}" style="display:flex;">
        <img src="${hexDB.storage.urlBase}/imgpersonajes/${normalizar(char.iconoOverride)}icon.png"
             class="player-icon"
             onerror="this.onerror=null; this.src='${NO_ENCONTRADO()}'">
    </a>`;

    document.getElementById('header-grimorio').innerHTML = `
        <div class="player-header">
            <div style="display:flex; align-items:center; gap:20px;">
                ${portraitHTML}
                <div>
                    <a href="${linkStats}" target="_blank" style="text-decoration:none;" title="Ver ficha de estado de ${pj}">
                        <h2 style="margin:0; color:var(--gold); cursor:pointer;">${pj.toUpperCase()}</h2>
                    </a>
                    <p style="margin:5px 0 0 0; color:var(--gold); font-weight:bold;">
                        HEX: <span style="color:white;">${char.hex}</span> &nbsp;|&nbsp; VEX MAX: <span style="color:#dcb1f0;">${maxVex}</span>
                    </p>
                    ${statsHTML}
                </div>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                ${btnArbol}
                ${btnCastear}
                ${estadoUI.esAdmin ? `<button onclick="window.cambiarVista('gestion')" class="btn-nav" style="background:#4a004a; border-color:var(--purple-magic);">⚙️ Asignar/Quitar (OP)</button>` : ''}
            </div>
        </div>`;

    document.getElementById('header-aprendizaje').innerHTML = `
        <button onclick="window.cambiarVista('grimorio')" class="btn-nav btn-volver" style="margin-bottom:20px;">⬅ Volver al Grimorio</button>
        <div class="player-header" style="justify-content:center;">
            <div style="display:flex; align-items:center; gap:20px;">
                ${portraitHTML}
                <div>
                    <a href="${linkStats}" target="_blank" style="text-decoration:none;" title="Ver ficha de estado de ${pj}">
                        <h2 style="margin:0; color:var(--gold); cursor:pointer;">ÁRBOL DE APRENDIZAJE</h2>
                    </a>
                </div>
            </div>
        </div>`;

    document.getElementById('header-casteo').innerHTML = `
        <button onclick="window.cambiarVista('grimorio')" class="btn-nav btn-volver" style="margin-bottom:20px;">⬅ Volver al Grimorio</button>
        <div class="player-header" style="flex-direction:column; align-items:stretch;">
            <div style="display:flex; align-items:center; gap:20px;">
                ${portraitHTML}
                <div>
                    <a href="${linkStats}" target="_blank" style="text-decoration:none;" title="Ver ficha de estado de ${pj}">
                        <h2 style="margin:0; color:var(--gold); cursor:pointer;">ZONA DE CONJURO: ${pj.toUpperCase()}</h2>
                    </a>
                    <p style="margin:5px 0 0 0; font-size:1.1em; color:var(--gold); font-weight:bold;">
                        HEX: <span style="color:white;">${char.hex}</span> &nbsp;|&nbsp; VEX MAX: <span style="color:#dcb1f0;">${maxVex}</span>
                    </p>
                </div>
            </div>
            ${logCasteoGlobalHTML}
        </div>`;

    document.getElementById('header-gestion').innerHTML = `
        <button onclick="window.cambiarVista('grimorio')" class="btn-nav btn-volver" style="margin-bottom:20px;">⬅ Volver al Grimorio</button>
        <div class="player-header">
            <div style="display:flex; align-items:center; gap:20px;">
                ${portraitHTML}
                <div>
                    <a href="${linkStats}" target="_blank" style="text-decoration:none;" title="Ver ficha de estado de ${pj}">
                        <h2 style="margin:0; color:var(--gold); cursor:pointer;">GESTIÓN OP: ${pj.toUpperCase()}</h2>
                    </a>
                    <p style="margin:5px 0 0 0; color:var(--gold); font-weight:bold;">
                        HEX Actual: <span style="color:white;">${char.hex}</span> &nbsp;|&nbsp; VEX MAX: <span style="color:#dcb1f0;">${maxVex}</span>
                    </p>
                    ${statsHTML}
                </div>
            </div>
        </div>
        <label class="toggle-hex">
            <input type="checkbox" onchange="window.toggleRestarHex(this.checked)" ${estadoUI.restarHexAsignacion ? 'checked' : ''}>
            RESTAR COSTE DE HEX AL ASIGNAR HECHIZO
        </label>
        <div style="margin-bottom:20px; text-align:center; background:#1a0033; padding:15px; border:1px solid var(--gold); border-radius:8px; max-width:800px; margin:0 auto 30px auto;">
            <div style="margin-bottom:15px;">
                <label style="color:var(--gold); font-weight:bold; margin-right:10px;">FUENTE DEL HECHIZO (ORIGEN):</label>
                <select id="slicer-origen" class="search-bar" style="margin:0; width:auto; display:inline-block;">
                    <option value="Mapa Hex">Mapa Hex</option>
                    <option value="OP Admin">OP Admin</option>
                    ${Object.keys(db.personajes).sort().map(n => `<option value="${n}">${n}</option>`).join('')}
                </select>
            </div>
            <h4 style="color:#00ffff; margin:0 0 5px 0; text-align:left;">📋 Bitácora de Aprendizaje</h4>
            <textarea id="op-log-textarea" readonly style="width:100%; height:80px; background:#000; color:#fff; border:1px dashed var(--gold); padding:10px; font-family:monospace; box-sizing:border-box; margin-bottom:10px;"></textarea>
            <div style="display:flex; gap:10px;">
                <button onclick="window.copiarLogOP()" style="flex:3; background:var(--gold); color:black; font-weight:bold; padding:8px; border:none; cursor:pointer; border-radius:4px;">COPIAR AL PORTAPAPELES</button>
                <button onclick="window.limpiarLogOP()" style="flex:1; background:#8b0000; color:white; padding:8px; border:none; cursor:pointer; border-radius:4px;">LIMPIAR LOG</button>
            </div>
        </div>`;
}

export function dibujarGrimorioGrid() {
    const pj  = estadoUI.personajeSeleccionado;
    const inv = getInventarioCombinado(pj);
    const todosNodos = [...(db.hechizos.nodos || []), ...(db.hechizos.nodosOcultos || [])];
    const fAf = estadoUI.filtrosGrimorio.afinidad; const fTx = estadoUI.filtrosGrimorio.busqueda.toLowerCase();

    let html = ``;
    inv.filter(item => (fAf === 'Todos' || item["Hechizo Afinidad"] === fAf) && (!fTx || item.Hechizo.toLowerCase().includes(fTx)))
       .forEach(item => {
        const itemNorm = textNorm(item.Hechizo);
        const info = todosNodos.find(n => textNorm(n.Nombre) === itemNorm || textNorm(n.ID) === itemNorm) || {};

        const checkColaVis = estadoUI.colaCambios.toggleConocido.slice().reverse().find(c => c.ID === info.ID || c.Nombre === info.Nombre);
        const isPublicBase = info.Conocido && info.Conocido.toString().trim().toLowerCase() === 'si';
        const isKnown  = checkColaVis ? (checkColaVis.Estado === 'si') : isPublicBase;
        const isHidden = !estadoUI.esAdmin && !isKnown;

        const col       = getColorAfinidad(item["Hechizo Afinidad"] || info.Afinidad);
        const clase     = info.Clase || 'Clase -';
        const isTemporal = item.Tipo && item.Tipo !== 'Normal' ? `<br><i>Hechizo ${item.Tipo}</i>` : '';

        const tituloReal = (info.Nombre && info.Nombre.trim() !== '') ? info.Nombre : item.Hechizo;
        const titulo     = isHidden ? (info.ID || item.Hechizo) : tituloReal;
        const subTitulo  = info.ID ? `<span style="display:block; color:#888; font-size:0.7em; font-style:italic; margin-bottom:10px; text-transform:uppercase;">ID: ${info.ID}</span>` : '';

        const res        = isHidden ? '<i style="color:#ff4444;">Información Sellada (Hechizo no descubierto).</i>' : getValInfo(info, ['resumen', 'Resumen']);
        const efe        = isHidden ? '' : getValInfo(info, ['efecto', 'Efecto']);
        const detailsHTML = isHidden ? '' : generarDetalles(info);

        const btnVis = (estadoUI.esAdmin && info.Nombre) ? `<button onclick="window.toggleVisibilidad('${info.ID}', '${safeStr(info.Nombre)}', '${isKnown ? 'no' : 'si'}')" class="btn-nav" style="background:#111; color:#aaa; border-color:#555; width:100%; margin-top:10px; font-size:0.8em; padding:5px;">${isKnown ? '👁️ Ocultar Hechizo Globalmente' : '🙈 Hacer Público'}</button>` : '';

        html += `<div class="spell-card" style="border-top-color: ${col.b};">
                    <h3 style="color:${isHidden ? '#666' : col.t}; margin-bottom:2px;">${titulo}</h3>
                    ${subTitulo}
                    <div class="spell-tags">
                        <span class="spell-tag tag-hex">HEX: ${item["Hechizo Hex"] || info.HEX || 0}</span>
                        <span class="spell-tag" style="border-color:${col.b}; color:${col.t};">${item["Hechizo Afinidad"] || info.Afinidad}</span>
                        <span class="spell-tag tag-clase">${clase}</span>
                    </div>
                    ${res ? `<div class="spell-desc" style="${isHidden ? 'background:#000; border-left-color:#333;' : ''}">${res}</div>` : ''}
                    ${efe ? `<div class="spell-efecto">Efecto: <span style="color:var(--cyan-magic); font-weight:normal;">${efe}</span></div>` : ''}
                    ${detailsHTML}
                    <div class="tag-origen">Origen: ${item.Origen || 'Desconocido'}${isTemporal}</div>
                    ${btnVis}
                 </div>`;
    });
    document.getElementById('grid-grimorio').innerHTML = html || `<p style="grid-column:1/-1; color:#aaa; text-align:center;">El grimorio está vacío.</p>`;
}

export function dibujarGestionGrid() {
    const pj         = estadoUI.personajeSeleccionado;
    const invNombres = getInventarioCombinado(pj).map(i => textNorm(i.Hechizo));
    let nodosBrutos  = [...(db.hechizos.nodos || []), ...(db.hechizos.nodosOcultos || [])];

    let mapUnicos = new Map();
    nodosBrutos.forEach(n => {
        const idKey = (n.ID || "").toString().trim().toLowerCase(); if (!idKey) return;
        if (!mapUnicos.has(idKey)) { mapUnicos.set(idKey, n); }
        else {
            const existente = mapUnicos.get(idKey);
            const nombreNuevo = (n.Nombre || "").toString().trim();
            const nombreViejo = (existente.Nombre || "").toString().trim();
            const esPlaceholder = (txt) => txt === "" || txt.toLowerCase().startsWith("hechizo");
            if (esPlaceholder(nombreViejo) && !esPlaceholder(nombreNuevo)) mapUnicos.set(idKey, n);
        }
    });

    let nodos = Array.from(mapUnicos.values());
    const fAf = estadoUI.filtrosGestion.afinidad; const fCl = estadoUI.filtrosGestion.clase; const fTx = estadoUI.filtrosGestion.busqueda.toLowerCase();

    if (fAf !== 'Todos') nodos = nodos.filter(n => n.Afinidad === fAf);
    if (fCl !== 'Todos') nodos = nodos.filter(n => n.Clase && n.Clase.includes(fCl));
    if (fTx) nodos = nodos.filter(n => (n.Nombre && n.Nombre.toLowerCase().includes(fTx)) || (n.ID && n.ID.toLowerCase().includes(fTx)));

    let html = ``;
    nodos.sort((a,b) => {
        const hexA = parseInt(a.HEX) || 0; const hexB = parseInt(b.HEX) || 0;
        if (hexA !== hexB) return hexA - hexB;
        const tituloA = a.Nombre && a.Nombre.trim() !== "" ? a.Nombre : a.ID;
        const tituloB = b.Nombre && b.Nombre.trim() !== "" ? b.Nombre : b.ID;
        return (tituloA || "").localeCompare(tituloB || "");
    }).forEach(h => {
        const tituloPrincipal    = h.Nombre && h.Nombre.trim() !== "" ? h.Nombre : h.ID;
        const subTitulo          = h.ID ? `ID: ${h.ID}` : "Sin ID";
        const nombreSafeForButtons = safeStr(tituloPrincipal);
        const isOwned = invNombres.includes(textNorm(h.Nombre)) || invNombres.includes(textNorm(h.ID));

        const checkColaVis    = estadoUI.colaCambios.toggleConocido.slice().reverse().find(c => c.ID === h.ID || c.Nombre === h.Nombre);
        const isPublicBase    = h.Conocido && h.Conocido.toString().trim().toLowerCase() === 'si';
        const currentlyPublic = checkColaVis ? (checkColaVis.Estado === 'si') : isPublicBase;

        const col   = getColorAfinidad(h.Afinidad); const costo = parseInt(h.HEX) || 0;
        const btn   = isOwned
            ? `<button onclick="window.accionCola('quitar', '${nombreSafeForButtons}')" class="btn-nav" style="background:#4a0000; border-color:#ff0000; color:white; width:100%; margin-top:10px;">❌ QUITAR HECHIZO</button>`
            : `<button onclick="window.accionCola('agregar', '${nombreSafeForButtons}', '${h.Afinidad}', ${costo})" class="btn-nav" style="background:#004a00; border-color:#00ff00; color:white; width:100%; margin-top:10px;">➕ ASIGNAR</button>`;
        const btnVis = `<button onclick="window.toggleVisibilidad('${h.ID}', '${nombreSafeForButtons}', '${currentlyPublic ? 'no' : 'si'}')" class="btn-nav" style="background:#111; color:#aaa; border-color:#555; width:100%; margin-top:5px; font-size:0.8em; padding:5px;">${currentlyPublic ? '👁️ Ocultar Hechizo' : '🙈 Hacer Público'}</button>`;

        html += `<div class="spell-card" style="border-left:4px solid ${col.b}; ${isOwned ? 'box-shadow: inset 0 0 15px rgba(0,255,0,0.1);' : ''}">
                    <h3 style="color:${col.t}; margin-bottom:2px;">${tituloPrincipal}</h3>
                    <span style="display:block; color:#888; font-size:0.7em; font-style:italic; margin-bottom:10px;">${subTitulo}</span>
                    <div class="spell-tags">
                        <span class="spell-tag tag-hex">HEX: ${costo}</span>
                        <span class="spell-tag tag-clase">${h.Clase || '-'}</span>
                    </div>
                    ${btn}
                    ${btnVis}
                 </div>`;
    });
    document.getElementById('grid-gestion').innerHTML = html;
}

export function dibujarAprendizajeGrid() {
    const pj     = estadoUI.personajeSeleccionado;
    const grupos = obtenerHechizosAprendibles(pj);
    let html = ``;

    if(Object.keys(grupos).length === 0) {
        document.getElementById('grid-aprendizaje').innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#ff4444; font-size:1.2em;">No hay hechizos que cumplan con los precedentes actuales.</p>`;
        return;
    }

    Object.keys(grupos).forEach(reqStr => {
        html += `<h3 class="req-header">PRECEDENTES: <span style="color:#ccc;">${reqStr}</span></h3><div class="grid-inventario">`;
        grupos[reqStr].forEach(h => {
            const col   = getColorAfinidad(h.Afinidad); const costo = parseInt(h.HEX) || 0;
            const checkColaVis = estadoUI.colaCambios.toggleConocido.slice().reverse().find(c => c.ID === h.ID || c.Nombre === h.Nombre);
            const isPublicBase = h.Conocido && h.Conocido.toString().trim().toLowerCase() === 'si';
            const isKnown  = checkColaVis ? (checkColaVis.Estado === 'si') : isPublicBase;

            const titulo  = isKnown ? h.Nombre : h.ID;
            const res     = isKnown ? getValInfo(h, ['resumen', 'Resumen']) : '<i style="color:#ff4444;">Información Sellada (Hechizo no descubierto).</i>';
            const efe     = isKnown ? getValInfo(h, ['efecto', 'Efecto']) : '';
            const details = isKnown ? generarDetalles(h) : '';

            html += `<div class="spell-card" style="border: 2px dashed ${col.b}; background:rgba(10,20,30,0.5);">
                        <h3 style="color:${isKnown ? col.t : '#666'};">${titulo}</h3>
                        <div class="spell-tags">
                            <span class="spell-tag tag-hex">COSTE: ${costo}</span>
                            <span class="spell-tag" style="border-color:${col.b}; color:${col.t};">${h.Afinidad}</span>
                            <span class="spell-tag tag-clase">${h.Clase || '-'}</span>
                        </div>
                        <div class="spell-desc" style="${!isKnown ? 'background:#000; border-left-color:#333;' : ''}">${res}</div>
                        ${efe ? `<div class="spell-efecto">Efecto: <span style="color:var(--cyan-magic); font-weight:normal;">${efe}</span></div>` : ''}
                        ${details}
                     </div>`;
        });
        html += `</div>`;
    });
    document.getElementById('grid-aprendizaje').innerHTML = html;
}

export function dibujarCatalogoHechizos() {
    let nodosBrutos = [...(db.hechizos.nodos || []), ...(db.hechizos.nodosOcultos || [])];

    let mapUnicos = new Map();
    nodosBrutos.forEach(n => {
        const idKey = (n.ID || "").toString().trim().toLowerCase(); if (!idKey) return;
        if (!mapUnicos.has(idKey)) { mapUnicos.set(idKey, n); }
        else {
            const existente = mapUnicos.get(idKey);
            const esPlaceholder = (txt) => txt === "" || txt.toLowerCase().startsWith("hechizo");
            if (esPlaceholder((existente.Nombre || "").toString().trim()) && !esPlaceholder((n.Nombre || "").toString().trim())) mapUnicos.set(idKey, n);
        }
    });

    let nodos = Array.from(mapUnicos.values());
    const fAf = estadoUI.filtrosAll.afinidad; const fCl = estadoUI.filtrosAll.clase; const fEs = estadoUI.filtrosAll.estado; const fTx = estadoUI.filtrosAll.busqueda.toLowerCase();

    if (fAf !== 'Todos') nodos = nodos.filter(n => n.Afinidad === fAf);
    if (fCl !== 'Todos') nodos = nodos.filter(n => n.Clase && n.Clase.includes(fCl));
    if (fTx) nodos = nodos.filter(n => (n.Nombre && n.Nombre.toLowerCase().includes(fTx)) || (n.ID && n.ID.toLowerCase().includes(fTx)));

    let html = ``;
    nodos.sort((a,b) => {
        const hexA = parseInt(a.HEX) || 0; const hexB = parseInt(b.HEX) || 0;
        if (hexA !== hexB) return hexA - hexB;
        const tituloA = a.Nombre && a.Nombre.trim() !== "" ? a.Nombre : a.ID;
        const tituloB = b.Nombre && b.Nombre.trim() !== "" ? b.Nombre : b.ID;
        return (tituloA || "").localeCompare(tituloB || "");
    }).forEach(h => {
        const checkColaVis = estadoUI.colaCambios.toggleConocido.slice().reverse().find(c => c.ID === h.ID || c.Nombre === h.Nombre);
        const isPublicBase = h.Conocido && h.Conocido.toString().trim().toLowerCase() === 'si';
        const isKnown  = checkColaVis ? (checkColaVis.Estado === 'si') : isPublicBase;

        if (fEs === 'Descubierto' && !isKnown) return;
        if (fEs === 'Oculto'      &&  isKnown) return;

        const isHidden = !estadoUI.esAdmin && !isKnown;
        const col   = getColorAfinidad(h.Afinidad); const costo = parseInt(h.HEX) || 0;
        const tituloReal = h.Nombre && h.Nombre.trim() !== "" ? h.Nombre : h.ID;
        const titulo     = isHidden ? h.ID : tituloReal;
        const subTitulo  = (estadoUI.esAdmin && h.ID) ? `<span style="display:block; color:#888; font-size:0.7em; font-style:italic; margin-bottom:10px;">ID: ${h.ID}</span>` : '';

        const res         = isHidden ? '<i style="color:#ff4444;">Información Sellada (Hechizo no descubierto por el grupo).</i>' : getValInfo(h, ['resumen', 'Resumen']);
        const efe         = isHidden ? '' : getValInfo(h, ['efecto', 'Efecto']);
        const detailsHTML = isHidden ? '' : generarDetalles(h);
        const btnVis      = (estadoUI.esAdmin && h.Nombre) ? `<button onclick="window.toggleVisibilidad('${h.ID}', '${safeStr(h.Nombre)}', '${isKnown ? 'no' : 'si'}')" class="btn-nav" style="background:#111; color:#aaa; border-color:#555; width:100%; margin-top:10px; font-size:0.8em; padding:5px;">${isKnown ? '👁️ Ocultar Hechizo Globalmente' : '🙈 Hacer Público'}</button>` : '';

        html += `<div class="spell-card" style="border-top-color: ${col.b};">
                    <h3 style="color:${isHidden ? '#666' : col.t}; margin-bottom:2px;">${titulo}</h3>
                    ${subTitulo}
                    <div class="spell-tags">
                        <span class="spell-tag tag-hex">HEX: ${costo}</span>
                        <span class="spell-tag" style="border-color:${col.b}; color:${col.t};">${h.Afinidad}</span>
                        <span class="spell-tag tag-clase">${h.Clase || '-'}</span>
                    </div>
                    ${res ? `<div class="spell-desc" style="${isHidden ? 'background:#000; border-left-color:#333;' : ''}">${res}</div>` : ''}
                    ${efe ? `<div class="spell-efecto">Efecto: <span style="color:var(--cyan-magic); font-weight:normal;">${efe}</span></div>` : ''}
                    ${detailsHTML}
                    ${btnVis}
                 </div>`;
    });

    if (html === '') html = `<p style="grid-column:1/-1; color:#aaa; text-align:center;">No se encontraron hechizos con estos filtros.</p>`;
    document.getElementById('grid-catalogo-hechizos').innerHTML = html;
}
