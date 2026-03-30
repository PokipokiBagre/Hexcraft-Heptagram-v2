// ============================================================
// panel-personaje-logic.js — Crear, Renombrar, Subir Imagen
// ============================================================

import { supabase } from '../../hex-auth.js';
import { devState, STORAGE_URL, norm } from '../dev-state.js';

const BUCKET = 'imagenes-hex';

// ── CREAR PERSONAJE ───────────────────────────────────────────
export async function crearPersonaje(nombre, esJugador, npcTipo) {
    if (!nombre || !nombre.trim()) return { error: 'El nombre no puede estar vacío.' };

    const nombreTrimmed = nombre.trim();
    const existe = devState.listaPersonajes.some(
        p => p.nombre.toLowerCase() === nombreTrimmed.toLowerCase()
    );
    if (existe) return { error: `Ya existe un personaje llamado "${nombreTrimmed}".` };

    const datos = {
        nombre:    nombreTrimmed,
        is_player: esJugador,
        is_active: true,
        npc_tipo:  esJugador ? null : npcTipo,
        // todos los stats quedan en 0 por los defaults de la DB
    };

    const { data, error } = await supabase
        .from('personajes')
        .insert(datos)
        .select()
        .single();

    if (error) return { error: error.message };

    // Actualizar lista local
    devState.listaPersonajes.push(data);
    window.__devListaPersonajes = devState.listaPersonajes;
    window.dispatchEvent(new Event('devPersonajesUpdate'));

    return { data };
}

// ── RENOMBRAR PERSONAJE ───────────────────────────────────────
export async function editarNombrePersonaje(nombreActual, nuevoNombre) {
    if (!nuevoNombre || !nuevoNombre.trim()) return { error: 'El nombre no puede estar vacío.' };

    const nuevoTrimmed = nuevoNombre.trim();
    if (nuevoTrimmed === nombreActual) return { ok: true }; // sin cambio

    const existe = devState.listaPersonajes.some(
        p => p.nombre.toLowerCase() === nuevoTrimmed.toLowerCase() && p.nombre !== nombreActual
    );
    if (existe) return { error: `Ya existe un personaje llamado "${nuevoTrimmed}".` };

    const { error } = await supabase
        .from('personajes')
        .update({ nombre: nuevoTrimmed })
        .eq('nombre', nombreActual);

    if (error) return { error: error.message };

    // Actualizar lista local
    const pj = devState.listaPersonajes.find(p => p.nombre === nombreActual);
    if (pj) pj.nombre = nuevoTrimmed;
    window.__devListaPersonajes = devState.listaPersonajes;

    // Si era el personaje seleccionado, actualizar
    if (devState.pjSeleccionado === nombreActual) {
        devState.pjSeleccionado = nuevoTrimmed;
    }

    window.dispatchEvent(new Event('devPersonajesUpdate'));
    return { ok: true };
}

// ── SUBIR IMAGEN DE PERSONAJE ─────────────────────────────────
export async function subirImagenPersonaje(file, keyNorm, onProgreso) {
    const tipoIcono = 'imgpersonajes';
    const rutaPNG   = `${tipoIcono}/${keyNorm}.png`;
    const rutaJPG   = `${tipoIcono}/${keyNorm}.jpg`;

    if (onProgreso) onProgreso(20, 'Procesando imagen...');
    const { blobPNG, blobJPG } = await _convertirAFormatos(file);

    const filePNG = new File([blobPNG], `${keyNorm}.png`, { type: 'image/png' });
    const fileJPG = new File([blobJPG], `${keyNorm}.jpg`, { type: 'image/jpeg' });

    if (onProgreso) onProgreso(50, 'Subiendo PNG...');
    const subida = (ruta, f, tipo) => {
        const p = supabase.storage.from(BUCKET)
            .upload(ruta, f, { upsert: true, contentType: tipo, cacheControl: '3600' });
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Tiempo de espera agotado.')), 25000);
        });
        return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
    };

    const { error: errPNG } = await subida(rutaPNG, filePNG, 'image/png');
    if (errPNG) throw new Error(errPNG.message || 'Error subiendo PNG');

    if (onProgreso) onProgreso(80, 'Subiendo JPG...');
    const { error: errJPG } = await subida(rutaJPG, fileJPG, 'image/jpeg');
    if (errJPG) throw new Error(errJPG.message || 'Error subiendo JPG');

    if (onProgreso) onProgreso(100, '¡Imagen subida!');
    return `${STORAGE_URL}/imgpersonajes/${keyNorm}.png?v=${Date.now()}`;
}

// ── Conversión interna ────────────────────────────────────────
function _convertirAFormatos(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            try {
                const MAX = 512;
                let w = img.naturalWidth, h = img.naturalHeight;
                if (w > MAX || h > MAX) {
                    const r = Math.min(MAX / w, MAX / h);
                    w = Math.round(w * r); h = Math.round(h * r);
                }

                const c1 = document.createElement('canvas');
                c1.width = w; c1.height = h;
                c1.getContext('2d').drawImage(img, 0, 0, w, h);

                c1.toBlob(blobPNG => {
                    const c2 = document.createElement('canvas');
                    c2.width = w; c2.height = h;
                    const ctx = c2.getContext('2d');
                    ctx.fillStyle = '#05000a';
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(img, 0, 0, w, h);
                    c2.toBlob(blobJPG => {
                        URL.revokeObjectURL(url);
                        resolve({ blobPNG, blobJPG });
                    }, 'image/jpeg', 0.9);
                }, 'image/png');
            } catch (e) { reject(new Error('Error procesando imagen.')); }
        };

        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagen inválida o corrupta.')); };
        img.src = url;
    });
}
