// ============================================================
// dev-logic.js — Lógica de Sincronización y Logs
// ============================================================

import { db } from '../hex-db.js';
import { supabase } from '../hex-auth.js'; 
import { devState } from './dev-state.js';
import { objState } from './objetos/panel-objetos-state.js';
import { stState } from './estadisticas/panel-stats-state.js';

export function revisarCambiosPendientes() {
    const btnSync = document.getElementById('btn-sync-global');
    if (!btnSync) return;

    let hayCambios = false;

    if (Object.keys(objState.colaInventario).length > 0) hayCambios = true;
    if (Object.values(objState.colaNuevosObjetos).some(o => o.nombre.trim() !== '')) hayCambios = true;
    if (Object.keys(objState.colaEdicionObjetos).length > 0) hayCambios = true;
    if (Object.keys(stState.colaStats).length > 0) hayCambios = true;
    if (Object.keys(stState.colaEstadosConfig).length > 0) hayCambios = true;
    if (stState.colaBorrarEstados.length > 0) hayCambios = true;

    if (hayCambios) btnSync.classList.remove('oculto');
    else btnSync.classList.add('oculto');
}

export function actualizarLogGlobal() {
    const logPorPJ = {};

    // --- 1. Objetos ---
    for (const pjKey in objState.colaInventario) {
        const realPj = devState.listaPersonajes.find(p => p.nombre.toLowerCase() === pjKey)?.nombre || pjKey;
        for (const objNombre in objState.colaInventario[pjKey]) {
            const cantNueva = objState.colaInventario[pjKey][objNombre];
            const cantVieja = objState.inventariosDB[pjKey]?.[objNombre] || 0;
            const delta = cantNueva - cantVieja; 
            if (delta !== 0) {
                if (!logPorPJ[realPj]) logPorPJ[realPj] = [];
                if (delta > 0) logPorPJ[realPj].push(`Obj Obt. ${objNombre} x${delta}`);
                else logPorPJ[realPj].push(`Obj Prd. ${objNombre} x${Math.abs(delta)}`);
            }
        }
    }

    const pjActual = devState.pjSeleccionado || "SIN_ASIGNAR";
    const nuevosArr = Object.values(objState.colaNuevosObjetos).filter(o => o.nombre.trim() !== '');
    for (const obj of nuevosArr) {
        if (obj.cant > 0) {
            if (!logPorPJ[pjActual]) logPorPJ[pjActual] = [];
            logPorPJ[pjActual].push(`Obj Obt. ${obj.nombre} x${obj.cant}`);
        }
    }

    // --- 2. Estadísticas ---

    // Nombres legibles para flatKeys simples (campoRaiz sin subCampo)
    const nomLegibles = {
        'hex':              'HEX',
        'asistencia':       'Asistencia',
        'vidaRojaActual':   'Vida Roja',
        'baseVidaRojaMax':  'Vida Roja Máx',
        'baseVidaAzul':     'Vida Azul',
        'baseGuardaDorada': 'Guarda Dorada',
        'baseDanoRojo':     'Daño Rojo',
        'baseDanoAzul':     'Daño Azul',
        'baseElimDorada':   'Elim. Dorada'
    };

    // Nombres legibles para subCampos (buffs, hechizosEfecto, afinidadesBase)
    const subNomLegibles = {
        'fisica':            'Física',
        'energetica':        'Energética',
        'espiritual':        'Espiritual',
        'mando':             'Mando',
        'psiquica':          'Psíquica',
        'oscura':            'Oscura',
        'danoRojo':          'Daño Rojo',
        'danoAzul':          'Daño Azul',
        'elimDorada':        'Elim. Dorada',
        'vidaRojaMaxExtra':  'Vida Roja Máx Extra',
        'vidaAzulExtra':     'Vida Azul Extra',
        'guardaDoradaExtra': 'Guarda Dorada Extra'
    };

    for (const pjKey in stState.colaStats) {
        const realPj = devState.listaPersonajes.find(p => p.nombre.toLowerCase() === pjKey.toLowerCase())?.nombre || pjKey;
        const cambios = stState.colaStats[pjKey];
        const dbPj = stState.statsDB[pjKey] || {};

        // Detectar reinicio de asistencia ANTES del loop para filtrar HEX correctamente
        // Usamos el flag explícito __esReinicio que pone darAsistencia() en panel-stats-logic.js
        // Esto evita falsos negativos cuando el valor previo venía de la cola y no de la BD
        const fueReinicioAsistencia = !!cambios['__esReinicio'];

        for (const flatKey in cambios) {
            // BUG FIX: modPjStat llama setPjStat con subCampo=null cuando no hay subcampo,
            // generando flatKeys como "baseVidaRojaMax.null" — los ignoramos aquí,
            // el valor ya viene correctamente como "baseVidaRojaMax" en otro entry.
            if (flatKey.endsWith('.null') || flatKey.startsWith('__')) continue;

            const cantNueva = cambios[flatKey];
            const parts = flatKey.split('.');
            const campoRaiz = parts[0];
            const subCampo = parts.length > 1 ? parts[1] : null;

            let cantVieja = 0;
            if (!subCampo) cantVieja = dbPj[campoRaiz] ?? 0;
            else cantVieja = dbPj[campoRaiz]?.[subCampo] ?? 0;

            if (typeof cantNueva === 'number' && typeof cantVieja === 'number') {
                const delta = cantNueva - cantVieja;
                if (delta === 0) continue;
                if (!logPorPJ[realPj]) logPorPJ[realPj] = [];
                const sign = delta > 0 ? '+' : '';

                // ── ASISTENCIA ──
                if (campoRaiz === 'asistencia') {
                    if (fueReinicioAsistencia) {
                        logPorPJ[realPj].push(`Asistencia reiniciada (1/7)`);
                        const hexFinal = cambios['hex'] !== undefined ? cambios['hex'] : dbPj['hex'];
                        logPorPJ[realPj].push(`HEX +300`);
                        logPorPJ[realPj].push(`HEX +1000 ¡Extra! (${hexFinal})`);
                    } else {
                        logPorPJ[realPj].push(`Asistencia ${sign}${delta} (${cantNueva}/7)`);
                    }
                }

                // ── HEX: omitir si el cambio vino del reinicio de asistencia ──
                else if (campoRaiz === 'hex') {
                    if (!fueReinicioAsistencia) {
                        logPorPJ[realPj].push(`HEX ${sign}${delta} (${cantNueva})`);
                    }
                }

                // ── VIDA ROJA (muestra actual/max) ──
                else if (campoRaiz === 'vidaRojaActual' || campoRaiz === 'baseVidaRojaMax') {
                    const maxBase = campoRaiz === 'baseVidaRojaMax'
                        ? cantNueva
                        : (dbPj.baseVidaRojaMax || 0) + (cambios['baseVidaRojaMax'] !== undefined
                            ? cambios['baseVidaRojaMax'] - (dbPj.baseVidaRojaMax || 0) : 0);
                    const extraVida = (dbPj.buffs?.vidaRojaMaxExtra || 0)
                        + (dbPj.hechizosEfecto?.vidaRojaMaxExtra || 0)
                        + (dbPj.hechizos?.vidaRojaMaxExtra || 0);
                    const finalMax = maxBase + extraVida;
                    const finalAct = campoRaiz === 'vidaRojaActual'
                        ? cantNueva
                        : (dbPj.vidaRojaActual || 0) + (cambios['vidaRojaActual'] !== undefined
                            ? cambios['vidaRojaActual'] - (dbPj.vidaRojaActual || 0) : 0);
                    logPorPJ[realPj].push(`${nomLegibles[campoRaiz]} ${sign}${delta} (${finalAct}/${finalMax})`);
                }

                // ── ESTADOS NUMÉRICOS ──
                else if (campoRaiz === 'estados' && subCampo) {
                    const eDef = stState.estadosDB.find(e => e.id === subCampo);
                    const eName = eDef ? eDef.nombre : subCampo;
                    logPorPJ[realPj].push(`${eName} ${sign}${delta} (${cantNueva})`);
                }

                // ── AFINIDADES BASE ──
                else if (campoRaiz === 'afinidadesBase' && subCampo) {
                    logPorPJ[realPj].push(`Af. Base ${subNomLegibles[subCampo] || subCampo} ${sign}${delta} (${cantNueva})`);
                }

                // ── ALTERACIONES (hechizosEfecto / ALT) ──
                else if (campoRaiz === 'hechizosEfecto' && subCampo) {
                    logPorPJ[realPj].push(`Af. Alt. ${subNomLegibles[subCampo] || subCampo} ${sign}${delta} (${cantNueva})`);
                }

                // ── BUFFS / EXTRAS ──
                else if (campoRaiz === 'buffs' && subCampo) {
                    logPorPJ[realPj].push(`Buff ${subNomLegibles[subCampo] || subCampo} ${sign}${delta} (${cantNueva})`);
                }

                // ── RESTO (stats simples con nombre legible o el campoRaiz como fallback) ──
                else {
                    logPorPJ[realPj].push(`${nomLegibles[campoRaiz] || campoRaiz} ${sign}${delta} (${cantNueva})`);
                }

            } else if (typeof cantNueva === 'boolean') {
                const cantViejaBool = !subCampo ? !!dbPj[campoRaiz] : !!(dbPj[campoRaiz]?.[subCampo]);
                if (cantNueva === cantViejaBool) continue;
                if (!logPorPJ[realPj]) logPorPJ[realPj] = [];
                if (campoRaiz === 'estados' && subCampo) {
                    const eDef = stState.estadosDB.find(e => e.id === subCampo);
                    const eName = eDef ? eDef.nombre : subCampo;
                    logPorPJ[realPj].push(cantNueva ? `Estado adq. ${eName}` : `Estado rmv. ${eName}`);
                }
            }
        }
    }

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

export async function ejecutarGuardadoGlobal() {
    const btnSync = document.getElementById('btn-sync-global');
    btnSync.innerText = "⏳ SINCRONIZANDO CON LA BASE DE DATOS...";
    btnSync.style.pointerEvents = "none";

    try {
        const catalogUpserts = [];
        const invUpserts = [];
        const deletePromises = []; 
        const statsUpserts = [];
        const estadosUpserts = [];

        // --- OBJETOS ---
        const nuevosArr = Object.values(objState.colaNuevosObjetos).filter(o => o.nombre.trim() !== '');
        for (const obj of nuevosArr) {
            catalogUpserts.push({ nombre: obj.nombre, tipo: obj.tipo, material: obj.mat, rareza: obj.rar, efecto: obj.eff });
            if (obj.cant > 0) invUpserts.push({ personaje_nombre: devState.pjSeleccionado, objeto_nombre: obj.nombre, cantidad: obj.cant });
        }

        for (const oldName in objState.colaEdicionObjetos) {
            const dataEdit = objState.colaEdicionObjetos[oldName];
            const newName = dataEdit.nombre;
            catalogUpserts.push({ nombre: newName, tipo: dataEdit.tipo, material: dataEdit.mat, rareza: dataEdit.rar, efecto: dataEdit.eff });

            if (oldName !== newName) {
                Object.keys(objState.inventariosDB).forEach(pjKey => {
                    if (objState.inventariosDB[pjKey][oldName] > 0) {
                        const realPj = devState.listaPersonajes.find(p => p.nombre.toLowerCase() === pjKey)?.nombre || pjKey;
                        invUpserts.push({ personaje_nombre: realPj, objeto_nombre: newName, cantidad: objState.inventariosDB[pjKey][oldName] });
                        deletePromises.push(supabase.from('inventario_objetos').delete().eq('personaje_nombre', realPj).eq('objeto_nombre', oldName));
                    }
                });
                deletePromises.push(supabase.from('objetos').delete().eq('nombre', oldName));
            }
        }

        for (const pjKey in objState.colaInventario) {
            const realPj = devState.listaPersonajes.find(p => p.nombre.toLowerCase() === pjKey)?.nombre || pjKey;
            for (const obj in objState.colaInventario[pjKey]) {
                const cantFinal = objState.colaInventario[pjKey][obj];
                if (cantFinal > 0) invUpserts.push({ personaje_nombre: realPj, objeto_nombre: obj, cantidad: cantFinal });
                else deletePromises.push(supabase.from('inventario_objetos').delete().eq('personaje_nombre', realPj).eq('objeto_nombre', obj));
            }
        }

        // =========================================================================
        // ESTADÍSTICAS: MAPEO EXACTO A COLUMNAS DE SUPABASE (af_, ef_, bf_)
        // Nota: hz_* y hechizo_* son propiedad del módulo Grimorio — no se tocan aquí
        // =========================================================================
        for (const pjKey in stState.colaStats) {
            const realPj = devState.listaPersonajes.find(p => p.nombre.toLowerCase() === pjKey.toLowerCase())?.nombre || pjKey;
            const cambios = stState.colaStats[pjKey];
            let updatedPj = JSON.parse(JSON.stringify(stState.statsDB[pjKey]));

            for (const flatKey in cambios) {
                if (flatKey.endsWith('.null') || flatKey.startsWith('__')) continue; // ignorar keys malformadas
                const keys = flatKey.split('.');
                if (keys.length === 1) updatedPj[keys[0]] = cambios[flatKey];
                else {
                    if (!updatedPj[keys[0]]) updatedPj[keys[0]] = {};
                    updatedPj[keys[0]][keys[1]] = cambios[flatKey];
                }
            }

            statsUpserts.push({
                nombre: realPj,
                hex: updatedPj.hex,
                asistencia: updatedPj.asistencia,
                vida_roja_actual: updatedPj.vidaRojaActual,
                base_vida_roja_max: updatedPj.baseVidaRojaMax,
                base_vida_azul: updatedPj.baseVidaAzul,
                base_guarda_dorada: updatedPj.baseGuardaDorada,
                base_dano_rojo: updatedPj.baseDanoRojo,
                base_dano_azul: updatedPj.baseDanoAzul,
                base_elim_dorada: updatedPj.baseElimDorada,
                estados: updatedPj.estados,

                // Afinidades Base (af_)
                af_fisica: updatedPj.afinidadesBase.fisica || 0,
                af_energetica: updatedPj.afinidadesBase.energetica || 0,
                af_espiritual: updatedPj.afinidadesBase.espiritual || 0,
                af_mando: updatedPj.afinidadesBase.mando || 0,
                af_psiquica: updatedPj.afinidadesBase.psiquica || 0,
                af_oscura: updatedPj.afinidadesBase.oscura || 0,

                // Alteraciones por Hechizos (ef_)
                ef_fisica: updatedPj.hechizosEfecto.fisica || 0,
                ef_energetica: updatedPj.hechizosEfecto.energetica || 0,
                ef_espiritual: updatedPj.hechizosEfecto.espiritual || 0,
                ef_mando: updatedPj.hechizosEfecto.mando || 0,
                ef_psiquica: updatedPj.hechizosEfecto.psiquica || 0,
                ef_oscura: updatedPj.hechizosEfecto.oscura || 0,
                efecto_dano_rojo: updatedPj.hechizosEfecto.danoRojo || 0,
                efecto_dano_azul: updatedPj.hechizosEfecto.danoAzul || 0,
                efecto_elim: updatedPj.hechizosEfecto.elimDorada || 0,
                efecto_vida_roja: updatedPj.hechizosEfecto.vidaRojaMaxExtra || 0,
                efecto_vida_azul: updatedPj.hechizosEfecto.vidaAzulExtra || 0,
                efecto_guarda: updatedPj.hechizosEfecto.guardaDoradaExtra || 0,

                // Extras Temporales / Buffs (bf_)
                bf_fisica: updatedPj.buffs.fisica || 0,
                bf_energetica: updatedPj.buffs.energetica || 0,
                bf_espiritual: updatedPj.buffs.espiritual || 0,
                bf_mando: updatedPj.buffs.mando || 0,
                bf_psiquica: updatedPj.buffs.psiquica || 0,
                bf_oscura: updatedPj.buffs.oscura || 0,
                buff_dano_rojo: updatedPj.buffs.danoRojo || 0,
                buff_dano_azul: updatedPj.buffs.danoAzul || 0,
                buff_elim: updatedPj.buffs.elimDorada || 0,
                buff_vida_roja: updatedPj.buffs.vidaRojaMaxExtra || 0,
                buff_vida_azul: updatedPj.buffs.vidaAzulExtra || 0,
                buff_guarda: updatedPj.buffs.guardaDoradaExtra || 0
            });
        }

        // --- ESTADOS GLOBALES ---
        for (const id in stState.colaEstadosConfig) {
            estadosUpserts.push({ id: id, ...stState.colaEstadosConfig[id] });
        }
        if (stState.colaBorrarEstados.length > 0) {
            deletePromises.push(supabase.from('estados_config').delete().in('id', stState.colaBorrarEstados));
        }

        // 🔥 LANZAMIENTO A SUPABASE 🔥
        if (deletePromises.length > 0) await Promise.all(deletePromises);

        if (catalogUpserts.length > 0) {
            const { error: errCat } = await supabase.from('objetos').upsert(catalogUpserts, { onConflict: 'nombre' });
            if (errCat) throw new Error("Catálogo: " + errCat.message);
        }
        if (invUpserts.length > 0) {
            const { error: errInv } = await supabase.from('inventario_objetos').upsert(invUpserts, { onConflict: 'personaje_nombre,objeto_nombre' });
            if (errInv) throw new Error("Inventarios: " + errInv.message);
        }
        if (statsUpserts.length > 0) {
            const { error: errSt } = await supabase.from('personajes').upsert(statsUpserts, { onConflict: 'nombre' });
            if (errSt) throw new Error("Estadísticas: " + errSt.message);
        }
        if (estadosUpserts.length > 0) {
            const { error: errEst } = await supabase.from('estados_config').upsert(estadosUpserts, { onConflict: 'id' });
            if (errEst) throw new Error("Estados: " + errEst.message);
        }

        localStorage.removeItem('hex_obj_v4');
        localStorage.removeItem('hex_stats_v2');

        btnSync.innerText = "✅ CAMBIOS APLICADOS";
        btnSync.style.background = "#004a00";
        btnSync.style.borderColor = "#00ff00";
        btnSync.style.color = "white";

        setTimeout(() => { window.location.reload(); }, 1000);

    } catch (e) {
        console.error("Error guardando en BD:", e);
        alert("Ocurrió un error guardando en Supabase:\n" + e.message);
        btnSync.innerText = "❌ ERROR AL GUARDAR";
        btnSync.style.background = "#4a0000";
        btnSync.style.pointerEvents = "auto";
    }
}
