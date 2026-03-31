// ============================================================
// panel-personaje-logic.js — Crear, Renombrar, Subir Imagen
// ============================================================

import { supabase } from '../../hex-auth.js';
import { devState, STORAGE_URL, norm } from '../dev-state.js';
import { stState } from '../estadisticas/panel-stats-state.js';
import { objState } from '../objetos/panel-objetos-state.js';
import { hzState } from '../hechizos/panel-hechizos-state.js';

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
    };

    const { data, error } = await supabase
        .from('personajes')
        .insert(datos)
        .select()
        .single();

    if (error) return { error: error.message };

    devState.listaPersonajes.push(data);
    window.__devListaPersonajes = devState.listaPersonajes;

    const nom = data.nombre;
    const normNom = norm(nom);

    stState.statsDB[nom] = {
        hex: 0, asistencia: 1,
        vidaRojaActual: 0, baseVidaRojaMax: 0, baseVidaAzul: 0, baseGuardaDorada: 0,
        baseDanoRojo: 0, baseDanoAzul: 0, baseElimDorada: 0,
        afinidadesBase: { fisica:0, energetica:0, espiritual:0, mando:0, psiquica:0, oscura:0 },
        hechizos: { fisica:0, energetica:0, espiritual:0, mando:0, psiquica:0, oscura:0, danoRojo:0, danoAzul:0, elimDorada:0, vidaRojaMaxExtra:0, vidaAzulExtra:0, guardaDoradaExtra:0 },
        hechizosEfecto: { fisica:0, energetica:0, espiritual:0, mando:0, psiquica:0, oscura:0, danoRojo:0, danoAzul:0, elimDorada:0, vidaRojaMaxExtra:0, vidaAzulExtra:0, guardaDoradaExtra:0 },
        buffs: { fisica:0, energetica:0, espiritual:0, mando:0, psiquica:0, oscura:0, danoRojo:0, danoAzul:0, elimDorada:0, vidaRojaMaxExtra:0, vidaAzulExtra:0, guardaDoradaExtra:0 },
        estados: {}, notasAfinidad: {}, iconoOverride: ''
    };
    objState.inventariosDB[normNom] = {};
    objState.equipadosDB[normNom] = {};
    hzState.inventariosDB[normNom] = [];

    window.dispatchEvent(new Event('devPersonajesUpdate'));
    return { data };
}

// ── RENOMBRAR PERSONAJE ───────────────────────────────────────
export async function editarNombrePersonaje(nombreActual, nuevoNombre) {
    if (!nuevoNombre || !nuevoNombre.trim()) return { error: 'El nombre no puede estar vacío.' };

    const nuevoTrimmed = nuevoNombre.trim();
    if (nuevoTrimmed === nombreActual) return { ok: true }; 

    const existe = devState.listaPersonajes.some(
        p => p.nombre.toLowerCase() === nuevoTrimmed.toLowerCase() && p.nombre !== nombreActual
    );
    if (existe) return { error: `Ya existe un personaje llamado "${nuevoTrimmed}".` };

    const oldNorm = norm(nombreActual);
    const newNorm = norm(nuevoTrimmed);

    // 🌟 NUEVO: Mover los archivos de imagen en Supabase Storage
    try {
        // Renombramos PNG y JPG. No usamos await para que se hagan en paralelo y sea más rápido.
        const moverPng = supabase.storage.from(BUCKET).move(`imgpersonajes/${oldNorm}icon.png`, `imgpersonajes/${newNorm}icon.png`);
        const moverJpg = supabase.storage.from(BUCKET).move(`imgpersonajes/${oldNorm}icon.jpg`, `imgpersonajes/${newNorm}icon.jpg`);
        
        // Esperamos a que terminen, pero no lanzamos error si fallan 
        // (ya que puede que el personaje no tuviera imagen personalizada subida).
        await Promise.all([moverPng, moverJpg]);
    } catch (e) {
        console.warn("Aviso al mover imágenes en Storage:", e);
    }

    // Actualizar Base de Datos (Gracias al script SQL de Cascade, esto no dará error)
    const { error } = await supabase
        .from('personajes')
        .update({ nombre: nuevoTrimmed })
        .eq('nombre', nombreActual);

    if (error) return { error: error.message };

    // Actualizar estado local
    const pj = devState.listaPersonajes.find(p => p.nombre === nombreActual);
    if (pj) pj.nombre = nuevoTrimmed;
    window.__devListaPersonajes = devState.listaPersonajes;

    // Migrar colas y bases de datos locales al nuevo key
    if (stState.statsDB[nombreActual]) { stState.statsDB[nuevoTrimmed] = stState.statsDB[nombreActual]; delete stState.statsDB[nombreActual]; }
    if (stState.colaStats[nombreActual]) { stState.colaStats[nuevoTrimmed] = stState.colaStats[nombreActual]; delete stState.colaStats[nombreActual]; }
    if (stState.colaNotas[nombreActual]) { stState.colaNotas[nuevoTrimmed] = stState.colaNotas[nombreActual]; delete stState.colaNotas[nombreActual]; }

    if (objState.inventariosDB[oldNorm]) { objState.inventariosDB[newNorm] = objState.inventariosDB[oldNorm]; delete objState.inventariosDB[oldNorm]; }
    if (objState.equipadosDB[oldNorm]) { objState.equipadosDB[newNorm] = objState.equipadosDB[oldNorm]; delete objState.equipadosDB[oldNorm]; }
    if (objState.colaInventario[oldNorm]) { objState.colaInventario[newNorm] = objState.colaInventario[oldNorm]; delete objState.colaInventario[oldNorm]; }
    if (objState.colaEquipados[oldNorm]) { objState.colaEquipados[newNorm] = objState.colaEquipados[oldNorm]; delete objState.colaEquipados[oldNorm]; }

    if (hzState.inventariosDB[oldNorm]) { hzState.inventariosDB[newNorm] = hzState.inventariosDB[oldNorm]; delete hzState.inventariosDB[oldNorm]; }
    if (hzState.colaAsignaciones[oldNorm]) { hzState.colaAsignaciones[newNorm] = hzState.colaAsignaciones[oldNorm]; delete hzState.colaAsignaciones[oldNorm]; }

    if (devState.pjSeleccionado === nombreActual) {
        devState.pjSeleccionado = nuevoTrimmed;
        window.dispatchEvent(new Event('devUIUpdate'));
    }

    window.dispatchEvent(new Event('devPersonajesUpdate'));
    return { ok: true };
}

// ── SUBIR IMAGEN DE PERSONAJE ─────────────────────────────────
export async function subirImagenPersonaje(file, keyNorm, onProgreso, nombre) {
    const tipoIcono = 'imgpersonajes';
    
    // 🌟 APLICADA LA DOBLE SUBIDA PARA CLONES
    let keysToUpload = [keyNorm];
    if (nombre) {
        const keyPropia = norm(nombre) + 'icon';
        if (keyPropia !== keyNorm && !keysToUpload.includes(keyPropia)) {
            keysToUpload.push(keyPropia);
        }
    }

    if (onProgreso) onProgreso(20, 'Procesando imagen...');
    const { blobPNG, blobJPG } = await _convertirAFormatos(file);

    let urlPrincipal = '';

    for (let i = 0; i < keysToUpload.length; i++) {
        const currentKey = keysToUpload[i];
        const rutaPNG = `${tipoIcono}/${currentKey}.png`;
        const rutaJPG = `${tipoIcono}/${currentKey}.jpg`;

        const filePNG = new File([blobPNG], `${currentKey}.png`, { type: 'image/png' });
        const fileJPG = new File([blobJPG], `${currentKey}.jpg`, { type: 'image/jpeg' });

        const progresoBase = 20 + (i * 35); 

        if (onProgreso) onProgreso(progresoBase + 10, `Subiendo PNG (${currentKey})...`);
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
        if (errPNG) throw new Error(errPNG.message || `Error subiendo PNG (${currentKey})`);

        if (onProgreso) onProgreso(progresoBase + 25, `Subiendo JPG (${currentKey})...`);
        const { error: errJPG } = await subida(rutaJPG, fileJPG, 'image/jpeg');
        if (errJPG) throw new Error(errJPG.message || `Error subiendo JPG (${currentKey})`);

        if (currentKey === keyNorm) {
            urlPrincipal = `${STORAGE_URL}/${rutaPNG}?v=${Date.now()}`;
        }
    }

    if (onProgreso) onProgreso(100, keysToUpload.length > 1 ? '¡Imágenes subidas!' : '¡Imagen subida!');
    return urlPrincipal;
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
