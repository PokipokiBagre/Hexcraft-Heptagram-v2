import { db as localDB } from './inventario-state.js';
import { db as hexDB }   from '../hex-db.js';
import { supabase }      from '../hex-auth.js';

export async function inicializarDatos(barraProgreso) {
    try {
        if (barraProgreso) barraProgreso.style.width = '30%';

        const [personajesArr, hechizosData, afinidadesRes] = await Promise.all([
            hexDB.personajes.getAll(),
            hexDB.hechizos.getDataCompleta(),
            supabase.from('hechizos_afinidades').select('afinidad, color_t')
        ]);

        if (barraProgreso) barraProgreso.style.width = '70%';

        // Poblar el mapa de colores desde la DB
        for (let k in localDB.colorMap) delete localDB.colorMap[k];
        if (afinidadesRes.data) {
            afinidadesRes.data.forEach(a => { localDB.colorMap[a.afinidad] = a.color_t; });
        }

        for (let k in localDB.personajes) delete localDB.personajes[k];

        personajesArr.forEach(p => {
            const base = { fisica: p.af_fisica||0, energetica: p.af_energetica||0, espiritual: p.af_espiritual||0, mando: p.af_mando||0, psiquica: p.af_psiquica||0, oscura: p.af_oscura||0 };
            const hz   = { fisica: p.hz_fisica||0, energetica: p.hz_energetica||0, espiritual: p.hz_espiritual||0, mando: p.hz_mando||0, psiquica: p.hz_psiquica||0, oscura: p.hz_oscura||0 };
            const ef   = { fisica: p.ef_fisica||0, energetica: p.ef_energetica||0, espiritual: p.ef_espiritual||0, mando: p.ef_mando||0, psiquica: p.ef_psiquica||0, oscura: p.ef_oscura||0 };
            const bf   = { fisica: p.bf_fisica||0, energetica: p.bf_energetica||0, espiritual: p.bf_espiritual||0, mando: p.bf_mando||0, psiquica: p.bf_psiquica||0, oscura: p.bf_oscura||0 };

            const totales = {
                fisica:     base.fisica     + hz.fisica     + ef.fisica     + bf.fisica,
                energetica: base.energetica + hz.energetica + ef.energetica + bf.energetica,
                espiritual: base.espiritual + hz.espiritual + ef.espiritual + bf.espiritual,
                mando:      base.mando      + hz.mando      + ef.mando      + bf.mando,
                psiquica:   base.psiquica   + hz.psiquica   + ef.psiquica   + bf.psiquica,
                oscura:     base.oscura     + hz.oscura     + ef.oscura     + bf.oscura
            };

            const mapNombres = { 'Física': totales.fisica, 'Energética': totales.energetica, 'Espiritual': totales.espiritual, 'Mando': totales.mando, 'Psíquica': totales.psiquica, 'Oscura': totales.oscura };
            let mayorAfinidad = 'Ninguna'; let maxVal = -1;
            for (const [key, val] of Object.entries(mapNombres)) { if (val > maxVal && val > 0) { maxVal = val; mayorAfinidad = key; } }

            localDB.personajes[p.nombre] = {
                isPlayer:       p.is_player,
                isActive:       p.is_active,
                iconoOverride:  p.icono_override || p.nombre,
                hex:            p.hex        || 0,
                asistencia:     p.asistencia || 1,
                mayorAfinidad,
                afinidades:     totales,
                afinidadesBase: base,
                afinidadesHz:   hz,
                afinidadesEf:   ef,
                afinidadesBf:   bf
            };
        });

        localDB.hechizos = hechizosData;

        if (barraProgreso) barraProgreso.style.width = '100%';
        return true;

    } catch (e) {
        console.error("Error en inicializarDatos:", e);
        return false;
    }
}

export async function sincronizarColaBD(cola) {
    let logErrores = [];
    try {
        // 1. Agregar Hechizos
        for (const item of cola.agregar) {
            await supabase.from('hechizos_inventario').delete()
                .eq('personaje_nombre', item[0])
                .eq('hechizo_nombre', item[1]);

            // 🔥 ELIMINAMOS 'origen' DE AQUÍ PORQUE NO EXISTE EN LA TABLA DE SUPABASE 🔥
            const { error } = await supabase.from('hechizos_inventario').insert({
                personaje_nombre: item[0],
                hechizo_nombre:   item[1],
                hechizo_afinidad: item[2] || '',
                hechizo_hex:      item[3] || 0,
                tipo:             item[4] || 'Normal'
            });
            if (error) logErrores.push("Error Asignando Hechizo: " + error.message);
        }

        // 2. Quitar Hechizos
        for (const item of cola.quitar) {
            const { error } = await supabase.from('hechizos_inventario').delete()
                .eq('personaje_nombre', item.Personaje)
                .eq('hechizo_nombre', item.Hechizo);
            if (error) logErrores.push("Error Quitando Hechizo: " + error.message);
        }

        // 3. Cambiar Visibilidad del Mapa
        for (const item of cola.toggleConocido) {
            const { error } = await supabase.from('hechizos_nodos')
                .update({ es_conocido: item.Estado === 'si' })
                .eq('hechizo_id', item.ID);
            if (error) logErrores.push("Error Visibilidad Mapa: " + error.message);
        }

        // 4. Actualizar Estadísticas
        if (cola.stats && Object.keys(cola.stats).length > 0) {
            for (const [pj, cambios] of Object.entries(cola.stats)) {
                const { error } = await supabase.from('personajes')
                    .update(cambios)
                    .eq('nombre', pj);
                if (error) logErrores.push(`Error Actualizando Stats de ${pj}: ` + error.message);
            }
        }

        if (logErrores.length > 0) {
            console.error("Super-Log de Errores:", logErrores);
            return { success: false, errors: logErrores };
        }

        return { success: true };

    } catch (e) {
        console.error("Crash Crítico en sincronizarColaBD:", e);
        return { success: false, errors: [e.message] };
    }
}
