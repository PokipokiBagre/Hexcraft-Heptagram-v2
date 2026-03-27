// ============================================================
// dev-logic.js — Lógica de Sincronización y Logs
// ============================================================

import { db } from '../hex-db.js';
import { supabase } from '../hex-auth.js'; // 🌟 Importación directa a Supabase
import { devState } from './dev-state.js';
import { objState } from './objetos/panel-objetos-state.js';
// (Aquí importaremos en el futuro los states de Stats y Hechizos)

// 🌟 SUPERVISOR DE CAMBIOS
export function revisarCambiosPendientes() {
    const btnSync = document.getElementById('btn-sync-global');
    if (!btnSync) return;

    let hayCambios = false;

    if (Object.keys(objState.colaInventario).length > 0) hayCambios = true;
    if (Object.values(objState.colaNuevosObjetos).some(o => o.nombre.trim() !== '')) hayCambios = true;
    if (Object.keys(objState.colaEdicionObjetos).length > 0) hayCambios = true;

    // (Aquí revisaremos las colas de Stats y Hechizos)

    if (hayCambios) btnSync.classList.remove('oculto');
    else btnSync.classList.add('oculto');
}

// 🌟 GENERADOR INTELIGENTE DEL PORTAPAPELES
export function actualizarLogGlobal() {
    const logPorPJ = {};

    // 1. Rastreo de Inventario (Objetos)
    for (const pjKey in objState.colaInventario) {
        const realPj = devState.listaPersonajes.find(p => p.nombre.toLowerCase() === pjKey)?.nombre || pjKey;

        for (const objNombre in objState.colaInventario[pjKey]) {
            const cantNueva = objState.colaInventario[pjKey][objNombre];
            const cantVieja = objState.inventariosDB[pjKey]?.[objNombre] || 0;
            const delta = cantNueva - cantVieja; 

            if (delta !== 0) {
                if (!logPorPJ[realPj]) logPorPJ[realPj] = [];
                const catObj = objState.catalogoDB.find(o => o.nombre === objNombre);
                const eff = catObj && catObj.efecto ? catObj.efecto.replace(/\r?\n/g, ' ').trim() : '';
                const effStr = eff ? ` | ${eff}` : '';

                if (delta > 0) logPorPJ[realPj].push(`Obj Obt: ${objNombre} x${delta}${effStr}`);
                else logPorPJ[realPj].push(`Obj Prd: ${objNombre} x${Math.abs(delta)}`);
            }
        }
    }

    // 2. Rastreo de Forja (Nuevos Objetos)
    const pjActual = devState.pjSeleccionado || "SIN_ASIGNAR";
    const nuevosArr = Object.values(objState.colaNuevosObjetos).filter(o => o.nombre.trim() !== '');
    
    for (const obj of nuevosArr) {
        if (obj.cant > 0) {
            if (!logPorPJ[pjActual]) logPorPJ[pjActual] = [];
            const eff = obj.eff ? obj.eff.replace(/\r?\n/g, ' ').trim() : '';
            const effStr = eff ? ` | ${eff}` : '';
            logPorPJ[pjActual].push(`Obj Obt: ${obj.nombre} x${obj.cant}${effStr}`);
        }
    }

    // 3. Formateo Final
    let logText = "";
    for (const pj in logPorPJ) {
        if (logPorPJ[pj].length > 0) {
            logText += `${pj}\n`;
            logPorPJ[pj].forEach(line => { logText += `${line}\n`; });
            logText += `\n`;
        }
    }

    const textarea = document.getElementById('log-global-textarea');
    if (textarea) textarea.value = logText.trim();
}

// 🌟 EL GRAN BOTÓN DE GUARDADO DIRECTO A SUPABASE
export async function ejecutarGuardadoGlobal() {
    const btnSync = document.getElementById('btn-sync-global');
    btnSync.innerText = "⏳ SINCRONIZANDO CON LA BASE DE DATOS...";
    btnSync.style.pointerEvents = "none";

    try {
        const catalogUpserts = [];
        const invUpserts = [];
        const deletePromises = []; 

        // --- 1. PROCESAR FORJA (Nuevos Objetos) ---
        const nuevosArr = Object.values(objState.colaNuevosObjetos).filter(o => o.nombre.trim() !== '');
        for (const obj of nuevosArr) {
            catalogUpserts.push({ nombre: obj.nombre, tipo: obj.tipo, material: obj.mat, rareza: obj.rar, efecto: obj.eff });
            if (obj.cant > 0) {
                invUpserts.push({ personaje_nombre: devState.pjSeleccionado, objeto_nombre: obj.nombre, cantidad: obj.cant });
            }
        }

        // --- 2. PROCESAR EDICIONES (Soporte para Cambio de Nombre) ---
        for (const oldName in objState.colaEdicionObjetos) {
            const dataEdit = objState.colaEdicionObjetos[oldName];
            const newName = dataEdit.nombre;

            // Siempre actualizamos/creamos el objeto en el catálogo con sus datos nuevos
            catalogUpserts.push({ nombre: newName, tipo: dataEdit.tipo, material: dataEdit.mat, rareza: dataEdit.rar, efecto: dataEdit.eff });

            // ⚠️ MIGRACIÓN: Si el nombre cambió, transferir los inventarios y borrar el objeto viejo
            if (oldName !== newName) {
                Object.keys(objState.inventariosDB).forEach(pj => {
                    if (objState.inventariosDB[pj][oldName] > 0) {
                        // Pasar la cantidad al nombre nuevo
                        invUpserts.push({ personaje_nombre: pj, objeto_nombre: newName, cantidad: objState.inventariosDB[pj][oldName] });
                        // Borrar el registro del nombre viejo
                        deletePromises.push(supabase.from('inventario_objetos').delete().eq('personaje_nombre', pj).eq('objeto_nombre', oldName));
                    }
                });
                // Borrar el objeto viejo del catálogo
                deletePromises.push(supabase.from('objetos').delete().eq('nombre', oldName));
            }
        }

        // --- 3. PROCESAR INVENTARIOS (Sumas y Restas desde la interfaz Global o Inv) ---
        for (const pj in objState.colaInventario) {
            for (const obj in objState.colaInventario[pj]) {
                const cantFinal = objState.colaInventario[pj][obj];
                if (cantFinal > 0) {
                    invUpserts.push({ personaje_nombre: pj, objeto_nombre: obj, cantidad: cantFinal });
                } else {
                    // Si la cantidad bajó a 0, borramos la fila para no dejar basura en la BD
                    deletePromises.push(supabase.from('inventario_objetos').delete().eq('personaje_nombre', pj).eq('objeto_nombre', obj));
                }
            }
        }

        // =========================================================
        // 🔥 LANZAMIENTO MASIVO A SUPABASE 🔥
        // =========================================================

        // A. Ejecutar los borrados (vaciados de inventario o cambios de nombre)
        if (deletePromises.length > 0) await Promise.all(deletePromises);

        // B. Actualizar el Catálogo de Objetos
        if (catalogUpserts.length > 0) {
            const { error: errCat } = await supabase.from('objetos').upsert(catalogUpserts, { onConflict: 'nombre' });
            if (errCat) throw new Error("Error en Catálogo: " + errCat.message);
        }

        // C. Actualizar Inventarios
        if (invUpserts.length > 0) {
            const { error: errInv } = await supabase.from('inventario_objetos').upsert(invUpserts, { onConflict: 'personaje_nombre,objeto_nombre' });
            if (errInv) throw new Error("Error en Inventarios: " + errInv.message);
        }

        // --- PROCESAR STATS Y HECHIZOS (AQUÍ IRÁN LUEGO) ---

        // Limpiar memoria
        objState.colaInventario = {}; 
        objState.colaNuevosObjetos = {};
        objState.colaEdicionObjetos = {};

        // Éxito visual
        btnSync.innerText = "✅ CAMBIOS APLICADOS";
        btnSync.style.background = "#004a00";
        btnSync.style.borderColor = "#00ff00";
        btnSync.style.color = "white";

        setTimeout(() => {
            window.location.reload(); 
        }, 1000);

    } catch (e) {
        console.error("Error guardando en BD:", e);
        alert("Ocurrió un error guardando en Supabase:\n" + e.message);
        btnSync.innerText = "❌ ERROR AL GUARDAR";
        btnSync.style.background = "#4a0000";
        btnSync.style.pointerEvents = "auto";
    }
}
