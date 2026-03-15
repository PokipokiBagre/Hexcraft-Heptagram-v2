// ============================================================
// extra-data.js — Carga de datos desde Supabase + Storage
// ============================================================

import { supabase } from '../hex-auth.js';
import { BUCKET, STORAGE_URL, itemsPersonajes, itemsObjetos, itemsInterfaz } from './extra-state.js';

// 👉 ¡CORRECCIÓN CLAVE 1!: Agregamos \- al regex para NO borrar los guiones (hex-002)
const norm = (str) => str ? str.toString().trim().toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e')
    .replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o')
    .replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
    .replace(/\s+/g,'_')
    .replace(/[^a-z0-9_\-]/g,'') : ''; // <-- AHORA ACEPTA GUIONES

export async function asegurarBucket() {
    try {
        const { data: buckets, error } = await supabase.storage.listBuckets();
        if (error) return; 
        
        const existe = buckets?.some(b => b.name === BUCKET);
        if (!existe) {
            await supabase.storage.createBucket(BUCKET, { public: true });
        }
    } catch(e) {}
}

export async function cargarDatos() {
    try {
        // 👉 CORRECCIÓN CLAVE 2: Restauramos tus llamadas directas a la DB
        const [ {data: dbPersonajes}, {data: dbObjetos} ] = await Promise.all([
            supabase.from('personajes').select('nombre, icono_override'),
            supabase.from('objetos').select('nombre')
        ]);

        // Listar qué archivos existen REALMENTE en Supabase Storage
        const [ {data: filesPj}, {data: filesOb}, {data: filesInt} ] = await Promise.all([
            supabase.storage.from(BUCKET).list('imgpersonajes', { limit: 1000 }),
            supabase.storage.from(BUCKET).list('imgobjetos', { limit: 1000 }),
            supabase.storage.from(BUCKET).list('imginterfaz', { limit: 1000 })
        ]);

        const setPj = new Set((filesPj || []).map(f => f.name.replace(/\.[^/.]+$/, "")));
        const setOb = new Set((filesOb || []).map(f => f.name.replace(/\.[^/.]+$/, "")));
        const setInt = new Set((filesInt || []).map(f => f.name.replace(/\.[^/.]+$/, "")));

        // --- 1. PERSONAJES ---
        itemsPersonajes.length = 0;
        (dbPersonajes || []).forEach(p => {
            const kn = norm(p.icono_override || p.nombre) + 'icon';
            itemsPersonajes.push({
                nombre: p.nombre,
                keyNorm: kn,
                existe: setPj.has(kn),
                url: `${STORAGE_URL}/imgpersonajes/${kn}.png`
            });
        });

        // --- 2. OBJETOS ---
        itemsObjetos.length = 0;
        (dbObjetos || []).forEach(o => {
            const kn = norm(o.nombre);
            itemsObjetos.push({
                nombre: o.nombre,
                keyNorm: kn,
                existe: setOb.has(kn),
                url: `${STORAGE_URL}/imgobjetos/${kn}.png`
            });
        });

        // --- 3. INTERFAZ ---
        itemsInterfaz.length = 0;
        const listaRequeridaInterfaz = [
            { id: 'icon', nombre: 'Icono de la Pestaña (icon)' },
            { id: 'no_encontrado', nombre: 'Imagen Fallback (no_encontrado)' },
            { id: 'hex-002', nombre: 'Fondo Rol Actual (hex-002)' },
            { id: 'met-004', nombre: 'Fondo Meta (met-004)' },
            { id: 'objetos', nombre: 'Botón Menú Objetos (objetos)' },
            { id: 'estadisticas', nombre: 'Botón Menú Estadísticas (estadisticas)' },
            { id: 'misiones', nombre: 'Botón Menú Misiones (misiones)' },
            { id: 'hechizos', nombre: 'Botón Menú Hechizos (hechizos)' },
            { id: 'mapa', nombre: 'Botón Menú Mapa (mapa)' },
            { id: 'extra', nombre: 'Botón Menú Extra (extra)' }
        ];

        listaRequeridaInterfaz.forEach(item => {
            itemsInterfaz.push({
                nombre: item.nombre,
                keyNorm: item.id, 
                existe: setInt.has(item.id),
                url: `${STORAGE_URL}/imginterfaz/${item.id}.png`
            });
        });

    } catch (e) {
        console.error("Error cargando datos:", e);
    }
}

export async function subirImagen(file, keyNorm, tipoIcono, onProgreso) {
    if (onProgreso) onProgreso(10, 'Iniciando compresión...');
    const blob = await convertirAPNG(file);
    
    if (onProgreso) onProgreso(50, 'Subiendo a la nube...');
    const rutaPNG = `${tipoIcono}/${keyNorm}.png`;
    const rutaJPG = `${tipoIcono}/${keyNorm}.jpg`;

    const { error: errPNG } = await supabase.storage
        .from(BUCKET)
        .upload(rutaPNG, blob, { upsert: true, contentType: 'image/png' });

    if (errPNG) throw errPNG;

    await supabase.storage
        .from(BUCKET)
        .upload(rutaJPG, blob, { upsert: true, contentType: 'image/png' });

    if (onProgreso) onProgreso(100, '¡Imagen subida exitosamente!');

    return `${STORAGE_URL}/${rutaPNG}?v=${Date.now()}`;
}

function convertirAPNG(file) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            
            const MAX_SIZE = 512; 
            let width = img.naturalWidth;
            let height = img.naturalHeight;

            if (width > MAX_SIZE || height > MAX_SIZE) {
                const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            canvas.width  = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            canvas.toBlob(blob => resolve(blob), 'image/png');
        };
        img.src = url;
    });
}
