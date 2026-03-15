// ============================================================
// mapa-data.js — VERSIÓN SUPABASE (BLINDADA)
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
                if (row[0]) {
                    window.mapaColores[row[0].trim()] = {
                        t: row[1] ? row[1].toString().trim() : '#ffffff',
                        b: row[2] ? row[2].toString().trim() : '#555555'
                    };
                }
            });
        }

estadoMapa.inventario = {};
        if (hechizosData.inventario) {
            hechizosData.inventario.forEach(item => {
                const pj = item.Personaje;
                if (!estadoMapa.inventario[pj]) estadoMapa.inventario[pj] = new Set();
                // Guardamos el nombre del hechizo en minúsculas para que el buscador lo encuentre fácil
                estadoMapa.inventario[pj].add(item.Hechizo.trim().toLowerCase());
            });
        }
        
        // LIMPIAR ARRAYS POR SEGURIDAD
        estadoMapa.nodos = [];
        estadoMapa.enlaces = [];
        
        // UNIR NODOS Y FILTRAR FANTASMAS (Evita el error 'reading x')
        const todosLosNodos = [...(hechizosData.nodos || []), ...(hechizosData.nodosOcultos || [])];
        
        todosLosNodos.forEach(n => {
            if (!n) return; // ¡Filtro de seguridad contra undefined!
            
            estadoMapa.nodos.push({
                id: n.ID,
                nombreOriginal: n.Nombre || n.ID,
                nombre: `${n.Nombre || n.ID} (${n.HEX || 0})`,
                afinidad: n.Afinidad || '-',
                clase: n.Clase || 'Clase 1',
                hex: parseInt(n.HEX) || 0,
                resumen: n.Resumen || '',
                efecto: n.Efecto || '',
                overcast: n['Overcast 100%'] || '',
                undercast: n['Undercast 50%'] || '',
                especial: n.Especial || '',
                esConocido: n.Conocido === 'si',
                isHexNode: false,
                x: parseFloat(n.X) || 0,
                y: parseFloat(n.Y) || 0,
                radio: n.Size || (n.Conocido === 'si' ? 35 : 28),
                colorBase: n.Color || '#ffffff',
                incomingSources: [],
                modificado: false
            });
        });

        // ── ENLACES ───────────────────────────────────────────
        const findNode = (str) => {
            if (!str) return null;
            const strNorm = String(str).trim().toLowerCase();
            const strNum = strNorm.replace(/^hechizo\s+/i, '').trim();
            
            return estadoMapa.nodos.find(n => {
                const nid = String(n.id).trim().toLowerCase();
                const nnom = String(n.nombreOriginal).trim().toLowerCase();
                const nidNum = nid.replace(/^hechizo\s+/i, '').trim();
                const nnomNum = nnom.replace(/^hechizo\s+/i, '').trim();
                return nid === strNorm || nnom === strNorm || nidNum === strNum || nnomNum === strNum;
            });
        };

        if (hechizosData.string) {
            hechizosData.string.forEach(rel => {
                if (!rel || !rel.Source || !rel.Target) return;
                const sourceNode = findNode(rel.Source);
                const targetNode = findNode(rel.Target);

                // Solo creamos la flecha si AMBOS nodos existen realmente
                if (sourceNode && targetNode && sourceNode !== targetNode) {
                    estadoMapa.enlaces.push({ source: sourceNode, target: targetNode });
                    targetNode.incomingSources.push(sourceNode);
                }
            });
        }

        actualizarColoresFlechas();
        
        if (barra) barra.style.width = '100%';
    } catch (e) {
        console.error("Error en cargarDatos:", e);
    }
}

export function actualizarColoresFlechas() {
    estadoMapa.nodos.forEach(nodo => {
        if (!nodo) return;
        if (nodo.incomingSources.length === 0) {
            nodo.arrowColor = ESTETICA.lineaDescubierta; 
            return;
        }
        const total = nodo.incomingSources.length;
        const conocidos = nodo.incomingSources.filter(n => n && n.esConocido).length;
        
        if (conocidos === total) {
            nodo.arrowColor = ESTETICA.lineaDescubierta; 
        } else if (conocidos > 0) {
            nodo.arrowColor = ESTETICA.lineaMostaza; 
        } else {
            nodo.arrowColor = ESTETICA.lineaRosa; 
        }
    });
}

export async function guardarEdicionCompleta(payload) {
    try {
        const nodosParaUpsert = [];
        
        // ── 1. PREPARAR NODOS ──────────────────────────────────
        for (const item of payload.nodos) {
            if (item.eliminado) {
                const { error } = await supabase.from('hechizos_nodos').delete().eq('hechizo_id', item.idOriginal);
                if (error) throw error;
            } else {
                const d = item.datos; 
                
                nodosParaUpsert.push({
                    hechizo_id:  d.ID,
                    nombre:      d.Nombre   || d.ID,
                    hex_cost:    d.HEX      || 0,
                    clase:       d.Clase    || 'Clase 1',
                    afinidad:    d.Afinidad || '',
                    resumen:     d.Resumen  || '',
                    efecto:      d.Efecto   || '',
                    overcast:    d['Overcast 100%'] || '',
                    undercast:   d['Undercast 50%'] || '',
                    especial:    d.Especial || '',
                    pos_x:       d.X        || 0,
                    pos_y:       d.Y        || 0,
                    es_conocido: d.Conocido === 'si'
                });

                // Limpiar viejo ID si fue renombrado
                if (item.idOriginal && item.idOriginal !== d.ID) {
                    await supabase.from('hechizos_nodos').delete().eq('hechizo_id', item.idOriginal);
                }
            }
        }

        // Guardado masivo por lotes (Batch)
        if (nodosParaUpsert.length > 0) {
            for (let i = 0; i < nodosParaUpsert.length; i += 50) {
                const lote = nodosParaUpsert.slice(i, i + 50);
                const { error } = await supabase.from('hechizos_nodos').upsert(lote, { onConflict: 'hechizo_id' });
                if (error) throw error;
            }
        }

        // ── 2. PREPARAR ENLACES ────────────────────────────────
        const enlacesParaUpsert = [];
        for (const enlace of payload.enlaces) {
            if (enlace.eliminado) {
                const { error } = await supabase.from('hechizos_strings')
                    .delete()
                    .eq('source_id', enlace.source)
                    .eq('target_id', enlace.target);
                if (error) throw error;
            } else {
                enlacesParaUpsert.push({
                    source_id: enlace.source,
                    target_id: enlace.target
                });
            }
        }

        if (enlacesParaUpsert.length > 0) {
            for (let i = 0; i < enlacesParaUpsert.length; i += 50) {
                const lote = enlacesParaUpsert.slice(i, i + 50);
                const { error } = await supabase.from('hechizos_strings').upsert(lote, { onConflict: 'source_id,target_id' });
                if (error) throw error;
            }
        }

        // ── 3. COLORES DE AFINIDAD ─────────────────────────────
        const afinidadesParaUpsert = [];
        for (const [afinidad, colores] of Object.entries(payload.afinidades || {})) {
            afinidadesParaUpsert.push({
                afinidad,
                color_t: colores.t,
                color_b: colores.b
            });
        }
        
        if (afinidadesParaUpsert.length > 0) {
            const { error } = await supabase.from('hechizos_afinidades').upsert(afinidadesParaUpsert, { onConflict: 'afinidad' });
            if (error) throw error;
        }

        return true;
        
    } catch (e) {
        console.error("Error crítico guardando en Supabase:", e);
        return false;
    }
}

// Para evitar errores si algún archivo viejo todavía intenta llamarla
export async function guardarPosicionesYVisibilidad() {
    return true; 
}
