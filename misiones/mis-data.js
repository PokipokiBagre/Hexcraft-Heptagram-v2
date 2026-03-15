import { misGlobal, jugadoresActivos, estadoUI } from './mis-state.js';
import { db } from '../hex-db.js';
import { supabase } from '../hex-auth.js'; // Importamos Supabase para consultar los colores directo

// ============================================================
// mis-data.js — VERSIÓN SUPABASE (CON COLORES DINÁMICOS)
// ============================================================

export async function cargarDatos() {
    try {
        // Obtenemos Misiones, Personajes y los Colores de Afinidad al mismo tiempo
        const [misionesArr, personajesArr, afinidadesRes] = await Promise.all([
            db.misiones.getAll(),
            db.personajes.getJugadoresActivos(),
            supabase.from('hechizos_afinidades').select('*') 
        ]);

        // Mapeamos los colores (Ej: { 'Física': '#b36a2f', 'Psíquica': '#9648b8' })
        const colorMap = {};
        if (afinidadesRes.data) {
            afinidadesRes.data.forEach(a => {
                colorMap[a.afinidad] = a.color_t;
            });
        }

        // ── JUGADORES ACTIVOS → roster ────────────────────────
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

            // 🔥 INYECTAMOS EL COLOR DE LA BASE DE DATOS 🔥
            const colorAfinidad = colorMap[mayor] || '#ffffff';

            jugadoresActivos.push({
                nombre:   p.nombre,
                icon:     p.icono_override || p.nombre,
                afinidad: mayor,
                color:    colorAfinidad // <--- Listo para que tu interfaz (mis-ui.js) lo use
            });
        });

        // ── MISIONES ─────────────────────────────────────────
        misGlobal.length = 0;
        misionesArr.forEach((m, i) => {
            misGlobal.push({
                id:       m.titulo,   // el título es la clave única
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

        for (const [id, datos] of Object.entries(cambios)) {
            if (datos.__ELIMINAR__) {
                // Borrado real en Supabase
                const ok = await db.misiones.eliminar(datos.titulo);
                if (!ok) { success = false; logErrores.push(`Fallo al eliminar: ${datos.titulo}`); }
            } else {
                // Upsert normal
                const ok = await db.misiones.upsert(datos);
                if (!ok) { success = false; logErrores.push(`Fallo al guardar: ${datos.titulo}`); }
            }
        }

        // Chismoso de errores activado
        if (!success) {
            alert("⚠️ Supabase rechazó la operación:\n\n" + logErrores.join('\n'));
        }

        return success;
    } catch(e) {
        console.error("Error en sincronizarBD:", e);
        alert("Error crítico de base de datos en misiones:\n" + e.message);
        return false;
    }
}
