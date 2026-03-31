// ============================================================
// panel-clonar-logic.js — Lógica de Clonado
// ============================================================

import { clonarState }                              from './panel-clonar-state.js';
import { devState, norm, STORAGE_URL }              from '../dev-state.js';
import { stState }                                  from '../estadisticas/panel-stats-state.js';
import { getPjStat, setPjStat }                     from '../estadisticas/panel-stats-logic.js';
import { objState }                                 from '../objetos/panel-objetos-state.js';
import { getCantidadActual }                        from '../objetos/panel-objetos-logic.js';
import { hzState }                                  from '../hechizos/panel-hechizos-state.js';
import { asignarHechizo }                           from '../hechizos/panel-hechizos-logic.js';
import { supabase }                                 from '../../hex-auth.js';

const BUCKET = 'imagenes-hex';

// ── Leer hechizos efectivos de un PJ (cola + BD) ─────────────
export function getHechizosOrigen(pjNombre) {
    const pjKey = norm(pjNombre);
    const enDB  = hzState.inventariosDB[pjKey] || [];

    // Cola de asignaciones: { [hechizoId]: true | false }
    const cola  = hzState.colaAsignaciones[pjKey] || {};

    // IDs normalizados presentes (DB + cola true, minus cola false)
    const ids = new Set(enDB);
    for (const [id, val] of Object.entries(cola)) {
        if (val) ids.add(id);
        else     ids.delete(id);
    }

    // Mapear a objetos nodo para tener nombre, hex, afinidad, clase
    return Array.from(ids)
        .map(idNorm => {
            const nodo = (hzState.nodosDB || []).find(n => norm(n.id) === idNorm || norm(n.nombreOriginal || '') === idNorm);
            return {
                idNorm,
                id:       nodo?.id            || idNorm,
                nombre:   nodo?.nombreOriginal || idNorm,
                hex:      nodo?.hex            || 0,
                afinidad: nodo?.afinidad       || '',
                clase:    nodo?.clase          || '',
            };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export function getHechizosDestinoSet(pjNombre) {
    const pjKey = norm(pjNombre);
    const enDB  = hzState.inventariosDB[pjKey] || [];
    const cola  = hzState.colaAsignaciones[pjKey] || {};
    const ids   = new Set(enDB);
    for (const [id, val] of Object.entries(cola)) {
        if (val) ids.add(id);
        else     ids.delete(id);
    }
    return ids;
}

// ── Leer objetos efectivos de un PJ (cola + BD) ──────────────
export function getObjetosOrigen(pjNombre) {
    // IMPORTANTE: inventariosDB se pobla con toLowerCase(), NO con norm()
    const pjKey = pjNombre.toLowerCase();
    const enDB  = objState.inventariosDB[pjKey] || {};
    const cola  = objState.colaInventario[pjKey] || {};
    const merged = { ...enDB, ...cola };

    return Object.entries(merged)
        .filter(([, cant]) => cant > 0)
        .map(([nombre, cant]) => ({ nombre, cant }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// ── EJECUTAR CLONADO COMPLETO ─────────────────────────────────
export async function ejecutarClonado() {
    const { pjOrigen, pjDestino, modulos } = clonarState;
    if (!pjOrigen || !pjDestino)       return { error: 'Selecciona origen y destino.' };
    if (pjOrigen === pjDestino)        return { error: 'Origen y destino no pueden ser iguales.' };

    clonarState.ejecutando = true;
    const log = [];

    // ── 1. STATS BASE ─────────────────────────────────────────
    if (modulos.statsBase) {
        const AFINIDADES = ['fisica','energetica','espiritual','mando','psiquica','oscura'];
        AFINIDADES.forEach(af => {
            const v = getPjStat(pjOrigen, 'afinidadesBase', af);
            setPjStat(pjDestino, 'afinidadesBase', af, v, false);
        });
        const CAMPOS = ['baseVidaRojaMax','vidaRojaActual','baseVidaAzul','baseGuardaDorada',
                        'baseDanoRojo','baseDanoAzul','baseElimDorada'];
        CAMPOS.forEach(c => setPjStat(pjDestino, c, null, getPjStat(pjOrigen, c), false));
        log.push('✅ Stats base clonadas');
    }

    // ── 2. BUFFS / HECHIZOS-EFECTO / HECHIZOS-STAT ───────────
    if (modulos.buffsEfectos) {
        const GRUPOS = ['hechizos','hechizosEfecto','buffs'];
        const SUBS   = ['fisica','energetica','espiritual','mando','psiquica','oscura',
                        'danoRojo','danoAzul','elimDorada','vidaRojaMaxExtra','vidaAzulExtra','guardaDoradaExtra'];
        GRUPOS.forEach(g => {
            SUBS.forEach(s => {
                const v = getPjStat(pjOrigen, g, s);
                if (v !== 0) setPjStat(pjDestino, g, s, v, false);
            });
        });
        log.push('✅ Buffs / efectos de stats clonados');
    }

    // ── 3. HEX ────────────────────────────────────────────────
    if (modulos.hex) {
        const hexOrigen = getPjStat(pjOrigen, 'hex');
        setPjStat(pjDestino, 'hex', null, hexOrigen, false);
        log.push(`✅ HEX clonado (${hexOrigen})`);
    }

    // ── 4. ESTADOS ────────────────────────────────────────────
    if (modulos.estados) {
        const estadosOrigen = getPjStat(pjOrigen, 'estados') || {};
        for (const [id, val] of Object.entries(estadosOrigen)) {
            if (val) setPjStat(pjDestino, 'estados', id, val, false);
        }
        log.push('✅ Estados clonados');
    }

    // ── 5. HECHIZOS ───────────────────────────────────────────
    if (modulos.hechizos) {
        const hzOrigen  = getHechizosOrigen(pjOrigen);
        const hzDestSet = getHechizosDestinoSet(pjDestino);

        const lista = clonarState.hechizosMode === 'selectivo'
            ? hzOrigen.filter(h => clonarState.hechizosSeleccionados.has(h.idNorm))
            : hzOrigen;

        const cobrarOriginal       = hzState.cobrarAlAsignar;
        hzState.cobrarAlAsignar    = clonarState.cobrarHexHechizos;

        let clonados = 0;
        lista.forEach(h => {
            if (!hzDestSet.has(h.idNorm)) {
                asignarHechizo(pjDestino, h.id);
                clonados++;
            }
        });

        hzState.cobrarAlAsignar = cobrarOriginal;
        log.push(`✅ ${clonados} hechizo${clonados !== 1 ? 's' : ''} clonado${clonados !== 1 ? 's' : ''}`);
    }

    // ── 6. OBJETOS ────────────────────────────────────────────
    if (modulos.objetos) {
        const objOrigen  = getObjetosOrigen(pjOrigen);
        // IMPORTANTE: usar toLowerCase() igual que initObjetosDev
        const destinoKey = pjDestino.toLowerCase();

        if (!objState.colaInventario[destinoKey]) objState.colaInventario[destinoKey] = {};

        const lista = clonarState.objetosMode === 'selectivo'
            ? objOrigen.filter(o => (clonarState.objetosCantidades[o.nombre] ?? -1) !== 0)
            : objOrigen;

        let clonados = 0;
        lista.forEach(o => {
            const cantAClonar = clonarState.objetosMode === 'selectivo'
                ? (Number(clonarState.objetosCantidades[o.nombre]) || o.cant)
                : o.cant;
            if (cantAClonar <= 0) return;
            const actual = getCantidadActual(pjDestino, o.nombre);
            objState.colaInventario[destinoKey][o.nombre] = actual + cantAClonar;
            clonados++;
        });

        log.push(`✅ ${clonados} objeto${clonados !== 1 ? 's' : ''} clonado${clonados !== 1 ? 's' : ''}`);
    }

    // ── 7. IMAGEN ─────────────────────────────────────────────
    if (modulos.imagen) {
        const result = await _clonarImagen(pjOrigen, pjDestino);
        if (result.ok)    log.push('✅ Imagen clonada');
        else if (result.warn) log.push(`⚠️ Imagen: ${result.warn}`);
        else              log.push(`❌ Imagen: ${result.error}`);
    }

    // Disparar eventos para que el botón de guardar aparezca
    window.dispatchEvent(new Event('devUIUpdate'));
    window.dispatchEvent(new Event('devDataChanged'));

    clonarState.ejecutando  = false;
    clonarState.feedback    = { ok: true, msg: log.join('\n') };
    return { ok: true, log };
}

// ── Clonar imagen en Storage (copy PNG + JPG) ────────────────
async function _clonarImagen(origen, destino) {
    try {
        const srcKey  = norm(origen)  + 'icon';
        const dstKey  = norm(destino) + 'icon';

        // Comprobar que el origen tiene imagen descargando directamente
        const urlPNG = `${STORAGE_URL}/imgpersonajes/${srcKey}.png`;
        const res    = await fetch(urlPNG);
        if (!res.ok) return { warn: 'El personaje origen no tiene imagen subida.' };

        // Re-subir como destino (copy vía descarga + re-upload)
        const blob   = await res.blob();
        const file   = new File([blob], `${dstKey}.png`, { type: 'image/png' });

        const { error } = await supabase.storage.from(BUCKET)
            .upload(`imgpersonajes/${dstKey}.png`, file, { upsert: true, contentType: 'image/png', cacheControl: '3600' });

        if (error) return { error: error.message };

        // JPG (best effort)
        try {
            const urlJPG  = `${STORAGE_URL}/imgpersonajes/${srcKey}.jpg`;
            const resJPG  = await fetch(urlJPG);
            if (resJPG.ok) {
                const blobJ  = await resJPG.blob();
                const fileJ  = new File([blobJ], `${dstKey}.jpg`, { type: 'image/jpeg' });
                await supabase.storage.from(BUCKET)
                    .upload(`imgpersonajes/${dstKey}.jpg`, fileJ, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
            }
        } catch (_) { /* JPG es opcional */ }

        return { ok: true };
    } catch (e) {
        return { error: e.message || 'Error desconocido' };
    }
}

// ── Preview: conteo rápido de lo que se clonará ──────────────
export function getPreview() {
    const { pjOrigen, pjDestino, modulos } = clonarState;
    if (!pjOrigen || !pjDestino) return null;

    const lines = [];

    if (modulos.statsBase) {
        const afs = ['fisica','energetica','espiritual','mando','psiquica','oscura'];
        const totalAf = afs.reduce((s, af) => s + (getPjStat(pjOrigen,'afinidadesBase',af)||0), 0);
        lines.push({ icon:'📊', texto:`Stats base (Σ afinidades: ${totalAf})` });
    }
    if (modulos.buffsEfectos) lines.push({ icon:'⚡', texto:'Buffs, hechizos-efecto y extras de stats' });
    if (modulos.hex)    lines.push({ icon:'💎', texto:`HEX: ${getPjStat(pjOrigen,'hex')}` });
    if (modulos.estados) {
        const n = Object.values(getPjStat(pjOrigen,'estados')||{}).filter(Boolean).length;
        lines.push({ icon:'🔮', texto:`Estados activos: ${n}` });
    }
    if (modulos.hechizos) {
        const hz     = getHechizosOrigen(pjOrigen);
        const dstSet = getHechizosDestinoSet(pjDestino);
        const nuevos = hz.filter(h => !dstSet.has(h.idNorm));
        const sel    = clonarState.hechizosMode === 'selectivo'
            ? nuevos.filter(h => clonarState.hechizosSeleccionados.has(h.idNorm))
            : nuevos;
        lines.push({ icon:'📖', texto:`Hechizos: ${sel.length} a copiar (${hz.length - nuevos.length} ya posee)` });
    }
    if (modulos.objetos) {
        const objs = getObjetosOrigen(pjOrigen);
        const n    = clonarState.objetosMode === 'selectivo'
            ? objs.filter(o => (clonarState.objetosCantidades[o.nombre] ?? -1) !== 0).length
            : objs.length;
        lines.push({ icon:'🎒', texto:`Objetos: ${n} tipo${n !== 1 ? 's' : ''}` });
    }
    if (modulos.imagen) lines.push({ icon:'🖼️', texto:'Imagen de perfil' });

    return lines;
}

// ── CLONAR Y CREAR PERSONAJE NUEVO ───────────────────────────
// Crea un nuevo personaje con nombre "Destino (Origen)" y le aplica la clonación.
// Si ya existe "Destino (Origen)", intenta "Destino (Origen) 2", "Destino (Origen) 3", etc.
export async function ejecutarClonadoYCrear() {
    const { pjOrigen, pjDestino } = clonarState;
    if (!pjOrigen || !pjDestino) return { error: 'Selecciona origen y destino.' };

    // ── Calcular nombre del clon ──────────────────────────────
    const nombreBase = `${pjDestino} (${pjOrigen})`;
    let nombreFinal  = nombreBase;
    let sufijo = 2;

    const nombresExistentes = new Set(
        (devState.listaPersonajes || []).map(p => p.nombre.toLowerCase())
    );
    while (nombresExistentes.has(nombreFinal.toLowerCase())) {
        nombreFinal = `${nombreBase} ${sufijo}`;
        sufijo++;
    }

    // ── Importar crearPersonaje dinámicamente para evitar ciclos ─
    const { crearPersonaje } = await import('../personajes/panel-personaje-logic.js');

    // Determinar si el destino es jugador o NPC
    const pjDestinoData = devState.listaPersonajes.find(p => p.nombre === pjDestino);
    const esJugador     = pjDestinoData ? pjDestinoData.is_player : false;

    clonarState.ejecutando = true;

    const resultCrear = await crearPersonaje(nombreFinal, esJugador, null);
    if (resultCrear.error) {
        clonarState.ejecutando = false;
        clonarState.feedback = { ok: false, msg: `\u274C No se pudo crear el personaje: ${resultCrear.error}` };
        return { error: resultCrear.error };
    }

    // ── Guardar pjDestino original y hacer el clonado al nuevo personaje ─
    const destinoOriginal  = clonarState.pjDestino;
    clonarState.pjDestino  = nombreFinal;

    const resultClon = await ejecutarClonado();

    // Restaurar destino en state por si el usuario quiere seguir usando el panel
    clonarState.pjDestino = destinoOriginal;
    clonarState.ejecutando = false;

    if (resultClon.error) {
        clonarState.feedback = { ok: false, msg: `\u26A0\uFE0F Personaje creado como "${nombreFinal}" pero el clonado fall\u00F3:\n${resultClon.error}` };
        return { error: resultClon.error };
    }

    const lineas = [`\u2728 Personaje creado: ${nombreFinal}`, ...(resultClon.log || [])];
    clonarState.feedback = { ok: true, msg: lineas.join('\n') };
    return { ok: true, log: lineas, nombreFinal };
}
