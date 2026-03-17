// ============================================================
// obj-data.js — VERSIÓN SUPABASE (OPTIMIZACIÓN MASIVA)
// ============================================================

import { invGlobal, objGlobal, statsGlobal, historial, estadoUI } from './obj-state.js';
import { db } from '../hex-db.js';
import { supabase } from '../hex-auth.js'; // Importamos supabase directo para el guardado en lote

// ── Carga inicial desde Supabase ─────────────────────────────
export async function cargarTodoDesdeCSV() {
    try {
        const [personajesArr, objetosArr, inventObjArr] = await Promise.all([
            db.personajes.getAll(),
            db.objetos.getCatalogo(),
            db.objetos.getInventarioCompleto()
        ]);

        // Limpieza en memoria
        for (let k in invGlobal) delete invGlobal[k];
        for (let k in objGlobal) delete objGlobal[k];
        for (let k in statsGlobal) delete statsGlobal[k];

        // 1. Cargar Personajes
        personajesArr.forEach(p => {
            statsGlobal[p.nombre] = { 
                isPlayer: p.is_player, 
                isActive: p.is_active, 
                iconoOverride: p.icono_override || '' 
            };
            invGlobal[p.nombre] = {};
        });

        // 2. Cargar Catálogo de Objetos
        objetosArr.forEach(o => {
            objGlobal[o.nombre] = { 
                tipo: o.tipo || '-', 
                mat: o.material || '-', 
                eff: o.efecto || 'Sin descripción', 
                rar: o.rareza || 'Común' 
            };
        });

        // 3. Cargar Inventarios
        inventObjArr.forEach(row => {
            const p = row.personaje_nombre.toLowerCase();
            // Evitar case-sensitivity en los nombres de personajes
            const nombreRealPj = Object.keys(invGlobal).find(k => k.toLowerCase() === p) || row.personaje_nombre;
            const o = row.objeto_nombre;
            
            if (!invGlobal[nombreRealPj]) invGlobal[nombreRealPj] = {};
            invGlobal[nombreRealPj][o] = row.cantidad;
            
            if (!objGlobal[o] && row.objetos) {
                objGlobal[o] = { 
                    tipo: row.objetos.tipo || '-', 
                    mat: row.objetos.material || '-', 
                    eff: row.objetos.efecto || 'Sin descripción', 
                    rar: row.objetos.rareza || 'Común' 
                };
            }
        });

        return true;
    } catch(e) {
        console.error("Error al cargar datos desde Supabase:", e);
        return false;
    }
}

// ── Sincronización Optimizada por Lotes ─────────────────────────
export async function sincronizarObjetosBD(colaCambios, esAdmin = false) {
    let logErrores = [];
    try {
        const catalogUpserts = [];
        const invUpserts = [];
        const deletePromises = []; // Arreglo para lanzar todos los borrados al mismo tiempo

        for (const [nombreObj, data] of Object.entries(colaCambios)) {
            
            // Acción 1: Eliminar objeto de raíz (solo admin)
            if (data.__ELIMINAR_OBJETO__) {
                if (!esAdmin) { logErrores.push(`Sin permisos para eliminar: ${nombreObj}`); continue; }
                // Agregamos la promesa de borrado a la lista en lugar de esperar
                deletePromises.push(supabase.from('objetos').delete().eq('nombre', nombreObj));
                continue;
            }

            // Acción 2: Preparar datos para el Catálogo (solo admin)
            if (esAdmin) {
                const objInfo = objGlobal[nombreObj];
                if (objInfo) {
                    catalogUpserts.push({
                        nombre: nombreObj,
                        tipo: objInfo.tipo,
                        material: objInfo.mat,
                        efecto: objInfo.eff,
                        rareza: objInfo.rar
                    });
                }
            }

            // Acción 3: Preparar datos para el Inventario
            Object.keys(invGlobal).forEach(jugador => {
                const cant = invGlobal[jugador][nombreObj] || 0;
                if (cant > 0) {
                    invUpserts.push({
                        personaje_nombre: jugador,
                        objeto_nombre: nombreObj,
                        cantidad: cant
                    });
                } else {
                    // Si la cantidad es 0, lo mandamos a borrar concurrentemente
                    deletePromises.push(
                        supabase.from('inventario_objetos')
                            .delete()
                            .eq('personaje_nombre', jugador)
                            .eq('objeto_nombre', nombreObj)
                    );
                }
            });
        }

        // --- EJECUCIÓN MASIVA A VELOCIDAD LUZ ---

        // 1. Ejecutar todos los borrados AL MISMO TIEMPO (Adiós cuellos de botella)
        if (deletePromises.length > 0) {
            const deleteResults = await Promise.all(deletePromises);
            deleteResults.forEach(res => {
                if (res.error) logErrores.push(`Fallo en borrado: ${res.error.message}`);
            });
        }

        // 2. Guardar todo el catálogo nuevo/actualizado en 1 solo viaje
        if (catalogUpserts.length > 0) {
            const { error } = await supabase.from('objetos').upsert(catalogUpserts, { onConflict: 'nombre' });
            if (error) logErrores.push(`Fallo al actualizar catálogo: ${error.message}`);
        }

        // 3. Guardar todas las cantidades de inventario en 1 solo viaje
        if (invUpserts.length > 0) {
            const { error } = await supabase.from('inventario_objetos').upsert(invUpserts, { onConflict: 'personaje_nombre,objeto_nombre' });
            if (error) logErrores.push(`Fallo al asignar stock: ${error.message}`);
        }

        // Manejo final de errores
        if (logErrores.length > 0) {
            alert("⚠️ Problemas al guardar en Supabase:\n\n" + logErrores.join('\n'));
            return false;
        }

        return true;
    } catch(e) {
        console.error("Crash Crítico en sincronizarObjetosBD:", e);
        alert("Error crítico de base de datos:\n" + e.message);
        return false;
    }
}
