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
            existe:     setPersonajes.has(key),
            isPlayer:   p.is_player   // ← necesario para distinguir NPC de jugador
        });
    });

    const catalogo = await db.objetos.getCatalogo();
    itemsObjetos.length = 0;
    catalogo.forEach(o => {
        const key = norm(o.nombre);
        itemsObjetos.push({
            nombre:       o.nombre,
            keyNorm:      key,
            tipoIcono:    'imgobjetos',
            urlStorage:   `${STORAGE_URL}/imgobjetos/${key}.png`,
            urlGithub:    `../img/imgobjetos/${key}.png`,
            existe:       setObjetos.has(key),
            esPropuesta:  !!o.es_propuesta,
            propuesto_por: o.propuesto_por || ''
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

// 👉 NUEVO: Envuelve la llamada a Supabase en una protección con Autodestrucción
function uploadSeguro(ruta, file, tipoContenido) {
    const solicitud = supabase.storage.from(BUCKET)
        .upload(ruta, file, { upsert: true, contentType: tipoContenido, cacheControl: '3600' });
    
    let timerId;
    const tiempoLimite = new Promise((_, reject) => {
        timerId = setTimeout(() => reject(new Error("Conexión interrumpida por suspensión de pestaña.")), 25000);
    });

    // Promise.race compite entre la subida y el límite de 25 seg.
    // El .finally() destruye el temporizador para que no afecte a subidas futuras
    return Promise.race([solicitud, tiempoLimite]).finally(() => clearTimeout(timerId));
}

export async function subirImagen(file, keyNorm, tipoIcono, onProgreso, nombre) {
    // 1. Preparamos las keys en las que se guardará la imagen.
    // Siempre incluimos la key principal (que puede ser la del clon).
    let keysToUpload = [keyNorm];

    // Si es un personaje y tenemos su nombre, verificamos si su key propia es distinta
    if (tipoIcono === 'imgpersonajes' && nombre) {
        const keyPropia = norm(nombre) + 'icon';
        if (keyPropia !== keyNorm && !keysToUpload.includes(keyPropia)) {
            keysToUpload.push(keyPropia);
        }
    }

    if (onProgreso) onProgreso(30, 'Procesando formatos...');
    const { blobPNG, blobJPG } = await convertirAFormatos(file);

    let urlPrincipal = '';

    // 2. Iteramos sobre las keys (subirá 1 vez si es normal, 2 veces si es copia)
    for (let i = 0; i < keysToUpload.length; i++) {
        const currentKey = keysToUpload[i];
        const rutaPNG = `${tipoIcono}/${currentKey}.png`;
        const rutaJPG = `${tipoIcono}/${currentKey}.jpg`;

        const filePNG = new File([blobPNG], `${currentKey}.png`, { type: 'image/png' });
        const fileJPG = new File([blobJPG], `${currentKey}.jpg`, { type: 'image/jpeg' });

        // Ajustamos el porcentaje visual según la cantidad de subidas
        const progresoBase = 30 + (i * 30); 

        if (onProgreso) onProgreso(progresoBase + 10, `Subiendo PNG (${currentKey})...`);
        const { error: errPNG } = await uploadSeguro(rutaPNG, filePNG, 'image/png');
        if (errPNG) throw new Error(errPNG.message || `Error en red PNG (${currentKey})`);

        if (onProgreso) onProgreso(progresoBase + 20, `Subiendo JPG (${currentKey})...`);
        const { error: errJPG } = await uploadSeguro(rutaJPG, fileJPG, 'image/jpeg');
        if (errJPG) throw new Error(errJPG.message || `Error en red JPG (${currentKey})`);

        // Guardamos la URL de la key principal para devolvérsela a la interfaz
        if (currentKey === keyNorm) {
            urlPrincipal = `${STORAGE_URL}/${rutaPNG}?v=${Date.now()}`;
        }
    }

    if (onProgreso) onProgreso(100, keysToUpload.length > 1 ? '¡Imágenes subidas exitosamente!' : '¡Imagen subida exitosamente!');

    return urlPrincipal;
}

function convertirAFormatos(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
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
                
                // 1. Dibujar PNG original
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blobPNG) => {
                    // 2. Dibujar JPG con fondo negro
                    const canvasJPG = document.createElement('canvas');
                    canvasJPG.width = width;
                    canvasJPG.height = height;
                    const ctxJPG = canvasJPG.getContext('2d');
                    
                    ctxJPG.fillStyle = '#05000a'; 
                    ctxJPG.fillRect(0, 0, width, height);
                    ctxJPG.drawImage(img, 0, 0, width, height);

                    canvasJPG.toBlob((blobJPG) => {
                        URL.revokeObjectURL(url);
                        resolve({ blobPNG, blobJPG });
                    }, 'image/jpeg', 0.9);

                }, 'image/png');
            } catch (err) {
                reject(new Error("Error procesando imagen localmente."));
            }
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Formato de imagen inválido o corrupto."));
        };
        img.src = url;
    });
}

// ── IMÁGENES HUÉRFANAS ────────────────────────────────────────
// Devuelve las imágenes en Storage que no corresponden a ningún
// personaje activo ni objeto del catálogo.
export async function cargarHuerfanas() {
    const { db } = await import('../hex-db.js');

    // 1. Keys en uso por personajes
    const norm = (str) => str ? str.toString().trim().toLowerCase()
        .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e')
        .replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o')
        .replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
        .replace(/\s+/g,'_').replace(/[^a-z0-9_\-]/g,'') : '';

    const [personajes, catalogo, resStorage] = await Promise.all([
        db.personajes.getAll(),
        db.objetos.getCatalogo(),
        supabase.storage.from(BUCKET).list('imgpersonajes', { limit: 1000 })
    ]);

    const keysEnUso = new Set();
    personajes.forEach(p => {
        const key = norm(p.icono_override || p.nombre) + 'icon';
        keysEnUso.add(key + '.png');
        keysEnUso.add(key + '.jpg');
    });

    const archivos = resStorage.data || [];
    const huerfanas = archivos.filter(f => !keysEnUso.has(f.name.toLowerCase()));

    return huerfanas.map(f => ({
        nombre: f.name,
        ruta:   `imgpersonajes/${f.name}`,
        url:    `${STORAGE_URL}/imgpersonajes/${f.name}`,
        size:   f.metadata?.size || 0
    }));
}

export async function eliminarImagenStorage(ruta) {
    const { error } = await supabase.storage.from(BUCKET).remove([ruta]);
    return !error;
}
