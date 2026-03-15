// ============================================================
// extra-data.js — Carga de datos desde Supabase + Storage
// ============================================================

import { supabase } from '../hex-auth.js';
import { db }       from '../hex-db.js';
import { BUCKET, STORAGE_URL, itemsPersonajes, itemsObjetos, itemsInterfaz } from './extra-state.js';

const norm = (str) => str ? str.toString().trim().toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e')
    .replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o')
    .replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
    .replace(/\s+/g,'_')
    .replace(/[^a-z0-9_\-]/g,'') : '';

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
    const [resP, resO, resI] = await Promise.all([
        supabase.storage.from(BUCKET).list('imgpersonajes', { limit: 1000 }),
        supabase.storage.from(BUCKET).list('imgobjetos',    { limit: 1000 }),
        supabase.storage.from(BUCKET).list('imginterfaz',   { limit: 1000 })
    ]);

    const setPersonajes = new Set((resP.data || []).map(f => f.name.replace(/\.(png|jpg|jpeg|webp)$/i, '').toLowerCase()));
    const setObjetos    = new Set((resO.data || []).map(f => f.name.replace(/\.(png|jpg|jpeg|webp)$/i, '').toLowerCase()));
    const setInterfaz   = new Set((resI.data || []).map(f => f.name.replace(/\.(png|jpg|jpeg|webp)$/i, '').toLowerCase()));

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
    imgEncontradas.add('icon.png');
    imgEncontradas.add('no_encontrado.png');

    itemsInterfaz.length = 0;

    for (const ruta of rutasHTML) {
        try {
            const req = await fetch(ruta);
            if (!req.ok) continue;
            const text = await req.text();

            const regexSrc = /src=["'](?:\.\.\/)?img\/([^"']+)["']/gi;
            const regexUrl = /url\(['"]?(?:\.\.\/)?img\/([^)"']+)['"]?\)/gi;
            const regexDataImg = /data-img=["']([^"']+)["']/gi;
            const regexHref = /href=["'](?:\.\.\/)?(?:img\/)?([^"']+)["']/gi;

            let match;
            while ((match = regexSrc.exec(text)) !== null) imgEncontradas.add(match[1]);
            while ((match = regexUrl.exec(text)) !== null) imgEncontradas.add(match[1]);
            while ((match = regexDataImg.exec(text)) !== null) imgEncontradas.add(match[1]);
            while ((match = regexHref.exec(text)) !== null) {
                if(match[1].endsWith('.png') || match[1].endsWith('.jpg') || match[1].endsWith('.ico')) {
                    imgEncontradas.add(match[1]);
                }
            }
        } catch(e) {}
    }

    imgEncontradas.forEach(archivo => {
        const nombreLimpio = archivo.replace(/\.(png|jpg|jpeg|webp|gif|ico)$/i, '');
        const key = norm(nombreLimpio);
        
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

    if (onProgreso) onProgreso(30, 'Procesando formatos...');
    
    // Convertimos de forma segura
    const { blobPNG, blobJPG } = await convertirAFormatos(file);

    const filePNG = new File([blobPNG], `${keyNorm}.png`, { type: 'image/png' });
    const fileJPG = new File([blobJPG], `${keyNorm}.jpg`, { type: 'image/jpeg' });

    if (onProgreso) onProgreso(50, 'Subiendo versión PNG...');
    const { error: errPNG } = await supabase.storage
        .from(BUCKET)
        .upload(rutaPNG, filePNG, { upsert: true, contentType: 'image/png', cacheControl: '3600' });
    if (errPNG) throw new Error(errPNG.message || 'Error PNG');

    if (onProgreso) onProgreso(80, 'Subiendo versión JPG...');
    const { error: errJPG } = await supabase.storage
        .from(BUCKET)
        .upload(rutaJPG, fileJPG, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
    if (errJPG) throw new Error(errJPG.message || 'Error JPG');

    if (onProgreso) onProgreso(100, '¡Imagen subida exitosamente!');

    return `${STORAGE_URL}/${rutaPNG}?v=${Date.now()}`;
}

function convertirAFormatos(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                try {
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
                    const ctx = canvas.getContext('2d');
                    
                    // 1. Dibujar y generar PNG
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blobPNG) => {
                        
                        // 2. Dibujar fondo negro y generar JPG
                        const canvasJPG = document.createElement('canvas');
                        canvasJPG.width = width;
                        canvasJPG.height = height;
                        const ctxJPG = canvasJPG.getContext('2d');
                        ctxJPG.fillStyle = '#05000a'; 
                        ctxJPG.fillRect(0, 0, width, height);
                        ctxJPG.drawImage(img, 0, 0, width, height);
                        
                        canvasJPG.toBlob((blobJPG) => {
                            URL.revokeObjectURL(event.target.result);
                            resolve({ blobPNG, blobJPG });
                        }, 'image/jpeg', 0.9);

                    }, 'image/png');

                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = () => reject(new Error("Formato de imagen inválido."));
            img.src = event.target.result;
        };
        
        reader.onerror = () => reject(new Error("Error leyendo el archivo original."));
        reader.readAsDataURL(file); 
    });
}
