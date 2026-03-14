import { invGlobal, objGlobal, statsGlobal, estadoUI } from './obj-state.js';

function drawnHEXPreserveFocus(containerId, html) {
    const activeId = document.activeElement ? document.activeElement.id : null;
    const start = document.activeElement ? document.activeElement.selectionStart : null;
    const end = document.activeElement ? document.activeElement.selectionEnd : null;
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = html;
        if (activeId && document.getElementById(activeId)) {
            const el = document.getElementById(activeId);
            el.focus(); if (el.setSelectionRange) el.setSelectionRange(start, end);
        }
    }
}

const raridadValor = { "Legendario": 3, "Raro": 2, "Común": 1, "-": 0 };
const normalizarNombre = (str) => str ? str.toString().trim().toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/\s+/g,'_').replace(/[^a-z0-9ñ_]/g,'') : "";

// BUSCADOR INTELIGENTE: Soluciona el problema de mayúsculas (Ej: LINDA vs Linda)
const getPjStats = (nombre) => {
    const key = Object.keys(statsGlobal).find(k => k.toLowerCase() === nombre.toLowerCase());
    return key ? statsGlobal[key] : { isPlayer: false, isActive: true, iconoOverride: "" };
};

export function refrescarUI() { 
    // CONGELADOR DE ORDEN GENERAL (Se activa al cambiar de pestaña)
    if (estadoUI.resetCacheOrder) {
        estadoUI.cachedSortKeys = Object.keys(objGlobal).sort((a, b) => (invGlobal[estadoUI.jugadorInv]?.[b]||0) - (invGlobal[estadoUI.jugadorInv]?.[a]||0) || a.localeCompare(b));
        estadoUI.cachedInvOrders = {};
        Object.keys(invGlobal).forEach(j => {
            estadoUI.cachedInvOrders[j] = Object.keys(invGlobal[j]).filter(o => invGlobal[j][o] > 0).sort();
        });
        estadoUI.resetCacheOrder = false;
    }

    if (estadoUI.vistaActual === 'grilla') dibujarGrillaPersonajes();
    else if (estadoUI.vistaActual === 'inventario') dibujarInventarios();
    else if (estadoUI.vistaActual === 'resumen') dibujarResumenVisual();
    else if (estadoUI.vistaActual === 'catalogo') dibujarCatalogo(); 
    else if (estadoUI.vistaActual === 'control') dibujarControl();
    else if (estadoUI.vistaActual === 'op-menu') dibujarMenuOP();
    else if (estadoUI.vistaActual === 'crear') dibujarCreacionObjeto();
    else if (estadoUI.vistaActual === 'crear-multi') dibujarCreacionMulti();
    else if (estadoUI.vistaActual === 'party-loot') dibujarPartyLoot();
    else if (estadoUI.vistaActual === 'transfer') dibujarTransferencia();
}

export function dibujarGrillaPersonajes() {
    estadoUI.filtroRol = estadoUI.filtroRol || 'Jugadores';
    estadoUI.filtroAct = estadoUI.filtroAct || 'Activos';

    let html = `
    <h2 style="margin-top:0; text-align:center; font-family:'Cinzel'; color:var(--gold);">Inventarios de Personajes</h2>
    <div style="display:flex; justify-content:center; gap:20px; margin-bottom:30px; flex-wrap:wrap; border-bottom:2px solid #222; padding-bottom:15px; background: rgba(0,0,0,0.4); padding: 15px; border-radius: 8px;">
        <div class="filter-group" style="margin:0; display:flex; gap:10px;">
            <button onclick="window.setFiltro('rol', 'Todos')" class="${estadoUI.filtroRol === 'Todos' ? 'btn-active' : ''}">👥 Todos</button>
            <button onclick="window.setFiltro('rol', 'Jugadores')" class="${estadoUI.filtroRol === 'Jugadores' ? 'btn-active' : ''}">⚔️ Jugadores</button>
            <button onclick="window.setFiltro('rol', 'NPCs')" class="${estadoUI.filtroRol === 'NPCs' ? 'btn-active' : ''}">🎭 NPCs</button>
        </div>
        <div class="filter-group" style="margin:0; display:flex; gap:10px;">
            <button onclick="window.setFiltro('act', 'Todos')" class="${estadoUI.filtroAct === 'Todos' ? 'btn-active' : ''}">🌟 Ambos</button>
            <button onclick="window.setFiltro('act', 'Activos')" class="${estadoUI.filtroAct === 'Activos' ? 'btn-active' : ''}">🟢 Activos</button>
            <button onclick="window.setFiltro('act', 'Inactivos')" class="${estadoUI.filtroAct === 'Inactivos' ? 'btn-active' : ''}">🔴 Inactivos</button>
        </div>
    </div>
    <div class="catalogo-grid">`;
    
    const getSortValue = (p) => { if (p.isPlayer && p.isActive) return 1; if (!p.isPlayer && p.isActive) return 2; if (!p.isPlayer && !p.isActive) return 3; if (p.isPlayer && !p.isActive) return 4; return 5; };
    
    const sortedNames = Object.keys(statsGlobal).sort((a, b) => { 
        const valA = getSortValue(statsGlobal[a]); const valB = getSortValue(statsGlobal[b]); 
        if (valA !== valB) return valA - valB; 
        return a.localeCompare(b); 
    });

    sortedNames.forEach(j => {
        const p = statsGlobal[j];
        if (estadoUI.filtroRol === 'Jugadores' && !p.isPlayer) return; 
        if (estadoUI.filtroRol === 'NPCs' && p.isPlayer) return;
        if (estadoUI.filtroAct === 'Activos' && !p.isActive) return; 
        if (estadoUI.filtroAct === 'Inactivos' && p.isActive) return;

        let countComun = 0, countRaro = 0, countLeg = 0;
        
        if(invGlobal[j]) {
            Object.keys(invGlobal[j]).forEach(o => {
                if (invGlobal[j][o] > 0) {
                    const rar = objGlobal[o] ? objGlobal[o].rar : 'Común';
                    if (rar === 'Legendario') countLeg += invGlobal[j][o];
                    else if (rar === 'Raro') countRaro += invGlobal[j][o];
                    else countComun += invGlobal[j][o];
                }
            });
        }
        
        const jSafe = j.replace(/'/g, "\\'"); 
        const iconoMuestra = normalizarNombre(p.iconoOverride || j);
        
        let borderStyle = ""; let bgStyle = "background: #11001c;"; 
        if (p.isPlayer && p.isActive) { borderStyle = "border: 2px solid var(--gold); box-shadow: 0 4px 15px rgba(212, 175, 55, 0.2);"; } 
        else if (!p.isPlayer && p.isActive) { borderStyle = "border: 2px solid #00ffff; box-shadow: 0 4px 10px rgba(0, 255, 255, 0.1);"; bgStyle = "background: #060b19;"; } 
        else if (!p.isPlayer && !p.isActive) { borderStyle = "border: 2px solid #444;"; bgStyle = "background: #0a0a0a;"; } 
        else if (p.isPlayer && !p.isActive) { borderStyle = "border: 2px solid #cc0000; box-shadow: 0 4px 10px rgba(204, 0, 0, 0.2);"; bgStyle = "background: #1a0000;"; }

        const claseInactiva = p.isActive ? '' : 'inactive-card';

        html += `
        <div class="char-card player-card ${claseInactiva}" style="${borderStyle} ${bgStyle} padding: 15px; border-radius: 12px; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'" onclick="window.abrirInventario('${jSafe}')">
            <img src="../img/imgpersonajes/${iconoMuestra}icon.png" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,0.2); margin-bottom: 10px;" onerror="this.src='../img/imgobjetos/no_encontrado.png'">
            <h3 style="margin: 0 0 10px 0; font-family: 'Cinzel', serif; font-size: 1.2em; text-transform: uppercase;">${j}</h3>
            <div style="background: rgba(0,0,0,0.5); padding: 8px; border-radius: 6px;">
                <p style="margin: 0; font-size: 0.85em; color: #ddd;">Comunes: <strong style="color: white;">${countComun}</strong></p>
                <p style="margin: 5px 0 0 0; font-size: 0.85em; color: #ddd;">Raros: <strong style="color: #8a2be2;">${countRaro}</strong> | Legendarios: <strong style="color: var(--gold);">${countLeg}</strong></p>
            </div>
        </div>`;
    });
    html += `</div>`;
    
    const container = document.getElementById('contenedor-grilla');
    if(container) container.innerHTML = html;
}

export function dibujarResumenVisual() {
    let html = `<h2 style="margin-top:0;">Resumen del Equipo del Grupo</h2>`;
    
    Object.keys(invGlobal).sort().forEach(j => {
        let itemsHtml = '';
        
        // Usamos el caché de orden. Añadimos objetos nuevos si recibieron stock en esta vista.
        let frozenKeys = estadoUI.cachedInvOrders[j] || [];
        Object.keys(invGlobal[j]).forEach(k => { if (invGlobal[j][k] > 0 && !frozenKeys.includes(k)) frozenKeys.push(k); });

        frozenKeys.forEach(o => {
            const count = invGlobal[j][o];
            if (count > 0) {
                const info = objGlobal[o] || {};
                const imgFile = normalizarNombre(o);
                const tooltipText = `<span>${o}</span>Tipo: ${info.tipo}<br>Rareza: ${info.rar}<br><br>${info.eff}`;
                
                // Botones +/- en modo OP
                let badgeHTML = '';
                if(estadoUI.esAdmin) {
                    badgeHTML = `
                    <div class="badge-op">
                        <button class="minus" onclick="window.hexMod('${j}','${o.replace(/'/g, "\\'")}',-1); event.stopPropagation();">-</button>
                        <span>${count}</span>
                        <button class="plus" onclick="window.hexMod('${j}','${o.replace(/'/g, "\\'")}',1); event.stopPropagation();">+</button>
                    </div>`;
                } else {
                    badgeHTML = `<div class="badge-normal">${count}</div>`;
                }

                itemsHtml += `
                <div class="hex-tooltip img-stack" onclick="window.verImagen('../img/imgobjetos/${imgFile}.png')">
                    <img src="../img/imgobjetos/${imgFile}.png" onerror="this.src='../img/imgobjetos/no_encontrado.png'" alt="${o}">
                    ${badgeHTML}
                    <div class="tooltiptext">${tooltipText}</div>
                </div>`;
            }
        });

        if(itemsHtml !== '') {
            html += `
            <div class="resumen-row">
                <div class="resumen-left">
                    <img src="../img/imgpersonajes/${normalizarNombre(j)}icon.png" onerror="this.src='../img/imgobjetos/no_encontrado.png'" style="width:75px; height:75px; border-radius:50%; border:2px solid var(--gold); object-fit:cover;">
                    <h3 style="margin:8px 0 0 0; font-size:1em; color:var(--gold);">${j.toUpperCase()}</h3>
                </div>
                <div class="resumen-right">
                    ${itemsHtml}
                </div>
            </div>`;
        }
    });
    
    drawnHEXPreserveFocus('contenedor-resumen', html || '<p style="text-align:center; color:#aaa;">Nadie tiene objetos todavía.</p>');
}

export function dibujarInventarios() {
    if (!estadoUI.jugadorInv) return;
    const j = estadoUI.jugadorInv;
    const term = (estadoUI.busquedaInv || "").toLowerCase();
    
    const linkStats = `../estadisticas/index.html?pj=${encodeURIComponent(j)}`;
    
    let html = `
    <button onclick="window.volverAGrilla()" style="background:#444; margin-bottom: 20px;">⬅ Volver a Inventarios</button>
    <div class="player-header">
        <a href="${linkStats}" target="_blank" title="Ver ficha de estado de ${j}" style="display:flex;">
            <img src="../img/imgpersonajes/${normalizarNombre(j)}icon.png" class="player-icon" onerror="this.src='../img/imgobjetos/no_encontrado.png'">
        </a>
        <div style="text-align:left; flex:1;">
            <a href="${linkStats}" target="_blank" style="text-decoration:none;" title="Ver ficha de estado de ${j}">
                <h1 style="margin: 0; color:var(--gold); cursor:pointer;">${j.toUpperCase()}</h1>
            </a>
        </div>
        ${estadoUI.esAdmin ? `<button onclick="window.mostrarPagina('control')" style="background:#4a004a; border-color:var(--gold);">⚙️ Panel Control Masivo</button>` : ''}
    </div>
    <input type="text" id="busq-inv" class="search-bar" placeholder="🔍 Filtrar equipo..." value="${estadoUI.busquedaInv}" oninput="window.setBusquedaInv(this.value)">`;

    let frozenKeys = estadoUI.cachedInvOrders[j] || [];
    Object.keys(invGlobal[j]).forEach(k => { if (invGlobal[j][k] > 0 && !frozenKeys.includes(k)) frozenKeys.push(k); });

    const destacados = frozenKeys
        .filter(o => invGlobal[j][o] > 0 && (!term || o.toLowerCase().includes(term)))
        .sort((a, b) => (raridadValor[objGlobal[b]?.rar] || 0) - (raridadValor[objGlobal[a]?.rar] || 0))
        .slice(0, 5);

    if (destacados.length > 0) {
        html += `<div class="top-items-grid">`;
        destacados.forEach(o => {
            const imgFile = normalizarNombre(o);
            const rarClase = objGlobal[o]?.rar === 'Raro' ? 'rarity-raro' : (objGlobal[o]?.rar === 'Legendario' ? 'rarity-legendario' : '');
            const oSafe = o.replace(/'/g, "\\'");
            html += `
            <div class="top-item-card ${rarClase}">
                <img src="../img/imgobjetos/${imgFile}.png" onclick="window.verImagen(this.src)" onerror="this.src='../img/imgobjetos/no_encontrado.png'">
                <span style="font-size:0.65em; display:block; height:2.4em; overflow:hidden; color:#d4af37; cursor:pointer;" onclick="window.verImagenByName('${oSafe}')">${o}</span>
            </div>`;
        });
        html += `</div><hr style="border:0; border-top:1px solid rgba(212,175,55,0.2); margin:20px 0;">`;
    }

    html += `<div class="table-responsive"><table><tr><th>Imagen</th><th>Objeto</th><th>Efecto</th><th>Cant</th></tr>`;
    frozenKeys.forEach(o => {
        if (invGlobal[j][o] > 0 && (!term || o.toLowerCase().includes(term))) {
            const oSafe = o.replace(/'/g, "\\'");
            
            const cantHTML = estadoUI.esAdmin 
                ? `<div style="display:flex; justify-content:center; align-items:center; gap:8px;">
                     <button class="btn-inline-op minus" onclick="window.hexMod('${j}','${oSafe}',-1)">-</button>
                     <b style="font-size:1.3em; width:20px;">${invGlobal[j][o]}</b>
                     <button class="btn-inline-op plus" onclick="window.hexMod('${j}','${oSafe}',1)">+</button>
                   </div>`
                : `<b style="font-size:1.2em">${invGlobal[j][o]}</b>`;

            html += `<tr>
                <td><img src="../img/imgobjetos/${normalizarNombre(o)}.png" class="cat-img" onclick="window.verImagen(this.src)" onerror="this.src='../img/imgobjetos/no_encontrado.png'"></td>
                <td style="font-weight:bold; color:#d4af37; cursor:pointer;" onclick="window.verImagenByName('${oSafe}')">${o}</td>
                <td style="text-align:left; font-size:0.85em;">${objGlobal[o]?.eff || ''}</td>
                <td>${cantHTML}</td>
            </tr>`;
        }
    });
    html += "</table></div>";
    
    drawnHEXPreserveFocus('contenedor-jugadores', html);
}

export function dibujarCatalogo() {
    let html = "<h2>Catálogo Completo</h2><div class='filter-group'>";
    ['Todos', 'Común', 'Raro', 'Legendario'].forEach(r => {
        const active = estadoUI.filtroRar === r ? 'class="btn-active"' : '';
        html += `<button onclick="window.setRar('${r}')" ${active}>${r}</button> `;
    });
    html += "</div><div class='filter-group'>";
    ['Todos', 'Orgánico', 'Cristal', 'Metal', 'Sagrado'].forEach(m => {
        const active = estadoUI.filtroMat === m ? 'class="btn-active-mat"' : '';
        html += `<button onclick="window.setMat('${m}')" ${active}>${m}</button> `;
    });
    html += `</div><br><input type="text" id="busq-cat" class="search-bar" placeholder="🔍 Buscar objeto..." value="${estadoUI.busquedaCat}" oninput="window.setBusquedaCat(this.value)">
    <div class="table-responsive"><table><tr><th>Imagen</th><th>Nombre</th><th>Tipo</th><th>Efecto</th><th>Rareza</th></tr>`;
    
    const term = (estadoUI.busquedaCat || "").toLowerCase();
    Object.keys(objGlobal).sort().forEach(o => {
        const item = objGlobal[o];
        const matchR = estadoUI.filtroRar === 'Todos' || item.rar.trim() === estadoUI.filtroRar;
        const matchM = estadoUI.filtroMat === 'Todos' || item.mat.trim() === estadoUI.filtroMat;
        
        if (matchR && matchM && (!term || o.toLowerCase().includes(term))) {
            const oSafe = o.replace(/'/g, "\\'");
            html += `<tr>
                <td><img src="../img/imgobjetos/${normalizarNombre(o)}.png" class="cat-img" onclick="window.verImagen(this.src)" onerror="this.src='../img/imgobjetos/no_encontrado.png'"></td>
                <td style="font-weight:bold; color:#d4af37; cursor:pointer;" onclick="window.verImagenByName('${oSafe}')">${o}</td>
                <td style="font-size:0.85em; color:#aaa;">${item.tipo}</td>
                <td style="text-align:left; font-size:0.85em;">${item.eff}</td>
                <td style="font-size:0.85em;">${item.rar}</td>
            </tr>`;
        }
    });
    drawnHEXPreserveFocus('tabla-todos-objetos', html + "</table></div>");
}

export function dibujarMenuOP() {
    document.getElementById('menu-op-central').innerHTML = `
        <h2 style="margin-top:0;">Panel OP Maestro</h2>
        <div class="op-grid">
            <button onclick="window.mostrarPagina('party-loot')" style="background:#b8860b; color:#000;">Repartir Loot a Party</button>
            <button onclick="window.mostrarPagina('transfer')" style="background:#1a4b8c; color:#fff;">Mercado de Transferencias</button>
            <button onclick="window.mostrarPagina('crear')" style="background:#4a004a">Creación Rápida (1)</button>
            <button onclick="window.mostrarPagina('crear-multi')" style="background:#600060">Forja Múltiple (6)</button>
            <button onclick="window.descargarInventariosJPG()" style="background:#8b0000">Descargar todos los JPGs</button>
            <button onclick="window.descargarLogExcel()" style="background:#107c41; color:#fff;">Descargar Log (Excel)</button>
            <button onclick="window.descargarEstadoExcel()" style="background:#107c41; color:#fff;">Descargar Stock (Excel)</button>
        </div>`;
}

export function dibujarControl() {
    if (!estadoUI.jugadorInv) return; const j = estadoUI.jugadorInv; 
    
    let currentKeys = estadoUI.cachedInvOrders[j] || [];
    Object.keys(invGlobal[j]).forEach(k => {
         if (invGlobal[j][k] > 0 && !currentKeys.includes(k)) currentKeys.push(k);
    });

    let html = `<h2>Edición In-Situ: ${j}</h2><button onclick="window.mostrarPagina('inventario')" style="background:#444; margin-bottom: 20px;">⬅ Volver al Inventario</button>`;
    
    html += `<h3 style="color:var(--gold); margin-top:10px;">Inventario Actual (Click para modificar)</h3>
             <div style="background:#0a0014; padding:15px; border:1px solid var(--gold); border-radius:8px; margin-bottom:20px; display:flex; flex-wrap:wrap; gap:10px; justify-content:center;">`;
    
    let hasItems = false;
    const actionColor = estadoUI.editModo === 1 ? '#00ff00' : '#ff0000';
    
    currentKeys.forEach(o => {
        if (invGlobal[j][o] > 0) {
            const oSafe = o.replace(/'/g, "\\'");
            html += `<button onclick="window.hexMod('${j}','${oSafe}', ${estadoUI.editMult * estadoUI.editModo})" 
                             style="background:#222; padding:5px 12px; border-radius:4px; border:1px solid #444; font-size:0.9em; box-shadow:0 2px 4px #000; cursor:pointer; transition:0.2s;" 
                             onmouseover="this.style.borderColor='${actionColor}'" onmouseout="this.style.borderColor='#444'" title="Haz clic para modificar">
                        ${o}: <b style="color:var(--gold); font-size:1.3em; margin-left:5px;">${invGlobal[j][o]}</b>
                     </button>`;
            hasItems = true;
        }
    });
    if(!hasItems) html += `<span style="color:#666;">El inventario está vacío.</span>`;
    html += `</div>`;

    html += `<div class="container-hex" style="margin-bottom:20px; background:#1a0033; padding:15px; border:1px dashed #d4af37;">
                <textarea id="copy-log-stock" class="search-bar" readonly style="width:95%; height:80px; font-size:0.85em; margin-bottom:10px;">${estadoUI.logCopy || 'Bitácora de sesión...'}</textarea>
                <div style="display:flex; gap:10px;"><button onclick="window.copyToClipboard('copy-log-stock')" style="flex:3; background:#d4af37; color:#120024; font-weight:bold;">COPIAR REGISTRO TOTAL</button><button onclick="window.limpiarLog()" style="flex:1; background:#8b0000; color:white;">X</button></div>
             </div>
             
             <h3 style="color:var(--gold); margin-top:20px; border-bottom:1px solid #333; padding-bottom:10px;">Catálogo (Haz clic en la imagen)</h3>
             <div style="display:flex; justify-content:center; gap:10px; margin-bottom:10px; margin-top:15px;">
                <button onclick="window.setEditModo(1)" style="background:${estadoUI.editModo === 1 ? '#004a00' : '#222'}">MODO SUMAR (+)</button>
                <button onclick="window.setEditModo(-1)" style="background:${estadoUI.editModo === -1 ? '#660000' : '#222'}">MODO RESTAR (-)</button>
             </div>
             <div style="display:flex; justify-content:center; gap:10px; margin-bottom:20px; flex-wrap:wrap;">
                ${[1, 5, 10, 50, 100].map(m => `<button onclick="window.setEditMult(${m})" style="background:${estadoUI.editMult === m ? 'var(--gold)' : '#222'}; color:${estadoUI.editMult === m ? '#000' : '#fff'}">x${m}</button>`).join('')}
             </div>
             
             <input type="text" id="busq-op" class="search-bar" placeholder="🔍 Filtrar objeto y haz clic en la imagen..." value="${estadoUI.busquedaOP}" oninput="window.setBusquedaOP(this.value)">
             <div class="grid-control">`;
    
    estadoUI.cachedSortKeys.forEach(o => {
        const term = estadoUI.busquedaOP.toLowerCase();
        if (!term || o.toLowerCase().includes(term)) {
            const c = invGlobal[j][o] || 0;
            const oSafe = o.replace(/'/g, "\\'");
            html += `<div class="control-card ${c > 0 ? "item-con-stock" : ""}">
                        <img src="../img/imgobjetos/${normalizarNombre(o)}.png" 
                             onclick="window.hexMod('${j}','${oSafe}', ${estadoUI.editMult * estadoUI.editModo})" 
                             style="width:80px; height:80px; object-fit:cover; cursor:pointer; border-radius:8px; border:2px solid ${actionColor}; transition:0.2s; box-shadow:0 0 10px ${actionColor};"
                             onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"
                             onerror="this.src='../img/imgobjetos/no_encontrado.png'" title="Click para aplicar">
                        <span class="item-name" style="margin-top:10px;">${o}</span>
                     </div>`;
        }
    });
    drawnHEXPreserveFocus('panel-interactivo', html + "</div>");
}

export function dibujarTransferencia() {
    let html = `<h2>Mercado de Transferencias</h2>
                <button onclick="window.mostrarPagina('op-menu')" style="background:#444; margin-bottom: 20px;">⬅ Volver al Panel OP</button>
                <div style="display:flex; justify-content:center; gap:20px; align-items:center; flex-wrap:wrap; background:#1a0033; padding:20px; border-radius:8px; border:1px dashed var(--blue-life);">
                    <div style="text-align:center;">
                        <h4 style="color:#ff4d4d; margin:0 0 10px 0;">QUITAR DE (Origen)</h4>
                        <select id="trans-origen" class="search-bar" onchange="window.setTransOrigen(this.value)" style="width:200px; background:#4a0000;">
                            <option value="">-- Selecciona --</option>
                            ${Object.keys(invGlobal).sort().map(j => `<option value="${j}" ${estadoUI.transOrigen === j ? 'selected' : ''}>${j}</option>`).join('')}
                        </select>
                    </div>
                    <div style="font-size:2em; color:var(--gold);">➡</div>
                    <div style="text-align:center;">
                        <h4 style="color:#00ff00; margin:0 0 10px 0;">ENTREGAR A (Destino)</h4>
                        <select id="trans-destino" class="search-bar" onchange="window.setTransDestino(this.value)" style="width:200px; background:#004a00;">
                            <option value="">-- Selecciona --</option>
                            ${Object.keys(invGlobal).sort().map(j => `<option value="${j}" ${estadoUI.transDestino === j ? 'selected' : ''}>${j}</option>`).join('')}
                        </select>
                    </div>
                </div>`;
                
    if (estadoUI.transOrigen && estadoUI.transDestino) {
        if (estadoUI.transOrigen === estadoUI.transDestino) {
            html += `<h3 style="color:red; margin-top:20px;">El origen y el destino no pueden ser el mismo.</h3>`;
        } else {
            const j = estadoUI.transOrigen;
            const term = (estadoUI.busquedaOP || "").toLowerCase();
            
            html += `<div class="container-hex" style="margin-top:20px; background:#1a0033; padding:15px; border:1px dashed #d4af37;">
                        <textarea id="copy-log-trans" class="search-bar" readonly style="width:95%; height:80px; font-size:0.85em; margin-bottom:10px;">${estadoUI.logCopy || 'Bitácora de sesión...'}</textarea>
                        <div style="display:flex; gap:10px;"><button onclick="window.copyToClipboard('copy-log-trans')" style="flex:3; background:#d4af37; color:#120024; font-weight:bold;">COPIAR REGISTRO TOTAL</button><button onclick="window.limpiarLog()" style="flex:1; background:#8b0000; color:white;">X</button></div>
                     </div>
                     
                     <h4 style="color:var(--blue-life); margin-top:20px;">1. Selecciona Cuántos Quieres Pasar</h4>
                     <div style="display:flex; justify-content:center; gap:10px; margin-bottom:20px; flex-wrap:wrap;">
                        ${[1, 3, 5, 10, 50, 'TODO'].map(m => `<button onclick="window.setTransMult('${m}')" style="background:${estadoUI.transMult === m ? 'var(--gold)' : '#222'}; color:${estadoUI.transMult === m ? '#000' : '#fff'}">x${m}</button>`).join('')}
                     </div>

                     <h3 style="color:var(--gold);">2. Haz clic en la IMAGEN del inventario de ${j} para transferir</h3>
                     <input type="text" id="busq-op" class="search-bar" placeholder="🔍 Filtrar objeto a transferir..." value="${estadoUI.busquedaOP}" oninput="window.setBusquedaOP(this.value)">
                     <div class="grid-control">`;
            
            Object.keys(invGlobal[j]).sort().forEach(o => {
                if (invGlobal[j][o] > 0 && (!term || o.toLowerCase().includes(term))) {
                    const c = invGlobal[j][o];
                    const cantToPass = estadoUI.transMult === 'TODO' ? c : estadoUI.transMult;
                    const oSafe = o.replace(/'/g, "\\'");
                    html += `<div class="control-card item-con-stock">
                                <img src="../img/imgobjetos/${normalizarNombre(o)}.png" 
                                     onclick="window.ejecutarTransfer('${oSafe}', ${cantToPass})" 
                                     style="width:80px; height:80px; object-fit:cover; cursor:pointer; border-radius:8px; border:2px solid #00ff00; transition:0.2s; box-shadow:0 0 10px #00ff00;"
                                     onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"
                                     onerror="this.src='../img/imgobjetos/no_encontrado.png'" title="Clic para Transferir ${cantToPass}">
                                <span class="item-name" style="margin-top:10px;">${o}</span>
                                <span style="font-size:1.1em; color:white;">Stock: <b>${c}</b></span>
                             </div>`;
                }
            });
            html += `</div>`;
        }
    }
    drawnHEXPreserveFocus('panel-transferencia', html);
}

export function dibujarPartyLoot() {
    const term = (estadoUI.busquedaOP || "").toLowerCase();

    let html = `<h2>Loot Rápido para la Party</h2>
                <button onclick="window.mostrarPagina('op-menu')" style="background:#444; margin-bottom: 20px;">⬅ Volver al Panel OP</button>
                <div style="background:#1a0033; padding:20px; border-radius:8px; border:1px dashed var(--gold); margin-bottom:20px;">
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #444; padding-bottom:10px; flex-wrap:wrap; gap:10px;">
                        <h4 style="color:var(--gold); margin:0;">1. Selecciona los destinatarios</h4>
                        <div style="display:flex; gap:10px;">
                            <button onclick="window.seleccionarTodosJugadores()" style="background:#1a365d; color:white; border:1px solid #4a90e2; padding:5px 10px; border-radius:4px; cursor:pointer;">Todos los Jugadores</button>
                            <button onclick="window.seleccionarTodosNPCs()" style="background:#330000; color:white; border:1px solid #ff1744; padding:5px 10px; border-radius:4px; cursor:pointer;">Todos los NPCs</button>
                            <button onclick="window.toggleMostrarNPCsLoot()" style="background:#222; color:white; border:1px solid var(--gold); padding:5px 10px; border-radius:4px; cursor:pointer;">
                                ${estadoUI.mostrarNPCsLoot ? '👁️ Ocultar NPCs' : '🎭 Mostrar NPCs'}
                            </button>
                        </div>
                    </div>

                    <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center;">`;
    
    Object.keys(invGlobal).sort().forEach(j => {
        const p = getPjStats(j);
        if (!estadoUI.mostrarNPCsLoot && !p.isPlayer) return;

        const isChecked = estadoUI.partyLoot.includes(j) ? 'checked' : '';
        const colorTexto = p.isPlayer ? '#fff' : '#aaa';

        html += `<label style="background:#000; padding:10px; border:1px solid #444; border-radius:4px; cursor:pointer; color:${colorTexto};">
                    <input type="checkbox" ${isChecked} onchange="window.togglePartyLoot('${j}', this.checked)"> 
                    <img src="../img/imgpersonajes/${normalizarNombre(p.iconoOverride || j)}icon.png" style="width:24px; height:24px; border-radius:50%; vertical-align:middle; margin-right:5px;" onerror="this.src='../img/imgobjetos/no_encontrado.png'">
                    ${j}
                 </label>`;
    });

    html += `   </div>
                <h4 style="color:var(--blue-life); margin-top:20px;">2. Multiplicador de Entrega (Por Clic)</h4>
                <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">`;
    
    [1, 5, 10, 50, 100].forEach(m => {
        html += `<button onclick="window.setPartyMult(${m})" style="background:${estadoUI.partyMult === m ? 'var(--gold)' : '#222'}; color:${estadoUI.partyMult === m ? '#000' : '#fff'}">x${m}</button>`;
    });

    html += `   </div>
            </div>
            
            <div class="container-hex" style="margin-bottom:20px; background:#1a0033; padding:15px; border:1px dashed #d4af37;">
                <textarea id="copy-log-loot" class="search-bar" readonly style="width:95%; height:80px; font-size:0.85em; margin-bottom:10px;"></textarea>
                <div style="display:flex; gap:10px;"><button onclick="window.copyToClipboard('copy-log-loot')" style="flex:3; background:#d4af37; color:#120024; font-weight:bold;">COPIAR REGISTRO</button><button onclick="window.limpiarLog()" style="flex:1; background:#8b0000; color:white;">X</button></div>
            </div>
            
            <h4 style="color:var(--gold);">3. Haz clic en la IMAGEN de un objeto para entregar <span style="color:white;">x${estadoUI.partyMult}</span></h4>
            <input type="text" id="busq-op" class="search-bar" placeholder="🔍 Buscar objeto..." value="${estadoUI.busquedaOP}" oninput="window.setBusquedaOP(this.value)">
            <div class="grid-control">`;

    estadoUI.cachedSortKeys.forEach(o => {
        if (!term || o.toLowerCase().includes(term)) {
            html += `<div class="control-card">
                        <img src="../img/imgobjetos/${normalizarNombre(o)}.png" 
                             onclick="window.giveLootToParty('${o.replace(/'/g, "\\'")}')" 
                             style="width:80px; height:80px; object-fit:cover; border:2px solid var(--gold); border-radius:8px; background:#000; cursor:pointer; transition:0.2s;" 
                             onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"
                             onerror="this.src='../img/imgobjetos/no_encontrado.png'">
                        <span class="item-name" style="margin-top:10px; color:#fff;">${o}</span>
                     </div>`;
        }
    });

    drawnHEXPreserveFocus('panel-party-loot', html + `</div>`);
}

function generarDatalistsDinamicos() {
    const tipos = new Set(['Consumible', 'Herramienta', 'Accesorio', 'Equipo']);
    const mats = new Set(['Cristal', 'Metal', 'Orgánico', 'Sagrado']);
    const rars = new Set(['Común', 'Raro', 'Legendario']);

    Object.values(objGlobal).forEach(obj => {
        if (obj.tipo && obj.tipo !== '-') tipos.add(obj.tipo.trim());
        if (obj.mat && obj.mat !== '-') mats.add(obj.mat.trim());
        if (obj.rar && obj.rar !== '-') rars.add(obj.rar.trim());
    });

    return `
        <datalist id="dl-tipos">${[...tipos].sort().map(t => `<option value="${t}">`).join('')}</datalist>
        <datalist id="dl-mats">${[...mats].sort().map(m => `<option value="${m}">`).join('')}</datalist>
        <datalist id="dl-rars">${[...rars].sort().map(r => `<option value="${r}">`).join('')}</datalist>
    `;
}

export function dibujarCreacionObjeto() {
    let html = `
    ${generarDatalistsDinamicos()}
    <h2>Creación Rápida (1 Objeto)</h2>
    <div class="container-hex" style="max-width:600px; background:rgba(30,0,60,0.9); padding:20px; border:1px solid #d4af37; border-radius:8px; margin:0 auto;">
        <input type="text" id="new-obj-name" class="search-bar" placeholder="Nombre del Objeto..." oninput="window.updateCreationLog()" style="width:95%">
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
            <input type="text" id="new-obj-tipo" list="dl-tipos" class="search-bar" style="width:100%" placeholder="Tipo (Ej: Consumible)" value="">
            <input type="text" id="new-obj-mat" list="dl-mats" class="search-bar" style="width:100%" placeholder="Material (Ej: Metal)" value="">
        </div>
        
        <textarea id="new-obj-eff" class="search-bar" placeholder="Efecto o Descripción..." oninput="window.updateCreationLog()" style="width:95%; height:60px; margin-top:10px; resize:none;"></textarea>
        
        <input type="text" id="new-obj-rar" list="dl-rars" class="search-bar" style="width:95%; margin-top:10px;" placeholder="Rareza (Ej: Común)" value="">
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:25px; margin-bottom:10px; border-bottom:1px solid #444; padding-bottom:10px;">
            <h3 style="margin:0; font-size:1em; color:var(--gold);">Entregar a (Opcional)</h3>
            <button onclick="window.toggleMostrarNPCs()" style="background:#222; color:#fff; border:1px solid var(--gold); border-radius:4px; padding:5px 10px; font-size:0.85em; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='#222'">
                ${estadoUI.mostrarNPCsCrea ? '👁️ Ocultar NPCs' : '🎭 Mostrar NPCs'}
            </button>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">`;
    
    Object.keys(invGlobal).sort().forEach(j => {
        const p = getPjStats(j);
        if (!estadoUI.mostrarNPCsCrea && !p.isPlayer) return;

        html += `<div style="text-align:left; font-size:0.8em; border-bottom:1px solid #333; padding:5px; display:flex; justify-content:space-between; align-items:center;">
                    <label style="color:${p.isPlayer ? 'white' : '#aaa'};">${j}:</label>
                    <input type="number" class="cant-input" data-player="${j}" value="" placeholder="0" min="0" oninput="window.updateCreationLog()" style="width:60px; background:#000; color:white; border:1px solid #555; text-align:center;">
                 </div>`;
    });
    
    html += `</div>
        <div style="margin-top:20px; background:#1a0033; padding:15px; border:1px dashed #d4af37;">
            <textarea id="copy-log-crea" class="search-bar" readonly style="width:95%; height:80px; font-size:0.85em; margin-bottom:10px; resize:none;"></textarea>
            <button onclick="window.copyToClipboard('copy-log-crea')" style="width:100%; background:#d4af37; color:#120024; font-weight:bold; cursor:pointer;">COPIAR REGISTRO</button>
        </div>
        <button onclick="window.ejecutarAgregarObjeto()" style="width:100%; margin-top:20px; background:#006400; font-weight:bold; padding:12px; cursor:pointer;">FORJAR Y REPARTIR</button>
        <button onclick="window.mostrarPagina('op-menu')" style="width:100%; margin-top:10px; background:#444; padding:12px; cursor:pointer;">CANCELAR</button>
    </div>`;
    drawnHEXPreserveFocus('panel-creacion', html);
}

export function dibujarCreacionMulti() {
    let html = `
    ${generarDatalistsDinamicos()}
    <h2 style="font-family:'Cinzel';">Forja Múltiple (6 Objetos)</h2>
    <div class="container-hex" style="max-width:1200px; background:rgba(15,0,30,0.95); padding:25px; border:1px solid var(--gold); border-radius:12px; margin:0 auto; box-shadow: 0 0 30px rgba(0,0,0,0.5);">
        
        <div style="text-align:left; margin-bottom:25px; border-bottom:1px solid #444; padding-bottom:15px;">
            <h3 style="margin:0 0 10px 0; font-size:1.1em; color:var(--gold);">Destinatario del Loot (Opcional)</h3>
            <select id="multi-player-dest" class="search-bar" onchange="window.updateCreationMultiLog()" style="width:100%; max-width:400px; margin:0;">
                <option value="">-- Solo crear en Catálogo (Nadie) --</option>
                ${Object.keys(invGlobal).sort().map(j => `<option value="${j}">${j}</option>`).join('')}
            </select>
        </div>
        
        <div id="multi-creation-container">`; // El CSS se encarga de las 3 columnas ahora
    
    for(let i=1; i<=6; i++) {
        html += `
        <div style="border: 1px solid #444; padding: 18px; border-radius: 10px; background:rgba(0,0,0,0.3); display:flex; flex-direction:column; gap:12px;">
            <h4 style="margin:0; color:var(--gold); font-family:'Cinzel'; border-bottom:1px solid #333; padding-bottom:8px;">OBJETO ${i}</h4>
            
            <input type="text" id="new-obj-name-${i}" class="search-bar" placeholder="Nombre del Objeto..." oninput="window.updateCreationMultiLog()" style="width:100%;">
            
            <div class="multi-obj-row">
                <input type="text" id="new-obj-tipo-${i}" list="dl-tipos" class="search-bar" placeholder="Tipo..." oninput="window.updateCreationMultiLog()">
                <input type="text" id="new-obj-mat-${i}" list="dl-mats" class="search-bar" placeholder="Material..." oninput="window.updateCreationMultiLog()">
            </div>
            
            <div class="multi-obj-row-triple">
                <input type="text" id="new-obj-rar-${i}" list="dl-rars" class="search-bar" placeholder="Rareza..." oninput="window.updateCreationMultiLog()">
                <div style="color:#666; font-size:0.7em; display:flex; align-items:center; justify-content:center;">CANT:</div>
                <input type="number" id="new-obj-cant-${i}" class="search-bar" placeholder="1" min="1" oninput="window.updateCreationMultiLog()" style="width:100%; text-align:center; padding:5px;">
            </div>
            
            <textarea id="new-obj-eff-${i}" class="search-bar" placeholder="Descripción del efecto..." oninput="window.updateCreationMultiLog()" style="width:100%; height:60px; margin:0; resize:none; text-align:left; font-size:0.8em;"></textarea>
        </div>`;
    }

    html += `</div>
        
        <div style="margin-top:30px; background:rgba(26,0,51,0.8); padding:20px; border:1px dashed var(--gold); border-radius:10px;">
            <h4 style="color:var(--gold); margin:0 0 12px 0; text-align:left; font-family:'Cinzel';">Discord Log (Vista Previa)</h4>
            <textarea id="copy-log-crea-multi" class="search-bar" readonly style="width:100%; height:120px; font-size:0.9em; margin-bottom:15px; resize:none; background:#000; color:#00ff00; border-color:#333; text-align:left; font-family:monospace;"></textarea>
            <button onclick="window.copyToClipboard('copy-log-crea-multi')" style="width:100%; max-width:300px; background:var(--gold); color:#000; font-weight:bold;">📋 COPIAR LOG PARA DISCORD</button>
        </div>

        <div style="display:flex; gap:20px; margin-top:35px; justify-content:center;">
            <button onclick="window.ejecutarAgregarMulti()" style="flex:2; max-width:450px; background:linear-gradient(135deg, #004a00 0%, #008000 100%); color:white; font-size:1.3em; padding:18px; border:none; border-radius:8px; box-shadow: 0 5px 15px rgba(0,255,0,0.2);">🔨 FINALIZAR GRAN FORJA 🔨</button>
            <button onclick="window.mostrarPagina('op-menu')" style="flex:1; max-width:200px; background:#333; color:#ccc; border:1px solid #555;">CANCELAR</button>
        </div>
    </div>`;
    drawnHEXPreserveFocus('panel-creacion-multi', html);
}
