// ============================================================
// obj-data.js — VERSIÓN SUPABASE (ESTABILIDAD MÁXIMA)
// Reemplaza los fetch de Google Sheets
// ============================================================

import { invGlobal, objGlobal, statsGlobal, historial, estadoUI } from './obj-state.js';
import { db } from '../hex-db.js';

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
            const p = row.personaje_nombre;
            const o = row.objeto_nombre;
            
            // Si el personaje fue borrado pero quedan rastros, inicializamos
            if (!invGlobal[p]) invGlobal[p] = {};
            invGlobal[p][o] = row.cantidad;
            
            // Si el objeto no está en el catálogo, lo creamos temporalmente
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

export async function sincronizarObjetosBD(colaCambios, esAdmin = false) {
    let logErrores = [];
    try {
        for (const [nombreObj, data] of Object.entries(colaCambios)) {
            
            // Acción 1: Eliminar objeto de raíz (solo admin)
            if (data.__ELIMINAR_OBJETO__) {
                if (!esAdmin) { logErrores.push(`Sin permisos para eliminar: ${nombreObj}`); continue; }
                const ok = await db.objetos.eliminarObjeto(nombreObj);
                if (!ok) logErrores.push(`Fallo al eliminar: ${nombreObj}`);
                continue;
            }

            // Acción 2: Actualizar Catálogo de Objetos (solo admin)
            if (esAdmin) {
                const objInfo = objGlobal[nombreObj];
                if (objInfo) {
                    const okObj = await db.objetos.upsertObjeto({
                        nombre: nombreObj,
                        tipo: objInfo.tipo,
                        material: objInfo.mat,
                        efecto: objInfo.eff,
                        rareza: objInfo.rar
                    });
                    if (!okObj) logErrores.push(`Fallo al actualizar catálogo: ${nombreObj}`);
                }
            }

            // Acción 3: Actualizar Inventarios (todos pueden)
            const changes = [];
            Object.keys(invGlobal).forEach(jugador => {
                const cant = invGlobal[jugador][nombreObj] || 0;
                changes.push({
                    personaje_nombre: jugador,
                    objeto_nombre: nombreObj,
                    cantidad: cant
                });
            });
            
            if (changes.length > 0) {
                const okInv = await db.objetos.sincronizarBatch(changes);
                if (!okInv) logErrores.push(`Fallo al asignar stock del objeto: ${nombreObj}`);
            }
        }

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
