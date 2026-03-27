// ============================================================
// dev-main.js — Orquestador del Panel Máster
// ============================================================

import { hexAuth } from '../hex-auth.js';
import { db } from '../hex-db.js';

import { initObjetosDev } from './objetos/panel-objetos-logic.js';
import { renderColumnaObjetos } from './objetos/panel-objetos-ui.js';
import { objState } from './objetos/panel-objetos-state.js';

let pjSeleccionado = null;
let listaPersonajes = [];
let filtroRolActual = 'jugadores'; 
let busquedaTexto = '';

const STORAGE_URL = 'https://gkscqurkpyteusqyspsu.supabase.co/storage/v1/object/public/imagenes-hex';
const norm = (str) => str.toString().trim().toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');

window.onload = async () => {
    const favicon = document.getElementById("dynamic-favicon");
    if (favicon) favicon.href = `${STORAGE_URL}/imginterfaz/icon.png`;

    await hexAuth.init();
    const badge = document.getElementById('hex-session-badge');
    if (badge) badge.innerHTML = hexAuth.renderStatusBadge();

    if (!hexAuth.esAdmin()) {
        document.getElementById('pantalla-carga').classList.add('oculto');
        document.getElementById('access-denied').classList.remove('oculto');
        return;
    }

    try {
        const [personajesBD, catalogoObj, invObj] = await Promise.all([
            db.personajes.getAll(),
            db.objetos.getCatalogo(),
            db.objetos.getInventarioCompleto()
        ]);

        listaPersonajes = personajesBD.filter(p => p.is_active);

        initObjetosDev(catalogoObj, invObj);

        document.getElementById('pantalla-carga').classList.add('oculto');
        document.getElementById('interfaz-master').classList.remove('oculto');

        renderSelectorPersonajes();

        // Escucha actualizaciones fuertes (clics de botones)
        window.addEventListener('devUIUpdate', () => {
            if (pjSeleccionado) renderColumnaObjetos(pjSeleccionado);
            revisarCambiosPendientes();
            actualizarLogGlobal(); // 🌟 Actualiza portapapeles
        });

        // Escucha actualizaciones sutiles (escribir en input)
        window.addEventListener('devDataChanged', () => {
            revisarCambiosPendientes();
            actualizarLogGlobal(); // 🌟 Actualiza portapapeles
        });

    } catch (error) {
        console.error("Error crítico cargando DB:", error);
        document.getElementById('pantalla-carga').innerHTML = `<h2 style="color:#ff4444;">Error de conexión a la Base de Datos.</h2>`;
    }
};

window.cambiarFiltroRol = (rol) => {
    filtroRolActual = rol;
    const btnJ = document.getElementById('tab-jugadores');
    const btnN = document.getElementById('tab-npcs');

    if (rol === 'jugadores') {
        btnJ.style.background = '#004a00'; btnJ.style.borderColor = '#00e676'; btnJ.style.color = 'white';
        btnN.style.background = '#111'; btnN.style.borderColor = '#444'; btnN.style.color = '#888';
    } else {
        btnN.style.background = '#4a0000'; btnN.style.borderColor = '#ff4444'; btnN.style.color = 'white';
        btnJ.style.background = '#111'; btnJ.style.borderColor = '#444'; btnJ.style.color = '#888';
    }
    renderSelectorPersonajes();
};

window.filtrarPorNombre = (texto) => {
    busquedaTexto = texto.toLowerCase();
    renderSelectorPersonajes();
};

function renderSelectorPersonajes() {
    const contenedor = document.getElementById('dev-character-list');
    if (!contenedor) return;

    let filtrados = listaPersonajes.filter(p => {
        const coincideRol = filtroRolActual === 'jugadores' ? p.is_player : !p.is_player;
        const coincideNom = p.nombre.toLowerCase().includes(busquedaTexto);
        return coincideRol && coincideNom;
    });

    if (filtrados.length === 0) {
        contenedor.innerHTML = `<div style="color:#666; font-style:italic; padding:20px;">No se encontraron personajes en esta categoría.</div>`;
        return;
    }

    let html = '';
    filtrados.sort((a,b) => a.nombre.localeCompare(b.nombre)).forEach(p => {
        const icono = norm(p.icono_override || p.nombre);
        const imgUrl = `${STORAGE_URL}/imgpersonajes/${icono}icon.png`;
        const imgError = `this.onerror=null; this.src='${STORAGE_URL}/imginterfaz/no_encontrado.png'`;
        const borderColor = p.is_player ? '#00e676' : '#ff4444';
        const claseActiva = (pjSeleccionado === p.nombre) ? 'active' : '';

        html += `
        <div class="char-portrait-container ${claseActiva}" id="portrait-${norm(p.nombre)}" onclick="window.seleccionarPersonajeDev('${p.nombre.replace(/'/g, "\\'")}')">
            <img src="${imgUrl}" class="char-portrait" style="border-color: ${borderColor}44;" onerror="${imgError}" title="${p.nombre}">
            <div class="char-name">${p.nombre}</div>
        </div>`;
    });
    
    contenedor.innerHTML = html;
}

window.seleccionarPersonajeDev = (nombre) => {
    pjSeleccionado = nombre;
    
    document.querySelectorAll('.char-portrait-container').forEach(el => el.classList.remove('active'));
    const portrait = document.getElementById(`portrait-${norm(nombre)}`);
    if (portrait) portrait.classList.add('active');

    document.getElementById('dev-workspace').classList.remove('oculto');
    renderColumnaObjetos(pjSeleccionado);
    
    const colStats = document.getElementById('content-stats');
    if (colStats) colStats.innerHTML = `<div style="color:#666; text-align:center; padding:20px; font-style:italic;">[Módulo Estadísticas Pendiente...]</div>`;
    
    const colSpells = document.getElementById('content-spells');
    if (colSpells) colSpells.innerHTML = `<div style="color:#666; text-align:center; padding:20px; font-style:italic;">[Módulo Hechizos Pendiente...]</div>`;
};


// =========================================================
// 🌟 GENERADOR INTELIGENTE DEL PORTAPAPELES (LOG)
// =========================================================
function actualizarLogGlobal() {
    const logPorPJ = {};

    // 1. Rastreo matemático de Inventario (Suma/Resta neta)
    for (const pjKey in objState.colaInventario) {
        // Buscar el nombre real (Capitalizado) en la base de datos
        const realPj = listaPersonajes.find(p => p.nombre.toLowerCase() === pjKey)?.nombre || pjKey;

        for (const objNombre in objState.colaInventario[pjKey]) {
            const cantNueva = objState.colaInventario[pjKey][objNombre];
            const cantVieja = objState.inventariosDB[pjKey]?.[objNombre] || 0;
            const delta = cantNueva - cantVieja; // Aquí ocurre la magia de la agregación

            if (delta !== 0) {
                if (!logPorPJ[realPj]) logPorPJ[realPj] = [];
                
                // Extraer el efecto/descripción del catálogo de la BD
                const catObj = objState.catalogoDB.find(o => o.nombre === objNombre);
                const eff = catObj && catObj.efecto ? catObj.efecto.replace(/\r?\n/g, ' ').trim() : '';
                const effStr = eff ? ` | ${eff}` : '';

                if (delta > 0) {
                    logPorPJ[realPj].push(`OO: ${objNombre} x${delta}${effStr}`);
                } else {
                    logPorPJ[realPj].push(`OO Removido: ${objNombre} x${Math.abs(delta)}`);
                }
            }
        }
    }

    // 2. Rastreo de Forja (Nuevos Objetos)
    // Se asocian al personaje que estuviera seleccionado al momento de escribir
    const pjActual = pjSeleccionado || "SIN_ASIGNAR";
    const nuevosArr = Object.values(objState.colaNuevosObjetos).filter(o => o.nombre.trim() !== '');
    
    for (const obj of nuevosArr) {
        if (obj.cant > 0) {
            if (!logPorPJ[pjActual]) logPorPJ[pjActual] = [];
            const eff = obj.eff ? obj.eff.replace(/\r?\n/g, ' ').trim() : '';
            const effStr = eff ? ` | ${eff}` : '';
            logPorPJ[pjActual].push(`OO: ${obj.nombre} x${obj.cant}${effStr}`);
        }
    }

    // 3. Formateo y Ensamblaje del Texto
    let logText = "";
    for (const pj in logPorPJ) {
        if (logPorPJ[pj].length > 0) {
            logText += `${pj}\n`;
            logPorPJ[pj].forEach(line => {
                logText += `${line}\n`;
            });
            logText += `\n`;
        }
    }

    const textarea = document.getElementById('log-global-textarea');
    if (textarea) textarea.value = logText.trim();
}

window.copiarLogGlobal = () => {
    const textarea = document.getElementById('log-global-textarea');
    if (!textarea || !textarea.value) return;
    
    navigator.clipboard.writeText(textarea.value).then(() => {
        alert('¡Log copiado al portapapeles!');
    });
};


function revisarCambiosPendientes() {
    const btnSync = document.getElementById('btn-sync-global');
    if (!btnSync) return;

    let hayCambios = false;

    if (Object.keys(objState.colaInventario).length > 0) hayCambios = true;
    if (Object.values(objState.colaNuevosObjetos).some(o => o.nombre.trim() !== '')) hayCambios = true;
    if (Object.keys(objState.colaEdicionObjetos).length > 0) hayCambios = true;

    if (hayCambios) btnSync.classList.remove('oculto');
    else btnSync.classList.add('oculto');
}

window.ejecutarGuardadoGlobal = async () => {
    const btnSync = document.getElementById('btn-sync-global');
    btnSync.innerText = "⏳ SINCRONIZANDO CON LA MATRIZ...";
    btnSync.style.pointerEvents = "none";

    try {
        const invUpserts = [];

        // 1. Forja
        const nuevosArr = Object.values(objState.colaNuevosObjetos).filter(o => o.nombre.trim() !== '');
        for (const obj of nuevosArr) {
            await db.objetos.upsertObjeto({ nombre: obj.nombre, tipo: obj.tipo, material: obj.mat, rareza: obj.rar, efecto: obj.eff });
            if (obj.cant > 0) invUpserts.push({ personaje_nombre: pjSeleccionado, objeto_nombre: obj.nombre, cantidad: obj.cant });
        }

        // 2. Ediciones
        for (const oldName in objState.colaEdicionObjetos) {
            const dataEdit = objState.colaEdicionObjetos[oldName];
            await db.objetos.upsertObjeto({ nombre: dataEdit.nombre, tipo: dataEdit.tipo, material: dataEdit.mat, rareza: dataEdit.rar, efecto: dataEdit.eff });
        }

        // 3. Inventarios (+/-)
        for (const pj in objState.colaInventario) {
            for (const obj in objState.colaInventario[pj]) {
                invUpserts.push({ personaje_nombre: pj, objeto_nombre: obj, cantidad: objState.colaInventario[pj][obj] });
            }
        }
        
        if (invUpserts.length > 0) await db.objetos.sincronizarBatch(invUpserts);

        objState.colaInventario = {}; 
        objState.colaNuevosObjetos = {};
        objState.colaEdicionObjetos = {};

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
};
