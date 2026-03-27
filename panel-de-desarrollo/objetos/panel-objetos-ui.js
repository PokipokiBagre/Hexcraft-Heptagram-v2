// ============================================================
// panel-objetos-ui.js — Renderizado de la Columna de Objetos
// ============================================================

import { objState, STORAGE_URL, TIPOS_OBJ, RAREZAS_OBJ, MATERIALES_OBJ } from './panel-objetos-state.js';
import { getCantidadActual, modificarCantidad, actualizarFormularioNuevo, setCantidadFormularios, setBusquedaObjeto, cambiarVistaObjetos, seleccionarObjetoParaEditar, modificarObjetoEdicion, isEquipado, toggleEquipacion } from './panel-objetos-logic.js';

window.devModObjeto = modificarCantidad;
window.devModFormObj = actualizarFormularioNuevo;
window.devSetFormCount = setCantidadFormularios;
window.devBusquedaObj = setBusquedaObjeto;
window.devSetVistaObj = cambiarVistaObjetos;
window.devSeleccionarObjEdit = seleccionarObjetoParaEditar;
window.devModFormEdit = modificarObjetoEdicion;
window.devToggleEqp = toggleEquipacion; // 🌟 BOTON

const norm = (str) => str.toString().trim().toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
    .replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/ñ/g,'n').replace(/\s+/g,'_')
    .replace(/[^a-z0-9_]/g,'');

function drawnHEXPreserveFocus(containerId, html) {
    const activeEl = document.activeElement;
    const activeId = activeEl ? activeEl.id : null;
    const start = activeEl && activeEl.selectionStart !== undefined ? activeEl.selectionStart : null;
    const end = activeEl && activeEl.selectionEnd !== undefined ? activeEl.selectionEnd : null;
    
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = html;
        if (activeId && document.getElementById(activeId)) {
            const newEl = document.getElementById(activeId);
            newEl.focus();
            if (start !== null && newEl.setSelectionRange) newEl.setSelectionRange(start, end);
        }
    }
}

function generarTarjetaObjeto(objNombre, pjSeleccionado, colorBordeDestacado = 'var(--cyan-magic)') {
    const cant = getCantidadActual(pjSeleccionado, objNombre);
    const imgPath = `${STORAGE_URL}/imgobjetos/${norm(objNombre)}.png`;
    const imgError = `this.onerror=null; this.src='${STORAGE_URL}/imginterfaz/no_encontrado.png'`;
    
    const modificado = (objState.colaInventario[pjSeleccionado.toLowerCase()] && objState.colaInventario[pjSeleccionado.toLowerCase()][objNombre] !== undefined);
    
    const eqp = isEquipado(pjSeleccionado, objNombre);
    const btnEqpText = eqp ? 'Dsqp.' : 'Eqp.';
    const btnEqpStyle = eqp ? 'background:var(--gold); color:#000;' : 'background:#222; color:#888; border: 1px solid #444;';
    const btnEqpShadow = eqp ? 'box-shadow: 0 0 10px rgba(212, 175, 55, 0.4);' : '';
    
    const borderGlow = modificado ? `border-color:${colorBordeDestacado}; box-shadow:0 0 8px ${colorBordeDestacado}55;` : (eqp ? 'border-color:var(--gold);' : 'border-color:#333;');

    const dbObj = objState.catalogoDB.find(o => o.nombre === objNombre);
    const editObj = objState.colaEdicionObjetos[objNombre];
    const efecto = editObj ? editObj.eff : (dbObj ? dbObj.efecto : '');
    const efectoStr = efecto ? efecto.replace(/"/g, '&quot;') : 'Sin efecto detallado';

    return `
    <div style="background:#050505; border:1px solid; ${borderGlow} border-radius:8px; padding:8px; display:flex; flex-direction:column; gap:8px; transition:0.2s;">
        <div style="display:flex; align-items:center; gap:10px;">
            <img src="${imgPath}" onerror="${imgError}" style="width:40px; height:40px; border-radius:4px; border:1px solid ${eqp ? 'var(--gold)' : '#444'}; object-fit:cover;">
            <div style="flex:1; line-height:1.2; overflow:hidden;">
                <div style="color:${eqp ? 'var(--gold)' : '#eee'}; font-weight:bold; font-size:0.95em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${objNombre}">${objNombre}</div>
                <div style="display:flex; gap:10px; align-items:baseline; margin-top:2px;">
                    <div style="color:var(--cyan-magic); font-size:0.8em; font-family:'Cinzel';">Stock: ${cant}</div>
                </div>
                <div style="color:#888; font-size:0.75em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;" title="${efectoStr}">
                    ${efecto || '<i style="opacity:0.5">Sin efecto detallado</i>'}
                </div>
            </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; gap:2px;">
            <div style="display:flex; gap:2px;">
                <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre.replace(/'/g, "\\'")}', -20)" style="background:#4a0000; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">-20</button>
                <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre.replace(/'/g, "\\'")}', -5)" style="background:#660000; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">-5</button>
                <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre.replace(/'/g, "\\'")}', -1)" style="background:#a00000; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">-1</button>
            </div>
            
            <button onclick="window.devToggleEqp('${pjSeleccionado}', '${objNombre.replace(/'/g, "\\'")}')" style="${btnEqpStyle} ${btnEqpShadow} border-radius:3px; padding:4px 12px; cursor:pointer; font-weight:bold; font-size:0.75em; transition:0.2s;">${btnEqpText}</button>
            
            <div style="display:flex; gap:2px;">
                <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre.replace(/'/g, "\\'")}', 1)" style="background:#006600; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">+1</button>
                <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre.replace(/'/g, "\\'")}', 5)" style="background:#00a000; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">+5</button>
                <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre.replace(/'/g, "\\'")}', 20)" style="background:#00cc00; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">+20</button>
            </div>
        </div>
    </div>`;
}

export function renderColumnaObjetos(pjSeleccionado) {
    const contenedorC = 'content-items';
    if (!document.getElementById(contenedorC)) return;

    if (!pjSeleccionado) {
        drawnHEXPreserveFocus(contenedorC, `<div style="text-align:center; color:#666; margin-top:50px; font-style:italic;">Selecciona un personaje arriba para gestionar sus objetos.</div>`);
        return;
    }

    let html = `
        <div style="display:flex; gap:5px; margin-bottom:15px; flex-wrap:wrap;">
            <button onclick="window.devSetVistaObj('inventario')" style="flex:1; padding:6px; border-radius:4px; border:1px solid #444; background:${objState.vistaActiva==='inventario'?'var(--cyan-magic)':'#111'}; color:${objState.vistaActiva==='inventario'?'#000':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">🎒 Inv</button>
            <button onclick="window.devSetVistaObj('catalogo')" style="flex:1; padding:6px; border-radius:4px; border:1px solid #444; background:${objState.vistaActiva==='catalogo'?'#00ff88':'#111'}; color:${objState.vistaActiva==='catalogo'?'#000':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">🌍 Global</button>
            <button onclick="window.devSetVistaObj('forja')" style="flex:1; padding:6px; border-radius:4px; border:1px solid #444; background:${objState.vistaActiva==='forja'?'var(--gold)':'#111'}; color:${objState.vistaActiva==='forja'?'#000':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">🛠️ Forjar</button>
            <button onclick="window.devSetVistaObj('editar')" style="flex:1; padding:6px; border-radius:4px; border:1px solid #444; background:${objState.vistaActiva==='editar'?'#ff4444':'#111'}; color:${objState.vistaActiva==='editar'?'#fff':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">✏️ Editar</button>
        </div>
    `;

    if (objState.vistaActiva === 'inventario') {
        html += `<input type="text" id="dev-search-inv" placeholder="🔍 Buscar en su inventario..." value="${objState.busqueda}" oninput="window.devBusquedaObj(this.value, 'inv')" style="width:100%; box-sizing:border-box; background:#000; color:var(--cyan-magic); border:1px solid var(--cyan-magic); padding:10px; border-radius:6px; margin-bottom:15px; font-family:'Rajdhani'; outline:none;">
                 <div style="display:flex; flex-direction:column; gap:8px; overflow-y:auto; padding-right:5px;">`;

        const pjKey = pjSeleccionado.toLowerCase();
        const itemsBD = objState.inventariosDB[pjKey] ? Object.keys(objState.inventariosDB[pjKey]) : [];
        const itemsCola = objState.colaInventario[pjKey] ? Object.keys(objState.colaInventario[pjKey]) : [];
        const itemsEqpCola = objState.colaEquipados[pjKey] ? Object.keys(objState.colaEquipados[pjKey]) : [];
        
        const setUnico = new Set([...itemsBD, ...itemsCola, ...itemsEqpCola]);
        let listaMostrar = Array.from(setUnico).filter(obj => getCantidadActual(pjSeleccionado, obj) > 0);

        if (objState.busqueda !== "") listaMostrar = listaMostrar.filter(nom => nom.toLowerCase().includes(objState.busqueda));

        if (listaMostrar.length === 0) {
            html += `<div style="text-align:center; color:#555; padding:10px; font-size:0.9em;">Inventario vacío.</div>`;
        } else {
            listaMostrar.sort((a,b) => {
                const eqpA = isEquipado(pjSeleccionado, a); const eqpB = isEquipado(pjSeleccionado, b);
                if (eqpA && !eqpB) return -1; if (!eqpA && eqpB) return 1; return a.localeCompare(b);
            }).forEach(objNombre => { html += generarTarjetaObjeto(objNombre, pjSeleccionado, 'var(--cyan-magic)'); });
        }
        html += `</div>`;
    }
    else if (objState.vistaActiva === 'catalogo') {
        html += `<input type="text" id="dev-search-cat" placeholder="🔍 Buscar en el mundo..." value="${objState.busquedaCat}" oninput="window.devBusquedaObj(this.value, 'cat')" style="width:100%; box-sizing:border-box; background:#000; color:#00ff88; border:1px solid #00ff88; padding:10px; border-radius:6px; margin-bottom:15px; font-family:'Rajdhani'; outline:none;">
                 <div style="display:flex; flex-direction:column; gap:8px; overflow-y:auto; padding-right:5px;">`;

        let listaMostrar = objState.catalogoDB.map(o => o.nombre);
        if (objState.busquedaCat !== "") listaMostrar = listaMostrar.filter(nom => nom.toLowerCase().includes(objState.busquedaCat));

        if (listaMostrar.length === 0) html += `<div style="text-align:center; color:#555; padding:10px; font-size:0.9em;">No existe en la base de datos. ¡Fórjalo!</div>`;
        else {
            listaMostrar.slice(0, 50).forEach(objNombre => { html += generarTarjetaObjeto(objNombre, pjSeleccionado, '#00ff88'); });
            if (listaMostrar.length > 50) html += `<div style="text-align:center; color:#666; font-size:0.8em; padding:5px;">Mostrando 50 resultados.</div>`;
        }
        html += `</div>`;
    }
    else if (objState.vistaActiva === 'forja') {
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h4 style="color:var(--gold); margin:0; font-family:'Cinzel';">🛠️ Modelos a Crear</h4>
                <input type="number" min="1" max="10" value="${objState.formulariosCreacion}" onchange="window.devSetFormCount(this.value)" style="width:50px; background:#000; color:#fff; border:1px solid var(--gold); border-radius:4px; text-align:center; outline:none; font-family:'Rajdhani'; font-weight:bold;">
            </div>
            <div style="overflow-y:auto; padding-right:5px;">`;

        for (let i = 0; i < objState.formulariosCreacion; i++) {
            const fData = objState.colaNuevosObjetos[i] || { nombre: '', cant: 1, tipo: 'Consumible', mat: '-', rar: 'Común', eff: '' };
            html += `
                <div style="background:#0a0514; border:1px solid #4a1880; border-radius:8px; padding:12px; margin-bottom:15px; box-shadow:inset 0 0 10px rgba(74,24,128,0.2);">
                    <input type="text" id="forja-nom-${i}" placeholder="Nombre del Objeto Nuevo" value="${fData.nombre.replace(/"/g, '&quot;')}" oninput="window.devModFormObj(${i}, 'nombre', this.value, false)" style="width:100%; box-sizing:border-box; background:#000; color:var(--cyan-magic); border:1px solid #4a1880; padding:8px; border-radius:4px; font-weight:bold; margin-bottom:8px; outline:none;">
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px;">
                        <div><div style="color:#888; font-size:0.7em; margin-bottom:2px;">Dar a ${pjSeleccionado}</div><input type="number" id="forja-cant-${i}" min="1" value="${fData.cant}" oninput="window.devModFormObj(${i}, 'cant', parseInt(this.value)||0, false)" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:6px; border-radius:4px; outline:none;"></div>
                        <div><div style="color:#888; font-size:0.7em; margin-bottom:2px;">Material</div><select id="forja-mat-${i}" onchange="window.devModFormObj(${i}, 'mat', this.value, true)" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:6px; border-radius:4px; outline:none;">${MATERIALES_OBJ.map(m => `<option value="${m}" ${fData.mat === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px;">
                        <div><div style="color:#888; font-size:0.7em; margin-bottom:2px;">Tipo</div><select onchange="window.devModFormObj(${i}, 'tipo', this.value, true)" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:6px; border-radius:4px; outline:none;">${TIPOS_OBJ.map(t => `<option value="${t}" ${fData.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
                        <div><div style="color:#888; font-size:0.7em; margin-bottom:2px;">Rareza</div><select onchange="window.devModFormObj(${i}, 'rar', this.value, true)" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:6px; border-radius:4px; outline:none;">${RAREZAS_OBJ.map(r => `<option value="${r}" ${fData.rar === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
                    </div>
                    <div style="color:#888; font-size:0.7em; margin-bottom:2px;">Efecto / Descripción</div>
                    <textarea id="forja-eff-${i}" rows="2" placeholder="Describe el efecto..." oninput="window.devModFormObj(${i}, 'eff', this.value, false)" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:8px; border-radius:4px; outline:none; resize:vertical;">${fData.eff}</textarea>
                </div>`;
        }
        html += `</div>`;
    }
    else if (objState.vistaActiva === 'editar') {
        if (!objState.objAEditarSeleccionado) {
            html += `<input type="text" id="dev-search-edit" placeholder="🔍 Buscar en inventario para editar..." value="${objState.busquedaEdit}" oninput="window.devBusquedaObj(this.value, 'edit')" style="width:100%; box-sizing:border-box; background:#000; color:#ff4444; border:1px solid #ff4444; padding:10px; border-radius:6px; margin-bottom:15px; font-family:'Rajdhani'; outline:none;">
                     <div style="display:flex; flex-direction:column; gap:8px; overflow-y:auto; padding-right:5px;">`;

            let listaMostrar = [];
            if (objState.busquedaEdit === "") {
                const pjKey = pjSeleccionado.toLowerCase();
                const itemsBD = objState.inventariosDB[pjKey] ? Object.keys(objState.inventariosDB[pjKey]) : [];
                const itemsCola = objState.colaInventario[pjKey] ? Object.keys(objState.colaInventario[pjKey]) : [];
                const setUnico = new Set([...itemsBD, ...itemsCola]);
                listaMostrar = Array.from(setUnico).filter(obj => getCantidadActual(pjSeleccionado, obj) > 0);
            } else {
                listaMostrar = objState.catalogoDB.map(o => o.nombre).filter(nom => nom.toLowerCase().includes(objState.busquedaEdit));
            }

            if (listaMostrar.length === 0) html += `<div style="text-align:center; color:#555; padding:10px; font-size:0.9em;">No se encontraron objetos para editar.</div>`;
            else {
                listaMostrar.forEach(objNombre => {
                    const imgPath = `${STORAGE_URL}/imgobjetos/${norm(objNombre)}.png`;
                    const imgError = `this.onerror=null; this.src='${STORAGE_URL}/imginterfaz/no_encontrado.png'`;
                    const modificado = (objState.colaEdicionObjetos[objNombre] !== undefined);
                    const borderGlow = modificado ? 'border-color:#ff4444; box-shadow:0 0 8px rgba(255,68,68,0.3);' : 'border-color:#333;';

                    html += `
                    <div style="background:#050505; border:1px solid; ${borderGlow} border-radius:8px; padding:8px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                        <div style="display:flex; align-items:center; gap:10px; flex:1; overflow:hidden;">
                            <img src="${imgPath}" onerror="${imgError}" style="width:40px; height:40px; border-radius:4px; border:1px solid #444; object-fit:cover;">
                            <div style="color:#eee; font-weight:bold; font-size:0.9em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${objNombre}</div>
                        </div>
                        <button onclick="window.devSeleccionarObjEdit('${objNombre.replace(/'/g, "\\'")}')" style="background:#4a0000; color:#fff; border:1px solid #ff4444; border-radius:4px; padding:6px 12px; cursor:pointer; font-weight:bold; font-size:0.8em; flex-shrink:0;">✏️ EDITAR</button>
                    </div>`;
                });
            }
            html += `</div>`;
        } 
        else {
            const eData = objState.colaEdicionObjetos[objState.objAEditarSeleccionado];
            if (eData) {
                html += `
                <button onclick="window.devSeleccionarObjEdit('')" style="background:#222; color:#aaa; border:1px solid #444; padding:8px 12px; border-radius:4px; margin-bottom:15px; cursor:pointer; width:100%; font-weight:bold;">⬅ VOLVER A LA LISTA</button>
                <div style="background:#1a0505; border:1px solid #800000; border-radius:8px; padding:15px; box-shadow:inset 0 0 15px rgba(128,0,0,0.3); overflow-y:auto;">
                    <div style="color:#ffaa00; font-size:0.8em; margin-bottom:15px; font-style:italic;">⚠️ Modificar estos datos afectará a TODOS los jugadores que posean este objeto.</div>
                    
                    <div style="color:#888; font-size:0.7em; margin-bottom:2px;">Renombrar Objeto</div>
                    <input type="text" id="edit-nom" value="${eData.nombre.replace(/"/g, '&quot;')}" oninput="window.devModFormEdit('nombre', this.value, false)" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #800000; padding:10px; border-radius:4px; font-weight:bold; margin-bottom:12px; outline:none;">
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:12px;">
                        <div><div style="color:#888; font-size:0.7em; margin-bottom:2px;">Tipo</div><select onchange="window.devModFormEdit('tipo', this.value, true)" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:8px; border-radius:4px; outline:none;">${TIPOS_OBJ.map(t => `<option value="${t}" ${eData.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
                        <div><div style="color:#888; font-size:0.7em; margin-bottom:2px;">Rareza</div><select onchange="window.devModFormEdit('rar', this.value, true)" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:8px; border-radius:4px; outline:none;">${RAREZAS_OBJ.map(r => `<option value="${r}" ${eData.rar === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
                    </div>
                    
                    <div style="color:#888; font-size:0.7em; margin-bottom:2px;">Material</div>
                    <select id="edit-mat" onchange="window.devModFormEdit('mat', this.value, true)" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:8px; border-radius:4px; margin-bottom:12px; outline:none;">${MATERIALES_OBJ.map(m => `<option value="${m}" ${eData.mat === m ? 'selected' : ''}>${m}</option>`).join('')}</select>

                    <div style="color:#888; font-size:0.7em; margin-bottom:2px;">Efecto / Descripción</div>
                    <textarea id="edit-eff" rows="4" oninput="window.devModFormEdit('eff', this.value, false)" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:10px; border-radius:4px; outline:none; resize:vertical;">${eData.eff}</textarea>
                </div>`;
            }
        }
    }

    drawnHEXPreserveFocus(contenedorC, html);
}
