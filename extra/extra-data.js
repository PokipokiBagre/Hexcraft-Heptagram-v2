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
        supabase.storage.from(BUCKET).list('imgpersonajes', { limit: 1000 }).catch(() => ({ data: [] })),
        supabase.storage.from(BUCKET).list('imgobjetos',    { limit: 1000 }).catch(() => ({ data: [] })),
        supabase.storage.from(BUCKET).list('imginterfaz',   { limit: 1000 }).catch(() => ({ data: [] }))
    ]);

    // Mapas para detección inteligente de formato (.png, .jpg, .webp)
    const mapP = new Map();
    const mapO = new Map();
    const mapI = new Map();

    const cleanKey = (n) => n.replace(/^img(personajes|objetos|interfaz)\//i, '').toLowerCase();

    (resP.data || []).forEach(f => mapP.set(cleanKey(f.name), f.name));
    (resO.data || []).forEach(f => mapO.set(cleanKey(f.name), f.name));
    (resI.data || []).forEach(f => mapI.set(cleanKey(f.name), f.name));

    const [personajes, catalogo] = await Promise.all([
        db.personajes.getAll().catch(()=>[]),
        db.objetos.getCatalogo().catch(()=>[])
    ]);

    // 1. Personajes
    itemsPersonajes.length = 0;
    personajes.forEach(p => {
        const key = norm(p.icono_override || p.nombre) + 'icon';
        
        let ext = '.png';
        let existe = false;
        if (mapP.has(key + '.png')) { existe = true; ext = '.png'; }
        else if (mapP.has(key + '.jpg')) { existe = true; ext = '.jpg'; }
        else if (mapP.has(key + '.webp')) { existe = true; ext = '.webp'; }

        itemsPersonajes.push({
            nombre:     p.nombre,
            keyNorm:    key,
            tipoIcono:  'imgpersonajes',
            // Respetamos los nombres de variables (urlStorage) pero con extensión dinámica y fallback directo
            urlStorage: existe ? `${STORAGE_URL}/imgpersonajes/${key}${ext}?v=${Date.now()}` : `${STORAGE_URL}/imginterfaz/no_encontrado.png?v=${Date.now()}`,
            urlGithub:  `../img/imgpersonajes/${key}${ext}`,
            existe:     existe,
            isPlayer:   p.is_player
        });
    });

    // 2. Objetos
    itemsObjetos.length = 0;
    catalogo.forEach(o => {
        const key = norm(o.nombre);

        let ext = '.png';
        let existe = false;
        if (mapO.has(key + '.png')) { existe = true; ext = '.png'; }
        else if (mapO.has(key + '.jpg')) { existe = true; ext = '.jpg'; }
        else if (mapO.has(key + '.webp')) { existe = true; ext = '.webp'; }

        itemsObjetos.push({
            nombre:        o.nombre,
            keyNorm:       key,
            tipoIcono:    'imgobjetos',
            urlStorage:   existe ? `${STORAGE_URL}/imgobjetos/${key}${ext}?v=${Date.now()}` : `${STORAGE_URL}/imginterfaz/no_encontrado.png?v=${Date.now()}`,
            urlGithub:    `../img/imgobjetos/${key}${ext}`,
            existe:       existe,
            esPropuesta:  !!o.es_propuesta,
            propuesto_por: o.propuesto_por || ''
        });
    });

    // 3. Interfaz
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
    // ¡RESTAURADO! Aquí está tu amado icon.png a salvo
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
        // 🚨 BLOQUEO CORRECTO: Ignoramos 'icon-inicio' que es el que estaba hardcodeado molestando
        if (archivo.toLowerCase().includes('icon-inicio')) return;

        const nombreLimpio = archivo.replace(/\.(png|jpg|jpeg|webp|gif|ico)$/i, '');
        const key = norm(nombreLimpio);
        
        if(!key || key.includes('/') || key.length < 2) return;

        let ext = '.png';
        let existe = false;
        if (mapI.has(key + '.png')) { existe = true; ext = '.png'; }
        else if (mapI.has(key + '.jpg')) { existe = true; ext = '.jpg'; }
        else if (mapI.has(archivo.toLowerCase())) {
            existe = true; 
            ext = archivo.substring(archivo.lastIndexOf('.'));
        }

        itemsInterfaz.push({
            nombre:     archivo, 
            keyNorm:    key,
            tipoIcono:  'imginterfaz',
            urlStorage: existe ? `${STORAGE_URL}/imginterfaz/${key}${ext}?v=${Date.now()}` : `${STORAGE_URL}/imginterfaz/no_encontrado.png?v=${Date.now()}`,
            urlGithub:  `../img/${archivo}`,
            existe:     existe
        });
    });
}

function uploadSeguro(ruta, file, tipoContenido) {
    const solicitud = supabase.storage.from(BUCKET)
        .upload(ruta, file, { upsert: true, contentType: tipoContenido, cacheControl: '3600' });
    
    let timerId;
    const tiempoLimite = new Promise((_, reject) => {
        timerId = setTimeout(() => reject(new Error("Conexión interrumpida por suspensión de pestaña.")), 25000);
    });

    return Promise.race([solicitud, tiempoLimite]).finally(() => clearTimeout(timerId));
}

export async function subirImagen(file, keyNorm, tipoIcono, onProgreso, nombre) {
    let keysToUpload = [keyNorm];

    if (tipoIcono === 'imgpersonajes' && nombre) {
        const keyPropia = norm(nombre) + 'icon';
        if (keyPropia !== keyNorm && !keysToUpload.includes(keyPropia)) {
            keysToUpload.push(keyPropia);
        }
    }

    if (onProgreso) onProgreso(30, 'Procesando formatos...');
    const { blobPNG, blobJPG } = await convertirAFormatos(file);

    let urlPrincipal = '';

    for (let i = 0; i < keysToUpload.length; i++) {
        const currentKey = keysToUpload[i];
        const rutaPNG = `${tipoIcono}/${currentKey}.png`;
        const rutaJPG = `${tipoIcono}/${currentKey}.jpg`;

        const filePNG = new File([blobPNG], `${currentKey}.png`, { type: 'image/png' });
        const fileJPG = new File([blobJPG], `${currentKey}.jpg`, { type: 'image/jpeg' });

        const progresoBase = 30 + (i * 30); 

        if (onProgreso) onProgreso(progresoBase + 10, `Subiendo PNG (${currentKey})...`);
        const { error: errPNG } = await uploadSeguro(rutaPNG, filePNG, 'image/png');
        if (errPNG) throw new Error(errPNG.message || `Error en red PNG (${currentKey})`);

        if (onProgreso) onProgreso(progresoBase + 20, `Subiendo JPG (${currentKey})...`);
        const { error: errJPG } = await uploadSeguro(rutaJPG, fileJPG, 'image/jpeg');
        if (errJPG) throw new Error(errJPG.message || `Error en red JPG (${currentKey})`);

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
                
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blobPNG) => {
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
export async function cargarHuerfanas() {
    const { db } = await import('../hex-db.js');

    const normEstricta = (str) => str ? str.toString().trim().toLowerCase()
        .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e')
        .replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o')
        .replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
        .replace(/\s+/g,'_').replace(/[^a-z0-9_\-]/g,'') : '';

    const normSuave = (str) => str ? str.toString().trim().toLowerCase()
        .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e')
        .replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o')
        .replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
        .replace(/\s+/g,'_') : '';

    const [personajes, catalogo, resStorage] = await Promise.all([
        db.personajes.getAll().catch(()=>[]),
        db.objetos.getCatalogo().catch(()=>[]),
        supabase.storage.from(BUCKET).list('imgpersonajes', { limit: 1000 }).catch(()=>({data:[]}))
    ]);

    const keysEnUso = new Set();
    
    personajes.forEach(p => {
        const baseNombre = p.icono_override || p.nombre;
        
        const estricto = normEstricta(baseNombre);
        const suave    = normSuave(baseNombre);

        // Blindamos todas las combinaciones posibles (con/sin 'icon' y con/sin extensión)
        keysEnUso.add(estricto + 'icon.png');
        keysEnUso.add(estricto + 'icon.jpg');
        keysEnUso.add(estricto + '.png');
        keysEnUso.add(estricto + '.jpg');
        
        // Blindamos la versión suave para proteger Yuko_(Malicia) o similares
        keysEnUso.add(suave + 'icon.png');
        keysEnUso.add(suave + 'icon.jpg');
        keysEnUso.add(suave + '.png');
        keysEnUso.add(suave + '.jpg');
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
