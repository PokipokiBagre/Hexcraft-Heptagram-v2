// ============================================================
// dev-main.js — Controlador de Eventos y Renderizado Global
// ============================================================

import { hexAuth } from '../hex-auth.js';
import { db } from '../hex-db.js';

import { devState, norm, STORAGE_URL } from './dev-state.js';
import { revisarCambiosPendientes, actualizarLogGlobal, ejecutarGuardadoGlobal } from './dev-logic.js';

import { initObjetosDev } from './objetos/panel-objetos-logic.js';
import { renderColumnaObjetos } from './objetos/panel-objetos-ui.js';

// Exponemos las funciones al objeto window para que el HTML pueda llamarlas
window.cambiarFiltroRol = cambiarFiltroRol;
window.filtrarPorNombre = filtrarPorNombre;
window.seleccionarPersonajeDev = seleccionarPersonajeDev;
window.copiarLogGlobal = copiarLogGlobal;
window.ejecutarGuardadoGlobal = ejecutarGuardadoGlobal;

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

        devState.listaPersonajes = personajesBD.filter(p => p.is_active);

        // Inicializamos los módulos hijos
        initObjetosDev(catalogoObj, invObj);

        document.getElementById('pantalla-carga').classList.add('oculto');
        document.getElementById('interfaz-master').classList.remove('oculto');

        renderSelectorPersonajes();

        // Eventos disparados por los submódulos cuando algo cambia en su UI
        window.addEventListener('devUIUpdate', () => {
            if (devState.pjSeleccionado) renderColumnaObjetos(devState.pjSeleccionado);
            revisarCambiosPendientes();
            actualizarLogGlobal();
        });

        window.addEventListener('devDataChanged', () => {
            revisarCambiosPendientes();
            actualizarLogGlobal();
        });

    } catch (error) {
        console.error("Error crítico cargando DB:", error);
        document.getElementById('pantalla-carga').innerHTML = `<h2 style="color:#ff4444;">Error de conexión a la Base de Datos.</h2>`;
    }
};

function cambiarFiltroRol(rol) {
    devState.filtroRolActual = rol;
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
}

function filtrarPorNombre(texto) {
    devState.busquedaTexto = texto.toLowerCase();
    renderSelectorPersonajes();
}

function renderSelectorPersonajes() {
    const contenedor = document.getElementById('dev-character-list');
    if (!contenedor) return;

    let filtrados = devState.listaPersonajes.filter(p => {
        const coincideRol = devState.filtroRolActual === 'jugadores' ? p.is_player : !p.is_player;
        const coincideNom = p.nombre.toLowerCase().includes(devState.busquedaTexto);
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
        const claseActiva = (devState.pjSeleccionado === p.nombre) ? 'active' : '';

        html += `
        <div class="char-portrait-container ${claseActiva}" id="portrait-${norm(p.nombre)}" onclick="window.seleccionarPersonajeDev('${p.nombre.replace(/'/g, "\\'")}')">
            <img src="${imgUrl}" class="char-portrait" style="border-color: ${borderColor}44;" onerror="${imgError}" title="${p.nombre}">
            <div class="char-name">${p.nombre}</div>
        </div>`;
    });
    
    contenedor.innerHTML = html;
}

function seleccionarPersonajeDev(nombre) {
    devState.pjSeleccionado = nombre;
    
    document.querySelectorAll('.char-portrait-container').forEach(el => el.classList.remove('active'));
    const portrait = document.getElementById(`portrait-${norm(nombre)}`);
    if (portrait) portrait.classList.add('active');

    document.getElementById('dev-workspace').classList.remove('oculto');
    
    // Inicia renders de módulos hijos
    renderColumnaObjetos(devState.pjSeleccionado);
    
    const colStats = document.getElementById('content-stats');
    if (colStats) colStats.innerHTML = `<div style="color:#666; text-align:center; padding:20px; font-style:italic;">[Módulo Estadísticas Pendiente...]</div>`;
    
    const colSpells = document.getElementById('content-spells');
    if (colSpells) colSpells.innerHTML = `<div style="color:#666; text-align:center; padding:20px; font-style:italic;">[Módulo Hechizos Pendiente...]</div>`;
}

function copiarLogGlobal() {
    const textarea = document.getElementById('log-global-textarea');
    if (!textarea || !textarea.value) return;
    
    navigator.clipboard.writeText(textarea.value).then(() => {
        alert('¡Log copiado al portapapeles!');
    });
}
