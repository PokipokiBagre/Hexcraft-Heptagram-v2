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
    const nomLegibles = {
        'hex': 'HEX', 'asistencia': 'Asistencia', 'vidaRojaActual': 'Vida Roja',
        'baseVidaRojaMax': 'Límite Rojo', 'baseVidaAzul': 'Corazones Azules', 'baseGuardaDorada': 'Guarda Dorada',
        'baseDanoRojo': 'Daño Rojo', 'baseDanoAzul': 'Daño Azul', 'baseElimDorada': 'Eliminación Dorada'
    };
    const afinCapital = { fisica: 'Física', energetica: 'Energética', espiritual: 'Espiritual', mando: 'Mando', psiquica: 'Psíquica', oscura: 'Oscura' };

    for (const pjKey in stState.colaStats) {
        const realPj = devState.listaPersonajes.find(p => p.nombre.toLowerCase() === pjKey.toLowerCase())?.nombre || pjKey;
        const cambios = stState.colaStats[pjKey];
        const dbPj = stState.statsDB[pjKey] || {};

        for (const flatKey in cambios) {
            const cantNueva = cambios[flatKey];
            let cantVieja = 0;
            const parts = flatKey.split('.');
            if (parts.length === 1) cantVieja = dbPj[parts[0]] || 0;
            else cantVieja = dbPj[parts[0]]?.[parts[1]] || 0;

            if (typeof cantNueva === 'number' && typeof cantVieja === 'number') {
                const delta = cantNueva - cantVieja;
                if (delta !== 0) {
                    if (!logPorPJ[realPj]) logPorPJ[realPj] = [];
                    const sign = delta > 0 ? '+' : '';
                    let statName = nomLegibles[flatKey] || flatKey;
                    
                    if (flatKey.includes('afinidadesBase')) statName = `Afinidad Base ${afinCapital[parts[1]]}`;
                    if (flatKey.includes('hechizosEfecto')) statName = `Afinidad Alt. ${afinCapital[parts[1]]}`;
                    if (flatKey.includes('buffs')) statName = `Buff Extra ${afinCapital[parts[1]] || parts[1]}`;
                    
                    // 🌟 DIVISION DEL HEX POR BONO DE ASISTENCIA 🌟
                    if (flatKey === 'hex' && delta >= 1300) {
                        let extra = delta - 300;
                        logPorPJ[realPj].push(`HEX +300`);
                        logPorPJ[realPj].push(`HEX +${extra} ¡Extra! (${cantNueva})`);
                    }
                    else if (flatKey === 'asistencia' && delta < 0 && cantNueva === 1) {
                        logPorPJ[realPj].push(`Asistencia reiniciada (1/7)`);
                    }
                    else if (flatKey.includes('estados')) {
                        const eDef = stState.estadosDB.find(e => e.id === parts[1]);
                        const eName = eDef ? eDef.nombre : parts[1];
                        logPorPJ[realPj].push(`${eName} ${sign}${delta} (${cantNueva})`);
                    } 
                    else if (flatKey === 'vidaRojaActual' || flatKey === 'baseVidaRojaMax') {
                        let maxBase = (flatKey === 'baseVidaRojaMax' ? cantNueva : (dbPj.baseVidaRojaMax||0) + (cambios['baseVidaRojaMax'] !== undefined ? cambios['baseVidaRojaMax'] - (dbPj.baseVidaRojaMax||0) : 0));
                        let extra = (dbPj.buffs?.vidaRojaMaxExtra||0) + (dbPj.hechizosEfecto?.vidaRojaMaxExtra||0) + (dbPj.hechizos?.vidaRojaMaxExtra||0);
                        let finalMax = maxBase + extra;
                        let finalAct = (flatKey === 'vidaRojaActual' ? cantNueva : (dbPj.vidaRojaActual||0) + (cambios['vidaRojaActual'] !== undefined ? cambios['vidaRojaActual'] - (dbPj.vidaRojaActual||0) : 0));
                        logPorPJ[realPj].push(`${statName} ${sign}${delta} (${finalAct}/${finalMax})`);
                    } 
                    else {
                        logPorPJ[realPj].push(`${statName} ${sign}${delta} (${cantNueva})`);
                    }
                }
            } 
            else if (typeof cantNueva === 'boolean' && cantNueva !== cantVieja) {
                if (!logPorPJ[realPj]) logPorPJ[realPj] = [];
                const eDef = stState.estadosDB.find(e => e.id === parts[1]);
                const eName = eDef ? eDef.nombre : parts[1];
                if (cantNueva) logPorPJ[realPj].push(`Estado adq. ${eName}`);
                else logPorPJ[realPj].push(`Estado rmv. ${eName}`);
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

        // ================== ESTADÍSTICAS Y MAPEADO A COLUMNAS PLANAS ==================
        for (const pjKey in stState.colaStats) {
            const realPj = devState.listaPersonajes.find(p => p.nombre.toLowerCase() === pjKey.toLowerCase())?.nombre || pjKey;
            const cambios = stState.colaStats[pjKey];
            let updatedPj = JSON.parse(JSON.stringify(stState.statsDB[pjKey]));

            for (const flatKey in cambios) {
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
                
                fisica: updatedPj.afinidadesBase.fisica || 0,
                energetica: updatedPj.afinidadesBase.energetica || 0,
                espiritual: updatedPj.afinidadesBase.espiritual || 0,
                mando: updatedPj.afinidadesBase.mando || 0,
                psiquica: updatedPj.afinidadesBase.psiquica || 0,
                oscura: updatedPj.afinidadesBase.oscura || 0,
                
                alt_fisica: updatedPj.hechizosEfecto.fisica || 0,
                alt_energetica: updatedPj.hechizosEfecto.energetica || 0,
                alt_espiritual: updatedPj.hechizosEfecto.espiritual || 0,
                alt_mando: updatedPj.hechizosEfecto.mando || 0,
                alt_psiquica: updatedPj.hechizosEfecto.psiquica || 0,
                alt_oscura: updatedPj.hechizosEfecto.oscura || 0,
                alt_dano_rojo: updatedPj.hechizosEfecto.danoRojo || 0,
                alt_dano_azul: updatedPj.hechizosEfecto.danoAzul || 0,
                alt_elim_dorada: updatedPj.hechizosEfecto.elimDorada || 0,
                
                ext_fisica: updatedPj.buffs.fisica || 0,
                ext_energetica: updatedPj.buffs.energetica || 0,
                ext_espiritual: updatedPj.buffs.espiritual || 0,
                ext_mando: updatedPj.buffs.mando || 0,
                ext_psiquica: updatedPj.buffs.psiquica || 0,
                ext_oscura: updatedPj.buffs.oscura || 0,
                ext_dano_rojo: updatedPj.buffs.danoRojo || 0,
                ext_dano_azul: updatedPj.buffs.danoAzul || 0,
                ext_elim_dorada: updatedPj.buffs.elimDorada || 0,
                ext_vida_roja_max: updatedPj.buffs.vidaRojaMaxExtra || 0,
                ext_vida_azul: updatedPj.buffs.vidaAzulExtra || 0,
                ext_guarda_dorada: updatedPj.buffs.guardaDoradaExtra || 0
            });
        }

        for (const id in stState.colaEstadosConfig) {
            estadosUpserts.push({ id: id, ...stState.colaEstadosConfig[id] });
        }
        if (stState.colaBorrarEstados.length > 0) {
            deletePromises.push(supabase.from('estados_config').delete().in('id', stState.colaBorrarEstados));
        }

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
