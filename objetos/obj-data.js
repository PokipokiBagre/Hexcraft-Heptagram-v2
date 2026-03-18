// ============================================================
// obj-data.js — VERSIÓN SUPABASE (OPTIMIZACIÓN MASIVA)
// ============================================================

import { invGlobal, objGlobal, statsGlobal, historial, estadoUI, propuestasGlobal } from './obj-state.js';
import { db } from '../hex-db.js';
import { supabase } from '../hex-auth.js';

// ── Carga inicial desde Supabase ─────────────────────────────
export async function cargarTodoDesdeCSV() {
    try {
        const [personajesArr, objetosArr, inventObjArr] = await Promise.all([
            db.personajes.getAll(),
            db.objetos.getCatalogo(),
            db.objetos.getInventarioCompleto()
        ]);

        for (let k in invGlobal) delete invGlobal[k];
        for (let k in objGlobal) delete objGlobal[k];
        for (let k in statsGlobal) delete statsGlobal[k];

        personajesArr.forEach(p => {
            statsGlobal[p.nombre] = { 
                isPlayer: p.is_player, 
                isActive: p.is_active, 
                iconoOverride: p.icono_override || '' 
            };
            invGlobal[p.nombre] = {};
        });

        // Separar propuestas de objetos aprobados
        propuestasGlobal.length = 0;
        objetosArr.forEach(o => {
            if (o.es_propuesta) {
                propuestasGlobal.push({
                    nombre: o.nombre,
                    tipo: o.tipo || '-',
                    mat: o.material || '-',
                    eff: o.efecto || 'Sin descripción',
                    rar: o.rareza || 'Común',
                    propuesto_por: o.propuesto_por || 'Anónimo'
                });
            } else {
                objGlobal[o.nombre] = { 
                    tipo: o.tipo || '-', 
                    mat: o.material || '-', 
                    eff: o.efecto || 'Sin descripción', 
                    rar: o.rareza || 'Común' 
                };
            }
        });

        inventObjArr.forEach(row => {
            const p = row.personaje_nombre.toLowerCase();
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

// ── Funciones de Propuestas ───────────────────────────────────
export async function proponerObjeto(data) {
    const { error } = await supabase.from('objetos').upsert({
        nombre:             data.nombre,
        tipo:               data.tipo || '-',
        material:           data.mat  || '-',
        efecto:             data.eff  || '',
        rareza:             data.rar  || 'Común',
        es_propuesta:       true,
        propuesto_por:      data.propuesto_por      || 'Anónimo',
        propuesta_para:     data.propuesta_para     || '',
        propuesta_cantidad: data.propuesta_cantidad || 1
    }, { onConflict: 'nombre' });
    if (error) { console.error('proponerObjeto:', error); return false; }
    return true;
}

export async function aprobarPropuesta(nombre) {
    // 1. Marcar como aprobado
    const { data: obj, error: errUpd } = await supabase.from('objetos')
        .update({ es_propuesta: false, propuesto_por: '', propuesta_para: '', propuesta_cantidad: 1 })
        .eq('nombre', nombre)
        .select('propuesta_para, propuesta_cantidad')
        .single();
    if (errUpd) { console.error('aprobarPropuesta update:', errUpd); return false; }

    // 2. Si tenía destinatario, agregar al inventario
    const para  = obj?.propuesta_para;
    const cant  = obj?.propuesta_cantidad || 1;
    if (para && cant > 0) {
        const { data: existing } = await supabase.from('inventario_objetos')
            .select('cantidad').eq('personaje_nombre', para).eq('objeto_nombre', nombre).single();
        const nuevaCant = (existing?.cantidad || 0) + cant;
        await supabase.from('inventario_objetos')
            .upsert({ personaje_nombre: para, objeto_nombre: nombre, cantidad: nuevaCant },
                    { onConflict: 'personaje_nombre,objeto_nombre' });
    }
    return true;
}

export async function rechazarPropuesta(nombre) {
    const { error } = await supabase.from('objetos').delete().eq('nombre', nombre);
    if (error) { console.error('rechazarPropuesta:', error); return false; }
    return true;
}

export async function getPropuestasParaPersonaje(nombrePj) {
    const { data, error } = await supabase.from('objetos')
        .select('nombre, tipo, material, efecto, rareza, propuesto_por, propuesta_cantidad')
        .eq('es_propuesta', true)
        .eq('propuesta_para', nombrePj);
    if (error) { console.error('getPropuestasParaPersonaje:', error); return []; }
    return data || [];
}

export async function aprobarTodasPropuestas() {
    const { error } = await supabase.from('objetos')
        .update({ es_propuesta: false, propuesto_por: '' })
        .eq('es_propuesta', true);
    if (error) { console.error('aprobarTodasPropuestas:', error); return false; }
    return true;
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
