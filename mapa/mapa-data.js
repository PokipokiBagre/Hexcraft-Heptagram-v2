// ============================================================
// mapa-data.js — VERSIÓN SUPABASE
// ============================================================

import { estadoMapa, ESTETICA } from './mapa-state.js';
import { supabase } from '../hex-auth.js';
import { db }       from '../hex-db.js';

// ── Carga inicial ─────────────────────────────────────────────
export async function cargarDatos(barra) {
    try {
        if (barra) barra.style.width = '10%';

        // Carga paralela: jugadores activos + datos de hechizos
        const [personajesArr, hechizosData] = await Promise.all([
            db.personajes.getJugadoresActivos(),
            db.hechizos.getDataCompleta()
        ]);

        if (barra) barra.style.width = '60%';

        // ── JUGADORES → sidebar ────────────────────────────────
        estadoMapa.jugadores = personajesArr.map(p => p.nombre);

        // ── COLORES DE AFINIDAD desde la tabla hechizos_afinidades ──
        window.mapaColores = {};
        if (hechizosData.afinidades) {
            hechizosData.afinidades.forEach(row => {
                // row = [afinidad, color_t, color_b]
                if (row[0]) {
                    window.mapaColores[row[0].trim()] = {
                        t: row[1] ? row[1].toString().trim() : '#ffffff',
                        b: row[2] ? row[2].toString().trim() : '#555555'
                    };
                }
            });
        }

        // ── PROCESAR NODOS Y ENLACES ───────────────────────────
        // getDataCompleta() devuelve datos en formato PascalCase que el motor ya espera
        procesarInventario(hechizosData);
        procesarNodos(hechizosData);
        procesarEnlaces(hechizosData.string || []);

        if (barra) barra.style.width = '100%';
        return true;

    } catch (e) {
        console.error("Error cargando mapa:", e);
        return false;
    }
}

function procesarInventario(json) {
    estadoMapa.inventario = {};
    if (json.inventario) {
        json.inventario.forEach(row => {
            const pj = row.Personaje ? row.Personaje.trim() : '';
            const he = row.Hechizo   ? row.Hechizo.trim()   : '';
            if (pj && he) {
                if (!estadoMapa.inventario[pj]) estadoMapa.inventario[pj] = new Set();
                estadoMapa.inventario[pj].add(he.replace(/\s*\(\d+\)$/, '').trim().toLowerCase());
            }
        });
    }
}

function parseCoord(val) {
    if (val === undefined || val === null || val === '') return null;
    const num = parseFloat(String(val).trim().replace(/,/g, '.').replace(/[^0-9.\-]/g, ''));
    return isNaN(num) ? null : num;
}

function procesarNodos(json) {
    const todos = [].concat(json.nodos || []).concat(json.nodosOcultos || []);
    estadoMapa.nodos = [];
    const procesados = new Set();

    // Detectar si las coords son Gephi raw (>15000) y necesitan escalar
    let maxVal = 0;
    todos.forEach(n => {
        const x = parseCoord(n.X); const y = parseCoord(n.Y);
        if (x !== null && Math.abs(x) > maxVal) maxVal = Math.abs(x);
        if (y !== null && Math.abs(y) > maxVal) maxVal = Math.abs(y);
    });
    const isGephiRaw   = maxVal > 15000;
    const scaleFactor  = isGephiRaw ? (3500 / maxVal) : 1;

    todos.forEach(n => {
        if (!n.ID && !n.Nombre) return;

        const idReal      = n.ID     ? n.ID.toString().trim()     : '';
        const nombreReal  = n.Nombre && n.Nombre.trim() !== '' ? n.Nombre.trim() : idReal;
        const idUnico     = (idReal || nombreReal).toLowerCase();
        if (procesados.has(idUnico)) return;
        procesados.add(idUnico);

        const esConocido  = n.Conocido && n.Conocido.toString().trim().toLowerCase() === 'si';
        const hexCost     = parseInt(n.HEX) || 0;
        const isHexNode   = (idUnico === 'hex' || idUnico === 'hechizo hex');

        const baseName    = nombreReal.replace(/\s*\(\d+\)$/, '').trim();
        const nombreMostrar = (esConocido || isHexNode)
            ? (isHexNode ? "HEX" : `${baseName} (${hexCost})`)
            : `${idReal.toLowerCase().includes('hechizo') ? idReal : `Hechizo ${idReal}`} (${hexCost})`;

        let rawX = parseCoord(n.X); let rawY = parseCoord(n.Y);
        if (rawX === null) rawX = (Math.random() * 800) - 400;
        if (rawY === null) rawY = (Math.random() * 800) - 400;

        estadoMapa.nodos.push({
            id:             idReal,
            nombreOriginal: nombreReal,
            nombre:         nombreMostrar,
            afinidad:       n.Afinidad || 'Desconocida',
            clase:          n.Clase    || '-',
            hex:            hexCost,
            resumen:        n.Resumen  || 'Sin descripción',
            efecto:         n.Efecto   || '',
            overcast:       n['Overcast 100%'] || n.overcast || '',
            undercast:      n['Undercast 50%'] || n.undercast || '',
            especial:       n.Especial || '',
            esConocido,
            isHexNode,
            x:              rawX * scaleFactor,
            y:              rawY * scaleFactor,
            radio:          isHexNode ? 65 : (esConocido ? 35 : 28),
            incomingSources: [],
            modificado:     isGephiRaw
        });
    });
}

function procesarEnlaces(arrayStrings) {
    estadoMapa.enlaces = [];

    const findNode = (val) => {
        if (!val) return null;
        const str    = String(val).trim().toLowerCase();
        const strNum = str.replace(/^hechizo\s+/i, '').trim();
        return estadoMapa.nodos.find(n => {
            const nid    = String(n.id).trim().toLowerCase();
            const nnom   = String(n.nombreOriginal).trim().toLowerCase();
            const nidNum = nid.replace(/^hechizo\s+/i, '').trim();
            const nnomNum = nnom.replace(/^hechizo\s+/i, '').trim();
            return nid === str || nnom === str || nidNum === strNum || nnomNum === strNum;
        });
    };

    arrayStrings.forEach(rel => {
        if (!rel) return;
        // getDataCompleta devuelve { Source, Target }
        const src = rel.Source || Object.values(rel)[0];
        const tgt = rel.Target || Object.values(rel)[1];
        const sourceNode = findNode(src);
        const targetNode = findNode(tgt);
        if (sourceNode && targetNode && sourceNode !== targetNode) {
            estadoMapa.enlaces.push({ source: sourceNode, target: targetNode });
            targetNode.incomingSources.push(sourceNode);
        }
    });
    actualizarColoresFlechas();
}

export function actualizarColoresFlechas() {
    estadoMapa.nodos.forEach(nodo => {
        if (nodo.incomingSources.length === 0) { nodo.arrowColor = ESTETICA.lineaDescubierta; return; }
        const total    = nodo.incomingSources.length;
        const conocidos = nodo.incomingSources.filter(n => n.esConocido).length;
        if (conocidos === total)     nodo.arrowColor = ESTETICA.lineaDescubierta;
        else if (conocidos > 0)     nodo.arrowColor = ESTETICA.lineaMostaza;
        else                        nodo.arrowColor = ESTETICA.lineaRosa;
    });
}

// ── Guardar posiciones + visibilidad (desde mapa-main) ────────
// Usado cuando solo se arrastran nodos o se cambia si/no en el panel info
export async function guardarPosicionesYVisibilidad(cambios) {
    // cambios = [{ id, x, y, conocido: 'si'/'no' }]
    try {
        // 1. Batch de posiciones
        const posiciones = cambios.map(c => ({ hechizo_id: c.id, pos_x: c.x, pos_y: c.y }));
        await db.hechizos.guardarPosicionesBatch(posiciones);

        // 2. Visibilidad nodo a nodo
        for (const c of cambios) {
            await db.hechizos.toggleConocido(c.id, c.conocido === 'si');
        }
        return true;
    } catch (e) {
        console.error("Error en guardarPosicionesYVisibilidad:", e);
        return false;
    }
}

// ── Guardar edición completa (desde mapa-edicion) ─────────────
// Maneja nodos (upsert/delete), enlaces (insert/delete) y colores de afinidad
export async function guardarEdicionCompleta(payload) {
    // payload = { nodos: [...], enlaces: [...], afinidades: {...} }
    try {
        // ── NODOS ─────────────────────────────────────────────
        for (const nodo of payload.nodos) {
            if (nodo.eliminado) {
                await supabase.from('hechizos_nodos').delete().eq('hechizo_id', nodo.idOriginal);
            } else {
                const d = nodo.datos;
                await supabase.from('hechizos_nodos').upsert({
                    hechizo_id:  d.ID,
                    nombre:      d.Nombre,
                    hex_cost:    d.HEX      || 0,
                    clase:       d.Clase    || '-',
                    afinidad:    d.Afinidad || '',
                    resumen:     d.Resumen  || '',
                    efecto:      d.Efecto   || '',
                    overcast:    d['Overcast 100%'] || '',
                    undercast:   d['Undercast 50%'] || '',
                    especial:    d.Especial || '',
                    pos_x:       d.X        || 0,
                    pos_y:       d.Y        || 0,
                    es_conocido: d.Conocido === 'si'
                }, { onConflict: 'hechizo_id' });

                // Si el ID cambió, borrar el registro viejo
                if (nodo.idOriginal && nodo.idOriginal !== d.ID) {
                    await supabase.from('hechizos_nodos').delete().eq('hechizo_id', nodo.idOriginal);
                }
            }
        }

        // ── ENLACES ───────────────────────────────────────────
        for (const enlace of payload.enlaces) {
            if (enlace.eliminado) {
                await supabase.from('hechizos_strings')
                    .delete()
                    .eq('source_id', enlace.source)
                    .eq('target_id', enlace.target);
            } else {
                await supabase.from('hechizos_strings').upsert({
                    source_id: enlace.source,
                    target_id: enlace.target
                }, { onConflict: 'source_id,target_id' });
            }
        }

        // ── COLORES DE AFINIDAD ───────────────────────────────
        for (const [afinidad, colores] of Object.entries(payload.afinidades || {})) {
            await supabase.from('hechizos_afinidades').upsert({
                afinidad,
                color_t: colores.t,
                color_b: colores.b
            }, { onConflict: 'afinidad' });
        }

        return true;
    } catch (e) {
        console.error("Error en guardarEdicionCompleta:", e);
        return false;
    }
}
