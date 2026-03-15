// ============================================================
// extra-data.js — Carga de datos desde Supabase + Storage
// ============================================================

import { supabase } from '../hex-auth.js';
import { db }       from '../hex-db.js';
import { BUCKET, STORAGE_URL, itemsPersonajes, itemsObjetos, itemsInterfaz } from './extra-state.js';

// ¡GUION \- RECUPERADO PARA ACEPTAR HEX-002 Y MET-004!
const norm = (str) => str ? str.toString().trim().toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e')
    .replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o')
    .replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
    .replace(/\s+/g,'_')
    .replace(/[^a-z0-9_\-]/g,'') : ''; // <-- Acepta guiones y guiones bajos

export async function asegurarBucket() {
    try {
        const { data: buckets, error } = await supabase.storage.listBuckets();
        if (error) return; 
        
        const existe = buckets?.some(b => b.name === BUCKET);
        if (!existe) {
            await supabase.storage.createBucket(BUCKET, { public: true });
        }
    } catch(e) {
        // Ignoramos silenciosamente si falla por permisos
    }
}

export async function cargarDatos() {
    // Listar archivos existentes en el bucket
    const [resP, resO, resI] = await Promise.all([
        supabase.storage.from(BUCKET).list('imgpersonajes', { limit: 1000 }),
        supabase.storage.from(BUCKET).list('imgobjetos',    { limit: 1000 }),
        supabase.storage.from(BUCKET).list('imginterfaz',   { limit: 1000 })
    ]);

    const setPersonajes = new Set((resP.data || []).map(f => f.name.replace(/\.(png|jpg|jpeg|webp)$/i, '').toLowerCase()));
    const setObjetos    = new Set((resO.data || []).map(f => f.name.replace(/\.(png|jpg|jpeg|webp)$/i, '').toLowerCase()));
    const setInterfaz   = new Set((resI.data || []).map(f => f.name.replace(/\.(png|jpg|jpeg|webp)$/i, '').toLowerCase()));

    // 1. Personajes
    const personajes = await db.personajes.getAll();
    itemsPersonajes.length = 0;
    personajes.forEach(p => {
        const key = norm(p.icono_override || p.nombre) + 'icon';
        itemsPersonajes.push({
            nombre:     p.nombre,
            keyNorm:    key,
            tipoIcono:  'imgpersonajes',
            urlStorage: `${STORAGE_URL}/imgpersonajes/${key}.png`,
            urlGithub:  `../img/imgpersonajes/${key}.png`,
            existe:     setPersonajes.has(key)
        });
    });

    // 2. Objetos
    const catalogo = await db.objetos.getCatalogo();
    itemsObjetos.length = 0;
    catalogo.forEach(o => {
        const key = norm(o.nombre);
        itemsObjetos.push({
            nombre:     o.nombre,
            keyNorm:    key,
            tipoIcono:  'imgobjetos',
            urlStorage: `${STORAGE_URL}/imgobjetos/${key}.png`,
            urlGithub:  `../img/imgobjetos/${key}.png`,
            existe:     setObjetos.has(key)
        });
    });

    // 3. Interfaz (Escaneo de HTML en Tiempo Real RESTAURADO Y MEJORADO)
    const rutasHTML = [
        '../index.html',
        '../objetos/index.html',
        '../estadisticas/index.html',
        '../misiones/index.html',
        '../hechizos/index.html',
        '../mapa/index.html',
        '../extra/index.html'
    ];

    const imgEncontradas = new Set();
    
    // Forzamos manualmente el icono y la imagen de no encontrado por seguridad
    imgEncontradas.add('icon.png');
    imgEncontradas.add('no_encontrado.png');

    itemsInterfaz.length = 0;

    for (const ruta of rutasHTML) {
        try {
            const req = await fetch(ruta);
            if (!req.ok) continue;
            const text = await req.text();

            // NUEVO: Ahora busca 'data-img' además de los clásicos 'src', 'url' y 'href'
            const regexSrc = /src=["'](?:\.\.\/)?img\/([^"']+)["']/gi;
            const regexUrl = /url\(['"]?(?:\.\.\/)?img\/([^)"']+)['"]?\)/gi;
            const regexDataImg = /data-img=["']([^"']+)["']/gi; // ¡Atrapa data-img="objetos.jpg"!
            const regexHref = /href=["'](?:\.\.\/)?(?:img\/)?([^"']+)["']/gi; // Atrapa el favicon

            let match;
            while ((match = regexSrc.exec(text)) !== null) imgEncontradas.add(match[1]);
            while ((match = regexUrl.exec(text)) !== null) imgEncontradas.add(match[1]);
            while ((match = regexDataImg.exec(text)) !== null) imgEncontradas.add(match[1]);
            
            while ((match = regexHref.exec(text)) !== null) {
                if(match[1].endsWith('.png') || match[1].endsWith('.jpg') || match[1].endsWith('.ico')) {
                    imgEncontradas.add(match[1]);
                }
            }
        } catch(e) {
            console.warn('No se pudo leer la ruta HTML:', ruta);
        }
    }

    imgEncontradas.forEach(archivo => {
        const nombreLimpio = archivo.replace(/\.(png|jpg|jpeg|webp|gif|ico)$/i, '');
        const key = norm(nombreLimpio);
        
        // Evitamos subir basura si el regex atrapó algo raro
        if(!key || key.includes('/') || key.length < 2) return;

        itemsInterfaz.push({
            nombre:     archivo, 
            keyNorm:    key,
            tipoIcono:  'imginterfaz',
            urlStorage: `${STORAGE_URL}/imginterfaz/${key}.png`,
            urlGithub:  `../img/${archivo}`,
            existe:     setInterfaz.has(key)
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
            
            // Definir un tamaño máximo para evitar archivos gigantes
            const MAX_SIZE = 512; 
            let width = img.naturalWidth;
            let height = img.naturalHeight;

            // Redimensionar si excede el límite
            if (width > MAX_SIZE || height > MAX_SIZE) {
                const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            canvas.width  = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            canvas.toBlob(resolve, 'image/png');
        };
        img.src = url;
    });
}
