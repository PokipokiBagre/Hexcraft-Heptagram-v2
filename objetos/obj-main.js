import { invGlobal, objGlobal, statsGlobal, historial, estadoUI, guardar } from './obj-state.js';
import { cargarTodoDesdeCSV, sincronizarObjetosBD } from './obj-data.js';
import { modificar, modificarMulti, transferir, descargarLogExcel, descargarEstadoExcel, agregarObjetoManual, agregarObjetosMulti } from './obj-logic.js';
import { refrescarUI, dibujarMenuOP, dibujarInventarios, dibujarCatalogo, dibujarControl, dibujarCreacionObjeto, dibujarCreacionMulti, dibujarGrillaPersonajes, dibujarPartyLoot, dibujarTransferencia, dibujarResumenVisual } from './obj-ui.js';

window.actualizarBotonSyncObj = () => {
    const btn = document.getElementById('btn-sync-global');
    if(!btn) return;
    const cambios = Object.keys(estadoUI.colaCambios || {}).length;
    if (cambios > 0) {
        btn.classList.remove('oculto');
        btn.innerText = `🔥 GUARDAR CAMBIOS AL SERVIDOR (${cambios}) 🔥`;
    } else {
        btn.classList.add('oculto');
    }
};

window.ejecutarSincronizacion = async () => {
    const btn = document.getElementById('btn-sync-global');
    btn.innerText = "Sincronizando..."; btn.disabled = true;
    if(await sincronizarObjetosBD(estadoUI.colaCambios)) {
        estadoUI.colaCambios = {}; 
        guardar();
        
        const cartelito = document.createElement('div');
        cartelito.innerHTML = "¡Guardado Exitoso! ✅";
        cartelito.style.cssText = "position:fixed; top:30px; left:50%; transform:translateX(-50%); background:var(--gold); color:#000; padding:15px 40px; border-radius:8px; font-weight:bold; font-size:1.2em; z-index:9999; box-shadow:0 0 20px var(--gold); font-family:'Cinzel', serif; text-align:center;";
        document.body.appendChild(cartelito);

        setTimeout(() => { window.location.reload(); }, 1200);
    } else {
        btn.disabled = false;
    }
};

window.descargarInventariosJPG = async () => {
    const jugadores = Object.keys(invGlobal);
    for (const j of jugadores) {
        estadoUI.jugadorInv = j;
        window.mostrarPagina('inventario');
        await new Promise(r => setTimeout(r, 1500)); 
        const canvas = await html2canvas(document.getElementById('contenedor-jugadores'), { backgroundColor: '#120024', scale: 2, useCORS: true });
        const link = document.createElement('a'); link.download = `Inv_${j}.jpg`; link.href = canvas.toDataURL("image/jpeg", 0.9); link.click();
    }
    window.mostrarPagina('op-menu');
};

async function iniciar() {
    if (performance.getEntriesByType("navigation")[0]?.type === "reload") { localStorage.removeItem('hex_obj_v4'); }
    const cache = localStorage.getItem('hex_obj_v4');
    const loader = document.getElementById('loader');

    if (!cache) { 
        await cargarTodoDesdeCSV(); 
    } else { 
        const p = JSON.parse(cache); 
        Object.assign(invGlobal, p.inv); Object.assign(objGlobal, p.obj); historial.push(...(p.his || [])); 
        if(p.modoSync !== undefined) estadoUI.modoSincronizado = p.modoSync;
        if(p.colaCambios) estadoUI.colaCambios = p.colaCambios;
        
        // El await que faltaba para cargar stats/identidades
        await cargarTodoDesdeCSV(); 
    }
    
    estadoUI.cambiosSesion = {};
    estadoUI.vistaActual = 'grilla';

    const modal = document.createElement('div');
    modal.id = 'hex-modal-view'; modal.className = 'hex-modal';
    modal.innerHTML = `<img id="hex-modal-img" src="" draggable="false">`;
    document.body.appendChild(modal);
    const modalImg = document.getElementById('hex-modal-img');
    let isDragging = false, offsetX, offsetY;

    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    modalImg.onmousedown = (e) => {
        isDragging = true; const rect = modalImg.getBoundingClientRect();
        offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
        modalImg.style.cursor = 'grabbing'; modalImg.style.margin = '0';
        modalImg.style.left = rect.left + 'px'; modalImg.style.top = rect.top + 'px';
        modalImg.style.transform = 'none'; e.preventDefault();
    };
    window.onmousemove = (e) => { if (!isDragging) return; modalImg.style.left = (e.clientX - offsetX) + 'px'; modalImg.style.top = (e.clientY - offsetY) + 'px'; };
    window.onmouseup = () => { isDragging = false; modalImg.style.cursor = 'grab'; };

    window.verImagen = (url) => { modalImg.src = url; modalImg.style.left = '50%'; modalImg.style.top = '50%'; modalImg.style.transform = 'translate(-50%, -50%)'; modalImg.style.margin = 'auto'; modal.style.display = 'flex'; };
    window.verImagenByName = (name) => {
        const norm = name.toString().trim().toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/\s+/g,'_').replace(/[^a-z0-9ñ_]/g,'');
        window.verImagen(`../img/imgobjetos/${norm}.png`);
    };

    const actualizarLogSesion = () => {
        let lines = [];
        for (const player in estadoUI.cambiosSesion) {
            for (const item in estadoUI.cambiosSesion[player]) {
                const count = estadoUI.cambiosSesion[player][item];
                if (count === 0) continue;
                const tag = count > 0 ? "OO" : "OP";
                const mult = Math.abs(count) > 1 ? ` x${Math.abs(count)}` : "";
                lines.push(`<${player} | ${tag}: ${item}${mult} | ${objGlobal[item]?.eff || "..."}>`);
            }
        }
        estadoUI.logCopy = lines.join('\n');
    };

    window.limpiarLog = () => { estadoUI.cambiosSesion = {}; estadoUI.logCopy = ""; refrescarUI(); };
    window.copyToClipboard = (id) => { const area = document.getElementById(id); area.select(); document.execCommand('copy'); };
    
    // Al cambiar la página se RECONGELA el orden de todo
    window.mostrarPagina = (id) => { 
        estadoUI.vistaActual = id;
        estadoUI.resetCacheOrder = true; 
        
        document.querySelectorAll('.pagina').forEach(p => p.classList.remove('activa')); 
        const target = document.getElementById('pag-' + id);
        if(target) target.classList.add('activa'); 
        
        refrescarUI(); 
        window.actualizarBotonSyncObj();
    };

    const _session = 'Y2FuZXk=';
    window.ejecutarSyncLog = () => { 
        if (estadoUI.esAdmin) { 
            window.mostrarPagina('op-menu'); 
            return; 
        } 
        const i = prompt("Acceso Restringido OP:"); 
        if (i === atob(_session)) { 
            estadoUI.esAdmin = true; 
            refrescarUI(); 
        } 
    };

    window.abrirInventario = (j) => { estadoUI.jugadorInv = j; window.mostrarPagina('inventario'); };
    window.volverAGrilla = () => { estadoUI.jugadorInv = null; window.mostrarPagina('grilla'); };

    window.setEditMult = (val) => { estadoUI.editMult = val; refrescarUI(); };
    window.setEditModo = (val) => { estadoUI.editModo = val; refrescarUI(); };
    window.hexMod = (j, o, c) => {
        if (!estadoUI.cambiosSesion[j]) estadoUI.cambiosSesion[j] = {};
        estadoUI.cambiosSesion[j][o] = (estadoUI.cambiosSesion[j][o] || 0) + c;
        actualizarLogSesion();
        modificar(j, o, c, () => { refrescarUI(); window.actualizarBotonSyncObj(); });
    };

    // CONTROLES DE PARTY LOOT
    window.togglePartyLoot = (player, isChecked) => {
        if (isChecked && !estadoUI.partyLoot.includes(player)) estadoUI.partyLoot.push(player);
        if (!isChecked) estadoUI.partyLoot = estadoUI.partyLoot.filter(p => p !== player);
        refrescarUI();
    };
    window.setPartyMult = (val) => { estadoUI.partyMult = val; refrescarUI(); };
    window.giveLootToParty = (item) => {
        if (estadoUI.partyLoot.length === 0) return alert("Selecciona al menos un jugador arriba.");
        const cant = estadoUI.partyMult || 1;
        estadoUI.partyLoot.forEach(j => {
            if (!estadoUI.cambiosSesion[j]) estadoUI.cambiosSesion[j] = {};
            estadoUI.cambiosSesion[j][item] = (estadoUI.cambiosSesion[j][item] || 0) + cant;
        });
        actualizarLogSesion();
        modificarMulti(estadoUI.partyLoot, item, cant, () => { refrescarUI(); window.actualizarBotonSyncObj(); });
    };

    window.toggleMostrarNPCsLoot = () => { 
        estadoUI.mostrarNPCsLoot = !estadoUI.mostrarNPCsLoot; 
        refrescarUI(); 
    };

    window.seleccionarTodosJugadores = () => {
        Object.keys(invGlobal).forEach(j => {
            const key = Object.keys(statsGlobal).find(k => k.toLowerCase() === j.toLowerCase());
            const p = key ? statsGlobal[key] : null;
            if(p && p.isPlayer && !estadoUI.partyLoot.includes(j)) estadoUI.partyLoot.push(j);
        });
        refrescarUI();
    };

    window.seleccionarTodosNPCs = () => {
        Object.keys(invGlobal).forEach(j => {
            const key = Object.keys(statsGlobal).find(k => k.toLowerCase() === j.toLowerCase());
            const p = key ? statsGlobal[key] : null;
            if((!p || !p.isPlayer) && !estadoUI.partyLoot.includes(j)) estadoUI.partyLoot.push(j);
        });
        refrescarUI();
    };

    // CONTROLES DE MERCADO DE TRANSFERENCIAS
    window.setTransOrigen = (val) => { estadoUI.transOrigen = val; refrescarUI(); };
    window.setTransDestino = (val) => { estadoUI.transDestino = val; refrescarUI(); };
    window.setTransMult = (val) => { estadoUI.transMult = val; refrescarUI(); };
    window.ejecutarTransfer = (item, cantToPass) => {
        const origen = estadoUI.transOrigen; const dest = estadoUI.transDestino;
        if (!origen || !dest || origen === dest) return;
        if (cantToPass <= 0) return;
        
        if (!estadoUI.cambiosSesion[origen]) estadoUI.cambiosSesion[origen] = {};
        estadoUI.cambiosSesion[origen][item] = (estadoUI.cambiosSesion[origen][item] || 0) - cantToPass;
        
        if (!estadoUI.cambiosSesion[dest]) estadoUI.cambiosSesion[dest] = {};
        estadoUI.cambiosSesion[dest][item] = (estadoUI.cambiosSesion[dest][item] || 0) + cantToPass;
        
        actualizarLogSesion();
        transferir(origen, dest, item, cantToPass, () => { refrescarUI(); window.actualizarBotonSyncObj(); });
    };

    // FILTROS Y BÚSQUEDAS
    window.setRar = (r) => { estadoUI.filtroRar = r; dibujarCatalogo(); };
    window.setMat = (m) => { estadoUI.filtroMat = m; dibujarCatalogo(); };
    window.setFiltro = (tipo, valor) => { if(tipo === 'rol') estadoUI.filtroRol = valor; if(tipo === 'act') estadoUI.filtroAct = valor; refrescarUI(); };
    window.setBusquedaInv = (v) => { estadoUI.busquedaInv = v; dibujarInventarios(); };
    window.setBusquedaCat = (v) => { estadoUI.busquedaCat = v; dibujarCatalogo(); };
    window.setBusquedaOP = (v) => { estadoUI.busquedaOP = v; refrescarUI(); };
    
    // RUTAS PARA AMBAS CREACIONES
    window.mostrarCreacionObjeto = () => { window.mostrarPagina('crear'); };
    window.mostrarCreacionMulti = () => { window.mostrarPagina('crear-multi'); };
    
    // LÓGICA DE CREACIÓN INDIVIDUAL
    window.toggleMostrarNPCs = () => {
        estadoUI.mostrarNPCsCrea = !estadoUI.mostrarNPCsCrea;
        refrescarUI();
    };

    window.updateCreationLog = () => {
        const n = document.getElementById('new-obj-name').value || "Objeto"; const e = document.getElementById('new-obj-eff').value || "Efecto";
        let l = []; document.querySelectorAll('.cant-input').forEach(i => {
            const c = parseInt(i.value) || 0; if (c > 0) l.push(`<${i.dataset.player} | OO: ${n}${c > 1 ? ' x'+c : ''} | ${e}>`);
        });
        const out = document.getElementById('copy-log-crea'); if (out) out.value = l.join('\n');
    };

    window.ejecutarAgregarObjeto = () => {
        const d = { nombre: document.getElementById('new-obj-name').value.trim(), tipo: document.getElementById('new-obj-tipo').value, mat: document.getElementById('new-obj-mat').value, eff: document.getElementById('new-obj-eff').value.trim(), rar: document.getElementById('new-obj-rar').value };
        const rep = {}; document.querySelectorAll('.cant-input').forEach(i => rep[i.dataset.player] = i.value);
        if(!d.nombre) return alert("Nombre vacío");
        agregarObjetoManual(d, rep, () => { window.mostrarPagina('op-menu'); window.actualizarBotonSyncObj(); });
    };

    // LÓGICA DE CREACIÓN MÚLTIPLE (6 OBJETOS)
    window.updateCreationMultiLog = () => {
        const destPlayer = document.getElementById('multi-player-dest').value;
        let l = [];
        for(let i=1; i<=6; i++) { 
            const n = document.getElementById(`new-obj-name-${i}`)?.value.trim();
            const e = document.getElementById(`new-obj-eff-${i}`)?.value.trim();
            const c = parseInt(document.getElementById(`new-obj-cant-${i}`)?.value) || 0;
            if(n && c > 0) {
                if (destPlayer) l.push(`<${destPlayer} | OO: ${n}${c > 1 ? ' x'+c : ''} | ${e || "Sin descripción"}>`);
                else l.push(`<OO: ${n}${c > 1 ? ' x'+c : ''} | ${e || "Sin descripción"}>`);
            }
        }
        const out = document.getElementById('copy-log-crea-multi');
        if (out) out.value = l.join('\n');
    };

    window.ejecutarAgregarMulti = () => {
        const destPlayer = document.getElementById('multi-player-dest').value;
        let listaNuevos = [];
        for(let i=1; i<=6; i++) { 
            const nombre = document.getElementById(`new-obj-name-${i}`).value.trim();
            if(!nombre) continue;
            const tipo = document.getElementById(`new-obj-tipo-${i}`).value;
            const mat = document.getElementById(`new-obj-mat-${i}`).value;
            const rar = document.getElementById(`new-obj-rar-${i}`).value;
            const eff = document.getElementById(`new-obj-eff-${i}`).value.trim();
            const cant = parseInt(document.getElementById(`new-obj-cant-${i}`).value) || 1;
            listaNuevos.push({ nombre, tipo, mat, eff, rar, cant });
        }
        agregarObjetosMulti(listaNuevos, destPlayer, (creados) => {
            window.mostrarPagina('op-menu');
            window.actualizarBotonSyncObj();
        });
    };

    window.descargarEstadoExcel = descargarEstadoExcel; 
    window.descargarLogExcel = descargarLogExcel;
    
    // --- LÓGICA DE LECTURA DE URL ---
    const urlParams = new URLSearchParams(window.location.search);
    const pjQuery = urlParams.get('pj');
    let hashQuery = window.location.hash.replace('#inventario-', '');
    if (hashQuery) hashQuery = decodeURIComponent(hashQuery).replace(/_/g, ' ');

    const target = pjQuery || hashQuery;

    if (target) {
        // Busca al jugador ignorando mayúsculas/minúsculas
        const exactMatch = Object.keys(invGlobal).find(k => k.toLowerCase() === target.toLowerCase());
        if (exactMatch) {
            estadoUI.jugadorInv = exactMatch;
            window.mostrarPagina('inventario');
        } else {
            window.mostrarPagina('grilla');
        }
    } else {
        window.mostrarPagina('grilla'); 
    }
}

iniciar();
