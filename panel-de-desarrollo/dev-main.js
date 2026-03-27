// ============================================================
// dev-main.js — Orquestador del Panel Máster
// ============================================================

import { hexAuth, supabase } from '../hex-auth.js';
import { db } from '../hex-db.js';

// Importamos la lógica y UI de la columna de Objetos
import { initObjetosDev } from './objetos/panel-objetos-logic.js';
import { renderColumnaObjetos } from './objetos/panel-objetos-ui.js';

// Estado global del Panel de Desarrollo
let pjSeleccionado = null;
let listaPersonajes = [];

const STORAGE_URL = 'https://gkscqurkpyteusqyspsu.supabase.co/storage/v1/object/public/imagenes-hex';
const norm = (str) => str.toString().trim().toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');

window.onload = async () => {
    // 1. Configurar Favicon
    const favicon = document.getElementById("dynamic-favicon");
    if (favicon) favicon.href = `${STORAGE_URL}/imginterfaz/icon.png`;

    // 2. Autenticación Inicial
    await hexAuth.init();
    const badge = document.getElementById('hex-session-badge');
    if (badge) badge.innerHTML = hexAuth.renderStatusBadge();

    // 3. Seguridad: Si NO es admin, mostrar pantalla roja y detener la ejecución
    if (!hexAuth.esAdmin()) {
        document.getElementById('pantalla-carga').classList.add('oculto');
        document.getElementById('access-denied').classList.remove('oculto');
        return;
    }

    // 4. Descargar Base de Datos Global
    try {
        const [personajesBD, catalogoObj, invObj] = await Promise.all([
            db.personajes.getAll(),
            db.objetos.getCatalogo(),
            db.objetos.getInventarioCompleto()
        ]);

        // Guardamos solo los personajes activos para no saturar el selector
        listaPersonajes = personajesBD.filter(p => p.is_active);

        // 5. Inicializamos los submódulos pasándoles la BD limpia
        initObjetosDev(catalogoObj, invObj);

        // 6. Revelar la interfaz
        document.getElementById('pantalla-carga').classList.add('oculto');
        document.getElementById('interfaz-master').classList.remove('oculto');

        renderSelectorPersonajes();

        // 7. Event Listener: Escuchar cuando un submódulo pide actualizar la UI
        window.addEventListener('devUIUpdate', () => {
            if (pjSeleccionado) {
                renderColumnaObjetos(pjSeleccionado);
                // Aquí en el futuro llamaremos a renderColumnaStats() y renderColumnaHechizos()
            }
        });

    } catch (error) {
        console.error("Error crítico cargando DB:", error);
        document.getElementById('pantalla-carga').innerHTML = `<h2 style="color:#ff4444;">Error de conexión a la Base de Datos.</h2>`;
    }
};

// Dibuja la barra de arriba con las caritas
function renderSelectorPersonajes() {
    const contenedor = document.getElementById('dev-character-list');
    if (!contenedor) return;

    let html = '';
    // Ordenamos primero los Jugadores y luego los NPCs
    listaPersonajes.sort((a,b) => (a.is_player === b.is_player ? 0 : a.is_player ? -1 : 1)).forEach(p => {
        const icono = norm(p.icono_override || p.nombre);
        const imgUrl = `${STORAGE_URL}/imgpersonajes/${icono}icon.png`;
        const imgError = `this.onerror=null; this.src='${STORAGE_URL}/imginterfaz/no_encontrado.png'`;
        
        // Borde verde si es jugador, rojo si es NPC
        const borderColor = p.is_player ? '#00e676' : '#ff4444';

        html += `
        <div class="char-portrait-container" id="portrait-${norm(p.nombre)}" onclick="window.seleccionarPersonajeDev('${p.nombre.replace(/'/g, "\\'")}')">
            <img src="${imgUrl}" class="char-portrait" style="border-color: ${borderColor}44;" onerror="${imgError}" title="${p.nombre}">
            <div class="char-name">${p.nombre}</div>
        </div>`;
    });
    
    contenedor.innerHTML = html;
}

// Lógica de cuando el Máster hace clic en un retrato
window.seleccionarPersonajeDev = (nombre) => {
    pjSeleccionado = nombre;
    
    // Quitar la clase "active" a todos y ponérsela solo al seleccionado
    document.querySelectorAll('.char-portrait-container').forEach(el => el.classList.remove('active'));
    const portrait = document.getElementById(`portrait-${norm(nombre)}`);
    if (portrait) portrait.classList.add('active');

    // Desocultar el área de trabajo dividida en 3 columnas
    document.getElementById('dev-workspace').classList.remove('oculto');

    // Despertar a los submódulos
    renderColumnaObjetos(pjSeleccionado);
    
    // Placeholders temporales para las columnas que aún no hemos programado
    const colStats = document.getElementById('content-stats');
    if (colStats) colStats.innerHTML = `<div style="color:#666; text-align:center; padding:20px; font-style:italic;">[Módulo Estadísticas Pendiente...]</div>`;
    
    const colSpells = document.getElementById('content-spells');
    if (colSpells) colSpells.innerHTML = `<div style="color:#666; text-align:center; padding:20px; font-style:italic;">[Módulo Hechizos Pendiente...]</div>`;
};
