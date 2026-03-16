import { misGlobal, estadoUI } from './mis-state.js';
import { cargarDatos, sincronizarBD } from './mis-data.js';
import { dibujarTablero, dibujarRoster, renderFormularioModal } from './mis-ui.js';
import { asignarJugador, removerJugador, guardarMision, eliminarPersonalizada } from './mis-logic.js';
import { hexAuth } from '../hex-auth.js';
import { db }      from '../hex-db.js';

// ============================================================
// mis-main.js — VERSIÓN SUPABASE
// ============================================================

window.onload = async () => {
    // Buscar el favicon o crearlo si no existe
    let favicon = document.querySelector("link[rel='icon']");
    if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.head.appendChild(favicon);
    }
    // Asignar la ruta de Supabase
    favicon.href = `${db.storage.urlBase}/imginterfaz/icon.png`;

    const perf = performance.getEntriesByType("navigation")[0];
    if (perf && perf.type === "reload") localStorage.removeItem('hex_mis_v1');

    // Inicializar auth — detecta si ya hay sesión activa
    await hexAuth.init();
    estadoUI.esAdmin = hexAuth.esAdmin();

    // Actualizar badge en nav si existe
    const badge = document.getElementById('hex-session-badge');
    if (badge) badge.innerHTML = hexAuth.renderStatusBadge();

    await cargarDatos();
    dibujarRoster();

    // Restaurar orden de columnas
    const savedOrder = localStorage.getItem('hex_col_order');
    if (savedOrder) {
        const orderArr = JSON.parse(savedOrder);
        const parent = document.getElementById('tablon-misiones');
        orderArr.forEach(id => { const el = document.getElementById(id); if(el) parent.appendChild(el); });
    }

   export function dibujarTablero() {
    let contGrandes = 0; let contNormales = 0;
    // Variables para el conteo de misiones mostradas en pantalla
    let contGrandesMostradas = 0; let contNormalesMostradas = 0; 
    let htmlGrandes = ''; let htmlNormales = ''; let htmlPerso = ''; let htmlOP = '';

    misGlobal.forEach(m => {
        // Contamos el total absoluto para el denominador (siempre sumamos a menos que sea personalizada/OP)
        if (m.tipo === 'Grande') contGrandes++;
        if (m.tipo === 'Normal') contNormales++;

        // Si el filtro de finalizadas está oculto y la misión está finalizada (estado 3), nos la saltamos
        if (!estadoUI.verFinalizadas && m.estado === 3) return; 

        // Si la misión pasó el filtro, sumamos al contador de "mostradas"
        if (m.tipo === 'Grande') contGrandesMostradas++;
        if (m.tipo === 'Normal') contNormalesMostradas++;

        // Generamos el HTML de la tarjeta
        const htmlCard = generarHTMLMision(m);
        
        if (m.tipo === 'Grande') htmlGrandes += htmlCard;
        else if (m.tipo === 'Normal') htmlNormales += htmlCard;
        else if (m.tipo === 'Personalizada') htmlPerso += htmlCard;
        else if (m.tipo === 'OP' && estadoUI.esAdmin) htmlOP += htmlCard;
    });

    document.getElementById('lista-grandes').innerHTML = htmlGrandes || '<p style="color:#666; font-style:italic;">No hay misiones publicadas.</p>';
    document.getElementById('lista-normales').innerHTML = htmlNormales || '<p style="color:#666; font-style:italic;">No hay misiones publicadas.</p>';
    document.getElementById('lista-perso').innerHTML = htmlPerso || '<p style="color:#666; font-style:italic;">No hay misiones de jugadores.</p>';
    document.getElementById('lista-op').innerHTML = htmlOP;

    // Actualizamos los títulos para que muestren la relación Mostradas/Total
    const titleGrandes = document.querySelector('#col-grandes h2');
    if (titleGrandes) titleGrandes.innerText = `MISIONES GRANDES (${contGrandesMostradas}/${contGrandes})`;
    
    const titleNormales = document.querySelector('#col-normales h2');
    if (titleNormales) titleNormales.innerText = `MISIONES NORMALES (${contNormalesMostradas}/${contNormales})`;

    // Actualizamos el viejo contador por compatibilidad
    const countG = document.getElementById('count-grandes');
    if (countG) countG.innerText = contGrandes;
    const countN = document.getElementById('count-normales');
    if (countN) countN.innerText = contNormales;

    const colOP = document.getElementById('col-op');
    if(estadoUI.esAdmin) { colOP.classList.remove('oculto'); } else { colOP.classList.add('oculto'); }
}

// ── LOGIN CON SUPABASE en lugar de prompt+atob ───────────────
window.abrirMenuOP = async () => {
    if (hexAuth.esAdmin()) {
        // Toggle: si ya es admin, desactivar
        estadoUI.esAdmin = !estadoUI.esAdmin;
        if (!estadoUI.esAdmin) alert("Modo OP Desactivado");
        dibujarTablero();
        return;
    }
    // Si no está logueado como admin, mostrar modal de login
    hexAuth._mostrarModalLogin();
    // Al hacer login exitoso la página se recarga y hexAuth.init() detecta la sesión
};

window.cambiarFiltroFinalizadas = () => {
    estadoUI.verFinalizadas = !estadoUI.verFinalizadas;
    const btn = document.getElementById('btn-filtro-fin');
    btn.innerText = `Ver Finalizadas: ${estadoUI.verFinalizadas ? 'SÍ' : 'NO'}`;
    btn.style.background = estadoUI.verFinalizadas ? 'var(--gold)' : '#111';
    btn.style.color = estadoUI.verFinalizadas ? '#000' : 'var(--gold)';
    dibujarTablero();
};

// ================= DRAG & DROP: COLUMNAS =================
window.dragColStart = (e, colId) => {
    if(e.target.id !== colId) return;
    e.dataTransfer.setData('text/column', colId);
    setTimeout(() => document.getElementById(colId).classList.add('col-dragging'), 0);
};
window.dragColEnd  = (e) => { e.target.classList.remove('col-dragging'); };
window.dragColOver = (e) => { e.preventDefault(); };
window.dropCol = (e, targetColId) => {
    e.preventDefault();
    const sourceColId = e.dataTransfer.getData('text/column');
    if (sourceColId && sourceColId !== targetColId) {
        const parent = document.getElementById('tablon-misiones');
        const sourceEl = document.getElementById(sourceColId);
        const targetEl = document.getElementById(targetColId);
        let siblings = Array.from(parent.children);
        let sIdx = siblings.indexOf(sourceEl);
        let tIdx = siblings.indexOf(targetEl);
        if (sIdx < tIdx) parent.insertBefore(sourceEl, targetEl.nextSibling);
        else parent.insertBefore(sourceEl, targetEl);
        localStorage.setItem('hex_col_order', JSON.stringify(Array.from(parent.children).map(c=>c.id)));
    }
};

// ================= DRAG & DROP: JUGADORES =================
window.dragStart = (e, playerName, sourceId = 'roster') => {
    e.stopPropagation();
    document.body.classList.add('is-dragging-player');
    e.dataTransfer.setData('application/json', JSON.stringify({ player: playerName, from: sourceId }));
};
window.dragOver  = (e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); };
window.dragLeave = (e) => { e.currentTarget.classList.remove('drag-over'); };

window.dropPlayer = (e, misionId) => {
    e.preventDefault(); e.currentTarget.classList.remove('drag-over');
    document.body.classList.remove('is-dragging-player');
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;
    const data = JSON.parse(dataStr);
    if (data.from !== 'roster' && data.from !== misionId) removerJugador(data.from, data.player);
    asignarJugador(misionId, data.player);
};

window.dropToRoster = (e) => {
    e.preventDefault(); e.currentTarget.classList.remove('drag-over');
    document.body.classList.remove('is-dragging-player');
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;
    const data = JSON.parse(dataStr);
    if (data.from !== 'roster') removerJugador(data.from, data.player);
};

document.addEventListener("dragend", () => {
    document.body.classList.remove('is-dragging-player');
    window.justDragged = true;
    setTimeout(() => window.justDragged = false, 150);
});

window.quitarJugador = (misionId, playerName) => {
    if (window.justDragged) return;
    if(confirm(`¿Remover a ${playerName} de esta misión?`)) removerJugador(misionId, playerName);
};

document.addEventListener("dragover", (e) => {
    const arrastrandoJugador = document.body.classList.contains('is-dragging-player');
    const arrastrandoColumna = document.querySelector('.col-dragging') !== null;
    if (arrastrandoJugador || arrastrandoColumna) {
        e.preventDefault(); e.dataTransfer.dropEffect = "move";
        const edgeThreshold = 105; const scrollSpeed = 20;
        if (e.clientY < edgeThreshold) window.scrollBy(0, -scrollSpeed);
        else if (window.innerHeight - e.clientY < edgeThreshold) window.scrollBy(0, scrollSpeed);
    }
});

document.addEventListener("drop", (e) => {
    document.body.classList.remove('is-dragging-player');
    if (!e.target.closest('.drop-zone') && !e.target.closest('#roster-container')) {
        const dataStr = e.dataTransfer.getData('application/json');
        if (dataStr) {
            try { const data = JSON.parse(dataStr); if (data.from !== 'roster') removerJugador(data.from, data.player); } catch(err) {}
        }
    }
});

// ================= MODALES =================
window.abrirModalCrear = (tipoForzado = null) => {
    const title = document.getElementById('modal-title');
    const body  = document.getElementById('modal-body');
    const modal = document.getElementById('modal-mision');
    const content = document.getElementById('modal-content-window');
    content.style.position = 'relative'; content.style.left = 'auto'; content.style.top = 'auto'; content.style.transform = 'none';
    title.innerText = "CREAR NUEVA MISIÓN";
    body.innerHTML = renderFormularioModal({ tipo: tipoForzado || 'Personalizada', clase:'1', estado:1, cupos:2, desc:'', autor:'', titulo:'', notaOP:'' });
    modal.classList.remove('oculto');
};

window.abrirModalEditar = (id) => {
    const m = misGlobal.find(mis => mis.id === id);
    if(!m) return;
    const title = document.getElementById('modal-title');
    const body  = document.getElementById('modal-body');
    const modal = document.getElementById('modal-mision');
    const content = document.getElementById('modal-content-window');
    content.style.position = 'relative'; content.style.left = 'auto'; content.style.top = 'auto'; content.style.transform = 'none';
    title.innerText = `EDITAR MISIÓN`;
    body.innerHTML = renderFormularioModal(m);
    modal.classList.remove('oculto');
};

window.cerrarModal = () => { document.getElementById('modal-mision').classList.add('oculto'); };

window.ejecutarGuardarMision = () => {
    const id    = document.getElementById('form-id').value;
    const titulo = document.getElementById('form-titulo').value.trim();
    if(!titulo) return alert("El título no puede estar vacío.");
    const tipo = document.getElementById('form-tipo') ? document.getElementById('form-tipo').value : 'Personalizada';
    const datos = {
        id, titulo, tipo,
        clase:   document.getElementById('form-clase').value,
        estado:  parseInt(document.getElementById('form-estado').value) || 0,
        cupos:   parseInt(document.getElementById('form-cupos').value)  || 2,
        autor:   document.getElementById('form-autor').value.trim(),
        desc:    document.getElementById('form-desc').value.trim(),
        notaOP:  document.getElementById('form-notaOP') ? document.getElementById('form-notaOP').value.trim() : ''
    };
    guardarMision(datos);
    window.cerrarModal();
};

window.eliminarMis = (id) => { if(confirm("¿Borrar esta misión?")) eliminarPersonalizada(id); };

window.ejecutarSincronizacion = async () => {
    const btn = document.getElementById('btn-sync-global');
    btn.innerText = "Guardando..."; btn.disabled = true;

    if(await sincronizarBD()) {
        estadoUI.colaCambios.misiones = {};
        const c = document.createElement('div');
        c.innerText = "¡Misiones Guardadas! ✅";
        c.style.cssText = "position:fixed; top:30px; left:50%; transform:translateX(-50%); background:var(--gold); color:#000; padding:15px 40px; border-radius:8px; font-weight:bold; font-size:1.2em; z-index:99999;";
        document.body.appendChild(c);
        setTimeout(() => window.location.reload(), 1200);
    } else {
        alert("Error guardando misiones en Supabase.");
        btn.disabled = false;
        btn.innerText = "Reintentar Sync";
    }
};
