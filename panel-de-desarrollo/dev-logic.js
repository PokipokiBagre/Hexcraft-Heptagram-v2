// ============================================================
// dev-logic.js — Lógica de Sincronización y Logs
// ============================================================

import { db } from '../hex-db.js';
import { supabase } from '../hex-auth.js'; 
import { devState, norm } from './dev-state.js';
import { objState } from './objetos/panel-objetos-state.js';
import { stState } from './estadisticas/panel-stats-state.js';
import { hzState } from './hechizos/panel-hechizos-state.js'; 
import { getPjStat, calcularVidaRojaMaxTotal, calcularVidaAzulTotal, calcularGuardaDoradaTotal, calcularDanoRojoTotal, calcularDanoAzulTotal, calcularElimDoradaTotal } from './estadisticas/panel-stats-logic.js';
import { AFINIDADES_LISTA } from './estadisticas/panel-stats-state.js';
import { getCantidadActual } from './objetos/panel-objetos-logic.js'; 

export function revisarCambiosPendientes() {
    const btnSync = document.getElementById('btn-sync-global');
    if (!btnSync) return;

    let hayCambios = false;

    if (Object.keys(objState.colaInventario).length > 0) hayCambios = true;
    if (Object.keys(objState.colaEquipados).length > 0) hayCambios = true; // 🌟 
    if (Object.values(objState.colaNuevosObjetos).some(o => o.nombre.trim() !== '')) hayCambios = true;
    if (Object.keys(objState.colaEdicionObjetos).length > 0) hayCambios = true;
    if (Object.keys(stState.colaStats).length > 0) hayCambios = true;
    if (Object.keys(stState.colaEstadosConfig).length > 0) hayCambios = true;
    if (stState.colaBorrarEstados.length > 0) hayCambios = true;
    if (Object.keys(hzState.colaAsignaciones).length > 0) hayCambios = true; 
    if (Object.keys(hzState.colaVisibilidad).length > 0) hayCambios = true;

    if (hayCambios) btnSync.classList.remove('oculto');
    else btnSync.classList.add('oculto');
}

export function actualizarLogGlobal() {
    const logPorPJ = {};

    for (const pjKey in objState.colaInventario) {
        const realPj = devState.listaPersonajes.find(p => norm(p.nombre) === norm(pjKey))?.nombre || pjKey;
        for (const objNombre in objState.colaInventario[pjKey]) {
            const cantNueva = objState.colaInventario[pjKey][objNombre];
            const cantVieja = objState.inventariosDB[pjKey]?.[objNombre] || 0;
            const delta = cantNueva - cantVieja; 
            if (delta !== 0) {
                if (!logPorPJ[realPj]) logPorPJ[realPj] = [];
                if (delta > 0) {
                    const dbObj = objState.catalogoDB.find(o => o.nombre === objNombre);
                    const editObj = objState.colaEdicionObjetos[objNombre];
                    const efecto = (editObj ? editObj.eff : (dbObj ? dbObj.efecto : '')) || '';
                    const efectoStr = efecto ? ` | ${efecto}` : '';
                    logPorPJ[realPj].push(`Obj Obt. ${objNombre} x${delta}${efectoStr}`);
                } else {
                    logPorPJ[realPj].push(`Obj Prd. ${objNombre} x${Math.abs(delta)}`);
                }
            }
        }
    }

    // 🌟 LOG DE EQUIPACIÓN
    for (const pjKey in objState.colaEquipados) {
        const realPj = devState.listaPersonajes.find(p => norm(p.nombre) === norm(pjKey))?.nombre || pjKey;
        for (const objNombre in objState.colaEquipados[pjKey]) {
            const isEqp = objState.colaEquipados[pjKey][objNombre];
            const dbEqp = objState.equipadosDB[pjKey]?.[objNombre] || false;
            
            if (isEqp !== dbEqp) {
                if (!logPorPJ[realPj]) logPorPJ[realPj] = [];
                if (isEqp) {
                    const dbObj = objState.catalogoDB.find(o => o.nombre === objNombre);
                    const editObj = objState.colaEdicionObjetos[objNombre];
                    const efecto = (editObj ? editObj.eff : (dbObj ? dbObj.efecto : '')) || 'Sin efecto';
                    logPorPJ[realPj].push(`Obj. Eqp. | ${objNombre} | ${efecto}`);
                } else {
                    logPorPJ[realPj].push(`Obj. Dsqp. | ${objNombre}`);
                }
            }
        }
    }

    const pjActual = devState.pjSeleccionado || "SIN_ASIGNAR";
    const nuevosArr = Object.values(objState.colaNuevosObjetos).filter(o => o.nombre.trim() !== '');
    for (const obj of nuevosArr) {
        if (obj.cant > 0) {
            if (!logPorPJ[pjActual]) logPorPJ[pjActual] = [];
            const efectoStr = obj.eff ? ` | ${obj.eff}` : '';
            logPorPJ[pjActual].push(`Obj Obt. ${obj.nombre} x${obj.cant}${efectoStr}`);
        }
    }

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
        const realPj = devState.listaPersonajes.find(p => norm(p.nombre) === norm(pjKey))?.nombre || pjKey;
        const cambios = stState.colaStats[pjKey];
        const dbPj = stState.statsDB[pjKey] || {};

        const fueReinicioAsistencia = !!cambios['__esReinicio'];

        for (const flatKey in cambios) {
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
                else if (campoRaiz === 'hex') {
                    if (!fueReinicioAsistencia) {
                        logPorPJ[realPj].push(`HEX ${sign}${delta} (${cantNueva})`);
                    }
                }
                else {
                    const isVidaRoja = campoRaiz === 'vidaRojaActual' || campoRaiz === 'baseVidaRojaMax' || subCampo === 'vidaRojaMaxExtra';
                    const isVidaAzul = campoRaiz === 'baseVidaAzul' || subCampo === 'vidaAzulExtra';
                    const isGuarda   = campoRaiz === 'baseGuardaDorada' || subCampo === 'guardaDoradaExtra';
                    const isDRojo    = campoRaiz === 'baseDanoRojo' || subCampo === 'danoRojo';
                    const isDAzul    = campoRaiz === 'baseDanoAzul' || subCampo === 'danoAzul';
                    const isElim     = campoRaiz === 'baseElimDorada' || subCampo === 'elimDorada';

                    if (isVidaRoja || isVidaAzul || isGuarda || isDRojo || isDAzul || isElim) {
                        let finalTot = '';
                        if (isVidaRoja) {
                            finalTot = `${getPjStat(pjKey, 'vidaRojaActual')}/${calcularVidaRojaMaxTotal(pjKey)}`;
                        } else if (isVidaAzul) {
                            finalTot = calcularVidaAzulTotal(pjKey);
                        } else if (isGuarda) {
                            finalTot = calcularGuardaDoradaTotal(pjKey);
                        } else if (isDRojo) {
                            finalTot = calcularDanoRojoTotal(pjKey);
                        } else if (isDAzul) {
                            finalTot = calcularDanoAzulTotal(pjKey);
                        } else if (isElim) {
                            finalTot = calcularElimDoradaTotal(pjKey);
                        }

                        let prefijo = nomLegibles[campoRaiz] || campoRaiz;
                        if (campoRaiz === 'buffs') prefijo = "Buff " + (subNomLegibles[subCampo] || subCampo);
                        else if (campoRaiz === 'hechizos') prefijo = "Hcz " + (subNomLegibles[subCampo] || subCampo);
                        else if (campoRaiz === 'hechizosEfecto') prefijo = "Alt " + (subNomLegibles[subCampo] || subCampo);

                        logPorPJ[realPj].push(`${prefijo} ${sign}${delta} (${finalTot})`);
                    }
                    else if (campoRaiz === 'estados' && subCampo) {
                        const eDef = stState.estadosDB.find(e => e.id === subCampo);
                        const eName = eDef ? eDef.nombre : subCampo;
                        logPorPJ[realPj].push(`${eName} ${sign}${delta} (${cantNueva})`);
                    }
                    else if (campoRaiz === 'afinidadesBase' && subCampo) {
                        const totalAf = (getPjStat(pjKey, 'afinidadesBase', subCampo) || 0)
                                      + (getPjStat(pjKey, 'hechizos',       subCampo) || 0)
                                      + (getPjStat(pjKey, 'hechizosEfecto', subCampo) || 0)
                                      + (getPjStat(pjKey, 'buffs',          subCampo) || 0);
                        logPorPJ[realPj].push(`Af. Base ${subNomLegibles[subCampo] || subCampo} ${sign}${delta} (${totalAf})`);
                    }
                    else if (campoRaiz === 'hechizosEfecto' && subCampo && AFINIDADES_LISTA.includes(subCampo)) {
                        const totalAf = (getPjStat(pjKey, 'afinidadesBase', subCampo) || 0)
                                      + (getPjStat(pjKey, 'hechizos',       subCampo) || 0)
                                      + (getPjStat(pjKey, 'hechizosEfecto', subCampo) || 0)
                                      + (getPjStat(pjKey, 'buffs',          subCampo) || 0);
                        logPorPJ[realPj].push(`Af. Alt. ${subNomLegibles[subCampo] || subCampo} ${sign}${delta} (${totalAf})`);
                    }
                    else if (campoRaiz === 'buffs' && subCampo && AFINIDADES_LISTA.includes(subCampo)) {
                        const totalAf = (getPjStat(pjKey, 'afinidadesBase', subCampo) || 0)
                                      + (getPjStat(pjKey, 'hechizos',       subCampo) || 0)
                                      + (getPjStat(pjKey, 'hechizosEfecto', subCampo) || 0)
                                      + (getPjStat(pjKey, 'buffs',          subCampo) || 0);
                        logPorPJ[realPj].push(`Buff ${subNomLegibles[subCampo] || subCampo} ${sign}${delta} (${totalAf})`);
                    }
                    else if (campoRaiz === 'hechizosEfecto' && subCampo) {
                        logPorPJ[realPj].push(`Af. Alt. ${subNomLegibles[subCampo] || subCampo} ${sign}${delta} (${cantNueva})`);
                    }
                    else if (campoRaiz === 'buffs' && subCampo) {
                        logPorPJ[realPj].push(`Buff ${subNomLegibles[subCampo] || subCampo} ${sign}${delta} (${cantNueva})`);
                    }
                    else {
                        logPorPJ[realPj].push(`${nomLegibles[campoRaiz] || campoRaiz} ${sign}${delta} (${cantNueva})`);
                    }
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

    if (hzState.logCasteosSession && hzState.logCasteosSession.length > 0) {
        hzState.logCasteosSession.forEach(item => {
            if (!item.pj || item.pj === '—') {
                // Log global (ej: visibilidad) — sin cabecera de personaje
                if (!logPorPJ['__global__']) logPorPJ['__global__'] = [];
                logPorPJ['__global__'].push(item.msg);
            } else {
                const realPj = devState.listaPersonajes.find(p => norm(p.nombre) === norm(item.pj))?.nombre || item.pj;
                if (!logPorPJ[realPj]) logPorPJ[realPj] = [];
                logPorPJ[realPj].push(item.msg);
            }
        });
    }

    let logText = "";
    // Primero los globales sin cabecera
    if (logPorPJ['__global__'] && logPorPJ['__global__'].length > 0) {
        logPorPJ['__global__'].forEach(line => { logText += `${line}\n`; });
        logText += `\n`;
    }
    for (const pj in logPorPJ) {
        if (pj === '__global__') continue;
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
        const hzUpserts = [];

        const nuevosArr = Object.values(objState.colaNuevosObjetos).filter(o => o.nombre.trim() !== '');
        for (const obj of nuevosArr) {
            catalogUpserts.push({ nombre: obj.nombre, tipo: obj.tipo, material: obj.mat, rareza: obj.rar, efecto: obj.eff });
            if (obj.cant > 0) invUpserts.push({ personaje_nombre: devState.pjSeleccionado, objeto_nombre: obj.nombre, cantidad: obj.cant, equipado: false });
        }

        for (const oldName in objState.colaEdicionObjetos) {
            const dataEdit = objState.colaEdicionObjetos[oldName];
            const newName = dataEdit.nombre;
            catalogUpserts.push({ nombre: newName, tipo: dataEdit.tipo, material: dataEdit.mat, rareza: dataEdit.rar, efecto: dataEdit.eff });

            if (oldName !== newName) {
                Object.keys(objState.inventariosDB).forEach(pjKey => {
                    if (objState.inventariosDB[pjKey][oldName] > 0) {
                        const realPj = devState.listaPersonajes.find(p => norm(p.nombre) === norm(pjKey))?.nombre || pjKey;
                        const wasEqp = objState.equipadosDB[pjKey]?.[oldName] || false; 
                        invUpserts.push({ personaje_nombre: realPj, objeto_nombre: newName, cantidad: objState.inventariosDB[pjKey][oldName], equipado: wasEqp });
                        deletePromises.push(supabase.from('inventario_objetos').delete().eq('personaje_nombre', realPj).eq('objeto_nombre', oldName));
                    }
                });
                deletePromises.push(supabase.from('objetos').delete().eq('nombre', oldName));
            }
        }

        // 🌟 ACÁ SE GUARDAN LAS EQUIPACIONES JUNTAS CON LAS CANTIDADES
        const pjsInvolucradosObj = new Set([...Object.keys(objState.colaInventario), ...Object.keys(objState.colaEquipados)]);
        
        for (const pjKey of pjsInvolucradosObj) {
            const realPj = devState.listaPersonajes.find(p => norm(p.nombre) === norm(pjKey))?.nombre || pjKey;
            
            const objsInv = objState.colaInventario[pjKey] ? Object.keys(objState.colaInventario[pjKey]) : [];
            const objsEqp = objState.colaEquipados[pjKey] ? Object.keys(objState.colaEquipados[pjKey]) : [];
            const objsUnicos = new Set([...objsInv, ...objsEqp]);

            for (const obj of objsUnicos) {
                const cantFinal = getCantidadActual(pjKey, obj); 
                const eqpFinal = objState.colaEquipados[pjKey]?.[obj] !== undefined ? objState.colaEquipados[pjKey][obj] : (objState.equipadosDB[pjKey]?.[obj] || false);

                if (cantFinal > 0) {
                    invUpserts.push({ personaje_nombre: realPj, objeto_nombre: obj, cantidad: cantFinal, equipado: eqpFinal });
                } else {
                    deletePromises.push(supabase.from('inventario_objetos').delete().eq('personaje_nombre', realPj).eq('objeto_nombre', obj));
                }
            }
        }

        for (const pjKey in stState.colaStats) {
            const realPj = devState.listaPersonajes.find(p => norm(p.nombre) === norm(pjKey))?.nombre || pjKey;
            const cambios = stState.colaStats[pjKey];
            let updatedPj = JSON.parse(JSON.stringify(stState.statsDB[pjKey]));

            for (const flatKey in cambios) {
                if (flatKey.endsWith('.null') || flatKey.startsWith('__')) continue; 
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
                af_fisica: updatedPj.afinidadesBase.fisica || 0,
                af_energetica: updatedPj.afinidadesBase.energetica || 0,
                af_espiritual: updatedPj.afinidadesBase.espiritual || 0,
                af_mando: updatedPj.afinidadesBase.mando || 0,
                af_psiquica: updatedPj.afinidadesBase.psiquica || 0,
                af_oscura: updatedPj.afinidadesBase.oscura || 0,
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

        for (const id in stState.colaEstadosConfig) {
            estadosUpserts.push({ id: id, ...stState.colaEstadosConfig[id] });
        }
        if (stState.colaBorrarEstados.length > 0) {
            deletePromises.push(supabase.from('estados_config').delete().in('id', stState.colaBorrarEstados));
        }

        for (const pjKey in hzState.colaAsignaciones) {
            const realPj = devState.listaPersonajes.find(p => norm(p.nombre) === norm(pjKey))?.nombre || pjKey;
            for (const hzId in hzState.colaAsignaciones[pjKey]) {
                const agregar = hzState.colaAsignaciones[pjKey][hzId];
                if (agregar) hzUpserts.push({ personaje_nombre: realPj, hechizo_nombre: hzId });
                else deletePromises.push(supabase.from('hechizos_inventario').delete().eq('personaje_nombre', realPj).eq('hechizo_nombre', hzId)); 
            }
        }
        
        const visPromises = [];
        for (const hzId in hzState.colaVisibilidad) {
            visPromises.push(supabase.from('hechizos_nodos').update({ es_conocido: hzState.colaVisibilidad[hzId] }).eq('hechizo_id', hzId));
        }

        if (deletePromises.length > 0) await Promise.all(deletePromises);
        if (visPromises.length > 0) await Promise.all(visPromises); 

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
        if (hzUpserts.length > 0) {
            const { error: errHz } = await supabase.from('hechizos_inventario').upsert(hzUpserts, { onConflict: 'personaje_nombre,hechizo_nombre' }); 
            if (errHz) throw new Error("Hechizos: " + errHz.message);
        }

        // LIMPIEZA DE CACHÉ GENERAL
        localStorage.removeItem('hex_obj_v4');
        localStorage.removeItem('hex_stats_v2');
        localStorage.removeItem('hex_hechizos_cache');

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
