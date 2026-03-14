// ============================================================
// extra-data.js — Carga de datos desde Supabase + Storage
// ============================================================

import { supabase } from '../hex-auth.js';
import { db }       from '../hex-db.js';
import { BUCKET, STORAGE_URL, itemsPersonajes, itemsObjetos } from './extra-state.js';

const norm = (str) => str ? str.toString().trim().toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e')
    .replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o')
    .replace(/[úùüû]/g,'u').replace(/\s+/g,'_')
    .replace(/[^a-z0-9ñ_]/g,'') : '';

export async function asegurarBucket() {
    const { data: buckets } = await supabase.storage.listBuckets();
    const existe = buckets?.some(b => b.name === BUCKET);
    if (!existe) {
        await supabase.storage.createBucket(BUCKET, { public: true });
    }
}

export async function cargarDatos() {
    // Listar archivos existentes en el bucket
    const [resP, resO] = await Promise.all([
        supabase.storage.from(BUCKET).list('imgpersonajes', { limit: 1000 }),
        supabase.storage.from(BUCKET).list('imgobjetos',    { limit: 1000 })
    ]);

    const setPersonajes = new Set(
        (resP.data || []).map(f => f.name.replace(/\.(png|jpg|jpeg|webp)$/i, '').toLowerCase())
    );
    const setObjetos = new Set(
        (resO.data || []).map(f => f.name.replace(/\.(png|jpg|jpeg|webp)$/i, '').toLowerCase())
    );

    // Personajes
    const personajes = await db.personajes.getAll();
    itemsPersonajes.length = 0;
    personajes.forEach(p => {
        const key = norm(p.icono_override || p.nombre) + 'icon';
        const existe = setPersonajes.has(key);
        itemsPersonajes.push({
            nombre:     p.nombre,
            keyNorm:    key,
            tipoIcono:  'imgpersonajes',
            urlStorage: `${STORAGE_URL}/imgpersonajes/${key}.png`,
            urlGithub:  `../img/imgpersonajes/${key}.png`,
            existe
        });
    });

    // Objetos
    const catalogo = await db.objetos.getCatalogo();
    itemsObjetos.length = 0;
    catalogo.forEach(o => {
        const key = norm(o.nombre);
        const existe = setObjetos.has(key);
        itemsObjetos.push({
            nombre:     o.nombre,
            keyNorm:    key,
            tipoIcono:  'imgobjetos',
            urlStorage: `${STORAGE_URL}/imgobjetos/${key}.png`,
            urlGithub:  `../img/imgobjetos/${key}.png`,
            existe
        });
    });
}

export async function subirImagen(file, keyNorm, tipoIcono, onProgreso) {
    const rutaPNG = `${tipoIcono}/${keyNorm}.png`;
    const rutaJPG = `${tipoIcono}/${keyNorm}.jpg`;

    if (onProgreso) onProgreso(30, 'Procesando imagen...');

    // Convertir cualquier formato a PNG via canvas
    const blob = await convertirAPNG(file);

    if (onProgreso) onProgreso(60, 'Subiendo al servidor...');

    // Subir PNG
    const { error: errPNG } = await supabase.storage
        .from(BUCKET)
        .upload(rutaPNG, blob, { upsert: true, contentType: 'image/png' });

    if (errPNG) throw errPNG;

    // Subir también como JPG (mismo blob PNG, ambos nombres quedan registrados)
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
            canvas.width  = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext('2d').drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            canvas.toBlob(resolve, 'image/png');
        };
        img.src = url;
    });
}
