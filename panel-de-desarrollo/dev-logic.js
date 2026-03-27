// ============================================================
// dev-logic.js — Lógica de Sincronización y Logs
// ============================================================

import { db } from '../hex-db.js';
import { devState } from './dev-state.js';
import { objState } from './objetos/panel-objetos-state.js';
// (Aquí importaremos en el futuro los states de Stats y Hechizos)

// 🌟 SUPERVISOR DE CAMBIOS
export function revisarCambiosPendientes() {
    const btnSync = document.getElementById('btn-sync-global');
    if (!btnSync) return;

    let hayCambios = false;

    // Revisar colas de Objetos
    if (Object.keys(objState.colaInventario).length > 0) hayCambios = true;
    if (Object.values(objState.colaNuevosObjetos).some(o => o.nombre.trim() !== '')) hayCambios = true;
    if (Object.keys(objState.colaEdicionObjetos).length > 0) hayCambios = true;

    // (Aquí revisaremos las colas de Stats y Hechizos)

    if (hayCambios) btnSync.classList.remove('oculto');
    else btnSync.classList.add('oculto');
}

// 🌟 GENERADOR INTELIGENTE DEL PORTAPAPELES
export function actualizarLogGlobal() {
    const logPorPJ = {};

    // 1. Rastreo de Inventario (Objetos)
    for (const pjKey in objState.colaInventario) {
        const realPj = devState.listaPersonajes.find(p => p.nombre.toLowerCase() === pjKey)?.nombre || pjKey;

        for (const objNombre in objState.colaInventario[pjKey]) {
            const cantNueva = objState.colaInventario[pjKey][objNombre];
            const cantVieja = objState.inventariosDB[pjKey]?.[objNombre] || 0;
            const delta = cantNueva - cantVieja; 

            if (delta !== 0) {
                if (!logPorPJ[realPj]) logPorPJ[realPj] = [];
                const catObj = objState.catalogoDB.find(o => o.nombre === objNombre);
                const eff = catObj && catObj.efecto ? catObj.efecto.replace(/\r?\n/g, ' ').trim() : '';
                const effStr = eff ? ` | ${eff}` : '';

                if (delta > 0) logPorPJ[realPj].push(`OO: ${objNombre} x${delta}${effStr}`);
                else logPorPJ[realPj].push(`OO Removido: ${objNombre} x${Math.abs(delta)}`);
            }
        }
    }

    // 2. Rastreo de Forja (Nuevos Objetos)
    const pjActual = devState.pjSeleccionado || "SIN_ASIGNAR";
    const nuevosArr = Object.values(objState.colaNuevosObjetos).filter(o => o.nombre.trim() !== '');
    
    for (const obj of nuevosArr) {
        if (obj.cant > 0) {
            if (!logPorPJ[pjActual]) logPorPJ[pjActual] = [];
            const eff = obj.eff ? obj.eff.replace(/\r?\n/g, ' ').trim() : '';
            const effStr = eff ? ` | ${eff}` : '';
            logPorPJ[pjActual].push(`OO: ${obj.nombre} x${obj.cant}${effStr}`);
        }
    }

    // 3. Formateo Final
    let logText = "";
    for (const pj in logPorPJ) {
        if (logPorPJ[pj].length > 0) {
            logText += `${pj}\n`;
            logPorPJ[pj].forEach(line => { logText += `${line}\n`; });
            logText += `\n`;
        }
    }

    const textarea = document.getElementById('log-global-textarea');
    if (textarea) textarea.value = logText.trim();
}

// 🌟 EL GRAN BOTÓN DE GUARDADO A SUPABASE
export async function ejecutarGuardadoGlobal() {
    const btnSync = document.getElementById('btn-sync-global');
    btnSync.innerText = "⏳ SINCRONIZANDO CON LA MATRIZ...";
    btnSync.style.pointerEvents = "none";

    try {
        // --- PROCESAR OBJETOS ---
        const invUpserts = [];

        const nuevosArr = Object.values(objState.colaNuevosObjetos).filter(o => o.nombre.trim() !== '');
        for (const obj of nuevosArr) {
            await db.objetos.upsertObjeto({ nombre: obj.nombre, tipo: obj.tipo, material: obj.mat, rareza: obj.rar, efecto: obj.eff });
            if (obj.cant > 0) invUpserts.push({ personaje_nombre: devState.pjSeleccionado, objeto_nombre: obj.nombre, cantidad: obj.cant });
        }

        for (const oldName in objState.colaEdicionObjetos) {
            const dataEdit = objState.colaEdicionObjetos[oldName];
            await db.objetos.upsertObjeto({ nombre: dataEdit.nombre, tipo: dataEdit.tipo, material: dataEdit.mat, rareza: dataEdit.rar, efecto: dataEdit.eff });
        }

        for (const pj in objState.colaInventario) {
            for (const obj in objState.colaInventario[pj]) {
                invUpserts.push({ personaje_nombre: pj, objeto_nombre: obj, cantidad: objState.colaInventario[pj][obj] });
            }
        }
        
        if (invUpserts.length > 0) await db.objetos.sincronizarBatch(invUpserts);

        // --- PROCESAR STATS Y HECHIZOS (AQUÍ IRÁN LUEGO) ---

        // Limpiar colas de memoria
        objState.colaInventario = {}; 
        objState.colaNuevosObjetos = {};
        objState.colaEdicionObjetos = {};

        // Éxito visual
        btnSync.innerText = "✅ CAMBIOS APLICADOS";
        btnSync.style.background = "#004a00";
        btnSync.style.borderColor = "#00ff00";
        btnSync.style.color = "white";

        setTimeout(() => {
            window.location.reload(); 
        }, 1000);

    } catch (e) {
        console.error("Error guardando:", e);
        alert("Ocurrió un error guardando en Supabase. Revisa la consola.");
        btnSync.innerText = "❌ ERROR AL GUARDAR";
        btnSync.style.background = "#4a0000";
        btnSync.style.pointerEvents = "auto";
    }
}
