import { statsGlobal, listaEstados, estadoUI, dbExtra } from './stats-state.js';
import { db } from '../hex-db.js';

// ============================================================
// stats-data.js — VERSIÓN SUPABASE
// Reemplaza todos los fetch a Google Sheets y Apps Script
// ============================================================

export async function cargarTodoDesdeCSV(barraProgreso) {
    try {
        if (barraProgreso) barraProgreso.style.width = '10%';

        // Carga paralela desde Supabase
        const [personajesArr, objetosArr, inventObjArr, hechizosData, misionesArr] = await Promise.all([
            db.personajes.getAll(),
            db.objetos.getCatalogo(),
            db.objetos.getInventarioCompleto(),
            db.hechizos.getDataCompleta(),
            db.misiones.getAll()
        ]);

        if (barraProgreso) barraProgreso.style.width = '60%';

        // ── PERSONAJES → statsGlobal ──────────────────────────────
        for (let k in statsGlobal) delete statsGlobal[k];

        personajesArr.forEach(p => {
            statsGlobal[p.nombre] = {
                isPlayer:  p.is_player,
                isNPC:    !p.is_player,
                isActive:  p.is_active,
                hex:       p.hex        || 0,
                asistencia: p.asistencia || 1,
                vex:       p.vex        || 0,

                vidaRojaActual:  p.vida_roja_actual  || 0,
                vidaRojaMax:    (p.base_vida_roja_max || 0) + (p.hechizo_vida_roja || 0) + (p.efecto_vida_roja || 0) + (p.buff_vida_roja || 0),
                baseVidaRojaMax: p.base_vida_roja_max || 10,

                vidaAzul:       (p.base_vida_azul || 0) + (p.hechizo_vida_azul || 0) + (p.efecto_vida_azul || 0) + (p.buff_vida_azul || 0),
                baseVidaAzul:    p.base_vida_azul    || 0,

                guardaDorada:   (p.base_guarda_dorada || 0) + (p.hechizo_guarda || 0) + (p.efecto_guarda || 0) + (p.buff_guarda || 0),
                baseGuardaDorada: p.base_guarda_dorada || 0,

                danoRojo:       (p.base_dano_rojo || 0) + (p.hechizo_dano_rojo || 0) + (p.efecto_dano_rojo || 0) + (p.buff_dano_rojo || 0),
                baseDanoRojo:    p.base_dano_rojo   || 0,

                danoAzul:       (p.base_dano_azul || 0) + (p.hechizo_dano_azul || 0) + (p.efecto_dano_azul || 0) + (p.buff_dano_azul || 0),
                baseDanoAzul:    p.base_dano_azul   || 0,

                elimDorada:     (p.base_elim_dorada || 0) + (p.hechizo_elim || 0) + (p.efecto_elim || 0) + (p.buff_elim || 0),
                baseElimDorada:  p.base_elim_dorada || 0,

                afinidades: {
                    fisica:     (p.af_fisica||0)+(p.hz_fisica||0)+(p.ef_fisica||0)+(p.bf_fisica||0),
                    energetica: (p.af_energetica||0)+(p.hz_energetica||0)+(p.ef_energetica||0)+(p.bf_energetica||0),
                    espiritual: (p.af_espiritual||0)+(p.hz_espiritual||0)+(p.ef_espiritual||0)+(p.bf_espiritual||0),
                    mando:      (p.af_mando||0)+(p.hz_mando||0)+(p.ef_mando||0)+(p.bf_mando||0),
                    psiquica:   (p.af_psiquica||0)+(p.hz_psiquica||0)+(p.ef_psiquica||0)+(p.bf_psiquica||0),
                    oscura:     (p.af_oscura||0)+(p.hz_oscura||0)+(p.ef_oscura||0)+(p.bf_oscura||0)
                },
                afinidadesBase: {
                    fisica:     p.af_fisica     || 0,
                    energetica: p.af_energetica || 0,
                    espiritual: p.af_espiritual || 0,
                    mando:      p.af_mando      || 0,
                    psiquica:   p.af_psiquica   || 0,
                    oscura:     p.af_oscura     || 0
                },
                hechizos: {
                    fisica:           p.hz_fisica     || 0,
                    energetica:       p.hz_energetica || 0,
                    espiritual:       p.hz_espiritual || 0,
                    mando:            p.hz_mando      || 0,
                    psiquica:         p.hz_psiquica   || 0,
                    oscura:           p.hz_oscura     || 0,
                    danoRojo:         p.hechizo_dano_rojo  || 0,
                    danoAzul:         p.hechizo_dano_azul  || 0,
                    elimDorada:       p.hechizo_elim       || 0,
                    vidaRojaMaxExtra: p.hechizo_vida_roja  || 0,
                    vidaAzulExtra:    p.hechizo_vida_azul  || 0,
                    guardaDoradaExtra: p.hechizo_guarda    || 0
                },
                hechizosEfecto: {
                    fisica:           p.ef_fisica     || 0,
                    energetica:       p.ef_energetica || 0,
                    espiritual:       p.ef_espiritual || 0,
                    mando:            p.ef_mando      || 0,
                    psiquica:         p.ef_psiquica   || 0,
                    oscura:           p.ef_oscura     || 0,
                    danoRojo:         p.efecto_dano_rojo  || 0,
                    danoAzul:         p.efecto_dano_azul  || 0,
                    elimDorada:       p.efecto_elim       || 0,
                    vidaRojaMaxExtra: p.efecto_vida_roja  || 0,
                    vidaAzulExtra:    p.efecto_vida_azul  || 0,
                    guardaDoradaExtra: p.efecto_guarda    || 0
                },
                buffs: {
                    fisica:           p.bf_fisica     || 0,
                    energetica:       p.bf_energetica || 0,
                    espiritual:       p.bf_espiritual || 0,
                    mando:            p.bf_mando      || 0,
                    psiquica:         p.bf_psiquica   || 0,
                    oscura:           p.bf_oscura     || 0,
                    danoRojo:         p.buff_dano_rojo   || 0,
                    danoAzul:         p.buff_dano_azul   || 0,
                    elimDorada:       p.buff_elim        || 0,
                    vidaRojaMaxExtra: p.buff_vida_roja   || 0,
                    vidaAzulExtra:    p.buff_vida_azul   || 0,
                    guardaDoradaExtra: p.buff_guarda     || 0
                },
                estados:       p.estados       || {},
                iconoOverride: p.icono_override || ''
            };
        });

        // ── OBJETOS → dbExtra ─────────────────────────────────────
        dbExtra.objetosCount = {};
        dbExtra.inventarios  = {};
        dbExtra.infoObjetos  = {};

        objetosArr.forEach(o => {
            dbExtra.infoObjetos[o.nombre] = { rar: o.rareza || 'Común' };
        });

        inventObjArr.forEach(row => {
            const j = row.personaje_nombre.toLowerCase();
            const o = row.objeto_nombre;
            if (!dbExtra.objetosCount[j]) dbExtra.objetosCount[j] = 0;
            if (!dbExtra.inventarios[j])  dbExtra.inventarios[j]  = [];
            dbExtra.objetosCount[j] += row.cantidad;
            if (row.cantidad > 0) dbExtra.inventarios[j].push(o);
            if (!dbExtra.infoObjetos[o]) dbExtra.infoObjetos[o] = { rar: row.objetos?.rareza || 'Común' };
        });

        // ── HECHIZOS → dbExtra ───────────────────────────────────
        // hechizosData ya tiene { nodos, nodosOcultos, string, inventario, afinidades }
        // con el mismo formato que antes usaba el API Base64
        dbExtra.hechizos = hechizosData;

        // ── MISIONES ACTIVAS → dbExtra ───────────────────────────
        dbExtra.misionesActivas = {};
        misionesArr.forEach(m => {
            if (m.estado === 1 || m.estado === 2) {
                (m.jugadores || []).forEach(j => {
                    const jl = j.toLowerCase();
                    if (!dbExtra.misionesActivas[jl]) dbExtra.misionesActivas[jl] = [];
                    dbExtra.misionesActivas[jl].push(m.titulo);
                });
            }
        });

        if (barraProgreso) barraProgreso.style.width = '100%';

    } catch (error) {
        console.error("Error cargando desde Supabase:", error);
    }
}

// ── Estados: ahora vienen de Supabase, no de estados.csv ────
export async function cargarDiccionarioEstados() {
    try {
        const estadosArr = await db.estadosConfig.getAll();
        listaEstados.length = 0;
        estadosArr.forEach(e => {
            listaEstados.push({
                id:     e.id,
                nombre: e.nombre,
                tipo:   e.tipo,
                bg:     e.color_bg,
                border: e.color_border,
                desc:   e.descripcion
            });
        });
    } catch(e) {
        console.warn("Fallo al cargar estados desde Supabase:", e);
    }
}

// ── procesarTextoCSV se mantiene solo para el botón de exportar CSV ──
// (genera el CSV descargable desde los datos en memoria, no hace fetch)
export function procesarTextoCSV() {
    // No hace nada — los datos ya están en statsGlobal desde cargarTodoDesdeCSV
    // Esta función se conserva por compatibilidad con stats-main.js
}
