import { estadoMapa } from './mapa-state.js';
import { cargarDatos, actualizarColoresFlechas, guardarPosicionesYVisibilidad } from './mapa-data.js';
import { inicializarCanvas, dibujarFrame, actualizarPanelInfo, resetearPosicionPanel } from './mapa-ui.js';
import { hexAuth } from '../hex-auth.js';
import { db }      from '../hex-db.js';

window.onload = async () => {
    let favicon = document.querySelector("link[rel='icon']");
    if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.head.appendChild(favicon);
    }
    favicon.href = `${db.storage.urlBase}/imginterfaz/icon.png`;

    await hexAuth.init();
    estadoMapa.esAdmin = hexAuth.esAdmin();

    if (estadoMapa.esAdmin) {
        const btnEditar = document.getElementById('btn-editar-mapa');
        const btnOrdenar = document.getElementById('btn-ordenar');
        if (btnEditar) btnEditar.classList.remove('oculto');
        if (btnOrdenar) btnOrdenar.classList.remove('oculto');
    }

    try { 
        inicializarCanvas();
        const barra = document.getElementById('carga-progreso');
        const loadScreen = document.getElementById('loader');

        await cargarDatos(barra);
        centrarCamaraAuto(); 
        inicializarSidebar(); 
        inicializarBuscador();
        
        if (loadScreen) {
            loadScreen.style.opacity = '0';
            setTimeout(() => loadScreen.remove(), 500);
        }

        if(estadoMapa.nodos.some(n => n.modificado)) {
            document.getElementById('btn-save-map').classList.remove('oculto');
        }

        iniciarEventosInput();
        bucleRender();
    } catch (error) {
        console.error("Error fatal iniciando el mapa:", error);
    }
};

window.cambiarModoVisual = (modo) => {
    estadoMapa.modoVisual = modo;
    document.getElementById('mode-descubiertos').classList.toggle('active', modo === 'descubiertos');
    document.getElementById('mode-afinidades').classList.toggle('active', modo === 'afinidades');
    dibujarFrame();
};

const normalizarNombre = (str) => str ? str.toString().trim().toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/\s+/g,'_').replace(/[^a-z0-9ñ_]/g,'') : "";

// ── MODO SIDEBAR: 'jugadores' | 'npcs' ──────────────────────
let modoSidebar = 'jugadores';

function inicializarSidebar() {
    const sidebar = document.getElementById('sidebar-jugadores');
    if (!sidebar) return;

    // Inject toggle buttons above player list
    const headerEl = sidebar.querySelector('h3');
    if (headerEl && !document.getElementById('sidebar-toggle-bar')) {
        const toggleBar = document.createElement('div');
        toggleBar.id = 'sidebar-toggle-bar';
        toggleBar.style.cssText = 'display:flex; gap:6px; margin-bottom:12px;';
        toggleBar.innerHTML = `
            <button id="sb-tab-jugadores" onclick="window.setSidebarModo('jugadores')"
                style="flex:1; background:var(--gold); color:#000; border:1px solid var(--gold); padding:5px; border-radius:4px; font-family:'Cinzel'; font-size:0.72em; font-weight:bold; cursor:pointer;">Jugadores</button>
            <button id="sb-tab-npcs" onclick="window.setSidebarModo('npcs')"
                style="flex:1; background:#111; color:#888; border:1px solid #555; padding:5px; border-radius:4px; font-family:'Cinzel'; font-size:0.72em; font-weight:bold; cursor:pointer;">NPCs</button>`;
        headerEl.insertAdjacentElement('afterend', toggleBar);
    }

    renderSidebarLista();
}

function renderSidebarLista() {
    const container = document.getElementById('lista-jugadores');
    if (!container) return;
    container.innerHTML = '';

    const fuente = modoSidebar === 'jugadores' ? estadoMapa.jugadores : (estadoMapa.npcJugadores || []);
    fuente.forEach(jug => {
        const btn = document.createElement('button');
        btn.className = 'btn-jugador';
        btn.id = 'btn-jug-' + jug.replace(/\s+/g, '-');
        btn.innerHTML = `
            <img src="${db.storage.urlBase}/imgpersonajes/${normalizarNombre(jug)}icon.png" 
                 onerror="this.onerror=null; this.src='${db.storage.urlBase}/imginterfaz/no_encontrado.png'" 
                 style="width:24px; height:24px; border-radius:50%; object-fit:cover; border:1px solid var(--gold);">
            <span>${jug}</span>`;
        btn.onclick = () => window.seleccionarJugador(jug);
        container.appendChild(btn);
    });

    // Actualizar estilos de las tabs
    const tabJug = document.getElementById('sb-tab-jugadores');
    const tabNpc = document.getElementById('sb-tab-npcs');
    if (tabJug && tabNpc) {
        if (modoSidebar === 'jugadores') {
            tabJug.style.background = 'var(--gold)'; tabJug.style.color = '#000';
            tabNpc.style.background = '#111'; tabNpc.style.color = '#888';
        } else {
            tabNpc.style.background = 'var(--gold)'; tabNpc.style.color = '#000';
            tabJug.style.background = '#111'; tabJug.style.color = '#888';
        }
    }
}

window.setSidebarModo = (modo) => {
    modoSidebar = modo;
    // Reset jugador activo al cambiar de tab
    window.seleccionarJugador('Todos');
    renderSidebarLista();
};

// ── LÓGICA DE SELECCIÓN BLINDADA ──────────────────────────────────
window.seleccionarJugador = (nombre) => {
    estadoMapa.jugadorActivo = nombre;
    
    document.querySelectorAll('.btn-jugador').forEach(b => b.classList.remove('activo'));
    let btnId = nombre === 'Todos' ? 'btn-jug-Todos' : 'btn-jug-' + nombre.replace(/\s+/g, '-');
    let activeBtn = document.getElementById(btnId);
    if(activeBtn) activeBtn.classList.add('activo');
    
    const sidebar = document.getElementById('sidebar-jugadores');
    if (sidebar) sidebar.classList.remove('open');

    estadoMapa.vistaJugador = { posesiones: new Set(), aprendibles: new Set(), rastreo: new Set() };
    
    if (nombre !== 'Todos') {
        const inv = estadoMapa.inventario[nombre] || new Set();
        
        estadoMapa.nodos.forEach(n => {
            let idName = n.id.toLowerCase().trim();
            let originalName = n.nombreOriginal.toLowerCase().trim();
            let baseName = originalName.replace(/\s*\(\d+\)$/, '').trim();
            let justId = idName.replace('hechizo', '').trim();
            let idWithHechizo = `hechizo ${justId}`;

            // Comparamos contra todas las variables posibles
            if (inv.has(idName) || inv.has(originalName) || inv.has(baseName) || inv.has(justId) || inv.has(idWithHechizo)) {
                estadoMapa.vistaJugador.posesiones.add(n);
            }
        });

        // Reconstruir aprendibles
        estadoMapa.enlaces.forEach(e => {
            if (estadoMapa.vistaJugador.posesiones.has(e.source) && !estadoMapa.vistaJugador.posesiones.has(e.target)) {
                estadoMapa.vistaJugador.aprendibles.add(e.target);
            }
        });

        // Reconstruir rastreo (recursivo) hacia atrás
        const rastrear = (n) => {
            estadoMapa.enlaces.forEach(e => {
                if (e.target === n && !estadoMapa.vistaJugador.rastreo.has(e.source) && !estadoMapa.vistaJugador.posesiones.has(e.source)) {
                    estadoMapa.vistaJugador.rastreo.add(e.source);
                    rastrear(e.source);
                }
            });
        };
        estadoMapa.vistaJugador.aprendibles.forEach(n => rastrear(n));
        estadoMapa.vistaJugador.posesiones.forEach(n => rastrear(n));
    }
    
    estadoMapa.interaccion.selectedNode = null;
    window.cerrarPanelInfo(); 
};

window.abrirMenuOP = async () => { 
    if (estadoMapa.esAdmin) { 
        estadoMapa.esAdmin = false; 
        alert("Modo OP Desactivado."); 
        document.getElementById('btn-save-map').classList.add('oculto');
        document.getElementById('btn-ordenar').classList.add('oculto');
        document.getElementById('btn-editar-mapa').classList.add('oculto');
        if (window.mapaEditor) window.mapaEditor.desactivar(); 
        estadoMapa.interaccion.selectedNode = null;
        actualizarPanelInfo(); 
    } else { 
        await hexAuth._mostrarModalLogin();
        estadoMapa.esAdmin = hexAuth.esAdmin();
        if (estadoMapa.esAdmin) {
            document.getElementById('btn-ordenar').classList.remove('oculto');
            document.getElementById('btn-editar-mapa').classList.remove('oculto'); 
            alert("Modo OP Activado.\\n- TOCA un nodo para fijar su menú.\\n- Usa 'Auto-Ordenar' para organizar el mapa.");
            actualizarPanelInfo(); 
        }
    } 
};

window.cerrarPanelInfo = () => {
    estadoMapa.interaccion.selectedNode = null;
    estadoMapa.interaccion.hoveredNode = null; 
    resetearPosicionPanel();
    actualizarPanelInfo();
    dibujarFrame(); 
};

// ... Resto del motor físico sin alterar (se asume que YifanHu y eventos input ya están bien)
window.ordenarMapaYifanHu = () => {
    const nodos = estadoMapa.nodos;
    const enlaces = estadoMapa.enlaces;
    
    const K = 550; 
    let iteraciones = 150; 
    let temp = 400; 

    nodos.forEach(n => n.modificado = true);
    document.getElementById('btn-save-map').classList.remove('oculto');

    function iterarFisica() {
        if(iteraciones <= 0) {
            alert("¡Mapa circular ordenado! Si te gusta, pulsa Guardar Cambios.");
            return;
        }

        const disp = new Map();
        nodos.forEach(n => disp.set(n.id, {x:0, y:0}));

        for(let i=0; i<nodos.length; i++) {
            for(let j=i+1; j<nodos.length; j++) {
                const u = nodos[i]; const v = nodos[j];
                let dx = u.x - v.x; let dy = u.y - v.y;
                let dist = Math.sqrt(dx*dx + dy*dy) || 1;
                
                const f = (K * K) / dist;
                const fx = (dx / dist) * f; const fy = (dy / dist) * f;

                disp.get(u.id).x += fx; disp.get(u.id).y += fy;
                disp.get(v.id).x -= fx; disp.get(v.id).y -= fy;
            }
        }

        enlaces.forEach(link => {
            const u = link.source; const v = link.target;
            let dx = u.x - v.x; let dy = u.y - v.y;
            let dist = Math.sqrt(dx*dx + dy*dy) || 1;

            const f = (dist * dist) / K;
            const fx = (dx / dist) * f; const fy = (dy / dist) * f;

            disp.get(u.id).x -= fx; disp.get(u.id).y -= fy;
            disp.get(v.id).x += fx; disp.get(v.id).y += fy;
        });

        nodos.forEach(u => {
            if(!u.isHexNode) {
                let distCentro = Math.sqrt(u.x*u.x + u.y*u.y) || 1;
                const fG = (distCentro * distCentro) / (K * 2); 
                disp.get(u.id).x -= (u.x / distCentro) * fG;
                disp.get(u.id).y -= (u.y / distCentro) * fG;
            }
        });

        nodos.forEach(u => {
            if(u.isHexNode) { u.x = 0; u.y = 0; return; }

            const d = disp.get(u.id);
            const dLen = Math.sqrt(d.x*d.x + d.y*d.y);
            if(dLen > 0) {
                const limit = Math.min(dLen, temp); 
                u.x += (d.x / dLen) * limit;
                u.y += (d.y / dLen) * limit;
            }
        });

        temp *= 0.95; 
        iteraciones--;
        requestAnimationFrame(iterarFisica); 
    }

    iterarFisica();
};

window.cambiarEstadoNodo = (id, valor) => {
    const nodo = estadoMapa.nodos.find(n => n.id === id);
    if(nodo) {
        const nuevoEstado = (valor === 'si');
        if (nodo.esConocido !== nuevoEstado) {
            nodo.esConocido = nuevoEstado;
            nodo.modificado = true;
            nodo.radio = nodo.esConocido ? 35 : 28;
            let baseName = nodo.nombreOriginal.replace(/\s*\(\d+\)$/, '').trim();
            if (nodo.esConocido) {
                nodo.nombre = `${baseName} (${nodo.hex})`;
            } else {
                let maskName = nodo.id.toLowerCase().includes('hechizo') ? nodo.id : `Hechizo ${nodo.id}`;
                nodo.nombre = `${maskName} (${nodo.hex})`;
            }

            actualizarColoresFlechas(); 
            actualizarPanelInfo(); 
            document.getElementById('btn-save-map').classList.remove('oculto');
        }
    }
};

window.guardarCambiosMapa = async () => {
    const btn = document.getElementById('btn-save-map');
    btn.innerText = "Guardando..."; btn.disabled = true;

    const cambios = estadoMapa.nodos.filter(n => n.modificado).map(n => ({
        hechizo_id:  n.id || n.nombreOriginal,
        pos_x:       Math.round(n.x),
        pos_y:       Math.round(n.y),
        es_conocido: n.esConocido
    }));

    if (cambios.length === 0) {
        alert("No hay cambios para guardar.");
        btn.classList.add('oculto'); btn.disabled = false;
        return;
    }

    if (await db.hechizos.guardarPosicionesBatch(cambios)) {
        alert("¡Éxito! Posiciones guardadas permanentemente.");
        estadoMapa.nodos.forEach(n => n.modificado = false);
        btn.classList.add('oculto');
    } else {
        alert("Fallo de conexión al intentar guardar.");
    }

    btn.innerText = "💾 Guardar Cambios"; btn.disabled = false;
};

function centrarCamaraAuto() {
    if (estadoMapa.nodos.length === 0) return;
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    estadoMapa.nodos.forEach(n => {
        if (n.x < minX) minX = n.x;
        if (n.x > maxX) maxX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.y > maxY) maxY = n.y;
    });

    const w = (maxX - minX) || 1000;
    const h = (maxY - minY) || 1000;
    const cx = minX + w / 2;
    const cy = minY + h / 2;

    const zoomX = window.innerWidth / (w * 1.2);
    const zoomY = window.innerHeight / (h * 1.2);
    
    estadoMapa.camara.zoom = Math.min(zoomX, zoomY, 1.5); 
    estadoMapa.camara.x = (window.innerWidth / 2) - (cx * estadoMapa.camara.zoom);
    estadoMapa.camara.y = (window.innerHeight / 2) - (cy * estadoMapa.camara.zoom);
}

function iniciarEventosInput() {
    const canvas = document.getElementById('mapa-canvas');
    if(!canvas) return;

    let pinchStartDistance = 0;

    const getPosicionMundo = (clientX, clientY) => {
        const camara = estadoMapa.camara;
        return {
            x: (clientX - camara.x) / camara.zoom,
            y: (clientY - camara.y) / camara.zoom
        };
    };

    const obtenerNodoEnCursor = (worldX, worldY) => {
        for (let i = estadoMapa.nodos.length - 1; i >= 0; i--) {
            const n = estadoMapa.nodos[i];
            const dist = Math.hypot(n.x - worldX, n.y - worldY);
            if (dist <= n.radio) return n;
        }
        return null;
    };

    canvas.addEventListener('dblclick', (e) => {
        estadoMapa.interaccion.selectedNode = null;
        resetearPosicionPanel();
        actualizarPanelInfo();
    });

    canvas.addEventListener('mousedown', (e) => {
        const worldPos = getPosicionMundo(e.clientX, e.clientY);
        const nodo = obtenerNodoEnCursor(worldPos.x, worldPos.y);

        if (window.mapaEditor && window.mapaEditor.activa) {
            window.mapaEditor.onMouseDown(e, nodo, worldPos);
            estadoMapa.interaccion.lastMouseX = e.clientX;
            estadoMapa.interaccion.lastMouseY = e.clientY;
            return;
        }

        if (nodo) {
            if (estadoMapa.interaccion.selectedNode === nodo) {
                estadoMapa.interaccion.selectedNode = null;
                resetearPosicionPanel();
            } else {
                estadoMapa.interaccion.selectedNode = nodo;
                resetearPosicionPanel(); 
            }
            if (estadoMapa.esAdmin) estadoMapa.interaccion.draggedNode = nodo;
        } else {
            estadoMapa.interaccion.isDraggingBg = true;
        }
        
        actualizarPanelInfo(); 
        estadoMapa.interaccion.lastMouseX = e.clientX;
        estadoMapa.interaccion.lastMouseY = e.clientY;
    });

    canvas.addEventListener('mousemove', (e) => {
        const dx = e.clientX - estadoMapa.interaccion.lastMouseX;
        const dy = e.clientY - estadoMapa.interaccion.lastMouseY;
        const worldPos = getPosicionMundo(e.clientX, e.clientY);

        if (window.mapaEditor && window.mapaEditor.activa) {
            window.mapaEditor.onMouseMove(e, dx, dy, worldPos);
            estadoMapa.interaccion.lastMouseX = e.clientX;
            estadoMapa.interaccion.lastMouseY = e.clientY;
            const nodoBajoCursor = obtenerNodoEnCursor(worldPos.x, worldPos.y);
            canvas.style.cursor = nodoBajoCursor ? 'pointer' : (window.mapaEditor.herramienta === 'enlace' ? 'crosshair' : 'grab');
            return;
        }

        if (estadoMapa.interaccion.isDraggingBg) {
            estadoMapa.camara.x += dx;
            estadoMapa.camara.y += dy;
        } 
        else if (estadoMapa.interaccion.draggedNode) {
            const n = estadoMapa.interaccion.draggedNode;
            n.x += dx / estadoMapa.camara.zoom;
            n.y += dy / estadoMapa.camara.zoom;
            n.modificado = true;
            document.getElementById('btn-save-map').classList.remove('oculto');
        } 
        else {
            const nodoBajoCursor = obtenerNodoEnCursor(worldPos.x, worldPos.y);
            if (estadoMapa.interaccion.hoveredNode !== nodoBajoCursor) {
                estadoMapa.interaccion.hoveredNode = nodoBajoCursor;
                if (!estadoMapa.interaccion.selectedNode) actualizarPanelInfo();
                canvas.style.cursor = nodoBajoCursor ? 'pointer' : 'grab';
            }
        }
        estadoMapa.interaccion.lastMouseX = e.clientX;
        estadoMapa.interaccion.lastMouseY = e.clientY;
    });

    canvas.addEventListener('mouseup', (e) => {
        if (window.mapaEditor && window.mapaEditor.activa) {
            const worldPos = getPosicionMundo(e.clientX, e.clientY);
            const nodo = obtenerNodoEnCursor(worldPos.x, worldPos.y);
            window.mapaEditor.onMouseUp(e, nodo);
            return;
        }
        estadoMapa.interaccion.isDraggingBg = false;
        estadoMapa.interaccion.draggedNode = null;
        canvas.style.cursor = estadoMapa.interaccion.hoveredNode ? 'pointer' : 'grab';
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const camara = estadoMapa.camara;
        const zoomDelta = e.deltaY > 0 ? 0.85 : 1.15; 
        const nuevoZoom = Math.max(0.01, Math.min(camara.zoom * zoomDelta, 4)); 
        
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        camara.x = mouseX - (mouseX - camara.x) * (nuevoZoom / camara.zoom);
        camara.y = mouseY - (mouseY - camara.y) * (nuevoZoom / camara.zoom);
        camara.zoom = nuevoZoom;
    }, { passive: false });

    canvas.addEventListener('touchstart', (e) => {
        if (e.target.closest('button') || e.target.closest('.sidebar') || e.target.closest('.view-controls')) return; 
        e.preventDefault(); 
        
        if (e.touches.length === 1) { 
            const touch = e.touches[0];
            const worldPos = getPosicionMundo(touch.clientX, touch.clientY);
            const nodo = obtenerNodoEnCursor(worldPos.x, worldPos.y);

            if (window.mapaEditor && window.mapaEditor.activa) {
                window.mapaEditor.onMouseDown(e, nodo, worldPos);
                estadoMapa.interaccion.lastMouseX = touch.clientX;
                estadoMapa.interaccion.lastMouseY = touch.clientY;
                return;
            }

            if (nodo) {
                if (estadoMapa.interaccion.selectedNode === nodo) {
                    estadoMapa.interaccion.selectedNode = null;
                    resetearPosicionPanel();
                } else {
                    estadoMapa.interaccion.selectedNode = nodo;
                    resetearPosicionPanel(); 
                }
                if (estadoMapa.esAdmin) estadoMapa.interaccion.draggedNode = nodo;
            } else {
                estadoMapa.interaccion.isDraggingBg = true;
            }
            
            actualizarPanelInfo(); 
            estadoMapa.interaccion.lastMouseX = touch.clientX;
            estadoMapa.interaccion.lastMouseY = touch.clientY;
        } 
        else if (e.touches.length === 2) { 
            estadoMapa.interaccion.isDraggingBg = false;
            estadoMapa.interaccion.draggedNode = null;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchStartDistance = Math.hypot(dx, dy);
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (e.target.closest('button') || e.target.closest('.sidebar') || e.target.closest('.view-controls')) return; 
        e.preventDefault(); 
        
        if (e.touches.length === 1) { 
            const touch = e.touches[0];
            const dx = touch.clientX - estadoMapa.interaccion.lastMouseX;
            const dy = touch.clientY - estadoMapa.interaccion.lastMouseY;
            const worldPos = getPosicionMundo(touch.clientX, touch.clientY);

            if (window.mapaEditor && window.mapaEditor.activa) {
                window.mapaEditor.onMouseMove(e, dx, dy, worldPos);
                estadoMapa.interaccion.lastMouseX = touch.clientX;
                estadoMapa.interaccion.lastMouseY = touch.clientY;
                return;
            }

            if (estadoMapa.interaccion.isDraggingBg) {
                estadoMapa.camara.x += dx;
                estadoMapa.camara.y += dy;
            } 
            else if (estadoMapa.interaccion.draggedNode) {
                const n = estadoMapa.interaccion.draggedNode;
                n.x += dx / estadoMapa.camara.zoom;
                n.y += dy / estadoMapa.camara.zoom;

                n.modificado = true;
                document.getElementById('btn-save-map').classList.remove('oculto');
            }

            estadoMapa.interaccion.lastMouseX = touch.clientX;
            estadoMapa.interaccion.lastMouseY = touch.clientY;
            
        } else if (e.touches.length === 2) { 
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.hypot(dx, dy);
            
            if (pinchStartDistance > 0) {
                const zoomFactor = distance / pinchStartDistance;
                const camara = estadoMapa.camara;
                const nuevoZoom = Math.max(0.01, Math.min(camara.zoom * zoomFactor, 4));
                
                const mouseX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const mouseY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                
                camara.x = mouseX - (mouseX - camara.x) * (nuevoZoom / camara.zoom);
                camara.y = mouseY - (mouseY - camara.y) * (nuevoZoom / camara.zoom);
                camara.zoom = nuevoZoom;
            }
            pinchStartDistance = distance;
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        if (window.mapaEditor && window.mapaEditor.activa) {
            let nodo = null;
            if (e.changedTouches && e.changedTouches.length > 0) {
                const touch = e.changedTouches[0];
                const worldPos = getPosicionMundo(touch.clientX, touch.clientY);
                nodo = obtenerNodoEnCursor(worldPos.x, worldPos.y);
            }
            window.mapaEditor.onMouseUp(e, nodo);
            return;
        }

        estadoMapa.interaccion.isDraggingBg = false;
        estadoMapa.interaccion.draggedNode = null;
        if (e.touches.length < 2) {
            pinchStartDistance = 0;
        }
    });
}

// ── BUSCADOR ─────────────────────────────────────────────────
function inicializarBuscador() {
    // Inject search UI into the UI overlay
    const overlay = document.getElementById('ui-overlay');
    if (!overlay || document.getElementById('buscador-container')) return;

    const buscadorEl = document.createElement('div');
    buscadorEl.id = 'buscador-container';
    buscadorEl.style.cssText = `
        position: absolute;
        top: 70px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 40;
        pointer-events: auto;
        width: 320px;
        font-family: 'Cinzel', serif;
    `;
    buscadorEl.innerHTML = `
        <div style="position:relative;">
            <input id="buscador-input" type="text" placeholder="🔍 Buscar hechizo... (Tab para completar)"
                autocomplete="off"
                style="width:100%; box-sizing:border-box; background:rgba(5,0,10,0.92); color:#fff; border:1px solid var(--gold); border-radius:6px; padding:8px 36px 8px 12px; font-family:'Cinzel',serif; font-size:0.8em; outline:none;">
            <button id="buscador-clear" onclick="window.limpiarBuscador()" style="display:none; position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; color:#888; font-size:1em; cursor:pointer; padding:0;">✕</button>
        </div>
        <div id="buscador-sugerencias" style="display:none; background:rgba(5,0,10,0.96); border:1px solid var(--gold); border-top:none; border-radius:0 0 6px 6px; max-height:220px; overflow-y:auto;"></div>
    `;
    overlay.appendChild(buscadorEl);

    const input = document.getElementById('buscador-input');
    const sugerenciasEl = document.getElementById('buscador-sugerencias');
    let sugerenciasActuales = [];
    let indiceSugerencia = -1;

    function getNombreBusqueda(nodo) {
        // Para usuarios normales: si no está descubierto, solo buscar por número/id
        // Para admin: buscar por nombre real
        if (estadoMapa.esAdmin) return nodo.nombreOriginal.toLowerCase();
        if (nodo.esConocido) return nodo.nombreOriginal.toLowerCase();
        // Extraer solo el número del ID
        const match = nodo.id.match(/\d+/);
        return match ? match[0] : nodo.id.toLowerCase();
    }

    function getTextoMostrado(nodo) {
        if (estadoMapa.esAdmin) return `${nodo.nombreOriginal} (${nodo.hex})`;
        if (nodo.esConocido) return `${nodo.nombreOriginal} (${nodo.hex})`;
        const match = nodo.id.match(/\d+/);
        return `Hechizo ${match ? match[0] : nodo.id} (${nodo.hex})`;
    }

    function calcularSugerencias(texto) {
        if (!texto || texto.length < 1) return [];
        const q = texto.toLowerCase().trim();
        return estadoMapa.nodos
            .filter(n => {
                const termino = getNombreBusqueda(n);
                return termino.startsWith(q) || termino.includes(q);
            })
            .sort((a, b) => {
                const tA = getNombreBusqueda(a);
                const tB = getNombreBusqueda(b);
                const startsA = tA.startsWith(q);
                const startsB = tB.startsWith(q);
                if (startsA && !startsB) return -1;
                if (!startsA && startsB) return 1;
                return tA.localeCompare(tB);
            })
            .slice(0, 12);
    }

    // Navegar directamente a un nodo objeto (sin pasar por strings)
    function irAlNodo(nodo) {
        if (!nodo) return;
        const targetZoom = 1.2;
        estadoMapa.camara.zoom = targetZoom;
        estadoMapa.camara.x = (window.innerWidth / 2) - (nodo.x * targetZoom);
        estadoMapa.camara.y = (window.innerHeight / 2) - (nodo.y * targetZoom);
        estadoMapa.interaccion.selectedNode = nodo;
        resetearPosicionPanel();
        actualizarPanelInfo();
        sugerenciasEl.style.display = 'none';
        dibujarFrame();
    }

    function mostrarSugerencias(lista) {
        if (lista.length === 0) { sugerenciasEl.style.display = 'none'; return; }
        sugerenciasEl.style.display = 'block';

        // Limpiar y construir con addEventListener (sin inline onclick con strings problemáticos)
        sugerenciasEl.innerHTML = '';
        lista.forEach((n, i) => {
            const txt = getTextoMostrado(n);
            const colorData = window.mapaColores[n.afinidad];
            const color = colorData ? colorData.t : '#888';

            const div = document.createElement('div');
            div.className = 'sug-item';
            div.dataset.idx = i;
            div.style.cssText = `padding:7px 14px; cursor:pointer; font-size:0.78em; color:${n.esConocido || estadoMapa.esAdmin ? '#fff' : '#aaa'}; border-left:3px solid ${color}; transition:background 0.15s;`;
            div.innerHTML = `<span style="color:${color}; font-weight:bold;">${txt}</span><span style="color:#666; font-size:0.85em; margin-left:6px;">${n.afinidad || ''}</span>`;

            div.addEventListener('mouseenter', () => {
                indiceSugerencia = i;
                resaltarSugerencia();
            });
            div.addEventListener('mouseleave', () => {
                div.style.background = 'transparent';
            });
            // Click directo con referencia al objeto nodo — sin strings
            div.addEventListener('click', () => {
                irAlNodo(n);
            });

            sugerenciasEl.appendChild(div);
        });

        indiceSugerencia = -1;
    }

    input.addEventListener('input', () => {
        const val = input.value.trim();
        document.getElementById('buscador-clear').style.display = val ? 'block' : 'none';
        sugerenciasActuales = calcularSugerencias(val);
        mostrarSugerencias(sugerenciasActuales);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            if (sugerenciasActuales.length > 0) {
                const idx = indiceSugerencia >= 0 ? indiceSugerencia : 0;
                const nodo = sugerenciasActuales[idx];
                // Tab: autocompleta texto pero NO navega todavía
                input.value = getTextoMostrado(nodo).replace(/\s*\(\d+\)$/, '').trim();
                document.getElementById('buscador-clear').style.display = 'block';
                // Recalcular pero mantener referencia al nodo seleccionado
                sugerenciasActuales = calcularSugerencias(input.value);
                // Asegurarse que el nodo sigue en la lista
                const nuevoIdx = sugerenciasActuales.indexOf(nodo);
                mostrarSugerencias(sugerenciasActuales);
                indiceSugerencia = nuevoIdx >= 0 ? nuevoIdx : 0;
                resaltarSugerencia();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (sugerenciasActuales.length > 0) {
                indiceSugerencia = Math.min(indiceSugerencia + 1, sugerenciasActuales.length - 1);
                resaltarSugerencia();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (sugerenciasActuales.length > 0) {
                indiceSugerencia = Math.max(indiceSugerencia - 1, 0);
                resaltarSugerencia();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            // Enter: ir al nodo seleccionado con flecha, o al primero si solo hay uno, o al único match exacto
            if (indiceSugerencia >= 0 && sugerenciasActuales[indiceSugerencia]) {
                irAlNodo(sugerenciasActuales[indiceSugerencia]);
            } else if (sugerenciasActuales.length >= 1) {
                irAlNodo(sugerenciasActuales[0]);
            }
        } else if (e.key === 'Escape') {
            sugerenciasEl.style.display = 'none';
            input.blur();
        }
    });

    function resaltarSugerencia() {
        const items = sugerenciasEl.querySelectorAll('.sug-item');
        items.forEach((el, i) => {
            el.style.background = i === indiceSugerencia ? 'rgba(212,175,55,0.25)' : 'transparent';
        });
    }

    // Cerrar sugerencias al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!buscadorEl.contains(e.target)) {
            sugerenciasEl.style.display = 'none';
        }
    });
}

window.limpiarBuscador = () => {
    const input = document.getElementById('buscador-input');
    if (input) { input.value = ''; input.dispatchEvent(new Event('input')); }
};

// Función global de navegación (por si algo externo la llama)
window.navegarAHechizo = (x, y, id) => {
    const nodo = estadoMapa.nodos.find(n => n.id === id);
    if (nodo) {
        const targetZoom = 1.2;
        estadoMapa.camara.zoom = targetZoom;
        estadoMapa.camara.x = (window.innerWidth / 2) - (nodo.x * targetZoom);
        estadoMapa.camara.y = (window.innerHeight / 2) - (nodo.y * targetZoom);
        estadoMapa.interaccion.selectedNode = nodo;
        resetearPosicionPanel();
        actualizarPanelInfo();
        const sug = document.getElementById('buscador-sugerencias');
        if (sug) sug.style.display = 'none';
        dibujarFrame();
    }
};

function bucleRender() {
    dibujarFrame();
    requestAnimationFrame(bucleRender);
}
