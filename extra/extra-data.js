// ============================================================
// extra-data.js — Carga de datos desde Supabase + Storage
// ============================================================

import { supabase } from '../hex-auth.js';
import { db }       from '../hex-db.js';
import { BUCKET, STORAGE_URL, itemsPersonajes, itemsObjetos, itemsInterfaz } from './extra-state.js';

// Normalización estricta (sin paréntesis, para IDs)
const normEstricta = (str) => str ? str.toString().trim().toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e')
    .replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o')
    .replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
    .replace(/\s+/g,'_')
    .replace(/[^a-z0-9_\-]/g,'') : '';

// Normalización suave (conserva paréntesis y corchetes, para proteger huérfanas)
const normSuave = (str) => str ? str.toString().trim().toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e')
    .replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o')
    .replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
    .replace(/\s+/g,'_') : '';

const norm = normEstricta;

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
    // Peticiones seguras con catch para evitar que el Promise.all colapse por un timeout
    const pResP = supabase.storage.from(BUCKET).list('imgpersonajes', { limit: 1000 }).catch(() => ({ data: [] }));
    const pResO = supabase.storage.from(BUCKET).list('imgobjetos',    { limit: 1000 }).catch(() => ({ data: [] }));
    const pResI = supabase.storage.from(BUCKET).list('imginterfaz',   { limit: 1000 }).catch(() => ({ data: [] }));
    
    const [resP, resO, resI] = await Promise.all([pResP, pResO, pResI]);

    const mapP = new Map();
    const mapO = new Map();
    const mapI = new Map();

    // Limpiamos los nombres por si la API de Storage devuelve la ruta completa (ej: "imgpersonajes/adrienicon.png")
    const cleanKey = (n) => n.replace(/^imgpersonajes\//i, '')
                             .replace(/^imgobjetos\//i, '')
                             .replace(/^imginterfaz\//i, '')
                             .toLowerCase();

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
        const keyNorm = norm(p.icono_override || p.nombre) + 'icon';
        const filePng = keyNorm + '.png';
        const fileJpg = keyNorm + '.jpg';
        const fileWebp = keyNorm + '.webp';
        
        let existe = false;
        let ext = '.png';
        
        // 🌟 ARREGLO CLAVE: Evalúa exactamente qué formato existe para no enviar enlaces rotos
        if (mapP.has(filePng)) { existe = true; ext = '.png'; }
        else if (mapP.has(fileJpg)) { existe = true; ext = '.jpg'; }
        else if (mapP.has(fileWebp)) { existe = true; ext = '.webp'; }

        itemsPersonajes.push({
            tipo: 'imgpersonajes',
            key: keyNorm,
            nombre: p.nombre,
            rol: p.is_player ? 'Jugador' : 'NPC',
            existe,
            // 🌟 ARREGLO CLAVE: Si no existe, inyectamos directamente el no_encontrado.png
            url: existe ? `${STORAGE_URL}/imgpersonajes/${keyNorm}${ext}?v=${Date.now()}` : `${STORAGE_URL}/imginterfaz/no_encontrado.png?v=${Date.now()}`
        });
    });
    itemsPersonajes.sort((a,b) => a.nombre.localeCompare(b.nombre));

    // 2. Objetos
    itemsObjetos.length = 0;
    catalogo.forEach(o => {
        const keyNorm = norm(o.nombre);
        let existe = false;
        let ext = '.png';
        
        if (mapO.has(keyNorm + '.png')) { existe = true; ext = '.png'; }
        else if (mapO.has(keyNorm + '.jpg')) { existe = true; ext = '.jpg'; }
        else if (mapO.has(keyNorm + '.webp')) { existe = true; ext = '.webp'; }

        itemsObjetos.push({
            tipo: 'imgobjetos',
            key: keyNorm,
            nombre: o.nombre,
            rareza: o.rareza || 'Común',
            existe,
            esPropuesta: (o.tipo === 'Propuesta'),
            url: existe ? `${STORAGE_URL}/imgobjetos/${keyNorm}${ext}?v=${Date.now()}` : `${STORAGE_URL}/imginterfaz/no_encontrado.png?v=${Date.now()}`
        });
    });
    itemsObjetos.sort((a,b) => {
        if (a.esPropuesta && !b.esPropuesta) return -1;
        if (!a.esPropuesta && b.esPropuesta) return 1;
        return a.nombre.localeCompare(b.nombre);
    });

    // 3. Interfaz
    const INTERFAZ_ITEMS = [
        { key: 'hex-002',      archivo: 'hex-002.png',      label: 'Fondo del Header',       zona: 'Imagen de fondo del título principal' },
        { key: 'met-004',      archivo: 'met-004.png',      label: 'Tarjeta Meta',           zona: 'Sección "Hilos Activos" → Meta' },
        { key: 'estadisticas', archivo: 'estadisticas.jpg', label: 'Tarjeta Estadísticas',   zona: 'Grid principal → Estadísticas' },
        { key: 'misiones',     archivo: 'misiones.png',     label: 'Tarjeta Misiones',       zona: 'Grid principal → Misiones' },
        { key: 'objetos',      archivo: 'objetos.jpg',      label: 'Tarjeta Objetos',        zona: 'Grid principal → Objetos' },
        { key: 'hechizos',     archivo: 'hechizos.jpg',     label: 'Tarjeta Hechizos',       zona: 'Grid principal → Hechizos' },
        { key: 'mapa',         archivo: 'mapa.png',         label: 'Tarjeta Mapa',           zona: 'Grid principal → Mapa de Hechizos' },
        { key: 'extra',        archivo: 'extra.png',        label: 'Tarjeta Imágenes',       zona: 'Grid principal → Imágenes' },
        { key: 'region',       archivo: 'region.png',       label: 'Tarjeta Región',         zona: 'Grid principal → Mapa Regional' },
        { key: 'panel-dev',    archivo: 'panel-dev.png',    label: 'Tarjeta Panel Máster',   zona: 'Grid principal → Panel Máster (solo OP)' },
        { key: 'no_encontrado',archivo: 'no_encontrado.png',label: 'Imagen "No encontrado"', zona: 'Fallback cuando falta una imagen' },
    ];

    itemsInterfaz.length = 0;
    INTERFAZ_ITEMS.forEach(it => {
        const extBase = it.archivo.split('.').pop();
        const keyNorm = it.key.toLowerCase();
        let existe = false;
        let ext = `.${extBase}`;
        
        if (mapI.has(keyNorm + `.${extBase}`)) { existe = true; }
        else if (mapI.has(keyNorm + '.png')) { existe = true; ext = '.png'; }
        else if (mapI.has(keyNorm + '.jpg')) { existe = true; ext = '.jpg'; }

        itemsInterfaz.push({
            tipo: 'imginterfaz',
            key: it.key,
            nombre: it.label,
            rol: it.zona,
            existe,
            url: existe ? `${STORAGE_URL}/imginterfaz/${keyNorm}${ext}?v=${Date.now()}` : `${STORAGE_URL}/imginterfaz/no_encontrado.png?v=${Date.now()}`
        });
    });
}

// ── UPLOAD ───────────────────────────────────────────────────
export async function subirImagen(file, tipo, item) {
    const progFill = document.getElementById('prog-fill');
    const progMsg  = document.getElementById('prog-msg');
    const setP = (pct, msg, col='#888') => {
        progFill.style.width = pct+'%';
        progMsg.textContent = msg;
        progMsg.style.color = col;
    };

    const keyNorm = (tipo === 'imgpersonajes')
        ? normEstricta(item.icono_override || item.nombre) + 'icon'
        : normEstricta(item.nombre);

    try {
        setP(20, 'Convirtiendo formatos...');
        const { blobPNG, blobJPG } = await _convertirFormatos(file);
        const filePNG = new File([blobPNG], `${keyNorm}.png`, { type:'image/png' });
        const fileJPG = new File([blobJPG], `${keyNorm}.jpg`, { type:'image/jpeg' });

        setP(50, 'Subiendo PNG...');
        const { error: e1 } = await _uploadSeguro(`${tipo}/${keyNorm}.png`, filePNG, 'image/png');
        if(e1) throw new Error(e1.message);

        setP(80, 'Subiendo JPG...');
        const { error: e2 } = await _uploadSeguro(`${tipo}/${keyNorm}.jpg`, fileJPG, 'image/jpeg');
        if(e2) throw new Error(e2.message);

        setP(100, '✅ ¡Completado!', '#00ff88');
        return { ok: true, url: `${STORAGE_URL}/${tipo}/${keyNorm}.png?v=${Date.now()}` };
    } catch(e) {
        setP(0, '❌ ' + (e.message || 'Error al subir'), '#ff4444');
        return { ok: false };
    }
}

// Wrap Promise.race para timeout y evitar bloqueos
function _uploadSeguro(ruta, file, tipoContenido) {
    const solicitud = supabase.storage.from(BUCKET)
        .upload(ruta, file, { upsert: true, contentType: tipoContenido, cacheControl: '3600' });
    
    let timerId;
    const tiempoLimite = new Promise((_, reject) => {
        timerId = setTimeout(() => reject(new Error("Conexión interrumpida.")), 25000);
    });

    return Promise.race([solicitud, tiempoLimite]).finally(() => clearTimeout(timerId));
}

function _convertirFormatos(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            try {
                const MAX = 512;
                let w = img.naturalWidth, h = img.naturalHeight;
                if (w > MAX || h > MAX) {
                    const r = Math.min(MAX/w, MAX/h);
                    w = Math.round(w*r); h = Math.round(h*r);
                }
                const c1 = document.createElement('canvas');
                c1.width = w; c1.height = h;
                c1.getContext('2d').drawImage(img, 0, 0, w, h);

                c1.toBlob(blobPNG => {
                    const c2 = document.createElement('canvas');
                    c2.width = w; c2.height = h;
                    const ctx2 = c2.getContext('2d');
                    ctx2.fillStyle = '#05000a';
                    ctx2.fillRect(0,0,w,h);
                    ctx2.drawImage(img,0,0,w,h);
                    c2.toBlob(blobJPG => {
                        URL.revokeObjectURL(url);
                        resolve({ blobPNG, blobJPG });
                    }, 'image/jpeg', 0.9);
                }, 'image/png');
            } catch(e) { reject(new Error('Error de conversión.')); }
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Archivo no es una imagen válida.')); };
        img.src = url;
    });
}

// ── GESTIÓN DE IMÁGENES HUÉRFANAS ────────────────────────────────────────
export async function cargarHuerfanas() {
    const { db } = await import('../hex-db.js');

    const [personajes, catalogo, resStorage] = await Promise.all([
        db.personajes.getAll().catch(()=>[]),
        db.objetos.getCatalogo().catch(()=>[]),
        supabase.storage.from(BUCKET).list('imgpersonajes', { limit: 1000 }).catch(()=>({data:[]}))
    ]);

    const keysEnUso = new Set();
    
    // Proteger imágenes de personajes (con y sin paréntesis)
    personajes.forEach(p => {
        const baseName = p.icono_override || p.nombre;
        const estricto = normEstricta(baseName);
        const suave    = normSuave(baseName);

        const variantes = [
            estricto + 'icon', suave + 'icon',
            estricto, suave
        ];

        variantes.forEach(v => {
            keysEnUso.add(v + '.png');
            keysEnUso.add(v + '.jpg');
            keysEnUso.add(v + '.webp');
        });
    });

    // Proteger imágenes de objetos (con y sin paréntesis)
    catalogo.forEach(o => {
        const estricto = normEstricta(o.nombre);
        const suave    = normSuave(o.nombre);

        const variantes = [estricto, suave];
        
        variantes.forEach(v => {
            keysEnUso.add(v + '.png');
            keysEnUso.add(v + '.jpg');
            keysEnUso.add(v + '.webp');
        });
    });

    const archivos = resStorage.data || [];
    const huerfanas = archivos.filter(f => !keysEnUso.has(f.name.toLowerCase()));

    return huerfanas.map(f => ({
        nombre: f.name,
        ruta: `imgpersonajes/${f.name}`,
        url: `${STORAGE_URL}/imgpersonajes/${f.name}`
    }));
}

export async function eliminarImagenStorage(ruta) {
    const { error } = await supabase.storage.from(BUCKET).remove([ruta]);
    return !error;
}
