// ============================================================
// region-data.js — Carga y guardado en Supabase (Isométrico 3D)
// ============================================================

import { supabase } from '../hex-auth.js';
import { db }       from '../hex-db.js';
import {
    BUCKET, STORAGE_URL, mapaActual, props, npcsMapaLocal, personajesDB, misionesActivas
} from './region-state.js';
import { normKey } from './region-utils.js';

export async function cargarTodo(mapaId = 'mundo') {
    try {
        const [ mapaRes, propsRes, npcsRes, personajesArr, misionesArr ] = await Promise.all([
            supabase.from('region_mapas').select('*').eq('id', mapaId).single(),
            supabase.from('region_props').select('*').order('nombre'),
            supabase.from('region_npcs').select('*'),
            db.personajes.getAll(), db.misiones.getAll()
        ]);

        for (const k in props) delete props[k];
        
        // Pincel de Color
        props['prop_pintar'] = { id: 'prop_pintar', nombre: '🖌️ PINCEL DE COLOR', tipo: 'terreno', imagen: null };
        // Pincel de Región (Nuevo prop inyectado)
        props['prop_region'] = { id: 'prop_region', nombre: '🗺️ PINCEL DE REGIÓN', tipo: 'terreno', imagen: null };

        propsRes.data?.forEach(p => {
            props[p.id] = { id:p.id, nombre:p.nombre, tipo:p.tipo, imagen:p.imagen_url };
        });

        personajesDB.length = 0;
        personajesArr.forEach(p => {
            const pid = `pj_${normKey(p.nombre)}`;
            props[pid] = { id: pid, nombre: p.nombre, tipo: 'entidad', imagen: `${STORAGE_URL}/imgpersonajes/${normKey(p.icono_override || p.nombre)}icon.png` };
            personajesDB.push({ ...p, icon: p.icono_override || p.nombre });
        });

        misionesActivas.length = 0;
        misionesArr.forEach(m => { if (m.estado === 1 || m.estado === 2) misionesActivas.push(m); });

        if (mapaRes.data) {
            Object.assign(mapaActual, mapaRes.data);
            mapaActual.hexes = mapaActual.datos_hexes || {};
            mapaActual.regiones = mapaActual.datos_regiones || {};
        }

        for (const k in npcsMapaLocal) delete npcsMapaLocal[k];
        npcsRes.data?.forEach(n => {
            if (n.mapa_id === mapaId) {
                npcsMapaLocal[n.id] = { ...n };
                props[n.id] = { id: n.id, nombre: n.nombre, tipo: 'entidad', imagen: n.icono_url || '' };
            }
        });
        return true;
    } catch (e) { return false; }
}

export async function guardarMapa() {
    try {
        const payload = {
            id: mapaActual.id, nombre: mapaActual.nombre, ancho: mapaActual.ancho, alto: mapaActual.alto,
            es_interior: mapaActual.esInterior, parent_id: mapaActual.parentId, parent_hex: mapaActual.parentHex,
            datos_hexes: mapaActual.hexes, datos_regiones: mapaActual.regiones, bg_imagen: mapaActual.bg_imagen,
            updated_at: new Date().toISOString()
        };
        const { error } = await supabase.from('region_mapas').upsert(payload, { onConflict: 'id' });
        if (error) throw error; return true;
    } catch (e) { return false; }
}

export async function guardarProp(propData) {
    try {
        const { error } = await supabase.from('region_props').upsert({
            id: propData.id, nombre: propData.nombre, tipo: propData.tipo, imagen_url: propData.imagen || ''
        }, { onConflict: 'id' });
        if (error) throw error; return true;
    } catch (e) { return false; }
}

export async function eliminarProp(propId) {
    try {
        const { error } = await supabase.from('region_props').delete().eq('id', propId);
        if (error) throw error; return true;
    } catch (e) { return false; }
}

export async function guardarNPC(npcData) {
    try {
        const { error } = await supabase.from('region_npcs').upsert({
            id: npcData.id, nombre: npcData.nombre, tipo: npcData.tipo, icono_url: npcData.icono_url || '',
            hex_pos: npcData.hex_pos, capa: npcData.capa || 'mid', descripcion: npcData.descripcion,
            stats: npcData.stats, mapa_id: mapaActual.id
        }, { onConflict: 'id' });
        if (error) throw error; return true;
    } catch (e) { return false; }
}

export async function eliminarNPC(npcId) {
    try {
        const { error } = await supabase.from('region_npcs').delete().eq('id', npcId);
        if (error) throw error; return true;
    } catch (e) { return false; }
}

export async function subirImagenStorage(file, carpeta, keyNorm) {
    const ruta = `${carpeta}/${keyNorm}.png`;
    const { error } = await supabase.storage.from(BUCKET).upload(ruta, file, { upsert: true, contentType: 'image/png' });
    if (error) throw new Error(error.message);
    return `${STORAGE_URL}/${ruta}?v=${Date.now()}`;
}

export async function listarImagenesBackground() {
    try {
        const { data } = await supabase.storage.from(BUCKET).list('imginterfaz', { limit: 100 });
        return (data || []).filter(f => f.name.startsWith('region_bg_')).map(f => `${STORAGE_URL}/imginterfaz/${f.name}`);
    } catch (e) { return []; }
}
