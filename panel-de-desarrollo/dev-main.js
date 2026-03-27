// ============================================================
// dev-main.js — Controlador de Eventos y Renderizado Global
// ============================================================

import { hexAuth, supabase } from '../hex-auth.js';
import { db } from '../hex-db.js';

import { devState, norm, STORAGE_URL } from './dev-state.js';
import { revisarCambiosPendientes, actualizarLogGlobal, ejecutarGuardadoGlobal } from './dev-logic.js';

import { initObjetosDev } from './objetos/panel-objetos-logic.js';
import { renderColumnaObjetos } from './objetos/panel-objetos-ui.js';

import { initStatsDev } from './estadisticas/panel-stats-logic.js';
import { renderColumnaStats } from './estadisticas/panel-stats-ui.js';

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
        // Descargar TODO (Incluyendo nodos de hechizos para calcular los stats de lectura)
        const [personajesBD, catalogoObj, invObj, estadosArr, {data: hecInv}, {data: hecNodos}] = await Promise.all([
            db.personajes.getAll(),
            db.objetos.getCatalogo(),
            db.objetos.getInventarioCompleto(),
            db.estadosConfig.getAll(),
            supabase.from('hechizos_inventario').select('*'),
            supabase.from('hechizos_nodos').select('*')
        ]);

        devState.listaPersonajes = personajesBD.filter(p => p.is_active);

        // 🌟 Calcular las estadísticas de solo-lectura aportadas por hechizos
        const spellStats = {};
        if (hecInv && hecNodos) {
            hecInv.forEach(h => {
                const pj = h.personaje_nombre.toLowerCase();
                const node = hecNodos.find(n => n.nombre === h.hechizo_nombre);
                if (node) {
                    if (!spellStats[pj]) spellStats[pj] = {};
                    const props = ['fisica','energetica','espiritual','mando','psiquica','oscura','danoRojo','danoAzul','elimDorada','vidaRojaMaxExtra','vidaAzulExtra','guardaDoradaExtra'];
                    props.forEach(pr => {
                        const dbField = pr.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`); // de fisica a fisica, de danoRojo a dano_rojo
                        if (node[dbField] || node[pr]) {
                            const val = node[dbField] || node[pr] || 0;
                            spellStats[pj][pr] = (spellStats[pj][pr] || 0) + val;
                        }
                    });
                }
            });
        }

        const statsGlobalMock = {};
        personajesBD.forEach(p => {
            statsGlobalMock[p.nombre] = {
                isPlayer: p.is_player,
                isActive: p.is_active,
                hex: p.hex || 0,
                asistencia: p.asistencia || 1,
                vex: p.vex || 0,
                vidaRojaActual: p.vida_roja_actual || 0,
                baseVidaRojaMax: p.base_vida_roja_max || 0,
                baseVidaAzul: p.base_vida_azul || 0,
                baseGuardaDorada: p.base_guarda_dorada || 0,
                baseDanoRojo: p.base_dano_rojo || 0,
                baseDanoAzul: p.base_dano_azul || 0,
                baseElimDorada: p.base_elim_dorada || 0,
                afinidadesBase: p.afinidades_base || {},
                hechizosEfecto: p.hechizos_efecto || {},
                buffs: p.buffs || {},
                estados: p.estados || {},
                iconoOverride: p.icono_override || '',
                hechizos: spellStats[p.nombre.toLowerCase()] || {} // Incorporamos los stats calculados
            };
        });

        const estadosListMock = estadosArr.map(e => ({
            id: e.id, nombre: e.nombre, tipo: e.tipo, bg: e.color_bg, border: e.color_border, desc: e.descripcion
        }));

        initObjetosDev(catalogoObj, invObj);
        initStatsDev(statsGlobalMock, estadosListMock);

        document.getElementById('pantalla-carga').classList.add('oculto');
        document.getElementById('interfaz-master').classList.remove('oculto');

        renderSelectorPersonajes();

        window.addEventListener('devUIUpdate', () => {
            if (devState.pjSeleccionado) {
                renderColumnaObjetos(devState.pjSeleccionado);
                renderColumnaStats(devState.pjSeleccionado);
            }
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
        contenedor.innerHTML = `<div style="color:#666; font-style:italic; padding:20px;">No se encontraron personajes.</div>`;
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
    
    renderColumnaObjetos(devState.pjSeleccionado);
    renderColumnaStats(devState.pjSeleccionado);
    
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
