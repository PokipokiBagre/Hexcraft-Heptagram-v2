// ============================================================
// panel-objetos-ui.js — Renderizado de la Columna de Objetos
// ============================================================

import { objState, STORAGE_URL, TIPOS_OBJ, RAREZAS_OBJ } from './panel-objetos-state.js';
import { getCantidadActual, modificarCantidad, actualizarFormularioNuevo, setCantidadFormularios, setBusquedaObjeto } from './panel-objetos-logic.js';

// Hacemos las funciones globales para que los botones del HTML puedan llamarlas
window.devModObjeto = modificarCantidad;
window.devModFormObj = actualizarFormularioNuevo;
window.devSetFormCount = setCantidadFormularios;
window.devBusquedaObj = setBusquedaObjeto;

const norm = (str) => str.toString().trim().toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');

export function renderColumnaObjetos(pjSeleccionado) {
    const contenedor = document.getElementById('content-items');
    if (!contenedor) return;

    if (!pjSeleccionado) {
        contenedor.innerHTML = `<div style="text-align:center; color:#666; margin-top:50px; font-style:italic;">Selecciona un personaje arriba para gestionar sus objetos.</div>`;
        return;
    }

    let html = `
        <input type="text" placeholder="🔍 Buscar objeto en la base de datos..." 
               value="${objState.busqueda}" 
               oninput="window.devBusquedaObj(this.value)" 
               style="width:100%; box-sizing:border-box; background:#000; color:var(--gold); border:1px solid var(--gold-dim); padding:10px; border-radius:6px; margin-bottom:15px; font-family:'Rajdhani';">
        
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:25px; max-height:350px; overflow-y:auto; padding-right:5px;">
    `;

    // Lógica de filtrado: Si no hay búsqueda, muestra el inventario actual. Si busca, busca en el catálogo global.
    let listaMostrar = [];
    if (objState.busqueda === "") {
        // Mostrar inventario actual del personaje
        const pjKey = pjSeleccionado.toLowerCase();
        
        // Juntamos lo de la BD y lo de la Cola temporal
        const itemsBD = objState.inventariosDB[pjKey] ? Object.keys(objState.inventariosDB[pjKey]) : [];
        const itemsCola = objState.colaInventario[pjKey] ? Object.keys(objState.colaInventario[pjKey]) : [];
        
        const setUnico = new Set([...itemsBD, ...itemsCola]);
        listaMostrar = Array.from(setUnico).filter(obj => getCantidadActual(pjSeleccionado, obj) > 0);
    } else {
        // Mostrar resultados de búsqueda del catálogo global
        listaMostrar = objState.catalogoDB
            .map(o => o.nombre)
            .filter(nom => nom.toLowerCase().includes(objState.busqueda));
    }

    if (listaMostrar.length === 0) {
        html += `<div style="text-align:center; color:#555; padding:10px; font-size:0.9em;">No se encontraron objetos. Usa la forja abajo para crear uno nuevo.</div>`;
    } else {
        listaMostrar.forEach(objNombre => {
            const cant = getCantidadActual(pjSeleccionado, objNombre);
            const imgPath = `${STORAGE_URL}/imgobjetos/${norm(objNombre)}.png`;
            const imgError = `this.onerror=null; this.src='${STORAGE_URL}/imginterfaz/no_encontrado.png'`;
            
            // Clase especial si el objeto fue modificado en esta sesión
            const pjKey = pjSeleccionado.toLowerCase();
            const modificado = (objState.colaInventario[pjKey] && objState.colaInventario[pjKey][objNombre] !== undefined);
            const borderGlow = modificado ? 'border-color:var(--cyan-magic); box-shadow:0 0 8px rgba(0,255,255,0.3);' : 'border-color:#333;';

            html += `
            <div style="background:#050505; border:1px solid; ${borderGlow} border-radius:8px; padding:8px; display:flex; flex-direction:column; gap:8px;">
                
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${imgPath}" onerror="${imgError}" style="width:40px; height:40px; border-radius:4px; border:1px solid #444; object-fit:cover;">
                    <div style="flex:1; line-height:1.2;">
                        <div style="color:#eee; font-weight:bold; font-size:0.95em;">${objNombre}</div>
                        <div style="color:var(--gold); font-size:0.8em; font-family:'Cinzel';">Stock: ${cant}</div>
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; gap:2px;">
                    <div style="display:flex; gap:2px;">
                        <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre}', -20)" style="background:#4a0000; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">-20</button>
                        <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre}', -5)" style="background:#660000; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">-5</button>
                        <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre}', -3)" style="background:#800000; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">-3</button>
                        <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre}', -1)" style="background:#a00000; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">-1</button>
                    </div>
                    <div style="display:flex; gap:2px;">
                        <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre}', 1)" style="background:#006600; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">+1</button>
                        <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre}', 3)" style="background:#008000; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">+3</button>
                        <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre}', 5)" style="background:#00a000; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">+5</button>
                        <button onclick="window.devModObjeto('${pjSeleccionado}', '${objNombre}', 20)" style="background:#00cc00; color:#fff; border:none; border-radius:3px; padding:4px 6px; cursor:pointer; font-weight:bold; font-size:0.75em;">+20</button>
                    </div>
                </div>
            </div>`;
        });
    }

    html += `</div>`;

    // =========================================================
    // FORJA DE OBJETOS NUEVOS
    // =========================================================
    html += `
        <div style="border-top:2px dashed #333; padding-top:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h4 style="color:var(--gold); margin:0; font-family:'Cinzel';">🛠️ Forjar Nuevos</h4>
                <div style="display:flex; align-items:center; gap:5px;">
                    <span style="color:#888; font-size:0.8em;">Cant. Diseños:</span>
                    <input type="number" min="1" max="10" value="${objState.formulariosCreacion}" onchange="window.devSetFormCount(this.value)" 
                           style="width:50px; background:#000; color:#fff; border:1px solid #555; border-radius:4px; text-align:center; outline:none;">
                </div>
            </div>
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
                <textarea rows="2" placeholder="Describe el efecto del objeto..." oninput="window.devModFormObj(${i}, 'eff', this.value)"
                          style="width:100%; box-sizing:border-box; background:#000; color:#fff; border:1px solid #444; padding:8px; border-radius:4px; outline:none; resize:vertical;">${fData.eff}</textarea>
            </div>
        `;
    }

    html += `</div>`;
    contenedor.innerHTML = html;
}
