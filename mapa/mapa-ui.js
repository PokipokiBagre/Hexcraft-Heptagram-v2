import { estadoMapa, COLOR_AFINIDAD, ESTETICA, COLORES_JUGADOR } from './mapa-state.js';

let canvas, ctx;

export function inicializarCanvas() {
    canvas = document.getElementById('mapa-canvas');
    if(!canvas) return;
    ctx = canvas.getContext('2d', { alpha: false });
    redimensionar();
    window.addEventListener('resize', redimensionar);
    
    // Hacemos arrastrables ambos paneles
    hacerPanelArrastrable('panel-info');
    hacerPanelArrastrable('panel-edicion-avanzada');
}

function redimensionar() {
    if(!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    dibujarFrame();
}

export function dibujarFrame() {
    if(!ctx) return;
    
    const { nodos, enlaces, camara, interaccion, jugadorActivo, vistaJugador, modoVisual } = estadoMapa;

    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#05000a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);
    ctx.translate(camara.x, camara.y);
    ctx.scale(camara.zoom, camara.zoom);

    const scaleFactor = Math.max(camara.zoom, 0.2); 
    const nodoActivo = interaccion.selectedNode || interaccion.hoveredNode;
    const isPlayerView = jugadorActivo !== 'Todos';

    const posesiones = vistaJugador.posesiones || new Set();
    const aprendibles = vistaJugador.aprendibles || new Set();
    const rastreo = vistaJugador.rastreo || new Set();

    const ancestorEdges = new Set();
    const ancestorNodes = new Set();
    const outgoingEdges = new Set();
    const outgoingNodes = new Set();

    if (nodoActivo) {
        const encontrarPrecedentes = (n) => {
            enlaces.forEach(e => {
                if (e.target === n && !ancestorEdges.has(e)) {
                    ancestorEdges.add(e);
                    ancestorNodes.add(e.source);
                    encontrarPrecedentes(e.source); 
                }
            });
        };
        encontrarPrecedentes(nodoActivo);

        enlaces.forEach(e => {
            if (e.source === nodoActivo) {
                outgoingEdges.add(e);
                outgoingNodes.add(e.target);
            }
        });
    }

    // ==========================================
    // 1. DIBUJAR ENLACES
    // ==========================================
    enlaces.forEach(link => {
        const dx = link.target.x - link.source.x;
        const dy = link.target.y - link.source.y;
        const angle = Math.atan2(dy, dx);
        
        const targetX = link.target.x - Math.cos(angle) * (link.target.radio + (4/scaleFactor));
        const targetY = link.target.y - Math.sin(angle) * (link.target.radio + (4/scaleFactor));

        ctx.beginPath();
        ctx.moveTo(link.source.x, link.source.y);
        ctx.lineTo(targetX, targetY);
        
        ctx.globalAlpha = 1.0; 
        let drawNormal = true;
        let arrowMult = 3;
        let baseHeadLen = 10;

        if (nodoActivo) {
            if (outgoingEdges.has(link)) {
                ctx.strokeStyle = ESTETICA.lineaSaliente;
                ctx.lineWidth = 4 / scaleFactor;
                ctx.setLineDash([]);
                drawNormal = false;
            } else if (ancestorEdges.has(link)) {
                ctx.strokeStyle = 'rgba(177, 156, 217, 0.45)'; 
                ctx.lineWidth = 1.5 / scaleFactor; 
                ctx.setLineDash([]);
                drawNormal = false;
            } else {
                ctx.strokeStyle = 'rgba(80, 80, 80, 0.15)'; 
                ctx.lineWidth = 0.8 / scaleFactor; 
                ctx.setLineDash([]);
                ctx.globalAlpha = 0.2; 
                arrowMult = 1.5; baseHeadLen = 5;
                drawNormal = false;
            }
        } 
        
        if (drawNormal) {
            if (isPlayerView) {
                let sP = posesiones.has(link.source);
                let tP = posesiones.has(link.target);
                let tA = aprendibles.has(link.target);
                let sT = rastreo.has(link.source) || sP;
                let tT = rastreo.has(link.target) || tP || tA;

                if (sP && tP) {
                    ctx.strokeStyle = COLORES_JUGADOR.posesionMorada; 
                    ctx.lineWidth = 1.5 / scaleFactor;
                    ctx.setLineDash([]);
                } else if (sP && tA) {
                    let target = link.target;
                    let totalReq = target.incomingSources.length;
                    let posReq = target.incomingSources.filter(n => posesiones.has(n)).length;
                    let ratio = posReq / totalReq;

                    if (ratio >= 0.75) ctx.strokeStyle = COLORES_JUGADOR.doradoInmediato; 
                    else if (ratio >= 0.4) ctx.strokeStyle = COLORES_JUGADOR.doradoMedio; 
                    else ctx.strokeStyle = COLORES_JUGADOR.doradoTenue; 
                    
                    ctx.lineWidth = 1.5 / scaleFactor;
                    ctx.setLineDash([]);
                } else if (sT && tT) {
                    ctx.strokeStyle = COLORES_JUGADOR.doradoRastreo; 
                    ctx.lineWidth = 1 / scaleFactor; 
                    ctx.setLineDash([]); 
                } else {
                    ctx.strokeStyle = COLORES_JUGADOR.fondoNeutro; 
                    ctx.lineWidth = 0.8 / scaleFactor;
                    ctx.setLineDash([]);
                    arrowMult = 1.5; baseHeadLen = 5;
                }
            } else {
                if (modoVisual === 'afinidades') {
                    ctx.strokeStyle = link.target.arrowColor; 
                    ctx.lineWidth = 1.5 / scaleFactor; 
                    if (ctx.strokeStyle === ESTETICA.lineaRosa) ctx.setLineDash([8 / scaleFactor, 8 / scaleFactor]);
                    else ctx.setLineDash([]); 
                } else {
                    ctx.strokeStyle = 'rgba(150, 150, 150, 0.3)'; 
                    ctx.lineWidth = 1.5 / scaleFactor; 
                    ctx.setLineDash([]); 
                }
            }
        }

        ctx.stroke();
        ctx.setLineDash([]); 

        const headlen = (ctx.lineWidth * arrowMult) + (baseHeadLen / scaleFactor); 
        ctx.beginPath();
        ctx.moveTo(targetX, targetY);
        ctx.lineTo(targetX - headlen * Math.cos(angle - Math.PI / 7), targetY - headlen * Math.sin(angle - Math.PI / 7));
        ctx.lineTo(targetX - headlen * Math.cos(angle + Math.PI / 7), targetY - headlen * Math.sin(angle + Math.PI / 7));
        ctx.lineTo(targetX, targetY);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
    });

    // --- HOOK DIBUJO DE EDICIÓN ---
    if (window.mapaEditor && window.mapaEditor.activa) {
        // 1. Dibujar enlace temporal
        if (window.mapaEditor.tempLink) {
            const temp = window.mapaEditor.tempLink;
            const seleccion = window.mapaEditor.seleccionMultiple;
            
            const nodosOrigen = (window.mapaEditor.isShiftPressed && seleccion.has(temp.source) && seleccion.size > 1) 
                ? Array.from(seleccion) 
                : [temp.source];

            nodosOrigen.forEach(nodoOrg => {
                const angle = Math.atan2(temp.endY - nodoOrg.y, temp.endX - nodoOrg.x);
                const headlen = 18 / scaleFactor;
                
                ctx.beginPath();
                ctx.moveTo(nodoOrg.x, nodoOrg.y);
                ctx.lineTo(temp.endX, temp.endY);
                ctx.strokeStyle = '#00ffff'; 
                ctx.lineWidth = 4 / scaleFactor; 
                ctx.setLineDash([10/scaleFactor, 10/scaleFactor]);
                ctx.stroke(); 
                ctx.setLineDash([]);
                
                ctx.beginPath();
                ctx.moveTo(temp.endX, temp.endY);
                ctx.lineTo(temp.endX - headlen * Math.cos(angle - Math.PI / 7), temp.endY - headlen * Math.sin(angle - Math.PI / 7));
                ctx.lineTo(temp.endX - headlen * Math.cos(angle + Math.PI / 7), temp.endY - headlen * Math.sin(angle + Math.PI / 7));
                ctx.lineTo(temp.endX, temp.endY);
                ctx.fillStyle = '#00ffff';
                ctx.fill();
            });
        }
        
        // 2. Dibujar Caja de Selección
        if (window.mapaEditor.boxStart && window.mapaEditor.boxCurrent) {
            const minX = Math.min(window.mapaEditor.boxStart.x, window.mapaEditor.boxCurrent.x);
            const minY = Math.min(window.mapaEditor.boxStart.y, window.mapaEditor.boxCurrent.y);
            const w = Math.abs(window.mapaEditor.boxCurrent.x - window.mapaEditor.boxStart.x);
            const h = Math.abs(window.mapaEditor.boxCurrent.y - window.mapaEditor.boxStart.y);
            
            ctx.fillStyle = 'rgba(0, 255, 255, 0.15)';
            ctx.fillRect(minX, minY, w, h);
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2 / scaleFactor;
            ctx.setLineDash([5/scaleFactor, 5/scaleFactor]);
            ctx.strokeRect(minX, minY, w, h);
            ctx.setLineDash([]);
        }

        // 3. Dibujar Enmascarado
        window.mapaEditor.seleccionMultiple.forEach(n => {
            ctx.beginPath(); 
            ctx.arc(n.x, n.y, n.radio + (12/scaleFactor), 0, Math.PI * 2);
            ctx.strokeStyle = '#00ffff'; 
            ctx.lineWidth = 6 / scaleFactor; 
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00ffff';
            ctx.stroke();
            ctx.shadowBlur = 0; 
        });
    }

    // ==========================================
    // 2. DIBUJAR NODOS
    // ==========================================
    nodos.forEach(nodo => {
        ctx.globalAlpha = 1.0; 
        
        let colorAfinidadReal;

        if (modoVisual === 'afinidades') {
            colorAfinidadReal = window.mapaColores[nodo.afinidad] ? window.mapaColores[nodo.afinidad].t : '#aaaaaa';
        } else {
            if (nodo.esConocido) {
                colorAfinidadReal = 'rgba(177, 156, 217, 1)';
            } else {
                colorAfinidadReal = 'rgba(236, 213, 154, 1)';
            }
        }

        if (nodo.isHexNode) colorAfinidadReal = '#ff4444'; 

        const isHovered = interaccion.hoveredNode === nodo;
        const isSelected = interaccion.selectedNode === nodo;
        
        const tieneElHechizo = posesiones.has(nodo);
        const esPlenamenteDescubierto = (isPlayerView && tieneElHechizo) || (!isPlayerView && nodo.esConocido);
        const esAprendibleInmediato = isPlayerView && aprendibles.has(nodo) && !tieneElHechizo;
        const esPrecedente = isPlayerView && rastreo.has(nodo) && !aprendibles.has(nodo) && !tieneElHechizo;
        const esIrrelevantePlayer = isPlayerView && !tieneElHechizo && !aprendibles.has(nodo) && !rastreo.has(nodo);

        let colorNodoFinal = colorAfinidadReal;
        if (isPlayerView && tieneElHechizo && !nodo.isHexNode) {
            colorNodoFinal = 'rgba(177, 156, 217, 1)';
        } else if (isPlayerView && (esAprendibleInmediato || esPrecedente)) {
            colorNodoFinal = esAprendibleInmediato ? 'rgba(236, 213, 154, 0.8)' : 'rgba(212, 196, 146, 0.4)';
        }

        if (nodoActivo) {
            if (nodo !== nodoActivo && !ancestorNodes.has(nodo) && !outgoingNodes.has(nodo) && !nodo.isHexNode) {
                ctx.globalAlpha = 0.2;
            }
        } else if (isPlayerView && esIrrelevantePlayer) {
            ctx.globalAlpha = 0.56; 
        }

        if (isSelected) {
            ctx.beginPath();
            ctx.arc(nodo.x, nodo.y, nodo.radio + (10/scaleFactor), 0, Math.PI * 2);
            ctx.strokeStyle = ESTETICA.lineaSaliente; 
            ctx.lineWidth = 3 / scaleFactor;
            ctx.setLineDash([8/scaleFactor, 8/scaleFactor]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        const rOuter = nodo.radio;
        const rGap = Math.max(1, nodo.radio - 3); 
        const rCore = Math.max(1, nodo.radio - 7); 

        ctx.shadowBlur = (isHovered || isSelected) ? 35 : (nodo.isHexNode ? 30 : (nodo.esConocido ? 5 : 0));
        ctx.shadowColor = esIrrelevantePlayer ? 'transparent' : colorNodoFinal;

        if (nodo.isHexNode) {
            ctx.beginPath(); ctx.arc(nodo.x, nodo.y, rOuter, 0, Math.PI * 2);
            ctx.fillStyle = '#4a0000'; ctx.fill();
        } else {
            ctx.beginPath(); ctx.arc(nodo.x, nodo.y, rOuter, 0, Math.PI * 2);
            ctx.fillStyle = '#111'; ctx.fill();

            ctx.beginPath(); ctx.arc(nodo.x, nodo.y, rGap, 0, Math.PI * 2);
            ctx.fillStyle = '#111'; ctx.fill();

            ctx.beginPath(); ctx.arc(nodo.x, nodo.y, rCore, 0, Math.PI * 2);
            if (esPlenamenteDescubierto) {
                ctx.fillStyle = colorNodoFinal;
                ctx.globalAlpha = 0.9;
                ctx.fill();
                ctx.globalAlpha = 1.0;
            } else if (esAprendibleInmediato) {
                ctx.fillStyle = '#222'; ctx.fill();
                ctx.fillStyle = 'rgba(236, 213, 154, 0.3)'; ctx.fill();
            } else if (esPrecedente) {
                ctx.fillStyle = '#222'; ctx.fill();
                ctx.fillStyle = 'rgba(212, 196, 146, 0.08)'; ctx.fill();
            } else {
                ctx.fillStyle = '#111'; ctx.fill();
                if (!isPlayerView) {
                    ctx.fillStyle = colorAfinidadReal;
                    ctx.globalAlpha = 0.15; ctx.fill(); ctx.globalAlpha = 1.0;
                }
            }
        }
        
        ctx.shadowBlur = 0;
        ctx.lineWidth = ((isHovered || isSelected) ? 4 : 2) / scaleFactor;
        ctx.beginPath(); ctx.arc(nodo.x, nodo.y, rOuter, 0, Math.PI * 2);
        
        if (esPlenamenteDescubierto) {
            ctx.strokeStyle = colorNodoFinal;
            ctx.setLineDash([]);
            ctx.stroke();
        } else if (isPlayerView) {
            ctx.strokeStyle = esIrrelevantePlayer ? 'rgba(80, 80, 80, 0.3)' : colorNodoFinal;
            ctx.setLineDash([]);
            ctx.stroke();
        } else {
            ctx.strokeStyle = colorAfinidadReal;
            ctx.globalAlpha = 0.5;
            ctx.setLineDash([6 / scaleFactor, 4 / scaleFactor]);
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }
        ctx.setLineDash([]); 

// ==========================================
        // 3. TEXTOS
        // ==========================================
        if (camara.zoom > 0.08 || isHovered || isSelected || nodo.isHexNode) {
            let fontSize = nodo.isHexNode ? 52 : (esPlenamenteDescubierto ? 32 : 26);
            if (isHovered || isSelected) fontSize += 8;

            ctx.font = "bold " + fontSize + "px sans-serif";
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            
            const textY = nodo.y + nodo.radio + (15 / scaleFactor);
            ctx.lineWidth = 6 / scaleFactor;
            
            // LÓGICA MÁSTER: Si es Admin, forzamos mostrar el nombre real del hechizo
            const textoADibujar = estadoMapa.esAdmin && !nodo.esConocido && !nodo.isHexNode 
                                  ? `${nodo.nombreOriginal.replace(/\s*\(\d+\)$/, '').trim()} (${nodo.hex})` 
                                  : nodo.nombre;
            
            if (isPlayerView && esIrrelevantePlayer && !nodo.isHexNode) {
                ctx.strokeStyle = 'rgba(0,0,0,0.2)'; 
            } else {
                ctx.strokeStyle = 'rgba(0,0,0,0.95)'; 
            }
            
            ctx.strokeText(textoADibujar, nodo.x, textY);
            
            if (nodo.isHexNode) {
                ctx.fillStyle = '#ffaaaa';
            } else if (isPlayerView) {
                if (tieneElHechizo) ctx.fillStyle = 'rgba(177, 156, 217, 1)'; 
                else if (esAprendibleInmediato) ctx.fillStyle = 'rgba(236, 213, 154, 0.9)'; 
                else if (esPrecedente) ctx.fillStyle = 'rgba(212, 196, 146, 0.4)'; 
                else ctx.fillStyle = 'rgba(100, 100, 100, 0.2)'; 
            } else if (modoVisual === 'descubiertos') {
                ctx.fillStyle = colorAfinidadReal;
            } else if (nodo.esConocido) {
                ctx.fillStyle = (isHovered || isSelected) ? ESTETICA.lineaSaliente : '#fff';
            } else {
                // Si está sellado, pero somos Máster, lo pintamos de gris clarito para diferenciar
                ctx.fillStyle = (isHovered || isSelected) ? '#ddd' : (estadoMapa.esAdmin ? '#e0e0e0' : '#bbb'); 
            }
            
            ctx.fillText(textoADibujar, nodo.x, textY);
        }

export function actualizarPanelInfo() {
    const panel = document.getElementById('panel-info');
    if(!panel) return;
    
    const nodo = estadoMapa.interaccion.selectedNode || estadoMapa.interaccion.hoveredNode;

    if (!nodo) { panel.classList.add('oculto'); return; }

    document.getElementById('info-titulo').innerText = nodo.nombre;
    const colorData = window.mapaColores[nodo.afinidad];
    const colorAfinidad = colorData ? colorData.t : '#888';
    
    if (nodo.esConocido || nodo.isHexNode) {
        document.getElementById('info-titulo').style.color = colorAfinidad;
        document.getElementById('info-tags').innerHTML = 
            '<span class="tag" style="border-color:' + colorAfinidad + '; color:' + colorAfinidad + '">' + nodo.afinidad + '</span>' +
            '<span class="tag">HEX: ' + nodo.hex + '</span>' +
            '<span class="tag">C-' + nodo.clase + '</span>';
        
        document.getElementById('info-desc').innerText = nodo.resumen;
    } else {
        document.getElementById('info-titulo').style.color = colorAfinidad;
        document.getElementById('info-tags').innerHTML = 
            '<span class="tag" style="border-color:' + colorAfinidad + '; color:' + colorAfinidad + '">' + nodo.afinidad + '</span>' +
            '<span class="tag" style="border-color:#555; color:#888;">Requisitos Insuficientes</span>';
        
        document.getElementById('info-desc').innerText = 'El conocimiento de este nodo permanece sellado.';
    }
        
    const efectoEl = document.getElementById('info-efecto');
    const detallesEl = document.getElementById('info-detalles');
    
    if (nodo.esConocido) {
        if (nodo.efecto) {
            efectoEl.innerText = "Efecto: " + nodo.efecto; 
            efectoEl.style.display = 'block';
        } else {
            efectoEl.style.display = 'none';
        }

        if (nodo.overcast || nodo.undercast || nodo.especial) {
            detallesEl.style.display = 'block';
            const bOver = document.getElementById('box-overcast');
            const bUnder = document.getElementById('box-undercast');
            const bEsp = document.getElementById('box-especial');

            if(nodo.overcast) { bOver.style.display = 'block'; document.getElementById('info-overcast').innerText = nodo.overcast; } else { bOver.style.display = 'none'; }
            if(nodo.undercast) { bUnder.style.display = 'block'; document.getElementById('info-undercast').innerText = nodo.undercast; } else { bUnder.style.display = 'none'; }
            if(nodo.especial) { bEsp.style.display = 'block'; document.getElementById('info-especial').innerText = nodo.especial; } else { bEsp.style.display = 'none'; }
        } else {
            detallesEl.style.display = 'none';
        }
    } else { 
        efectoEl.style.display = 'none'; 
        detallesEl.style.display = 'none';
    }

    const opDiv = document.getElementById('info-op');
    if (estadoMapa.esAdmin && !nodo.isHexNode) {
        const safeId = nodo.id.replace(/'/g, "\\'");
        opDiv.innerHTML = `
            <hr style="border-color: #444; margin: 15px 0 10px 0;">
            <label style="color:var(--gold); font-size:0.85em; font-weight:bold; font-family:'Cinzel';">🛠️ ESTADO (MÁSTER):</label>
            <select onchange="window.cambiarEstadoNodo('${safeId}', this.value)" style="width:100%; background:#000; color:#fff; border:1px solid var(--gold); padding:8px; margin-top:5px; cursor:pointer; pointer-events:auto;">
                <option value="si" ${nodo.esConocido ? 'selected' : ''}>👁️ SÍ (Descubierto)</option>
                <option value="no" ${!nodo.esConocido ? 'selected' : ''}>🔒 NO (Sellado)</option>
            </select>
        `;
    } else {
        opDiv.innerHTML = '';
    }

    panel.classList.remove('oculto');
}

export function resetearPosicionPanel() {
    const panel = document.getElementById('panel-info');
    if (panel) { panel.style.top = ''; panel.style.left = ''; panel.style.right = ''; panel.style.bottom = ''; panel.style.transform = ''; }
}

// NUEVO: SISTEMA UNIVERSAL DE ARRASTRE PARA PANELES
function hacerPanelArrastrable(id) {
    const el = document.getElementById(id);
    if(!el) return;
    el.style.cursor = 'grab';
    
    let offsetX = 0, offsetY = 0;

    el.onmousedown = iniciarArrastre;
    el.ontouchstart = iniciarArrastre;

    function iniciarArrastre(e) {
        // Evitar que el arrastre se active al intentar escribir o pulsar botones
        if (e.target.closest('button') || e.target.closest('select') || e.target.closest('summary') || e.target.closest('input') || e.target.closest('textarea')) {
            return; 
        }

        // --- CORRECCIÓN CLAVE PARA RESIZE ---
        // Detectar si el clic es en la esquina inferior derecha (zona de resize)
        let clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        let clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        
        const rect = el.getBoundingClientRect();
        
        // Zona de tolerancia en píxeles para el tirador de resize
        const toleranciaResize = 30; 
        
        const clickEnXDeResize = (clientX - rect.left) > (rect.width - toleranciaResize);
        const clickEnYDeResize = (clientY - rect.top) > (rect.height - toleranciaResize);
        
        if (clickEnXDeResize && clickEnYDeResize) {
            // El usuario está intentando redimensionar. Cancelamos el drag & drop (mover ventana)
            // y dejamos que el navegador actúe nativamente con el resize CSS.
            return; 
        }
        // -------------------------------------

        e = e || window.event;
        if (e.type !== 'touchstart') e.preventDefault(); 
        
        el.style.cursor = 'grabbing'; 
        
        el.style.bottom = "auto";
        el.style.right = "auto";
        el.style.transform = "none";
        
        el.style.left = rect.left + "px";
        el.style.top = rect.top + "px";

        offsetX = clientX - rect.left;
        offsetY = clientY - rect.top;

        document.onmouseup = detenerArrastre;
        document.onmousemove = arrastrar;
        document.ontouchend = detenerArrastre;
        document.ontouchmove = arrastrar;
    }

    function arrastrar(e) {
        e = e || window.event;
        let clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        let clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        
        if (e.type !== 'touchmove') e.preventDefault();
        
        el.style.left = (clientX - offsetX) + "px";
        el.style.top = (clientY - offsetY) + "px";
    }

    function detenerArrastre() {
        el.style.cursor = 'grab'; 
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
    }
}
