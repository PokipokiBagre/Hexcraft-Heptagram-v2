// ============================================================
// dev-main.js — Controlador de Eventos y Renderizado Global
// ============================================================

import { hexAuth } from '../hex-auth.js';
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
        // 🌟 Usamos db.hechizos.getDataCompleta() exactamente como lo hace tu stats-data.js
        const [personajesBD, catalogoObj, invObj, estadosArr, hechizosData] = await Promise.all([
            db.personajes.getAll(),
            db.objetos.getCatalogo(),
            db.objetos.getInventarioCompleto(),
            db.estadosConfig.getAll(),
            db.hechizos.getDataCompleta() 
        ]);

        devState.listaPersonajes = personajesBD.filter(p => p.is_active);

        // 1. Preparar las sumas de los hechizos por personaje
        const spellStats = {};
        personajesBD.forEach(p => {
            spellStats[p.nombre] = { fisica: 0, energetica: 0, espiritual: 0, mando: 0, psiquica: 0, oscura: 0, vidaRojaMaxExtra: 0, vidaAzulExtra: 0, guardaDoradaExtra: 0, danoRojo: 0, danoAzul: 0, elimDorada: 0 };
        });

        if (hechizosData && hechizosData.inventario) {
            hechizosData.inventario.forEach(h => {
                const pjStr = h.personaje_nombre;
                const node = hechizosData.nodos.find(n => n.nombre === h.hechizo_nombre);
                if (node && spellStats[pjStr]) {
                    spellStats[pjStr].fisica += Number(node.fisica || 0);
                    spellStats[pjStr].energetica += Number(node.energetica || 0);
                    spellStats[pjStr].espiritual += Number(node.espiritual || 0);
                    spellStats[pjStr].mando += Number(node.mando || 0);
                    spellStats[pjStr].psiquica += Number(node.psiquica || 0);
                    spellStats[pjStr].oscura += Number(node.oscura || 0);
                    spellStats[pjStr].vidaRojaMaxExtra += Number(node.vida_roja_max_extra || node.vidaRojaMaxExtra || 0);
                    spellStats[pjStr].vidaAzulExtra += Number(node.vida_azul_extra || node.vidaAzulExtra || 0);
                    spellStats[pjStr].guardaDoradaExtra += Number(node.guarda_dorada_extra || node.guardaDoradaExtra || 0);
                    spellStats[pjStr].danoRojo += Number(node.dano_rojo || node.danoRojo || 0);
                    spellStats[pjStr].danoAzul += Number(node.dano_azul || node.danoAzul || 0);
                    spellStats[pjStr].elimDorada += Number(node.elim_dorada || node.elimDorada || 0);
                }
            });
        }

        // 2. Mapeo forzado a Números para evitar fallos de lectura desde Supabase
        const statsGlobalMock = {};
        personajesBD.forEach(p => {
            statsGlobalMock[p.nombre] = {
                isPlayer: p.is_player,
                isActive: p.is_active,
                hex: Number(p.hex) || 0,
                asistencia: Number(p.asistencia) || 1,
                vex: Number(p.vex) || 0,
                vidaRojaActual: Number(p.vida_roja_actual) || 0,
                baseVidaRojaMax: Number(p.base_vida_roja_max) || 0,
                baseVidaAzul: Number(p.base_vida_azul) || 0,
                baseGuardaDorada: Number(p.base_guarda_dorada) || 0,
                baseDanoRojo: Number(p.base_dano_rojo) || 0,
                baseDanoAzul: Number(p.base_dano_azul) || 0,
                baseElimDorada: Number(p.base_elim_dorada) || 0,
                
                afinidadesBase: { fisica: Number(p.fisica)||0, energetica: Number(p.energetica)||0, espiritual: Number(p.espiritual)||0, mando: Number(p.mando)||0, psiquica: Number(p.psiquica)||0, oscura: Number(p.oscura)||0 },
                hechizosEfecto: { fisica: Number(p.alt_fisica)||0, energetica: Number(p.alt_energetica)||0, espiritual: Number(p.alt_espiritual)||0, mando: Number(p.alt_mando)||0, psiquica: Number(p.alt_psiquica)||0, oscura: Number(p.alt_oscura)||0, danoRojo: Number(p.alt_dano_rojo)||0, danoAzul: Number(p.alt_dano_azul)||0, elimDorada: Number(p.alt_elim_dorada)||0 },
                buffs: { fisica: Number(p.ext_fisica)||0, energetica: Number(p.ext_energetica)||0, espiritual: Number(p.ext_espiritual)||0, mando: Number(p.ext_mando)||0, psiquica: Number(p.ext_psiquica)||0, oscura: Number(p.ext_oscura)||0, danoRojo: Number(p.ext_dano_rojo)||0, danoAzul: Number(p.ext_dano_azul)||0, elimDorada: Number(p.ext_elim_dorada)||0, vidaRojaMaxExtra: Number(p.ext_vida_roja_max)||0, vidaAzulExtra: Number(p.ext_vida_azul)||0, guardaDoradaExtra: Number(p.ext_guarda_dorada)||0 },
                
                estados: p.estados || {},
                iconoOverride: p.icono_override || '',
                hechizos: spellStats[p.nombre] || {} 
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
