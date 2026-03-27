// ============================================================
// panel-objetos-ui.js — Renderizado de la Columna de Objetos
// ============================================================

import { objState, STORAGE_URL, TIPOS_OBJ, RAREZAS_OBJ } from './panel-objetos-state.js';
import { getCantidadActual, modificarCantidad, actualizarFormularioNuevo, setCantidadFormularios, setBusquedaObjeto, cambiarVistaObjetos, seleccionarObjetoParaEditar, modificarObjetoEdicion } from './panel-objetos-logic.js';

// Conexión de botones del HTML a la lógica
window.devModObjeto = modificarCantidad;
window.devModFormObj = actualizarFormularioNuevo;
window.devSetFormCount = setCantidadFormularios;
window.devBusquedaObj = setBusquedaObjeto;
window.devSetVistaObj = cambiarVistaObjetos;
window.devSeleccionarObjEdit = seleccionarObjetoParaEditar;
window.devModFormEdit = modificarObjetoEdicion;

const norm = (str) => str.toString().trim().toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');

export function renderColumnaObjetos(pjSeleccionado) {
    const contenedor = document.getElementById('content-items');
    if (!contenedor) return;

    if (!pjSeleccionado) {
        contenedor.innerHTML = `<div style="text-align:center; color:#666; margin-top:50px; font-style:italic;">Selecciona un personaje arriba para gestionar sus objetos.</div>`;
        return;
    }

    // 1. TABS DE NAVEGACIÓN
    let html = `
        <div style="display:flex; gap:5px; margin-bottom:15px;">
            <button onclick="window.devSetVistaObj('inventario')" style="flex:1; padding:8px; border-radius:4px; border:1px solid #444; background:${objState.vistaActiva==='inventario'?'var(--cyan-magic)':'#111'}; color:${objState.vistaActiva==='inventario'?'#000':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">🎒 Inv</button>
            <button onclick="window.devSetVistaObj('forja')" style="flex:1; padding:8px; border-radius:4px; border:1px solid #444; background:${objState.vistaActiva==='forja'?'var(--gold)':'#111'}; color:${objState.vistaActiva==='forja'?'#000':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">🛠️ Forjar</button>
            <button onclick="window.devSetVistaObj('editar')" style="flex:1; padding:8px; border-radius:4px; border:1px solid #444; background:${objState.vistaActiva==='editar'?'#ff4444':'#111'}; color:${objState.vistaActiva==='editar'?'#fff':'#aaa'}; font-weight:bold; cursor:pointer; font-family:'Cinzel'; transition:0.2s;">✏️ Editar</button>
        </div>
    `;

    // =========================================================
    // VISTA 1: INVENTARIO Y CATÁLOGO
    // =========================================================
    if (objState.vistaActiva === 'inventario') {
        html += `<input type="text" placeholder="🔍 Buscar objeto en la base de datos..." 
                       value="${objState.busqueda}" 
                       oninput="window.devBusquedaObj(this.value)" 
                       style="width:100%; box-sizing:border-box; background:#000; color:var(--cyan-magic); border:1px solid var(--cyan-magic); padding:10px; border-radius:6px; margin-bottom:15px; font-family:'Rajdhani'; outline:none;">
                 <div style="display:flex; flex-direction:column; gap:8px; overflow-y:auto; padding-right:5px;">`;

        let listaMostrar = [];
        if (objState.busqueda === "") {
            const pjKey = pjSeleccionado.toLowerCase();
            const itemsBD = objState.inventariosDB[pjKey] ? Object.keys(objState.inventariosDB[pjKey]) : [];
            const itemsCola = objState.colaInventario[pjKey] ? Object.keys(objState.colaInventario[pjKey]) : [];
            const setUnico = new Set([...itemsBD, ...itemsCola]);
            listaMostrar = Array.from(setUnico).filter(obj => getCantidadActual(pjSeleccionado, obj) > 0);
        } else {
            listaMostrar = objState.catalogoDB.map(o => o.nombre).filter(nom => nom.toLowerCase().includes(objState.busqueda));
        }

        if (listaMostrar.length === 0) {
            html += `<div style="text-align:center; color:#555; padding:10px; font-size:0.9em;">No se encontraron objetos. Revisa la pestaña de forja.</div>`;
        } else {
            listaMostrar.forEach(objNombre => {
                const cant = getCantidadActual(pjSeleccionado, objNombre);
                const imgPath = `${STORAGE_URL}/imgobjetos/${norm(objNombre)}.png`;
                const imgError = `this.onerror=null; this.src='${STORAGE_URL}/imginterfaz/no_encontrado.png'`;
                
                const modificado = (objState.colaInventario[pjSeleccionado.toLowerCase()] && objState.colaInventario[pjSeleccionado.toLowerCase()][objNombre] !== undefined);
                const borderGlow = modificado ? 'border-color:var(--cyan-magic); box-shadow:0 0 8px rgba(0,255,255,0.3);' : 'border-color:#333;';

                html += `
                <div style="background:#050505; border:1px solid; ${borderGlow} border-radius:8px; padding:8px; display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${imgPath}" onerror="${imgError}" style="width:40px; height:40px; border-radius:4px; border:1px solid #444; object-fit:cover;">
                        <div style="flex:1; line-height:1.2;">
                            <div style="color:#eee; font-weight:bold; font-size:0.95em;">${objNombre}</div>
                            <div style="color:var(--gold); font-size:0.8em; font-family:'Cinzel';">Stock Actual: ${cant}</div>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; gap:2px;">
                        <div style="display:flex; gap:2px;">
                            <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre}', -20)" style="background:#4a0000; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">-20</button>
                            <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre}', -5)" style="background:#660000; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">-5</button>
                            <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre}', -1)" style="background:#a00000; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">-1</button>
                        </div>
                        <div style="display:flex; gap:2px;">
                            <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre}', 1)" style="background:#006600; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">+1</button>
                            <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre}', 5)" style="background:#00a000; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">+5</button>
                            <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre}', 20)" style="background:#00cc00; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">+20</button>
                        </div>
                    </div>
                </div>`;
            });
        }
        html += `</div>`;
    }

    // =========================================================
    // VISTA 2: FORJAR NUEVO OBJETO
    // =========================================================
    else if (objState.vistaActiva === 'forja') {
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h4 style="color:var(--gold); margin:0; font-family:'Cinzel';">🛠️ Modelos a Crear</h4>
                <div style="display:flex; align-items:center; gap:5px;">
                    <input type="number" min="1" max="10" value="${objState.formulariosCreacion}" onchange="window.devSetFormCount(this.value)" 
                           style="width:50px; background:#000; color:#fff; border:1px solid var(--gold); border-radius:4px; text-align:center; outline:none; font-family:'Rajdhani'; font-weight:bold;">
                </div>
            </div>
            <div style="overflow-y:auto; padding-right:5px;">
        `;

        for (let i = 0; i < objState.formulariosCreacion; i++) {
            const fData = objState.colaNuevosObjetos[i] || { nombre: '', cant: 1, tipo: 'Arma', mat: '-', rar: 'Común', eff: '' };
            html += `
                <div style="background:#0a0514; border:1px solid #4a1880; border-radius:8px; padding:12px; margin-bottom:15px; box-shadow:inset 0 0 10px rgba(74,24,128,0.2);">
                    <input type="text" placeholder="Nombre del Objeto Nuevo" value="${fData.nombre.replace(/"/g, '&quot;')}" 
                           oninput="window.devModFormObj(${i}, 'nombre', this.value)"
                           style="width:100%; box-sizing:border-box; background:#000; color:var(--cyan-magic); border:1px solid #4a1880; padding:8px; border-radius:4px; font-weight:bold; margin-bottom:8px; outline:none;">
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px;">
                        <div>
                            <div style="color:#888; font-size:0.7em; margin-bottom:2px;">Dar a ${pjSeleccionado}</div>
                            <input type="number" min="1" value="${fData.cant}" oninput="window.devModFormObj(${i}, 'cant', parseInt(this.value)||0)"
                                   style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:6px; border-radius:4px; outline:none;">
                        </div>
                        <div>
                            <div style="color:#888; font-size:0.7em; margin-bottom:2px;">Material</div>
                            <input type="text" value="${fData.mat}" oninput="window.devModFormObj(${i}, 'mat', this.value)"
                                   style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:6px; border-radius:4px; outline:none;">
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px;">
                        <div>
                            <div style="color:#888; font-size:0.7em; margin-bottom:2px;">Tipo</div>
                            <select onchange="window.devModFormObj(${i}, 'tipo', this.value)" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:6px; border-radius:4px; outline:none;">
                                ${TIPOS_OBJ.map(t => `<option value="${t}" ${fData.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <div style="color:#888; font-size:0.7em; margin-bottom:2px;">Rareza</div>
                            <select onchange="window.devModFormObj(${i}, 'rar', this.value)" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:6px; border-radius:4px; outline:none;">
                                ${RAREZAS_OBJ.map(r => `<option value="${r}" ${fData.rar === r ? 'selected' : ''}>${r}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div style="color:#888; font-size:0.7em; margin-bottom:2px;">Efecto / Descripción</div>
                    <textarea rows="2" placeholder="Describe el efecto..." oninput="window.devModFormObj(${i}, 'eff', this.value)"
                              style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:8px; border-radius:4px; outline:none; resize:vertical;">${fData.eff}</textarea>
                </div>
            `;
        }
        html += `</div>`;
    }

    // =========================================================
    // VISTA 3: EDITAR OBJETO EXISTENTE
    // =========================================================
    else if (objState.vistaActiva === 'editar') {
        
        // Recopilamos qué objetos tiene el personaje actualmente (para mostrarlos en el select)
        const pjKey = pjSeleccionado.toLowerCase();
        const itemsBD = objState.inventariosDB[pjKey] ? Object.keys(objState.inventariosDB[pjKey]) : [];
        const itemsCola = objState.colaInventario[pjKey] ? Object.keys(objState.colaInventario[pjKey]) : [];
        const listaPersonaje = Array.from(new Set([...itemsBD, ...itemsCola])).filter(obj => getCantidadActual(pjSeleccionado, obj) > 0);

        html += `
            <div style="color:#aaa; font-size:0.85em; margin-bottom:8px;">Selecciona un objeto del inventario de ${pjSeleccionado}:</div>
            <select onchange="window.devSeleccionarObjEdit(this.value)" style="width:100%; padding:12px; background:#050010; color:#fff; border:1px solid #ff4444; border-radius:6px; margin-bottom:20px; outline:none; font-family:'Rajdhani'; font-size:1.1em;">
                <option value="">-- Buscar objeto a editar --</option>
                ${listaPersonaje.map(o => `<option value="${o.replace(/"/g, '&quot;')}" ${objState.objAEditarSeleccionado === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
        `;

        if (objState.objAEditarSeleccionado) {
            const eData = objState.colaEdicionObjetos[objState.objAEditarSeleccionado];
            if (eData) {
                html += `
                <div style="background:#1a0505; border:1px solid #800000; border-radius:8px; padding:15px; box-shadow:inset 0 0 15px rgba(128,0,0,0.3); overflow-y:auto;">
                    <div style="color:#ffaa00; font-size:0.8em; margin-bottom:15px; font-style:italic;">⚠️ Precaución: Modificar estos datos afectará a TODOS los jugadores que posean este objeto.</div>
                    
                    <div style="color:#888; font-size:0.7em; margin-bottom:2px;">Renombrar Objeto (Elige bien)</div>
                    <input type="text" value="${eData.nombre.replace(/"/g, '&quot;')}" 
                           oninput="window.devModFormEdit('nombre', this.value)"
                           style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #800000; padding:10px; border-radius:4px; font-weight:bold; margin-bottom:12px; outline:none;">
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:12px;">
                        <div>
                            <div style="color:#888; font-size:0.7em; margin-bottom:2px;">Tipo</div>
                            <select onchange="window.devModFormEdit('tipo', this.value)" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:8px; border-radius:4px; outline:none;">
                                ${TIPOS_OBJ.map(t => `<option value="${t}" ${eData.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <div style="color:#888; font-size:0.7em; margin-bottom:2px;">Rareza</div>
                            <select onchange="window.devModFormEdit('rar', this.value)" style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:8px; border-radius:4px; outline:none;">
                                ${RAREZAS_OBJ.map(r => `<option value="${r}" ${eData.rar === r ? 'selected' : ''}>${r}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div style="color:#888; font-size:0.7em; margin-bottom:2px;">Material</div>
                    <input type="text" value="${eData.mat.replace(/"/g, '&quot;')}" oninput="window.devModFormEdit('mat', this.value)"
                           style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:10px; border-radius:4px; margin-bottom:12px; outline:none;">

                    <div style="color:#888; font-size:0.7em; margin-bottom:2px;">Efecto / Descripción</div>
                    <textarea rows="4" oninput="window.devModFormEdit('eff', this.value)"
                              style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:10px; border-radius:4px; outline:none; resize:vertical;">${eData.eff}</textarea>
                </div>`;
            }
        }
    }

    contenedor.innerHTML = html;
}
