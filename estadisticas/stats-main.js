import { statsGlobal, listaEstados, estadoUI, dbExtra } from './stats-state.js';
import { cargarTodoDesdeCSV, procesarTextoCSV, cargarDiccionarioEstados } from './stats-data.js';
import { dibujarCatalogo, dibujarResumenVisual, dibujarDetalle, dibujarMenuOP, dibujarHexOP, dibujarFormularioCrear, dibujarPanelEdicionOP } from './stats-ui.js';
import { generarCSVExportacion, descargarArchivoCSV, calcularVidaRojaMax, getMysticBonus } from './stats-logic.js';

const API_ESTADISTICAS = 'https://script.google.com/macros/s/AKfycbwW4AXM9QSrPYR4vjXPdwSEhV1Q-t9S0exoskZQGoerVRJOsEMzReN1piMWzCfzW_RLmQ/exec';

// Inicialización segura del estado
if (!estadoUI.colaCambios) estadoUI.colaCambios = { stats: {} };
if (!estadoUI.colaCambios.stats) estadoUI.colaCambios.stats = {};
if (!estadoUI.hexLog) estadoUI.hexLog = {};

// ============================================================================
// 1. MOTOR DE RENDERIZADO UNIVERSAL
// ============================================================================
window.sincronizarUI = () => {
    localStorage.setItem('hex_stats_v2', JSON.stringify({ stats: statsGlobal, party: estadoUI.party }));
    window.actualizarBotonSync();

    const scrollVentana = window.scrollY;

    if (estadoUI.vistaActual === 'detalle') {
        const contenedor = document.getElementById('vista-detalle');
        if (contenedor && !contenedor.classList.contains('oculto')) {
            const h = contenedor.getBoundingClientRect().height;
            contenedor.style.minHeight = h + 'px'; 
            dibujarDetalle(); 
            requestAnimationFrame(() => contenedor.style.minHeight = '');
        }
    } else if (estadoUI.vistaActual === 'catalogo') {
        dibujarCatalogo();
    } else if (estadoUI.vistaActual === 'resumen') {
        dibujarResumenVisual();
    } else if (estadoUI.vistaActual === 'hex' || estadoUI.vistaActual === 'crear') {
        const sub = document.getElementById('sub-vista-op');
        if (sub) {
            sub.innerHTML = estadoUI.vistaActual === 'hex' ? dibujarHexOP() : dibujarFormularioCrear();
            if (estadoUI.vistaActual === 'hex') updateHexLogText();
        }
    }

    const modal = document.getElementById('modal-op');
    if (modal && !modal.classList.contains('oculto')) {
        const modalBody = document.getElementById('modal-op-body');
        if (modalBody) {
            const scrollModal = modalBody.scrollTop; 
            modalBody.innerHTML = dibujarPanelEdicionOP();
            modalBody.scrollTop = scrollModal; 
        }
    }

    window.scrollTo(0, scrollVentana);
};

// ============================================================================
// 2. LÓGICA DE ACTUALIZACIÓN DE ESTADÍSTICAS Y VIDAS
// ============================================================================
function recalcularVidas(p, accionMutadora) {
    const calcFisT = () => (p.afinidadesBase.fisica||0) + (p.hechizos.fisica||0) + (p.hechizosEfecto.fisica||0) + (p.buffs.fisica||0);
    const preFisBase = p.afinidadesBase.fisica || 0; 
    const preFis = calcFisT();
    
    const calcMagT = () => ['energetica','espiritual','mando','psiquica'].reduce((acc,k)=>acc+(p.afinidadesBase[k]||0)+(p.hechizos[k]||0)+(p.hechizosEfecto[k]||0)+(p.buffs[k]||0), 0);
    const preMagBase = ['energetica','espiritual','mando','psiquica'].reduce((acc,k)=>acc+(p.afinidadesBase[k]||0), 0); 
    const preMag = calcMagT();

    accionMutadora();

    const postFisBase = p.afinidadesBase.fisica || 0; 
    const postFis = calcFisT();
    const postMagBase = ['energetica','espiritual','mando','psiquica'].reduce((acc,k)=>acc+(p.afinidadesBase[k]||0), 0); 
    const postMag = calcMagT();

    const dbFis = Math.floor(postFisBase/2) - Math.floor(preFisBase/2); 
    if(dbFis!==0) p.baseVidaRojaMax = Math.max(0, (p.baseVidaRojaMax||10) + dbFis);
    
    const dbMag = Math.floor(postMagBase/4) - Math.floor(preMagBase/4); 
    if(dbMag!==0) p.baseVidaAzul = Math.max(0, (p.baseVidaAzul||0) + dbMag);
    
    const dTf = Math.floor(postFis/2) - Math.floor(preFis/2); 
    if(dTf!==0) p.vidaRojaActual = Math.max(0, (p.vidaRojaActual||0) + dTf);
    
    const dTm = Math.floor(postMag/4) - Math.floor(preMag/4); 
    if(dTm!==0) p.vidaAzul = Math.max(0, (p.vidaAzul||0) + dTm);

    const fMax = calcularVidaRojaMax(p); 
    if (p.vidaRojaActual > fMax) p.vidaRojaActual = fMax;
}

window.recalcularBases = () => { 
    const n = estadoUI.personajeSeleccionado; const p = statsGlobal[n]; if(!p) return; 
    if(confirm(`¿Recalcular Corazones Óptimos de ${n.toUpperCase()}?`)) { 
        // Calcula la magia TOTAL (Base + Hechizos + Alterado + Buffs)
        const calcMagT = ['energetica','espiritual','mando','psiquica'].reduce((acc,k)=>acc+(p.afinidadesBase[k]||0)+(p.hechizos[k]||0)+(p.hechizosEfecto[k]||0)+(p.buffs[k]||0), 0);
        
        p.baseVidaRojaMax = 10; 
        p.vidaRojaActual = calcularVidaRojaMax(p); 
        p.baseVidaAzul = Math.floor(calcMagT / 4); // Usa el total para la vida
        p.vidaAzul = p.baseVidaAzul; 
        
        window.encolarCambio(n); 
        window.sincronizarUI(); 
    } 
};

window.modificarBuff = (statId, c) => { const n=estadoUI.personajeSeleccionado; const p=statsGlobal[n]; if(!p)return; recalcularVidas(p, () => p.buffs[statId] = (p.buffs[statId]||0)+c); window.encolarCambio(n); window.sincronizarUI(); };
window.modBaseTop = (statId, c) => { const n=estadoUI.personajeSeleccionado; const p=statsGlobal[n]; if(!p)return; recalcularVidas(p, () => { const prop = `base${statId.charAt(0).toUpperCase() + statId.slice(1)}`; p[prop] = Math.max(0, (p[prop]||0)+c); }); window.encolarCambio(n); window.sincronizarUI(); };
window.modBaseAfin = (statId, c) => { const n=estadoUI.personajeSeleccionado; const p=statsGlobal[n]; if(!p)return; recalcularVidas(p, () => p.afinidadesBase[statId] = Math.max(0, (p.afinidadesBase[statId]||0)+c)); window.encolarCambio(n); window.sincronizarUI(); };
window.modSpellEffTop = (statId, c) => { const n=estadoUI.personajeSeleccionado; const p=statsGlobal[n]; if(!p)return; recalcularVidas(p, () => p.hechizosEfecto[statId] = (p.hechizosEfecto[statId]||0)+c); window.encolarCambio(n); window.sincronizarUI(); };
window.modSpellEffAfin = (statId, c) => { const n=estadoUI.personajeSeleccionado; const p=statsGlobal[n]; if(!p)return; recalcularVidas(p, () => p.hechizosEfecto[statId] = (p.hechizosEfecto[statId]||0)+c); window.encolarCambio(n); window.sincronizarUI(); };
window.modLibre = (statId, c) => { const n=estadoUI.personajeSeleccionado; const p=statsGlobal[n]; if(!p)return; p[statId] = Math.max(0, (p[statId]||0)+c); window.encolarCambio(n); window.sincronizarUI(); };
window.modEstado = (estId, c) => { const n=estadoUI.personajeSeleccionado; const p=statsGlobal[n]; if(!p)return; p.estados[estId] = Math.max(0, (p.estados[estId]||0)+c); window.encolarCambio(n); window.sincronizarUI(); };
window.toggleEstado = (estId) => { const n=estadoUI.personajeSeleccionado; const p=statsGlobal[n]; if(!p)return; p.estados[estId] = !p.estados[estId]; window.encolarCambio(n); window.sincronizarUI(); };
window.toggleIdentidad = (prop) => { const n = estadoUI.personajeSeleccionado; const p = statsGlobal[n]; if(!p) return; p[prop] = !p[prop]; if (prop === 'isPlayer') p.isNPC = !p.isPlayer; window.encolarCambio(n); window.sincronizarUI(); };

// RESTAURADO: FUNCIÓN DE CLONACIÓN
window.ejecutarClonacion = (tipo) => {
    const s = document.getElementById('clon-source'); if(!s) return; const sn = s.value; if(!sn) return alert("Selecciona origen.");
    const tn = estadoUI.personajeSeleccionado; const orig = statsGlobal[sn]; const dest = statsGlobal[tn];
    if(!confirm(`¿Clonar de ${sn} hacia ${tn}?`)) return;
    if (['estados','completo','stats_puros'].includes(tipo)) dest.estados = JSON.parse(JSON.stringify(orig.estados));
    if (['efectosExtras','completo'].includes(tipo)) { dest.buffs = JSON.parse(JSON.stringify(orig.buffs)); dest.hechizosEfecto = JSON.parse(JSON.stringify(orig.hechizosEfecto||{})); }
    if (['hex','completo','stats_puros'].includes(tipo)) dest.hex = orig.hex;
    if (['completo','stats_puros'].includes(tipo)) { 
        dest.vidaRojaActual = orig.vidaRojaActual; dest.baseVidaRojaMax = orig.baseVidaRojaMax; dest.vidaRojaMax = orig.vidaRojaMax;
        dest.vidaAzul = orig.vidaAzul; dest.baseVidaAzul = orig.baseVidaAzul; dest.guardaDorada = orig.guardaDorada; dest.baseGuardaDorada = orig.baseGuardaDorada;
        dest.afinidadesBase = JSON.parse(JSON.stringify(orig.afinidadesBase)); dest.afinidades = JSON.parse(JSON.stringify(orig.afinidades));
        dest.vex = orig.vex; if(tipo==='completo') dest.iconoOverride = orig.iconoOverride || sn;
    }
    window.encolarCambio(tn); 
    window.sincronizarUI(); 
    s.value = ""; 
};

// ============================================================================
// 3. SISTEMA DE HEX Y PARTY 
// ============================================================================
window.modHexInd = (nombre, amount) => { 
    const p = statsGlobal[nombre]; if(!p) return; 
    p.hex = Math.max(0, p.hex + amount); 
    window.addHexLogEntry(nombre, amount, false); 
    window.encolarCambio(nombre); 
    window.sincronizarUI(); 
};

window.modHexGlobal = (amount) => {
    if (!estadoUI.party.some(n => n !== null)) return alert("La Party está vacía.");
    estadoUI.party.forEach(nombre => { 
        if (nombre && statsGlobal[nombre]) { 
            const p = statsGlobal[nombre]; 
            p.hex = Math.max(0, p.hex + amount); 
            window.addHexLogEntry(nombre, amount, false); 
            window.encolarCambio(nombre); 
        } 
    });
    window.sincronizarUI();
};

window.addAsistenciaGlobal = () => {
    if (!estadoUI.party.some(n => n !== null)) return alert("La Party está vacía.");
    let leveledUp = [];
    estadoUI.party.forEach(nombre => {
        if (nombre && statsGlobal[nombre]) {
            const p = statsGlobal[nombre]; 
            p.asistencia = (p.asistencia || 1) + 1;
            if (p.asistencia >= 8) { 
                p.asistencia = 1; p.hex += 1000; 
                window.addHexLogEntry(nombre, 1000, true); leveledUp.push(nombre); 
            } else { 
                window.addHexLogEntry(nombre, 0, false); 
            }
            window.encolarCambio(nombre);
        }
    });
    if (leveledUp.length > 0) alert(`¡ASISTENCIA MÁXIMA!\n${leveledUp.join(', ')} regresan a Asistencia 1 y ganan +1000 HEX.`);
    window.sincronizarUI();
};

window.togglePartyMember = (nombre, isChecked) => {
    if (isChecked) { const e = estadoUI.party.indexOf(null); if (e !== -1) estadoUI.party[e] = nombre; else alert("Máximo de 6 alcanzado."); } 
    else { const c = estadoUI.party.indexOf(nombre); if (c !== -1) estadoUI.party[c] = null; }
    window.sincronizarUI();
};
window.vaciarParty = () => { estadoUI.party = [null, null, null, null, null, null]; window.sincronizarUI(); };
window.establecerPartyActiva = () => {
    if (!estadoUI.party.some(n => n !== null)) return alert("La Party está vacía.");
    if(!confirm("¿Marcar a esta Party como los únicos Activos/Jugadores?")) return;
    Object.keys(statsGlobal).forEach(n => { if (statsGlobal[n].isPlayer) { statsGlobal[n].isActive = false; window.encolarCambio(n); } });
    estadoUI.party.forEach(n => { if (n && statsGlobal[n]) { statsGlobal[n].isPlayer = true; statsGlobal[n].isNPC = false; statsGlobal[n].isActive = true; window.encolarCambio(n); } });
    alert("Party actualizada exitosamente.");
    window.sincronizarUI(); 
};

function updateHexLogText() {
    const textarea = document.getElementById('hex-log-textarea');
    if (!textarea) return; 
    let finalOutput = "";
    Object.keys(estadoUI.hexLog).sort().forEach(char => {
        const log = estadoUI.hexLog[char];
        const p = statsGlobal[char];
        if (!p) return;
        const asisStr = p.isPlayer ? ` (${p.asistencia || 1}/7)` : "";
        log.order.forEach(actionType => {
            if (actionType === 'pos' && log.pos.amount >= 0) finalOutput += `${char} +${log.pos.amount} Hex (${log.pos.finalHex})${asisStr}\n`;
            else if (actionType === 'neg' && log.neg.amount > 0) finalOutput += `${char} -${log.neg.amount} Hex (${log.neg.finalHex})${asisStr}\n`;
            else if (actionType === 'extra' && log.extra.amount > 0) finalOutput += `${char} +${log.extra.amount} Hex ¡EXTRA! (${log.extra.finalHex})${asisStr}\n`;
        });
    });
    textarea.value = finalOutput;
    textarea.scrollTop = textarea.scrollHeight; 
}

window.addHexLogEntry = (nombre, amount, isExtra = false) => {
    const p = statsGlobal[nombre]; if (!p) return;
    if (!estadoUI.hexLog[nombre]) estadoUI.hexLog[nombre] = { pos: { amount: 0, finalHex: 0 }, neg: { amount: 0, finalHex: 0 }, extra: { amount: 0, finalHex: 0 }, order: [] };
    const log = estadoUI.hexLog[nombre];

    if (isExtra) { log.extra.amount += amount; log.extra.finalHex = p.hex; log.order = log.order.filter(k => k !== 'extra'); log.order.push('extra'); } 
    else if (amount > 0) { log.pos.amount += amount; log.pos.finalHex = p.hex; log.order = log.order.filter(k => k !== 'pos'); log.order.push('pos'); } 
    else if (amount < 0) { log.neg.amount += Math.abs(amount); log.neg.finalHex = p.hex; log.order = log.order.filter(k => k !== 'neg'); log.order.push('neg'); } 
    else if (amount === 0) { if (log.order.length === 0) { log.pos.amount = 0; log.pos.finalHex = p.hex; log.order.push('pos'); } }
};

window.limpiarHexLog = () => { estadoUI.hexLog = {}; updateHexLogText(); };


// ============================================================================
// 4. FLUJO DE VENTANAS Y MODALES
// ============================================================================
window.abrirModalOP = () => {
    const modal = document.getElementById('modal-op');
    const headerText = document.getElementById('modal-header-title');
    if (modal) {
        if(headerText) headerText.innerText = `🛠️ MÁSTER: ${estadoUI.personajeSeleccionado.toUpperCase()}`;
        modal.classList.remove('oculto');
        const content = document.getElementById('hex-modal-content');
        content.style.left = ''; content.style.top = '';
        content.style.position = 'relative'; content.style.transform = 'none';
        window.sincronizarUI(); 
    }
};

window.cerrarModalOP = () => {
    const modal = document.getElementById('modal-op');
    if (modal) modal.classList.add('oculto');
};

function refrescarVistas() {
    ['vista-catalogo', 'vista-resumen', 'vista-detalle', 'vista-op'].forEach(id => document.getElementById(id).classList.add('oculto'));
    window.cerrarModalOP(); 

    if (estadoUI.vistaActual === 'catalogo') document.getElementById('vista-catalogo').classList.remove('oculto');
    else if (estadoUI.vistaActual === 'resumen') document.getElementById('vista-resumen').classList.remove('oculto');
    else if (estadoUI.vistaActual === 'detalle') document.getElementById('vista-detalle').classList.remove('oculto');
    else { 
        const op = document.getElementById('vista-op');
        op.classList.remove('oculto'); 
        op.innerHTML = dibujarMenuOP();
    }
    window.sincronizarUI();
}

window.mostrarCatalogo = () => { estadoUI.vistaActual = 'catalogo'; refrescarVistas(); window.scrollTo(0,0); };
window.mostrarResumen = () => { estadoUI.vistaActual = 'resumen'; refrescarVistas(); window.scrollTo(0,0); };
window.abrirDetalle = (nombre) => { estadoUI.personajeSeleccionado = nombre; estadoUI.vistaActual = 'detalle'; refrescarVistas(); window.scrollTo(0,0); };

window.abrirMenuOP = () => { 
    if (estadoUI.esAdmin) { 
        // Si ya es admin y le da clic desde detalle, que se quede en detalle.
        if (estadoUI.vistaActual !== 'detalle') {
            estadoUI.vistaActual = 'hex';
        }
        refrescarVistas(); 
        return; 
    }
    const pass = prompt("Acceso Restringido MÁSTER. Contraseña:");
    if (pass === atob('Y2FuZXk=')) { 
        estadoUI.esAdmin = true; 
        if (estadoUI.vistaActual !== 'detalle') {
            estadoUI.vistaActual = 'hex'; 
        }
        refrescarVistas(); 
    } 
};

window.mostrarPaginaOP = (subvista) => { estadoUI.vistaActual = subvista; refrescarVistas(); };
window.setFiltro = (tipo, valor) => { if(tipo === 'rol') estadoUI.filtroRol = valor; if(tipo === 'act') estadoUI.filtroAct = valor; window.sincronizarUI(); };

// ============================================================================
// 5. SINCRONIZACIÓN CON EL SERVIDOR (API)
// ============================================================================
window.encolarCambio = (nombre) => {
    try {
        if (!estadoUI.colaCambios.stats[nombre]) estadoUI.colaCambios.stats[nombre] = {};
        const p = statsGlobal[nombre];
        const fStr = (b, s, se, bf) => `${(b||0)+(s||0)+(se||0)+(bf||0)}_${b||0}_${s||0}_${se||0}_${bf||0}`;
        
        const s = estadoUI.colaCambios.stats[nombre];
        s['Hex'] = `${p.hex||0}_${p.asistencia||1}`;
        s['Vex'] = p.isPlayer ? 0 : (p.vex || 0);
        
        ['fisica', 'energetica', 'espiritual', 'mando', 'psiquica', 'oscura'].forEach(af => {
            s[af.charAt(0).toUpperCase() + af.slice(1)] = fStr(p.afinidadesBase[af], p.hechizos[af], p.hechizosEfecto[af], p.buffs[af]);
        });
        
        s['Corazones Rojo'] = p.vidaRojaActual || 0;
        s['Corazones Rojos Max'] = fStr(p.baseVidaRojaMax, p.hechizos.vidaRojaMaxExtra, p.hechizosEfecto.vidaRojaMaxExtra, p.buffs.vidaRojaMaxExtra);
        s['Corazones Azules'] = fStr(p.baseVidaAzul, p.hechizos.vidaAzulExtra, p.hechizosEfecto.vidaAzulExtra, p.buffs.vidaAzulExtra);
        s['Guarda Dorada'] = fStr(p.baseGuardaDorada, p.hechizos.guardaDoradaExtra, p.hechizosEfecto.guardaDoradaExtra, p.buffs.guardaDoradaExtra);
        
        s['Daño Rojo'] = fStr(p.baseDanoRojo, p.hechizos.danoRojo, p.hechizosEfecto.danoRojo, p.buffs.danoRojo);
        s['Daño Azul'] = fStr(p.baseDanoAzul, p.hechizos.danoAzul, p.hechizosEfecto.danoAzul, p.buffs.danoAzul);
        s['Eliminacion Dorada'] = fStr(p.baseElimDorada, p.hechizos.elimDorada, p.hechizosEfecto.elimDorada, p.buffs.elimDorada);
        
        s['Estado'] = listaEstados.map(e => e.tipo === 'booleano' ? (p.estados[e.id] ? '1' : '0') : (p.estados[e.id] || '0')).join('-');
        s['Jugador_Activo'] = `${p.isPlayer ? 1 : 0}_${p.isActive ? 1 : 0}`;
    } catch(e) { console.error("Error al encolar:", e); }
};

window.actualizarBotonSync = () => {
    const btn = document.getElementById('btn-sync-global'); if (!btn) return;
    const statsChanges = Object.keys(estadoUI.colaCambios.stats || {}).length;
    if (statsChanges > 0) {
        btn.classList.remove('oculto');
        btn.innerText = `🔥 GUARDAR CAMBIOS AL SERVIDOR (${statsChanges}) 🔥`;
    } else {
        btn.classList.add('oculto');
    }
};

window.ejecutarSincronizacion = async () => {
    const btn = document.getElementById('btn-sync-global'); btn.innerText = "Sincronizando..."; btn.disabled = true;
    try {
        const payload = { accion: 'sincronizar_stats', stats: estadoUI.colaCambios.stats };
        const res = await fetch(API_ESTADISTICAS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
        const data = await res.json();
        
        if (data.status === 'success') {
            estadoUI.colaCambios.stats = {};
            const alertBox = document.createElement('div');
            alertBox.innerHTML = "¡Guardado Exitoso! ✅";
            alertBox.style.cssText = "position:fixed; top:30px; left:50%; transform:translateX(-50%); background:var(--gold); color:#000; padding:15px 40px; border-radius:8px; font-weight:bold; font-size:1.2em; z-index:99999; box-shadow:0 0 20px var(--gold);";
            document.body.appendChild(alertBox);
            setTimeout(() => { window.location.reload(); }, 1200);
        } else {
            alert("Error: " + data.message); btn.disabled = false; window.sincronizarUI();
        }
    } catch(e) { alert("Error de conexión al servidor."); btn.disabled = false; window.sincronizarUI(); }
};

// ============================================================================
// 6. UTILIDADES VARIAS Y DRAG & DROP
// ============================================================================
window.copySilently = (texto, event) => {
    try {
        if(event) { event.preventDefault(); event.stopPropagation(); }
        navigator.clipboard.writeText(texto);
        const tooltip = document.createElement('div');
        tooltip.innerText = "✨ Copiado!";
        tooltip.className = 'floating-tooltip';
        tooltip.style.left = event.pageX + 'px';
        tooltip.style.top = (event.pageY - 20) + 'px';
        document.body.appendChild(tooltip);
        setTimeout(() => tooltip.remove(), 600);
    } catch (e) { console.log("Fallo al copiar.", e); }
};

const dragHeader = document.getElementById('modal-drag-header');
const modalContent = document.getElementById('hex-modal-content');
let isDragging = false, startX, startY, initialX, initialY;

if (dragHeader && modalContent) {
    dragHeader.onmousedown = (e) => {
        isDragging = true; startX = e.clientX; startY = e.clientY;
        const rect = modalContent.getBoundingClientRect();
        modalContent.style.position = 'absolute'; modalContent.style.left = rect.left + 'px'; modalContent.style.top = rect.top + 'px'; modalContent.style.transform = 'none'; modalContent.style.margin = '0';
        initialX = rect.left; initialY = rect.top; e.preventDefault(); 
    };
    window.onmousemove = (e) => { if (!isDragging) return; modalContent.style.left = (initialX + (e.clientX - startX)) + 'px'; modalContent.style.top = (initialY + (e.clientY - startY)) + 'px'; };
    window.onmouseup = () => { isDragging = false; };
}

window.descargarAumentada = () => { descargarArchivoCSV(generarCSVExportacion(), "HEX_ESTADOS_AUMENTADO.csv"); };

// ============================================================================
// 7. INICIO Y CARGA DE DATOS
// ============================================================================
async function iniciar() {
    try {
        if (performance.getEntriesByType("navigation")[0]?.type === "reload") localStorage.removeItem('hex_stats_v2');
        const loader = document.getElementById('loader'); const barra = document.getElementById('carga-progreso');

        await cargarDiccionarioEstados(); 
        const cache = localStorage.getItem('hex_stats_v2'); 
        if (!cache) { 
            await cargarTodoDesdeCSV(barra); 
        } else { 
            const parsed = JSON.parse(cache); 
            Object.assign(statsGlobal, parsed.stats); 
            if(parsed.party) estadoUI.party = parsed.party;
            cargarTodoDesdeCSV(barra); 
        }
        
        if (loader) setTimeout(() => loader.classList.add('oculto'), 500); 

        const target = new URLSearchParams(window.location.search).get('pj') || decodeURIComponent(window.location.hash.replace('#detalle-', '').replace('#inventario-', '').replace(/_/g, ' '));
        if (target) {
            const exactMatch = Object.keys(statsGlobal).find(k => k.toLowerCase() === target.toLowerCase());
            if (exactMatch) { estadoUI.personajeSeleccionado = exactMatch; estadoUI.vistaActual = 'detalle'; }
        }
    } catch (error) { console.error("Error crítico:", error); } 
    finally { refrescarVistas(); }
}

window.toggleCrearRol = () => { const btn = document.getElementById('btn-crear-rol'); if (btn.dataset.val === 'npc') { btn.dataset.val = 'jugador'; btn.innerText = '🎭 ROL: JUGADOR'; btn.style.background = '#003300'; btn.style.borderColor = '#00e676'; } else { btn.dataset.val = 'npc'; btn.innerText = '🎭 ROL: NPC'; btn.style.background = '#330000'; btn.style.borderColor = '#ff1744'; } };
window.toggleCrearAct = () => { const btn = document.getElementById('btn-crear-act'); if (btn.dataset.val === 'activo') { btn.dataset.val = 'inactivo'; btn.innerText = '🌟 ESTADO: INACTIVO'; btn.style.background = '#330000'; btn.style.borderColor = '#ff1744'; } else { btn.dataset.val = 'activo'; btn.innerText = '🌟 ESTADO: ACTIVO'; btn.style.background = '#003300'; btn.style.borderColor = '#00e676'; } };
window.updateCreationAfinitySum = () => { const s = ['fis','ene','esp','man','psi','osc'].reduce((acc,id)=>acc+(parseInt(document.getElementById('npc-'+id)?.value)||0),0); const d = document.getElementById('creation-affinity-sum-display'); if(d) d.innerText = `Total Afinidades: ${s}`; };

window.modForm = (inputId, cantidad) => {
    const input = document.getElementById(inputId);
    if(input) {
        input.value = Math.max(0, (parseInt(input.value)||0) + cantidad);
        if(inputId.startsWith('npc-fis') || inputId.startsWith('npc-ene') || inputId.startsWith('npc-esp') || inputId.startsWith('npc-man') || inputId.startsWith('npc-psi') || inputId.startsWith('npc-osc')) {
            window.updateCreationAfinitySum();
        }
    }
};

window.ejecutarCreacionNPC = () => {
    const nombre = document.getElementById('npc-nombre').value.trim(); if(!nombre) return alert("Falta nombre.");
    if(statsGlobal[nombre]) return alert("Ya existe un personaje con ese nombre.");
    const pV = (id) => parseInt(document.getElementById(id).value)||0;
    let stInit = {}; listaEstados.forEach(e => { stInit[e.id] = (e.tipo === 'numero') ? 0 : false; });
    statsGlobal[nombre] = {
        isPlayer: document.getElementById('btn-crear-rol').dataset.val === 'jugador', isNPC: document.getElementById('btn-crear-rol').dataset.val === 'npc', isActive: document.getElementById('btn-crear-act').dataset.val === 'activo', 
        hex: pV('npc-hex'), asistencia: 1, vex: pV('npc-vex'), vidaRojaActual: pV('npc-vra'), vidaRojaMax: pV('npc-vrm'), baseVidaRojaMax: pV('npc-vrm'),
        vidaAzul: pV('npc-va'), baseVidaAzul: pV('npc-va'), guardaDorada: pV('npc-gd'), baseGuardaDorada: pV('npc-gd'), 
        danoRojo: pV('npc-dr'), baseDanoRojo: pV('npc-dr'), danoAzul: pV('npc-da'), baseDanoAzul: pV('npc-da'), elimDorada: pV('npc-ed'), baseElimDorada: pV('npc-ed'),
        afinidades: { fisica:pV('npc-fis'), energetica:pV('npc-ene'), espiritual:pV('npc-esp'), mando:pV('npc-man'), psiquica:pV('npc-psi'), oscura:pV('npc-osc') },
        afinidadesBase: { fisica:pV('npc-fis'), energetica:pV('npc-ene'), espiritual:pV('npc-esp'), mando:pV('npc-man'), psiquica:pV('npc-psi'), oscura:pV('npc-osc') },
        hechizos: { fisica:0, energetica:0, espiritual:0, mando:0, psiquica:0, oscura:0, danoRojo:0, danoAzul:0, elimDorada:0, vidaRojaMaxExtra:0, vidaAzulExtra:0, guardaDoradaExtra:0 },
        hechizosEfecto: { fisica:0, energetica:0, espiritual:0, mando:0, psiquica:0, oscura:0, danoRojo:0, danoAzul:0, elimDorada:0, vidaRojaMaxExtra:0, vidaAzulExtra:0, guardaDoradaExtra:0 },
        buffs: { fisica:0, energetica:0, espiritual:0, mando:0, psiquica:0, oscura:0, danoRojo:0, danoAzul:0, elimDorada:0, vidaRojaMaxExtra:0, vidaAzulExtra:0, guardaDoradaExtra:0 },
        estados: stInit, iconoOverride: ""
    };
    window.encolarCambio(nombre); 
    estadoUI.personajeSeleccionado = nombre; 
    estadoUI.vistaActual = 'detalle'; 
    window.sincronizarUI(); 
};

// --- NUEVA FUNCIÓN: BORRAR PERSONAJE DESDE EL CATÁLOGO ---
window.borrarPersonaje = (nombre, event) => {
    event.stopPropagation(); // Evita que se abra la ficha al clickear la X
    if(confirm(`⚠️ ESTÁS A PUNTO DE BORRAR A ${nombre.toUpperCase()}.\n\nEl personaje desaparecerá de tu pantalla y se pondrá en la cola de cambios.\n\nNota: Deberás hacer clic en "Guardar Cambios al Servidor" para que la eliminación sea definitiva en la base de datos.`)) {
        if (!estadoUI.colaCambios.stats) estadoUI.colaCambios.stats = {};
        
        // Agregamos una bandera secreta para que Apps Script sepa que debe borrar la fila
        estadoUI.colaCambios.stats[nombre] = { __ELIMINAR_PERSONAJE__: true }; 
        
        delete statsGlobal[nombre]; // Lo borramos localmente
        
        // Si estaba en la party, lo sacamos
        const pIdx = estadoUI.party.indexOf(nombre);
        if(pIdx !== -1) estadoUI.party[pIdx] = null;
        
        window.sincronizarUI();
    }
};

iniciar();



