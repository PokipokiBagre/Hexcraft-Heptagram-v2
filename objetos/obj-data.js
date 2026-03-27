// ============================================================
// obj-data.js — VERSIÓN SUPABASE (OPTIMIZACIÓN MASIVA)
// ============================================================

import { invGlobal, objGlobal, statsGlobal, historial, estadoUI, propuestasGlobal, eqpGlobal } from './obj-state.js';
import { db } from '../hex-db.js';
import { supabase } from '../hex-auth.js';

// ── Carga inicial desde Supabase ─────────────────────────────
export async function cargarTodoDesdeCSV() {
    try {
        // 🌟 Ahora consultamos inventario_objetos directamente para traer la columna "equipado"
        const [personajesArr, objetosArr, inventObjRes] = await Promise.all([
            db.personajes.getAll(),
            db.objetos.getCatalogo(),
            supabase.from('inventario_objetos').select('*') 
        ]);
        const inventObjArr = inventObjRes.data || [];

        for (let k in invGlobal) delete invGlobal[k];
        for (let k in objGlobal) delete objGlobal[k];
        for (let k in statsGlobal) delete statsGlobal[k];
        for (let k in eqpGlobal) delete eqpGlobal[k]; // 🌟 Limpiamos eqpGlobal

        personajesArr.forEach(p => {
            statsGlobal[p.nombre] = { 
                isPlayer: p.is_player, 
                isActive: p.is_active, 
                iconoOverride: p.icono_override || '' 
            };
            invGlobal[p.nombre] = {};
            eqpGlobal[p.nombre] = {}; // 🌟 Inicializamos equipo
        });

        // Separar propuestas de objetos aprobados
        propuestasGlobal.length = 0;
        objetosArr.forEach(o => {
            if (o.es_propuesta) {
                propuestasGlobal.push(o);
            } else {
                objGlobal[o.nombre] = { tipo: o.tipo, mat: o.material, eff: o.efecto, rar: o.rareza };
            }
        });

        inventObjArr.forEach(item => {
            const pj = item.personaje_nombre;
            const obj = item.objeto_nombre;
            if (invGlobal[pj]) {
                invGlobal[pj][obj] = item.cantidad;
                eqpGlobal[pj][obj] = item.equipado || false; // 🌟 Guardamos estado de equipación
            }
        });

        estadoUI.resetCacheOrder = true;
        return true;
    } catch (e) {
        console.error("Error cargando DB:", e);
        return false;
    }
}

// ── Sincronización Automática al Servidor ─────────────────────────────
export async function sincronizarObjetosBD() {
    if (!estadoUI.colaCambios || Object.keys(estadoUI.colaCambios).length === 0) return true;

    try {
        const catalogUpserts = [];
        const deletePromises = [];
        const invUpserts = [];
        let logErrores = [];

        Object.keys(estadoUI.colaCambios).forEach(objNombre => {
            const flag = estadoUI.colaCambios[objNombre];
            
            if (flag.__ELIMINAR_OBJETO__) {
                deletePromises.push(supabase.from('objetos').delete().eq('nombre', objNombre));
                Object.keys(invGlobal).forEach(pj => {
                    deletePromises.push(supabase.from('inventario_objetos').delete().eq('personaje_nombre', pj).eq('objeto_nombre', objNombre));
                });
            } else {
                if (objGlobal[objNombre]) {
                    catalogUpserts.push({
                        nombre: objNombre,
                        tipo: objGlobal[objNombre].tipo,
                        material: objGlobal[objNombre].mat,
                        efecto: objGlobal[objNombre].eff,
                        rareza: objGlobal[objNombre].rar,
                        es_propuesta: false
                    });
                }
            }
        });

        Object.keys(invGlobal).forEach(pj => {
            Object.keys(invGlobal[pj]).forEach(obj => {
                if (estadoUI.colaCambios[obj]) {
                    const cant = invGlobal[pj][obj];
                    const eqp = eqpGlobal[pj]?.[obj] || false; // 🌟 Leemos el estado equipado
                    if (objGlobal[obj]) {
                        if (cant > 0) {
                            invUpserts.push({ personaje_nombre: pj, objeto_nombre: obj, cantidad: cant, equipado: eqp }); // 🌟 Sincronizamos eqp
                        } else {
                            deletePromises.push(supabase.from('inventario_objetos').delete().eq('personaje_nombre', pj).eq('objeto_nombre', obj));
                        }
                    }
                }
            });
        });

        if (deletePromises.length > 0) {
            const deleteResults = await Promise.all(deletePromises);
            deleteResults.forEach(res => { if (res.error) logErrores.push(`Fallo en borrado: ${res.error.message}`); });
        }

        if (catalogUpserts.length > 0) {
            const { error } = await supabase.from('objetos').upsert(catalogUpserts, { onConflict: 'nombre' });
            if (error) logErrores.push(`Fallo al actualizar catálogo: ${error.message}`);
        }

        if (invUpserts.length > 0) {
            const { error } = await supabase.from('inventario_objetos').upsert(invUpserts, { onConflict: 'personaje_nombre,objeto_nombre' });
            if (error) logErrores.push(`Fallo al asignar stock: ${error.message}`);
        }

        if (logErrores.length > 0) {
            alert("⚠️ Problemas al guardar en Supabase:\n\n" + logErrores.join('\n'));
            return false;
        }

        estadoUI.colaCambios = {}; 
        if(window.actualizarBotonSyncObj) window.actualizarBotonSyncObj();
        return true;

    } catch (e) {
        console.error("Crash crítico sincronizando BD:", e);
        alert("Ocurrió un error crítico intentando sincronizar.\nRevisa la consola.");
        return false;
    }
}

// ... Las funciones de propuestas (proponerObjeto, aprobarPropuesta, etc.) quedan exactamente igual
export async function proponerObjeto(nombrePj, objName, objTipo, objRar, objMat, objEff, cant) {
    try {
        const { error } = await supabase.from('objetos').insert([{
            nombre: objName, tipo: objTipo, rareza: objRar, material: objMat, efecto: objEff,
            es_propuesta: true, propuesto_por: nombrePj, prop_cantidad: cant
        }]);
        if (error) throw error;
        return true;
    } catch (e) { console.error("Error proponiendo:", e); return false; }
}

export async function getPropuestasParaPersonaje(nombrePj) {
    return propuestasGlobal.filter(p => p.propuesto_por === nombrePj);
}

export async function aprobarPropuesta(idPropuesta, nombreObj, cant, propuestoPor) {
    try {
        const { error: err1 } = await supabase.from('objetos').update({ es_propuesta: false }).eq('nombre', nombreObj);
        if (err1) throw err1;
        
        const { data: invData } = await supabase.from('inventario_objetos').select('cantidad').eq('personaje_nombre', propuestoPor).eq('objeto_nombre', nombreObj).single();
        const stockActual = invData ? invData.cantidad : 0;
        
        const { error: err2 } = await supabase.from('inventario_objetos').upsert({
            personaje_nombre: propuestoPor, objeto_nombre: nombreObj, cantidad: stockActual + cant, equipado: false
        }, { onConflict: 'personaje_nombre,objeto_nombre' });
        if (err2) throw err2;
        return true;
    } catch (e) { console.error("Error aprobando:", e); return false; }
}

export async function aprobarTodasPropuestas() {
    try {
        const invUpserts = [];
        const objsAprobar = [];
        for (const prop of propuestasGlobal) {
            objsAprobar.push(prop.nombre);
            const { data: invData } = await supabase.from('inventario_objetos').select('cantidad').eq('personaje_nombre', prop.propuesto_por).eq('objeto_nombre', prop.nombre).single();
            const stockActual = invData ? invData.cantidad : 0;
            invUpserts.push({ personaje_nombre: prop.propuesto_por, objeto_nombre: prop.nombre, cantidad: stockActual + prop.prop_cantidad, equipado: false });
        }

        if (objsAprobar.length > 0) {
            await supabase.from('objetos').update({ es_propuesta: false }).in('nombre', objsAprobar);
            await supabase.from('inventario_objetos').upsert(invUpserts, { onConflict: 'personaje_nombre,objeto_nombre' });
        }
        return true;
    } catch (e) { console.error("Error aprobando todas:", e); return false; }
}

export async function rechazarPropuesta(nombreObj) {
    try {
        const { error } = await supabase.from('objetos').delete().eq('nombre', nombreObj);
        if (error) throw error;
        return true;
    } catch (e) { console.error("Error rechazando:", e); return false; }
}
