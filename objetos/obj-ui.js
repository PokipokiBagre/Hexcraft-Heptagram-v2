import { invGlobal, objGlobal, statsGlobal, estadoUI, propuestasGlobal, eqpGlobal, historial } from './obj-state.js';
import { db } from '../hex-db.js';

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
const normalizarNombre = (str) => str ? str.toString().trim().toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n').replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') : "";

const NO_ENCONTRADO = () => `${db.storage.urlBase}/imginterfaz/no_encontrado.png`;
const STORAGE_URL = 'https://gkscqurkpyteusqyspsu.supabase.co/storage/v1/object/public/imagenes-hex';

const rColores = { "Común": "#aaa", "Raro": "#4a90e2", "Legendario": "#d4af37", "-": "#888" };
const safeStr = (s) => s.replace(/'/g, "\\'");

function filtrar(obj) {
    let matc = estadoUI.busquedaInv ? obj.toLowerCase().includes(estadoUI.busquedaInv) : true;
    let rar = estadoUI.filtroRar === 'Todos' ? true : (objGlobal[obj] && objGlobal[obj].rar === estadoUI.filtroRar);
    let mat = estadoUI.filtroMat === 'Todos' ? true : (objGlobal[obj] && objGlobal[obj].mat === estadoUI.filtroMat);
    return matc && rar && mat;
}

export function dibujarInventarios() {
    const j = estadoUI.jugadorInv;
    if (!j || !invGlobal[j]) return document.getElementById('grid-inventario').innerHTML = '<p style="color:#666;">Selecciona un personaje válido.</p>';
    
    let inventario = Object.keys(invGlobal[j]).filter(o => invGlobal[j][o] > 0 && filtrar(o));
    
    // 🌟 Ordenar: Primero los equipados, luego por rareza
    inventario.sort((a, b) => {
        const eqpA = eqpGlobal[j]?.[a] || false;
        const eqpB = eqpGlobal[j]?.[b] || false;
        if (eqpA && !eqpB) return -1;
        if (!eqpA && eqpB) return 1;

        let va = objGlobal[a] ? raridadValor[objGlobal[a].rar] : 0;
        let vb = objGlobal[b] ? raridadValor[objGlobal[b].rar] : 0;
        return vb - va || a.localeCompare(b);
    });

    let html = '';
    inventario.forEach(o => {
        const safeO = safeStr(o);
        const cant = invGlobal[j][o];
        const isEqp = eqpGlobal[j]?.[o] || false;
        
        // 🌟 Estilos dinámicos si está equipado
        const colorMarco = isEqp ? 'var(--gold)' : (rColores[objGlobal[o].rar] || '#888');
        const eqpShadow = isEqp ? `box-shadow: 0 0 10px rgba(212,175,55,0.6);` : '';
        const badgeEqp = isEqp ? `<div style="position:absolute; top:-5px; right:-5px; background:var(--gold); color:#000; font-size:0.65em; font-weight:bold; padding:2px 6px; border-radius:4px; z-index:10; box-shadow:0 0 5px var(--gold);">EQP</div>` : '';
        
        let btnEqpHTML = '';
        if (estadoUI.esAdmin) {
            btnEqpHTML = `<button onclick="window.toggleEqp('${j}', '${safeO}'); event.stopPropagation();" style="width:100%; margin-top:5px; padding:3px; background:${isEqp ? 'var(--gold)' : '#222'}; color:${isEqp ? '#000' : '#aaa'}; border:1px solid #444; border-radius:4px; font-size:0.75em; font-weight:bold; cursor:pointer; transition:0.2s;">${isEqp ? 'DSQP' : 'EQP'}</button>`;
        }

        html += `<div class="obj-card tooltip" onclick="window.abrirOpciones('${safeO}', '${j}')" style="border-color:${colorMarco}; ${eqpShadow}; position:relative;">
            ${badgeEqp}
            <img src="${STORAGE_URL}/imgobjetos/${normalizarNombre(o)}.png" class="obj-icon" style="border-color:${isEqp ? 'var(--gold)' : '#444'};" onerror="${NO_ENCONTRADO()}">
            <div class="obj-info">
                <div class="obj-name" style="color:${isEqp ? 'var(--gold)' : '#fff'};">${o}</div>
                <div class="obj-stock" style="color:${isEqp ? 'var(--gold)' : 'var(--cyan-magic)'};">Stock: ${cant}</div>
                ${btnEqpHTML}
            </div>
            <span class="tooltiptext">${o} <span style="color:#aaa;">(${objGlobal[o].tipo})</span><br><span style="color:var(--cyan-magic);">${objGlobal[o].eff}</span></span>
        </div>`;
    });

    if (html === '') html = '<p style="color:#666; font-style:italic;">Inventario vacío o sin coincidencias de filtro.</p>';
    document.getElementById('grid-inventario').innerHTML = html;
}

export function dibujarControl() {
    let html = '';
    let objs = Object.keys(objGlobal);
    if(estadoUI.busquedaOP) objs = objs.filter(o => o.toLowerCase().includes(estadoUI.busquedaOP));
    
    objs.sort().forEach(o => {
        const safeO = safeStr(o);
        const colRar = rColores[objGlobal[o].rar] || '#888';
        
        html += `<div style="background:#111; border:1px solid #333; padding:15px; border-radius:6px; margin-bottom:15px; border-top: 3px solid ${colRar};">
                    <h3 style="color:#eee; margin-bottom:5px; font-size:1.1em;">${o} <span style="font-size:0.75em; color:#888; font-weight:normal;">(${objGlobal[o].tipo})</span></h3>
                    <p style="color:var(--cyan-magic); font-size:0.85em; font-style:italic; margin-bottom:10px;">${objGlobal[o].eff}</p>
                    <div style="display:flex; flex-direction:column; gap:5px;">`;
        
        Object.keys(invGlobal).sort().forEach(j => {
            if(invGlobal[j][o] > 0) {
                // 🌟 Eqp Botones en Interactivo
                const isEqp = eqpGlobal[j]?.[o] || false;
                const btnEqpText = isEqp ? 'Dsqp.' : 'Eqp.';
                const btnEqpStyle = isEqp ? 'background:var(--gold); color:#000; box-shadow:0 0 5px var(--gold);' : 'background:#222; color:#888; border: 1px solid #444;';
                const colorNombre = isEqp ? 'var(--gold)' : '#fff';
                const borderColor = isEqp ? 'var(--gold)' : '#333';

                html += `<div style="display:flex; justify-content:space-between; align-items:center; background:#000; padding:8px; border-radius:6px; border:1px solid ${borderColor};">
                            <div style="flex:1; display:flex; align-items:center; gap:10px;">
                                <img src="${STORAGE_URL}/imgpersonajes/${normalizarNombre(statsGlobal[j].iconoOverride || j)}icon.png" onerror="${NO_ENCONTRADO()}" style="width:30px; height:30px; border-radius:50%; object-fit:cover; border:1px solid ${borderColor};">
                                <div>
                                    <div style="color:${colorNombre}; font-weight:bold; font-size:0.9em;">${j}</div>
                                    <div style="font-size:0.7em; color:#888;">Stock: <span style="color:var(--cyan-magic); font-weight:bold; font-size:1.1em;">${invGlobal[j][o]}</span></div>
                                </div>
                            </div>
                            <div style="display:flex; gap:3px;">
                                <button onclick="window.mod(-1, '${j}', '${safeO}')" class="btn-mod" style="background:#a00000;">-1</button>
                                <button onclick="window.toggleEqp('${j}', '${safeO}')" class="btn-mod" style="${btnEqpStyle} padding:4px 8px; font-weight:bold; font-size:0.7em;">${btnEqpText}</button>
                                <button onclick="window.mod(1, '${j}', '${safeO}')" class="btn-mod" style="background:#006600;">+1</button>
                            </div>
                        </div>`;
            }
        });
        html += `   </div>
                 </div>`;
    });
    drawnHEXPreserveFocus('panel-interactivo', html);
}

export function dibujarResumenVisual() {
    let html = '';
    const jugadores = Object.keys(invGlobal).filter(j => 
        (estadoUI.filtroRol === 'Todos' || (estadoUI.filtroRol === 'Jugadores' && statsGlobal[j]?.isPlayer) || (estadoUI.filtroRol === 'NPCs' && !statsGlobal[j]?.isPlayer)) &&
        (estadoUI.filtroAct === 'Todos' || (estadoUI.filtroAct === 'Activos' && statsGlobal[j]?.isActive) || (estadoUI.filtroAct === 'Inactivos' && !statsGlobal[j]?.isActive))
    ).sort();

    jugadores.forEach(j => {
        let inventario = Object.keys(invGlobal[j]).filter(o => invGlobal[j][o] > 0);
        inventario.sort((a,b) => {
            const eqpA = eqpGlobal[j]?.[a] || false; const eqpB = eqpGlobal[j]?.[b] || false;
            if (eqpA && !eqpB) return -1; if (!eqpA && eqpB) return 1;
            return (raridadValor[objGlobal[b].rar] || 0) - (raridadValor[objGlobal[a].rar] || 0) || a.localeCompare(b);
        });

        if(inventario.length > 0) {
            html += `<h3 style="color:var(--gold); border-bottom:1px solid #333; padding-bottom:5px; margin-top:20px;">🎒 ${j}</h3><div class="grid-objetos" style="margin-bottom:15px;">`;
            inventario.forEach(o => {
                const safeO = safeStr(o);
                const isEqp = eqpGlobal[j]?.[o] || false;
                const colorMarco = isEqp ? 'var(--gold)' : (rColores[objGlobal[o].rar] || '#888');
                const eqpShadow = isEqp ? `box-shadow: 0 0 10px rgba(212, 175, 55, 0.6);` : '';
                const badgeEqp = isEqp ? `<div style="position:absolute; top:-5px; right:-5px; background:var(--gold); color:#000; font-size:0.65em; font-weight:bold; padding:2px 6px; border-radius:4px; z-index:10; box-shadow:0 0 5px var(--gold);">EQP</div>` : '';

                let btnEqpHTML = `<button onclick="window.toggleEqp('${j}', '${safeO}')" style="width:100%; margin-top:5px; padding:3px; background:${isEqp ? 'var(--gold)' : '#222'}; color:${isEqp ? '#000' : '#aaa'}; border:1px solid #444; border-radius:4px; font-size:0.75em; font-weight:bold; cursor:pointer; transition:0.2s;">${isEqp ? 'DSQP' : 'EQP'}</button>`;

                html += `<div class="obj-card tooltip" style="border-color:${colorMarco}; ${eqpShadow}; position:relative; cursor:default;">
                    ${badgeEqp}
                    <img src="${STORAGE_URL}/imgobjetos/${normalizarNombre(o)}.png" class="obj-icon" style="border-color:${isEqp ? 'var(--gold)' : '#444'};" onerror="${NO_ENCONTRADO()}">
                    <div class="obj-info">
                        <div class="obj-name" style="color:${isEqp ? 'var(--gold)' : '#fff'};">${o}</div>
                        <div class="obj-stock">Stock: ${invGlobal[j][o]}</div>
                        ${btnEqpHTML}
                    </div>
                    <span class="tooltiptext">${o} <span style="color:#aaa;">(${objGlobal[o].tipo})</span><br><span style="color:var(--cyan-magic);">${objGlobal[o].eff}</span></span>
                </div>`;
            });
            html += `</div>`;
        }
    });
    
    if (html === '') html = '<p style="color:#666; font-style:italic;">No hay inventarios que coincidan con los filtros.</p>';
    document.getElementById('panel-party-loot').innerHTML = html;
}

export function dibujarLog() {
    const contenedor = document.getElementById('historial-log');
    if (!contenedor) return;
    let html = '';
    
    // 🌟 Pintado inteligente de Logs con colores para Equipo
    historial.slice().reverse().forEach(h => {
        let colorCambio = "#fff";
        let cTxt = h.cambio;
        if (h.cambio === "Eqp.") colorCambio = "var(--gold)";
        else if (h.cambio === "Dsqp.") colorCambio = "#aaa";
        else if (h.cambio > 0) { colorCambio = "#00ff00"; cTxt = "+" + h.cambio; }
        else if (h.cambio < 0) { colorCambio = "#ff4444"; }
        
        let extraHTML = h.extraLog ? `<div style="font-size:0.75em; color:var(--cyan-magic); margin-top:3px; font-style:italic;">Efecto: ${h.extraLog}</div>` : '';

        html += `<div style="border-bottom:1px solid #333; padding:6px 0; font-family:'Rajdhani';">
                    <span style="color:#666; font-size:0.8em;">${h.fecha}</span> | 
                    <span style="color:var(--cyan-magic); font-weight:bold;">${h.jugador}</span> | 
                    ${h.objeto} <span style="color:${colorCambio}; font-weight:bold;">(${cTxt})</span>
                    ${extraHTML}
                 </div>`;
    });
    contenedor.innerHTML = html;
}

// ... Las demás funciones de UI de crear, proponer, transferir y menús no necesitan cambiar
export function dibujarGrillaPersonajes() {
    let pjs = Object.keys(invGlobal).filter(j => 
        (estadoUI.filtroRol === 'Todos' || (estadoUI.filtroRol === 'Jugadores' && statsGlobal[j]?.isPlayer) || (estadoUI.filtroRol === 'NPCs' && !statsGlobal[j]?.isPlayer)) &&
        (estadoUI.filtroAct === 'Todos' || (estadoUI.filtroAct === 'Activos' && statsGlobal[j]?.isActive) || (estadoUI.filtroAct === 'Inactivos' && !statsGlobal[j]?.isActive))
    ).sort();

    let html = '';
    pjs.forEach(j => {
        let iconName = statsGlobal[j]?.iconoOverride || j;
        let cBorder = (statsGlobal[j] && statsGlobal[j].isPlayer) ? '#00e676' : '#ff4444';
        let activo = (estadoUI.jugadorInv === j) ? 'box-shadow: 0 0 15px var(--cyan-magic); border-color:var(--cyan-magic); filter:brightness(1.2);' : `border-color:${cBorder}44; filter:brightness(0.6);`;
        
        let invSize = Object.keys(invGlobal[j]).filter(o => invGlobal[j][o] > 0).length;
        
        html += `<div class="pj-portrait-container tooltip" onclick="window.seleccionarPersonaje('${j.replace(/'/g, "\\'")}')">
                    <img src="${STORAGE_URL}/imgpersonajes/${normalizarNombre(iconName)}icon.png" class="pj-portrait" style="${activo}" onerror="${NO_ENCONTRADO()}">
                    <div class="pj-name" style="${estadoUI.jugadorInv === j ? 'color:var(--cyan-magic); text-shadow:0 0 5px var(--cyan-magic);' : ''}">${j}</div>
                    <span class="tooltiptext">${j}<br><span style="color:var(--gold);">${invSize} objetos distintos</span></span>
                 </div>`;
    });
    document.getElementById('selector-personajes-grid').innerHTML = html;
}

export function refrescarUI() {
    dibujarGrillaPersonajes();
    if(estadoUI.vistaActual === 'grilla') dibujarInventarios();
    else if(estadoUI.vistaActual === 'catalogo') dibujarCatalogo();
    else if(estadoUI.vistaActual === 'control') dibujarControl();
    else if(estadoUI.vistaActual === 'party-loot') dibujarResumenVisual();
    else if(estadoUI.vistaActual === 'transfer') dibujarTransferencia();
    else if(estadoUI.vistaActual === 'propuestas') dibujarPropuestas();
    dibujarLog();
}

export function dibujarCatalogo() {
    let objs = Object.keys(objGlobal);
    if(estadoUI.busquedaCat) objs = objs.filter(o => o.toLowerCase().includes(estadoUI.busquedaCat));
    objs.sort().forEach(o => { /* Mantiene igual */ });
    drawnHEXPreserveFocus('tabla-todos-objetos', html); // El resto de métodos no cambió
}

export function dibujarTransferencia(objeto, jugador) {
    if(objeto && jugador) { estadoUI.transOrigen = jugador; estadoUI.transDestino = null; window.objTrans = objeto; estadoUI.transMult = 1; }
    if(!window.objTrans || !objGlobal[window.objTrans]) {
        document.getElementById('panel-transferencia').innerHTML = '<p style="color:#666;">Selecciona un objeto en el inventario.</p>'; return;
    }
    // Logica visual de transferir (la misma que tenías, no la pego para no exceder caracteres en UI)
}

export function dibujarMenuOP() {
    const pendientes = propuestasGlobal.length;
    const badgeProp = pendientes > 0
        ? `<span style="background:#ff9900; color:#000; font-size:0.7em; padding:2px 6px; border-radius:10px; margin-left:6px; font-weight:bold;">${pendientes}</span>`
        : '';
    document.getElementById('menu-op-central').innerHTML = `
        <h2 style="margin-top:0;">Panel OP Maestro</h2>
        <div class="op-grid">
            <button onclick="window.mostrarPagina('party-loot')" style="background:#b8860b; color:#000;">Repartir Loot a Party</button>
            <button onclick="window.mostrarPagina('transfer')" style="background:#1a4b8c; color:#fff;">Mercado de Transferencias</button>
            <button onclick="window.mostrarPagina('crear')" style="background:#4a004a">Creación Rápida (1)</button>
            <button onclick="window.mostrarPagina('crear-multi')" style="background:#600060">Forja Múltiple (6)</button>
            <button onclick="window.mostrarPagina('propuestas')" style="background:#4a2800; border:1px solid #ff9900; color:#ff9900;">📥 Propuestas Pendientes${badgeProp}</button>
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
                        <img src="${db.storage.urlBase}/imgobjetos/${normalizarNombre(o)}.png" 
                             onclick="window.hexMod('${j}','${oSafe}', ${estadoUI.editMult * estadoUI.editModo})" 
                             style="width:80px; height:80px; object-fit:cover; cursor:pointer; border-radius:8px; border:2px solid ${actionColor}; transition:0.2s; box-shadow:0 0 10px ${actionColor};"
                             onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"
                             onerror="this.onerror=null; this.src='${NO_ENCONTRADO()}'" title="Click para aplicar">
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
                                <img src="${db.storage.urlBase}/imgobjetos/${normalizarNombre(o)}.png" 
                                     onclick="window.ejecutarTransfer('${oSafe}', ${cantToPass})" 
                                     style="width:80px; height:80px; object-fit:cover; cursor:pointer; border-radius:8px; border:2px solid #00ff00; transition:0.2s; box-shadow:0 0 10px #00ff00;"
                                     onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"
                                     onerror="this.onerror=null; this.src='${NO_ENCONTRADO()}'" title="Clic para Transferir ${cantToPass}">
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
                    <img src="${db.storage.urlBase}/imgpersonajes/${normalizarNombre(p.iconoOverride || j)}icon.png" style="width:24px; height:24px; border-radius:50%; vertical-align:middle; margin-right:5px;" onerror="this.onerror=null; this.src='${NO_ENCONTRADO()}'">
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
                        <img src="${db.storage.urlBase}/imgobjetos/${normalizarNombre(o)}.png" 
                             onclick="window.giveLootToParty('${o.replace(/'/g, "\\'")}')" 
                             style="width:80px; height:80px; object-fit:cover; border:2px solid var(--gold); border-radius:8px; background:#000; cursor:pointer; transition:0.2s;" 
                             onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"
                             onerror="this.onerror=null; this.src='${NO_ENCONTRADO()}'">
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
        
        <div id="multi-creation-container">`;
    
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
            <h4 style="color:var(--gold); margin:0 0 12px 0; text-align:left; font-family:'Cinzel';">Log (Vista Previa)</h4>
            <textarea id="copy-log-crea-multi" class="search-bar" readonly style="width:100%; height:120px; font-size:0.9em; margin-bottom:15px; resize:none; background:#000; color:#00ff00; border-color:#333; text-align:left; font-family:monospace;"></textarea>
            <button onclick="window.copyToClipboard('copy-log-crea-multi')" style="width:100%; max-width:300px; background:var(--gold); color:#000; font-weight:bold;">📋 COPIAR LOG</button>
        </div>

        <div style="display:flex; gap:20px; margin-top:35px; justify-content:center;">
            <button onclick="window.ejecutarAgregarMulti()" style="flex:2; max-width:450px; background:linear-gradient(135deg, #004a00 0%, #008000 100%); color:white; font-size:1.3em; padding:18px; border:none; border-radius:8px; box-shadow: 0 5px 15px rgba(0,255,0,0.2);">🔨 FINALIZAR GRAN FORJA 🔨</button>
            <button onclick="window.mostrarPagina('op-menu')" style="flex:1; max-width:200px; background:#333; color:#ccc; border:1px solid #555;">CANCELAR</button>
        </div>
    </div>`;
    drawnHEXPreserveFocus('panel-creacion-multi', html);
}


// ── Modal de edición de objetos ──────────────────────────────────────────────
function generarDatalistsModal() {
    const tipos = new Set(['Consumible','Herramienta','Accesorio','Equipo']);
    const mats  = new Set(['Cristal','Metal','Orgánico','Sagrado']);
    const rars  = new Set(['Común','Raro','Legendario']);
    Object.values(objGlobal).forEach(o => {
        if (o.tipo && o.tipo !== '-') tipos.add(o.tipo.trim());
        if (o.mat  && o.mat  !== '-') mats.add(o.mat.trim());
        if (o.rar  && o.rar  !== '-') rars.add(o.rar.trim());
    });
    return `
        <datalist id="dl-tipos-m">${[...tipos].sort().map(t=>`<option value="${t}">`).join('')}</datalist>
        <datalist id="dl-mats-m">${[...mats].sort().map(m=>`<option value="${m}">`).join('')}</datalist>
        <datalist id="dl-rars-m">${[...rars].sort().map(r=>`<option value="${r}">`).join('')}</datalist>`;
}

export function dibujarModalEdicionObjeto(nombre) {
    const info = objGlobal[nombre];
    if (!info) return;
    const existing = document.getElementById('modal-edit-obj');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-edit-obj';
    modal.style.cssText = 'display:flex; position:fixed; z-index:100000; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.85); align-items:center; justify-content:center; backdrop-filter:blur(4px);';
    modal.onclick = (e) => { if (e.target === modal) window.cerrarModalEdicion(); };
    modal.innerHTML = `
        ${generarDatalistsModal()}
        <div style="max-width:500px;width:90%;padding:25px;background:rgba(20,0,40,0.97);border:2px solid var(--gold);border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.8);position:relative;">
            <button onclick="window.cerrarModalEdicion()" style="position:absolute;top:10px;right:15px;background:none;border:none;color:#aaa;font-size:1.5em;cursor:pointer;">&times;</button>
            <h2 style="color:var(--gold);margin-top:0;font-family:'Cinzel';text-align:center;">✏️ Editar Objeto</h2>
            <div style="display:flex;flex-direction:column;gap:12px;text-align:left;">
                <div><label style="color:#aaa;font-size:0.8em;">Nombre:</label>
                    <input type="text" id="edit-obj-name" class="search-bar" value="${nombre}" style="width:100%;box-sizing:border-box;margin-top:4px;"></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div><label style="color:#aaa;font-size:0.8em;">Tipo:</label>
                        <input type="text" id="edit-obj-tipo" list="dl-tipos-m" class="search-bar" value="${info.tipo}" style="width:100%;box-sizing:border-box;margin-top:4px;"></div>
                    <div><label style="color:#aaa;font-size:0.8em;">Material:</label>
                        <input type="text" id="edit-obj-mat" list="dl-mats-m" class="search-bar" value="${info.mat}" style="width:100%;box-sizing:border-box;margin-top:4px;"></div>
                </div>
                <div><label style="color:#aaa;font-size:0.8em;">Efecto:</label>
                    <textarea id="edit-obj-eff" class="search-bar" style="width:100%;height:70px;box-sizing:border-box;margin-top:4px;resize:none;">${info.eff}</textarea></div>
                <div><label style="color:#aaa;font-size:0.8em;">Rareza:</label>
                    <input type="text" id="edit-obj-rar" list="dl-rars-m" class="search-bar" value="${info.rar}" style="width:100%;box-sizing:border-box;margin-top:4px;"></div>
                <div style="display:flex;gap:10px;margin-top:10px;">
                    <button onclick="window.guardarEdicionObjeto('${nombre.replace(/'/g,"\'")}') " style="flex:2;background:linear-gradient(135deg,#004a00,#008000);color:white;font-weight:bold;padding:12px;border:none;border-radius:6px;cursor:pointer;font-size:1.05em;">💾 GUARDAR</button>
                    <button onclick="window.cerrarModalEdicion()" style="flex:1;background:#444;color:white;padding:12px;border:none;border-radius:6px;cursor:pointer;">Cancelar</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

// ── Propuestas ───────────────────────────────────────────────
export function dibujarPropuestas() {
    const cont = document.getElementById('panel-propuestas');
    if (!cont) return;

    if (propuestasGlobal.length === 0) {
        cont.innerHTML = `
        <h2 style="margin-top:0; color:#ff9900;">📥 Propuestas de Objetos</h2>
        <div style="text-align:center; padding:60px; color:#666; font-style:italic; border:1px dashed #444; border-radius:8px; background:rgba(0,0,0,0.3);">
            No hay propuestas pendientes.
        </div>
        <button onclick="window.mostrarPagina('op-menu')" style="margin-top:20px; background:#333; padding:10px 20px; cursor:pointer; border-radius:4px;">← Volver al Panel</button>`;
        return;
    }

    let html = `
    <h2 style="margin-top:0; color:#ff9900;">📥 Propuestas de Objetos <span style="background:#ff9900; color:#000; font-size:0.6em; padding:2px 8px; border-radius:10px; vertical-align:middle;">${propuestasGlobal.length}</span></h2>
    <div style="display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap;">
        <button onclick="window.aprobarTodas()" style="background:linear-gradient(135deg,#004a00,#007700); color:white; font-weight:bold; padding:12px 20px; border:none; border-radius:6px; cursor:pointer; font-size:1em;">✅ Aprobar Todas (${propuestasGlobal.length})</button>
        <button onclick="window.rechazarTodas()" style="background:linear-gradient(135deg,#4a0000,#770000); color:white; font-weight:bold; padding:12px 20px; border:none; border-radius:6px; cursor:pointer; font-size:1em;">❌ Rechazar Todas</button>
        <button onclick="window.mostrarPagina('op-menu')" style="background:#333; padding:12px 20px; border:1px solid #555; border-radius:6px; cursor:pointer;">← Volver al Panel</button>
    </div>
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px,1fr)); gap:15px;">`;

    propuestasGlobal.forEach(p => {
        const oSafe = p.nombre.replace(/'/g, "\\'");
        const norm = p.nombre.toString().trim().toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n').replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
        const imgUrl = `${db.storage.urlBase}/imgobjetos/${norm}.png`;
        const noFound = `${db.storage.urlBase}/imginterfaz/no_encontrado.png`;

        html += `
        <div style="background:linear-gradient(145deg,rgba(40,20,0,0.9),rgba(20,10,0,0.95)); border:2px solid #ff9900; border-radius:10px; padding:15px; position:relative;">
            <div style="position:absolute;top:8px;right:8px; background:#ff9900; color:#000; font-size:0.65em; padding:2px 7px; border-radius:8px; font-weight:bold;">PROPUESTA</div>
            <div style="display:flex; gap:12px; align-items:flex-start; margin-bottom:12px;">
                <img src="${imgUrl}" onerror="this.onerror=null;this.src='${noFound}'" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid #ff9900;background:#000;">
                <div style="flex:1;">
                    <div style="font-weight:bold;color:#ff9900;font-size:1.05em;margin-bottom:4px;">${p.nombre}</div>
                    <div style="font-size:0.75em;color:#aaa;">Tipo: ${p.tipo} | ${p.mat} | <span style="color:${p.rar==='Legendario'?'#d4af37':p.rar==='Raro'?'#8a2be2':'#aaa'}">${p.rar}</span></div>
                    <div style="font-size:0.7em;color:#888;margin-top:4px;">Propuesto por: <b style="color:#ccc;">${p.propuesto_por}</b></div>
                </div>
            </div>
            <div style="font-size:0.8em;color:#ddd;margin-bottom:12px;background:rgba(0,0,0,0.3);padding:8px;border-radius:4px;border-left:2px solid #ff9900;">${p.eff}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button onclick="window.aprobarPropuesta('${oSafe}')" style="background:#004a00;border:1px solid #00aa00;color:white;padding:8px;border-radius:4px;cursor:pointer;font-weight:bold;transition:0.2s;" onmouseover="this.style.background='#006600'" onmouseout="this.style.background='#004a00'">✅ Aprobar</button>
                <button onclick="window.rechazarPropuesta('${oSafe}')" style="background:#4a0000;border:1px solid #aa0000;color:white;padding:8px;border-radius:4px;cursor:pointer;font-weight:bold;transition:0.2s;" onmouseover="this.style.background='#660000'" onmouseout="this.style.background='#4a0000'">❌ Rechazar</button>
            </div>
        </div>`;
    });

    html += `</div>`;
    cont.innerHTML = html;
}

export function dibujarFormularioPropuesta() {
    const cont = document.getElementById('panel-crear-propuesta');
    if (!cont) return;

    const tipos = ['Consumible','Herramienta','Accesorio','Equipo','Equipamiento','-'];
    const mats  = ['Cristal','Metal','Orgánico','Sagrado','-'];
    const rars  = ['Común','Raro','Legendario'];

    const mostrarNPCs = estadoUI.propFormMostrarNPCs || false;

    // Construir lista de destinatarios
    let opcionesDestinatarios = `<option value="">-- Nadie (solo proponer el objeto) --</option>`;
    Object.keys(invGlobal).sort().forEach(j => {
        const p = getPjStats(j);
        if (!mostrarNPCs && !p.isPlayer) return;
        if (mostrarNPCs && p.isPlayer) return;
        const label = p.isPlayer ? j : `[NPC] ${j}`;
        opcionesDestinatarios += `<option value="${j}">${label}</option>`;
    });

    cont.innerHTML = `
    <h2 style="margin-top:0; color:#ff9900; font-family:'Cinzel';">📝 Proponer Nuevo Objeto</h2>
    <div style="max-width:640px; margin:0 auto; background:rgba(40,15,0,0.9); padding:25px; border:2px solid #ff9900; border-radius:10px; box-shadow:0 0 20px rgba(255,102,0,0.15);">
        <p style="color:#aaa; font-size:0.85em; margin-top:0; border-left:3px solid #ff9900; padding-left:10px;">
            Tu propuesta será revisada por el OP antes de aparecer en el catálogo oficial.
        </p>
        <div style="display:flex; flex-direction:column; gap:12px;">
            <div>
                <label style="color:#ff9900; font-size:0.8em; display:block; margin-bottom:4px;">Tu nombre / personaje</label>
                <input type="text" id="prop-autor" class="search-bar" placeholder="¿Quién propone esto?" style="width:100%; box-sizing:border-box;">
            </div>
            <div>
                <label style="color:#ff9900; font-size:0.8em; display:block; margin-bottom:4px;">Nombre del objeto *</label>
                <input type="text" id="prop-nombre" class="search-bar" placeholder="Nombre único del objeto..." style="width:100%; box-sizing:border-box;">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                    <label style="color:#aaa; font-size:0.8em; display:block; margin-bottom:4px;">Tipo</label>
                    <select id="prop-tipo" class="search-bar" style="width:100%; box-sizing:border-box;">
                        ${tipos.map(t=>`<option value="${t}">${t}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="color:#aaa; font-size:0.8em; display:block; margin-bottom:4px;">Material</label>
                    <select id="prop-mat" class="search-bar" style="width:100%; box-sizing:border-box;">
                        ${mats.map(m=>`<option value="${m}">${m}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div>
                <label style="color:#aaa; font-size:0.8em; display:block; margin-bottom:4px;">Rareza</label>
                <select id="prop-rar" class="search-bar" style="width:100%; box-sizing:border-box;">
                    ${rars.map(r=>`<option value="${r}">${r}</option>`).join('')}
                </select>
            </div>
            <div>
                <label style="color:#aaa; font-size:0.8em; display:block; margin-bottom:4px;">Efecto / Descripción *</label>
                <textarea id="prop-eff" class="search-bar" placeholder="¿Qué hace este objeto?" style="width:100%; height:80px; box-sizing:border-box; resize:none;"></textarea>
            </div>

            <!-- ── Destinatario ── -->
            <div style="background:rgba(255,102,0,0.07); border:1px solid rgba(255,102,0,0.3); border-radius:8px; padding:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <label style="color:#ff9900; font-size:0.85em; font-weight:bold;">🎁 Brindar a (Opcional)</label>
                    <button type="button" onclick="window.togglePropFormNPCs()"
                        style="background:${mostrarNPCs ? '#1a3a6a' : '#1a0033'}; color:${mostrarNPCs ? '#00ccff' : '#9966ff'}; border:1px solid ${mostrarNPCs ? '#00ccff' : '#9966ff'}; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:0.75em; font-family:'Cinzel'; transition:0.2s;">
                        ${mostrarNPCs ? '🎭 Mostrando NPCs' : '⚔️ Mostrando Jugadores'}
                    </button>
                </div>
                <div style="display:grid; grid-template-columns:1fr auto; gap:10px; align-items:center;">
                    <select id="prop-para" class="search-bar" style="width:100%; box-sizing:border-box; margin:0;">
                        ${opcionesDestinatarios}
                    </select>
                    <div style="display:flex; flex-direction:column; align-items:center; gap:3px;">
                        <label style="color:#aaa; font-size:0.7em;">Cant.</label>
                        <input type="number" id="prop-cantidad" value="1" min="1" max="99"
                            style="width:60px; background:#000; color:#fff; border:1px solid #555; border-radius:4px; padding:6px; text-align:center; font-size:1em; box-sizing:border-box;">
                    </div>
                </div>
                <p style="color:#666; font-size:0.72em; font-family:sans-serif; margin:8px 0 0 0;">
                    Si seleccionas un personaje, el objeto aparecerá en su inventario como pendiente hasta que el OP lo apruebe.
                </p>
            </div>

            <div style="display:flex; gap:10px; margin-top:8px;">
                <button onclick="window.enviarPropuesta()" style="flex:2; background:linear-gradient(135deg,#4a1800,#8a3000); color:#ff9900; font-weight:bold; padding:14px; border:1px solid #ff9900; border-radius:6px; cursor:pointer; font-size:1.05em; font-family:'Cinzel'; transition:0.2s;" onmouseover="this.style.background='#8a3000'" onmouseout="this.style.background='linear-gradient(135deg,#4a1800,#8a3000)'">📨 ENVIAR PROPUESTA</button>
                <button onclick="window.mostrarPagina('grilla')" style="flex:1; background:#333; color:#aaa; padding:14px; border:1px solid #555; border-radius:6px; cursor:pointer;">Cancelar</button>
            </div>
        </div>
    </div>`;
}
