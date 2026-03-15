// ============================================================
// inventario-data.js — VERSIÓN SUPABASE
// ============================================================

import { db as localDB } from './inventario-state.js';
import { db as hexDB }   from '../hex-db.js';

// ── Carga inicial desde Supabase ─────────────────────────────
export async function inicializarDatos(barraProgreso) {
    try {
        if (barraProgreso) barraProgreso.style.width = '30%';

        const [personajesArr, hechizosData] = await Promise.all([
            hexDB.personajes.getAll(),
            hexDB.hechizos.getDataCompleta()
        ]);

        if (barraProgreso) barraProgreso.style.width = '70%';

        // ── PROCESAR PERSONAJES ───────────────────────────────
        for (let k in localDB.personajes) delete localDB.personajes[k];

        personajesArr.forEach(p => {
            // Afinidades desglosadas para recalcular tras asignar hechizos
            const base = { fisica: p.af_fisica||0, energetica: p.af_energetica||0, espiritual: p.af_espiritual||0, mando: p.af_mando||0, psiquica: p.af_psiquica||0, oscura: p.af_oscura||0 };
            const hz   = { fisica: p.hz_fisica||0, energetica: p.hz_energetica||0, espiritual: p.hz_espiritual||0, mando: p.hz_mando||0, psiquica: p.hz_psiquica||0, oscura: p.hz_oscura||0 };
            const ef   = { fisica: p.ef_fisica||0, energetica: p.ef_energetica||0, espiritual: p.ef_espiritual||0, mando: p.ef_mando||0, psiquica: p.ef_psiquica||0, oscura: p.ef_oscura||0 };
            const bf   = { fisica: p.bf_fisica||0, energetica: p.bf_energetica||0, espiritual: p.bf_espiritual||0, mando: p.bf_mando||0, psiquica: p.bf_psiquica||0, oscura: p.bf_oscura||0 };

            // Totales para lectura rápida (casteo, VEX, etc.)
            const totales = {
                fisica:     base.fisica     + hz.fisica     + ef.fisica     + bf.fisica,
                energetica: base.energetica + hz.energetica + ef.energetica + bf.energetica,
                espiritual: base.espiritual + hz.espiritual + ef.espiritual + bf.espiritual,
                mando:      base.mando      + hz.mando      + ef.mando      + bf.mando,
                psiquica:   base.psiquica   + hz.psiquica   + ef.psiquica   + bf.psiquica,
                oscura:     base.oscura     + hz.oscura     + ef.oscura     + bf.oscura
            };

            // Afinidad primaria
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
                afinidades:     totales,   // totales — usado en casteo y renderHeaders
                afinidadesBase: base,      // solo base — sin hechizos ni efectos
                afinidadesHz:   hz,        // hechizo bonus — recalculable
                afinidadesEf:   ef,
                afinidadesBf:   bf
            };
        });

        // ── PROCESAR HECHIZOS ─────────────────────────────────
        // getDataCompleta() ya devuelve el formato { nodos, nodosOcultos, string, inventario, afinidades }
        // con claves PascalCase que todo el código de UI ya espera
        localDB.hechizos = hechizosData;

        if (barraProgreso) barraProgreso.style.width = '100%';
        return true;

    } catch (e) {
        console.error("Error en inicializarDatos:", e);
        return false;
    }
}

// ── Sincronización de la cola de cambios → Supabase ──────────
export async function sincronizarColaBD(cola) {
    try {
        let success = true;

        // 1. Agregar hechizos al inventario
        // item = [pj, nombreHechizo, afinidad, hex, tipo, origen]
        for (const item of cola.agregar) {
            const ok = await hexDB.hechizos.agregarHechizo(item[0], {
                nombre:   item[1],
                afinidad: item[2],
                hex:      item[3],
                tipo:     item[4] || 'Normal',
                origen:   item[5] || 'OP Admin'
            });
            if (!ok) success = false;
        }

        // 2. Quitar hechizos del inventario
        // item = { Personaje, Hechizo }
        for (const item of cola.quitar) {
            const ok = await hexDB.hechizos.quitarHechizo(item.Personaje, item.Hechizo);
            if (!ok) success = false;
        }

        // 3. Cambiar visibilidad de nodos del mapa
        // item = { ID, Nombre, Estado: 'si'/'no' }
        for (const item of cola.toggleConocido) {
            const ok = await hexDB.hechizos.toggleConocido(item.ID, item.Estado === 'si');
            if (!ok) success = false;
        }

        // 4. Actualizar estadísticas del personaje (hex gastado + afinidades recalculadas)
        // colaCambios.stats[pj] = { hex: X, hz_fisica: Y, hz_energetica: Z, ... }
        if (cola.stats && Object.keys(cola.stats).length > 0) {
            for (const [pj, cambios] of Object.entries(cola.stats)) {
                const payload = { nombre: pj, ...cambios };
                const ok = await hexDB.personajes.upsert(payload);
                if (!ok) success = false;
            }
        }

        return success;

    } catch (e) {
        console.error("Error en sincronizarColaBD:", e);
        return false;
    }
}
