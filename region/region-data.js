// ============================================================
// region-data.js — Carga y guardado en Supabase
// ============================================================

import { supabase } from '../hex-auth.js';
import { db }       from '../hex-db.js';
import {
    BUCKET, STORAGE_URL,
    mapaActual, props, npcsMapaLocal,
    personajesDB, misionesActivas,
    crearHexData
} from './region-state.js';

export const normKey = (s) => s ? s.toString().trim().toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e')
    .replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o')
    .replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
    .replace(/\s+/g,'_').replace(/[^a-z0-9_\-]/g,'') : '';

export async function cargarTodo(mapaId = 'mundo') {
    try {
        const [
            mapaRes, propsRes, npcsRes,
            personajesArr, misionesArr
        ] = await Promise.all([
            supabase.from('region_mapas').select('*').eq('id', mapaId).single(),
            supabase.from('region_props').select('*').order('nombre'),
            supabase.from('region_npcs').select('*'),
            db.personajes.getAll(),
            db.misiones.getAll()
        ]);

        for (const k in props) delete props[k];
        
        props['prop_pintar'] = {
            id: 'prop_pintar',
            nombre: '🖌️ PINCEL DE COLOR',
            tipo: 'terreno', 
            imagen: null
        };

        if (propsRes.data) {
            propsRes.data.forEach(p => {
                props[p.id] = {
                    id:     p.id,
                    nombre: p.nombre,
                    tipo:   p.tipo,         
                    imagen: p.imagen_url
                };
            });
        }

        personajesDB.length = 0;
        personajesArr.forEach(p => {
            personajesDB.push({
                nombre:   p.nombre,
                icon:     p.icono_override || p.nombre,
                isPlayer: p.is_player,
                npcTipo:  p.npc_tipo || 'sistema',
                color:    '#888'
            });

            const pid = `pj_${normKey(p.nombre)}`;
            props[pid] = {
                id: pid,
                nombre: p.nombre,
                tipo: 'entidad',
                imagen: `${STORAGE_URL}/imgpersonajes/${normKey(p.icono_override || p.nombre)}icon.png`
            };
        });

        misionesActivas.length = 0;
        misionesArr.forEach(m => {
            if (m.estado === 1 || m.estado === 2) {
                misionesActivas.push({
                    id:     m.titulo,
                    titulo: m.titulo,
                    tipo:   m.tipo,
                    estado: m.estado,
                    clase:  m.clase
                });
            }
        });

        for (const k in npcsMapaLocal) delete npcsMapaLocal[k];
        if (npcsRes.data) {
            npcsRes.data.forEach(n => {
                if (n.mapa_id === mapaId) {
                    npcsMapaLocal[n.id] = {
                        id:     n.id,
                        nombre: n.nombre,
                        tipo:   n.tipo || 'sistema',   
                        icono:  n.icono_url || '',
                        hex:    n.hex_pos,              
                        capa:   n.capa || 'mid',
                        desc:   n.descripcion || '',
                        stats:  n.stats || {},
                        mapaId: n.mapa_id
                    };
                }
            });
        }

        if (mapaRes.data) {
            const m = mapaRes.data;
            mapaActual.id     = m.id;
            mapaActual.nombre = m.nombre;
            mapaActual.ancho  = m.ancho  || 40;
            mapaActual.alto   = m.alto   || 30;
            mapaActual.esInterior = m.es_interior || false;
            mapaActual.parentId   = m.parent_id || null;
            mapaActual.parentHex  = m.parent_hex || null;

            for (const k in mapaActual.hexes) delete mapaActual.hexes[k];
            if (m.datos_hexes) {
                const parsed = typeof m.datos_hexes === 'string' ? JSON.parse(m.datos_hexes) : m.datos_hexes;
                for (const key in parsed) {
                    if (parsed[key].background) {
                        parsed[key].back = parsed[key].background;
                        delete parsed[key].background;
                    }
                }
                Object.assign(mapaActual.hexes, parsed);
            }

            for (const k in mapaActual.regiones) delete mapaActual.regiones[k];
            if (m.datos_regiones) {
                const parsed = typeof m.datos_regiones === 'string' ? JSON.parse(m.datos_regiones) : m.datos_regiones;
                Object.assign(mapaActual.regiones, parsed);
            }
        }

        return true;
    } catch (e) {
        console.error("Error cargarTodo:", e);
        return false;
    }
}

export async function guardarMapa() {
    try {
        const payload = {
            id:            mapaActual.id,
            nombre:        mapaActual.nombre,
            ancho:         mapaActual.ancho,
            alto:          mapaActual.alto,
            es_interior:   mapaActual.esInterior,
            parent_id:     mapaActual.parentId,
            parent_hex:    mapaActual.parentHex,
            datos_hexes:   mapaActual.hexes,
            datos_regiones: mapaActual.regiones,
            updated_at:    new Date().toISOString()
        };

        const { error } = await supabase.from('region_mapas').upsert(payload, { onConflict: 'id' });
        if (error) throw error;
        return true;
    } catch (e) {
        console.error("Error guardarMapa:", e);
        return false;
    }
}

export async function guardarProp(propData) {
    try {
        const { error } = await supabase
            .from('region_props')
            .upsert({
                id:         propData.id,
                nombre:     propData.nombre,
                tipo:       propData.tipo,
                imagen_url: propData.imagen || ''
            }, { onConflict: 'id' });
        if (error) throw error;
        return true;
    } catch (e) {
        console.error("Error guardarProp:", e);
        return false;
    }
}

export async function eliminarProp(propId) {
    try {
        const { error } = await supabase.from('region_props').delete().eq('id', propId);
        if (error) throw error;
        return true;
    } catch (e) { return false; }
}

export async function guardarNPC(npcData) {
    try {
        const { error } = await supabase
            .from('region_npcs')
            .upsert({
                id:          npcData.id,
                nombre:      npcData.nombre,
                tipo:        npcData.tipo,
                icono_url:   npcData.icono,
                hex_pos:     npcData.hex,
                capa:        npcData.capa,
                descripcion: npcData.desc,
                stats:       npcData.stats,
                mapa_id:     npcData.mapaId
            }, { onConflict: 'id' });
        if (error) throw error;
        return true;
    } catch (e) { return false; }
}

export async function eliminarNPC(npcId) {
    try {
        const { error } = await supabase.from('region_npcs').delete().eq('id', npcId);
        if (error) throw error;
        return true;
    } catch (e) { return false; }
}

export async function subirImagenProp(file, carpeta, keyNorm, onProgreso) {
    const ruta = `${carpeta}/${keyNorm}.png`;

    if (onProgreso) onProgreso(20, 'Procesando imagen...');

    const blobPNG = await convertirPNG(file);
    const filePNG = new File([blobPNG], `${keyNorm}.png`, { type: 'image/png' });

    if (onProgreso) onProgreso(60, 'Subiendo al servidor...');

    const { error } = await supabase.storage.from(BUCKET)
        .upload(ruta, filePNG, { upsert: true, contentType: 'image/png', cacheControl: '3600' });

    if (error) throw new Error(error.message);

    if (onProgreso) onProgreso(100, '¡Subida completada!');
    return `${STORAGE_URL}/${ruta}?v=${Date.now()}`;
}

function convertirPNG(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const MAX = 256;
            let w = img.naturalWidth, h = img.naturalHeight;
            if (w > MAX || h > MAX) {
                const r = Math.min(MAX / w, MAX / h);
                w = Math.round(w * r); h = Math.round(h * r);
            }
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            c.toBlob(blob => { URL.revokeObjectURL(url); resolve(blob); }, 'image/png');
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagen inválida')); };
        img.src = url;
    });
}

export async function listarImagenesBackground() {
    try {
        const { data } = await supabase.storage.from(BUCKET).list('imginterfaz', { limit: 200 });
        return (data || [])
            .filter(f => f.name.startsWith('region_bg_'))
            .map(f => ({
                nombre: f.name,
                url:    `${STORAGE_URL}/imginterfaz/${f.name}`
            }));
    } catch (e) { return []; }
}
