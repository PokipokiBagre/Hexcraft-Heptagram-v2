import { misGlobal, jugadoresActivos, estadoUI } from './mis-state.js';
import { db } from '../hex-db.js';
import { supabase } from '../hex-auth.js'; 

// ============================================================
// mis-data.js — VERSIÓN SUPABASE (CON COLORES Y BLINDAJE)
// ============================================================

export async function cargarDatos() {
    try {
        const [misionesArr, personajesArr, afinidadesRes] = await Promise.all([
            db.misiones.getAll(),
            db.personajes.getJugadoresActivos(),
            supabase.from('hechizos_afinidades').select('*') 
        ]);

        const colorMap = {};
        if (afinidadesRes.data) {
            afinidadesRes.data.forEach(a => {
                colorMap[a.afinidad] = a.color_t;
            });
        }

        jugadoresActivos.length = 0;
        personajesArr.forEach(p => {
            const afis = {
                'Física':     p.af_fisica     || 0,
                'Energética': p.af_energetica || 0,
                'Espiritual': p.af_espiritual || 0,
                'Mando':      p.af_mando      || 0,
                'Psíquica':   p.af_psiquica   || 0,
                'Oscura':     p.af_oscura     || 0
            };
            let mayor = 'Física'; let max = -1;
            for (let k in afis) { if (afis[k] > max && afis[k] > 0) { max = afis[k]; mayor = k; } }

            jugadoresActivos.push({
                nombre:   p.nombre,
                icon:     p.icono_override || p.nombre,
                afinidad: mayor,
                color:    colorMap[mayor] || '#888' // Color extraído directo de la DB
            });
        });

        misGlobal.length = 0;
        misionesArr.forEach((m, i) => {
            misGlobal.push({
                id:       m.titulo,
                titulo:   m.titulo,
                tipo:     m.tipo      || 'Personalizada',
                cupos:    m.cupos     || 2,
                estado:   m.estado    || 0,
                clase:    (m.clase || '1').replace('Clase ', '').trim(),
                desc:     m.descripcion || '',
                notaOP:   m.nota_op     || '',
                jugadores: m.jugadores  || [],
                autor:    m.autor       || 'OP',
                orden:    m.orden       !== undefined ? m.orden : i
            });
        });

    } catch (e) {
        console.error("Error cargando desde Supabase:", e);
    }
}

export async function sincronizarBD() {
    try {
        const cambios = estadoUI.colaCambios.misiones;
        let success = true;
        let logErrores = [];

        for (const [clave, datos] of Object.entries(cambios)) {
            
            if (datos.__ELIMINAR__) {
                const tituloABorrar = datos.titulo || clave;
                const { error } = await supabase.from('misiones').delete().eq('titulo', tituloABorrar);
                if (error) { success = false; logErrores.push(`Fallo al eliminar [${tituloABorrar}]: ${error.message}`); }
            } else {
                // 🔥 BLINDAJE: Extraemos la misión completa de la memoria visual global 🔥
                let m = misGlobal.find(mis => mis.id === clave || mis.titulo === clave);
                
                // Si por algún motivo no la encuentra, usamos "datos" como salvavidas
                if (!m) {
                    if (datos.titulo) m = datos; 
                    else continue; 
                }

                const payload = {
                    titulo:      m.titulo,
                    tipo:        m.tipo || 'Personalizada',
                    cupos:       m.cupos || 2,
                    estado:      m.estado || 0,
                    clase:       m.clase || '1',
                    descripcion: m.desc || m.descripcion || '',
                    nota_op:     m.notaOP || m.nota_op || '',
                    jugadores:   m.jugadores || [],
                    autor:       m.autor || 'OP',
                    orden:       m.orden || 0
                };

                // Guardado directo con Supabase para capturar el error exacto si lo hay
                const { error } = await supabase
                    .from('misiones')
                    .upsert(payload, { onConflict: 'titulo' });

                if (error) { 
                    success = false; 
                    logErrores.push(`Fallo en '${m.titulo}': ${error.message}`); 
                }
            }
        }

        if (!success) {
            alert("⚠️ Error al sincronizar con Supabase:\n\n" + logErrores.join('\n\n'));
        }

        return success;
    } catch(e) {
        console.error("Error en sincronizarBD:", e);
        alert("Error crítico:\n" + e.message);
        return false;
    }
}
