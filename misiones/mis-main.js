import { misGlobal, estadoUI } from './mis-state.js';
import { cargarDatos, sincronizarBD } from './mis-data.js';
import { dibujarTablero, dibujarRoster, renderFormularioModal } from './mis-ui.js';
import { asignarJugador, removerJugador, guardarMision, eliminarPersonalizada } from './mis-logic.js';

window.onload = async () => {
    const perf = performance.getEntriesByType("navigation")[0];
    if (perf && perf.type === "reload") localStorage.removeItem('hex_mis_v1');

    await cargarDatos();
    dibujarRoster();
    
    // Restaurar orden de columnas si existe en caché
    const savedOrder = localStorage.getItem('hex_col_order');
    if (savedOrder) {
        const orderArr = JSON.parse(savedOrder);
        const parent = document.getElementById('tablon-misiones');
        orderArr.forEach(id => { const el = document.getElementById(id); if(el) parent.appendChild(el); });
    }
    
    dibujarTablero();
    
    // Lógica para Modal Arrastrable
    const dragHeader = document.getElementById('modal-drag-header');
    const modalContent = document.getElementById('modal-content-window');
    let isDragging = false, startX, startY, initialX, initialY;

    dragHeader.onmousedown = (e) => {
        if(e.target.classList.contains('close-btn')) return;
        isDragging = true; startX = e.clientX; startY = e.clientY;
        const rect = modalContent.getBoundingClientRect();
        modalContent.style.position = 'absolute';
        modalContent.style.left = rect.left + 'px';
        modalContent.style.top = rect.top + 'px';
        modalContent.style.transform = 'none';
        modalContent.style.margin = '0';
        initialX = rect.left; initialY = rect.top;
        e.preventDefault(); 
    };
    window.onmousemove = (e) => {
        if (!isDragging) return;
        modalContent.style.left = (initialX + (e.clientX - startX)) + 'px';
        modalContent.style.top = (initialY + (e.clientY - startY)) + 'px';
    };
    window.onmouseup = () => { isDragging = false; };
};

window.abrirMenuOP = () => { 
    if (estadoUI.esAdmin) { estadoUI.esAdmin = false; alert("Modo OP Desactivado"); }
    else { if (prompt("Contraseña MÁSTER:") === atob('Y2FuZXk=')) estadoUI.esAdmin = true; }
    dibujarTablero();
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
window.dragColEnd = (e) => {
    e.target.classList.remove('col-dragging');
};
window.dragColOver = (e) => {
    e.preventDefault();
};
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

        const newOrder = Array.from(parent.children).map(c => c.id);
        localStorage.setItem('hex_col_order', JSON.stringify(newOrder));
    }
};

// ================= DRAG & DROP: JUGADORES =================
window.dragStart = (e, playerName, sourceId = 'roster') => {
    e.stopPropagation(); 
    document.body.classList.add('is-dragging-player');
    e.dataTransfer.setData('application/json', JSON.stringify({ player: playerName, from: sourceId }));
};
window.dragOver = (e) => {
    e.preventDefault(); e.currentTarget.classList.add('drag-over');
};
window.dragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
};
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

// --- SOLUCIÓN AL CLIC FANTASMA Y AUTO-SCROLL ---
document.addEventListener("dragend", () => {
    document.body.classList.remove('is-dragging-player');
    // Activa un escudo anti-clic durante 150ms al terminar de arrastrar
    window.justDragged = true;
    setTimeout(() => window.justDragged = false, 150);
});

window.quitarJugador = (misionId, playerName) => {
    // Si el escudo está activo (fue un arrastre), se ignora el evento y NO lanza la alerta
    if (window.justDragged) return; 
    
    // Si fue un clic real, entonces sí pregunta
    if(confirm(`¿Remover a ${playerName} de esta misión?`)) removerJugador(misionId, playerName);
};

document.addEventListener("dragover", (e) => {
    const arrastrandoJugador = document.body.classList.contains('is-dragging-player');
    const arrastrandoColumna = document.querySelector('.col-dragging') !== null;
    
    if (arrastrandoJugador || arrastrandoColumna) {
        e.preventDefault(); 
        e.dataTransfer.dropEffect = "move"; 
        
        const edgeThreshold = 105; 
        const scrollSpeed = 20; 
        
        if (e.clientY < edgeThreshold) {
            window.scrollBy(0, -scrollSpeed);
        } else if (window.innerHeight - e.clientY < edgeThreshold) {
            window.scrollBy(0, scrollSpeed);
        }
    }
});

document.addEventListener("drop", (e) => {
    document.body.classList.remove('is-dragging-player');
    if (!e.target.closest('.drop-zone') && !e.target.closest('#roster-container')) {
        const dataStr = e.dataTransfer.getData('application/json');
        if (dataStr) {
            try {
                const data = JSON.parse(dataStr);
                if (data.from !== 'roster') removerJugador(data.from, data.player);
            } catch(err) {}
        }
    }
});

// ================= MODALES =================
window.abrirModalCrear = (tipoForzado = null) => {
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
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
    const body = document.getElementById('modal-body');
    const modal = document.getElementById('modal-mision');
    const content = document.getElementById('modal-content-window');
    content.style.position = 'relative'; content.style.left = 'auto'; content.style.top = 'auto'; content.style.transform = 'none';
    
    title.innerText = `EDITAR MISIÓN`;
    body.innerHTML = renderFormularioModal(m);
    modal.classList.remove('oculto');
};

window.cerrarModal = () => { document.getElementById('modal-mision').classList.add('oculto'); };

window.ejecutarGuardarMision = () => {
    const id = document.getElementById('form-id').value;
    const titulo = document.getElementById('form-titulo').value.trim();
    if(!titulo) return alert("El título no puede estar vacío.");

    const tipo = document.getElementById('form-tipo') ? document.getElementById('form-tipo').value : 'Personalizada';
    
    const datos = {
        id, titulo, tipo,
        clase: document.getElementById('form-clase').value,
        estado: parseInt(document.getElementById('form-estado').value) || 0,
        cupos: parseInt(document.getElementById('form-cupos').value) || 2, 
        autor: document.getElementById('form-autor').value.trim(),
        desc: document.getElementById('form-desc').value.trim(),
        notaOP: document.getElementById('form-notaOP') ? document.getElementById('form-notaOP').value.trim() : ''
    };

    guardarMision(datos);
    window.cerrarModal();
};

window.eliminarMis = (id) => { if(confirm("¿Borrar esta misión?")) eliminarPersonalizada(id); };

window.ejecutarSincronizacion = async () => {
    const btn = document.getElementById('btn-sync-global');
    btn.innerText = "Sincronizando..."; btn.disabled = true;
    if(await sincronizarBD()) {
        estadoUI.colaCambios.misiones = {};
        const c = document.createElement('div'); c.innerText = "¡Misiones Guardadas! ✅";
        c.style.cssText = "position:fixed; top:30px; left:50%; transform:translateX(-50%); background:var(--gold); color:#000; padding:15px 40px; border-radius:8px; font-weight:bold; font-size:1.2em; z-index:99999;";
        document.body.appendChild(c);
        setTimeout(() => window.location.reload(), 1200);
    } else {
        alert("Error guardando misiones en Google Sheets.");
        btn.disabled = false; btn.innerText = "Reintentar Sync";
    }
};
