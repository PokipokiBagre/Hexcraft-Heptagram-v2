import { statsGlobal, listaEstados, estadoUI, dbExtra } from './stats-state.js';
import { cargarTodoDesdeCSV, procesarTextoCSV, cargarDiccionarioEstados } from './stats-data.js';
import { dibujarCatalogo, dibujarResumenVisual, dibujarDetalle, dibujarMenuOP, dibujarHexOP, dibujarFormularioCrear, dibujarPanelEdicionOP } from './stats-ui.js';
import { generarCSVExportacion, descargarArchivoCSV, calcularVidaRojaMax, getMysticBonus, esNPCSistema } from './stats-logic.js';
import { hexAuth, supabase } from '../hex-auth.js';
import { db } from '../hex-db.js';
import { currentConfig } from '../hex-auth.js';

// ============================================================
// stats-main.js — VERSIÓN SUPABASE (ESTABILIDAD MÁXIMA)
// ============================================================

if (!estadoUI.colaCambios) estadoUI.colaCambios = { stats: {} };
if (!estadoUI.colaCambios.stats) estadoUI.colaCambios.stats = {};
if (!estadoUI.hexLog) estadoUI.hexLog = {};

// ============================================================================
// 1. MOTOR DE RENDERIZADO UNIVERSAL
// ============================================================================
window.sincronizarUI = () => {
    // 🌟 BLINDAJE: Solo guardamos la party, NO los stats (esos vienen frescos de la DB).
    // Y le ponemos el ID de la campaña actual para que nunca se crucen.
    localStorage.setItem(`hex_party_${currentConfig.id}`, JSON.stringify(estadoUI.party));
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

    const _badge = document.getElementById('hex-session-badge');
    if (_badge) {
        if (hexAuth.esAdmin()) {
            _badge.innerHTML = `<span style="background:#4a004a; color:#d4af37; border:1px dashed #d4af37; padding:8px 14px; border-radius:4px; font-weight:bold; font-family:'Cinzel'; cursor:pointer; font-size:0.85em;" onclick="window.abrirMenuOP()">⚙️ MÁSTER</span>`;
        } else {
            _badge.innerHTML = hexAuth.renderStatusBadge();
        }
    }

    // Restaurar el scroll donde estaba el usuario
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
        const fisBase = p.afinidadesBase?.fisica || 0;
        p.baseVidaRojaMax = 10 + Math.floor(fisBase / 2);
        p.vidaRojaActual = calcularVidaRojaMax(p); 
        const magBase = (p.afinidadesBase?.energetica||0) + (p.afinidadesBase?.espiritual||0) + (p.afinidadesBase?.mando||0) + (p.afinidadesBase?.psiquica||0);
        p.baseVidaAzul = Math.floor(magBase / 4);
        p.vidaAzul = p.baseVidaAzul; 
        window.encolarCambio(n); window.sincronizarUI();
    }
};

window.modificarBuff       = (s,c) => { const n=estadoUI.personajeSeleccionado; const p=statsGlobal[n]; if(!p)return; recalcularVidas(p,()=>p.buffs[s]=(p.buffs[s]||0)+c); window.encolarCambio(n); window.sincronizarUI(); };
window.modBaseTop          = (s,c) => { const n=estadoUI.personajeSeleccionado; const p=statsGlobal[n]; if(!p)return; recalcularVidas(p,()=>{ const pr=`base${s.charAt(0).toUpperCase()+s.slice(1)}`; p[pr]=Math.max(0,(p[pr]||0)+c); }); window.encolarCambio(n); window.sincronizarUI(); };
window.modBaseAfin         = (s,c) => { const n=estadoUI.personajeSeleccionado; const p=statsGlobal[n]; if(!p)return; recalcularVidas(p,()=>p.afinidadesBase[s]=Math.max(0,(p.afinidadesBase[s]||0)+c)); window.encolarCambio(n); window.sincronizarUI(); };
window.modSpellEffTop      = (s,c) => { const n=estadoUI.personajeSeleccionado; const p=statsGlobal[n]; if(!p)return; recalcularVidas(p,()=>p.hechizosEfecto[s]=(p.hechizosEfecto[s]||0)+c); window.encolarCambio(n); window.sincronizarUI(); };
window.modSpellEffAfin     = (s,c) => { const n=estadoUI.personajeSeleccionado; const p=statsGlobal[n]; if(!p)return; recalcularVidas(p,()=>p.hechizosEfecto[s]=(p.hechizosEfecto[s]||0)+c); window.encolarCambio(n); window.sincronizarUI(); };
window.modLibre            = (s,c) => { const n=estadoUI.personajeSeleccionado; const p=statsGlobal[n]; if(!p)return; p[s]=Math.max(0,(p[s]||0)+c); window.encolarCambio(n); window.sincronizarUI(); };
window.modEstado           = (s,c) => { const n=estadoUI.personajeSeleccionado; const p=statsGlobal[n]; if(!p)return; p.estados[s]=Math.max(0,(p.estados[s]||0)+c); window.encolarCambio(n); window.sincronizarUI(); };
window.toggleEstado        = (s)   => { const n=estadoUI.personajeSeleccionado; const p=statsGlobal[n]; if(!p)return; p.estados[s]=!p.estados[s]; window.encolarCambio(n); window.sincronizarUI(); };
window.toggleIdentidad     = (pr)  => { const n=estadoUI.personajeSeleccionado; const p=statsGlobal[n]; if(!p)return; p[pr]=!p[pr]; if(pr==='isPlayer') p.isNPC=!p.isPlayer; window.encolarCambio(n); window.sincronizarUI(); };

// ── NPC tipo: sistema ↔ jugador ──────────────────────────────────────────────
window.toggleNpcTipo = (nombre) => {
    const p = statsGlobal[nombre]; if (!p || p.isPlayer) return;
    const nuevo = esNPCSistema(p) ? 'jugador' : 'sistema';
    if (!confirm(`¿Cambiar tipo de NPC de "${p.npc_tipo || 'sistema'}" a "${nuevo}"?\n\n${nuevo === 'jugador' ? 'El VEX pasará a calcularse desde la Afinidad Oscura.' : 'El VEX pasará a ser un valor absoluto editable.'}`)) return;
    p.npc_tipo = nuevo;
    window.encolarCambio(nombre); window.sincronizarUI();
};

// ── VEX directo para NPC sistema ────────────────────────────────────────────
window.modVexSistema = (nombre, delta) => {
    const p = statsGlobal[nombre]; if (!p) return;
    p.vex = Math.max(0, (p.vex || 0) + delta);
    window.encolarCambio(nombre); window.sincronizarUI();
};

window.setVexFijoSistema = (nombre) => {
    const input = document.getElementById('vex-fijo-input');
    const val = parseInt(input?.value);
    if (isNaN(val) || val < 0) return alert('Ingresa un número válido.');
    const p = statsGlobal[nombre]; if (!p) return;
    p.vex = val;
    window.encolarCambio(nombre); window.sincronizarUI();
};

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
    window.encolarCambio(tn); window.sincronizarUI(); s.value = "";
};

// ============================================================================
// 3. SISTEMA DE HEX Y PARTY
// ============================================================================
window.modHexInd = (nombre, amount) => {
    const p = statsGlobal[nombre]; if(!p) return;
    p.hex = Math.max(0, p.hex + amount);
    window.addHexLogEntry(nombre, amount, false);
    window.encolarCambio(nombre); window.sincronizarUI();
};

window.modHexGlobal = (amount) => {
    if (!estadoUI.party.some(n => n !== null)) return alert("La Party está vacía.");
    estadoUI.party.forEach(nombre => {
        if (nombre && statsGlobal[nombre]) {
            statsGlobal[nombre].hex = Math.max(0, statsGlobal[nombre].hex + amount);
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

window.modAsistenciaInd = (nombre, amount) => {
    const p = statsGlobal[nombre]; 
    if(!p || !p.isPlayer) return;
    p.asistencia = Math.max(1, (p.asistencia || 1) + amount);
    window.encolarCambio(nombre);
    window.sincronizarUI();
};

window.togglePartyMember = (nombre, isChecked) => {
    if (isChecked) {
        if (!estadoUI.esAdmin && statsGlobal[nombre]?.isPlayer) {
            return alert("Solo puedes añadir NPCs a la party en modo público.");
        }
        const e = estadoUI.party.indexOf(null);
        if (e !== -1) estadoUI.party[e] = nombre;
        else alert("Máximo de 6 alcanzado.");
    } else {
        const c = estadoUI.party.indexOf(nombre);
        if (c !== -1) estadoUI.party[c] = null;
    }
    window.sincronizarUI();
};

window.vaciarParty = () => { estadoUI.party = [null,null,null,null,null,null]; window.sincronizarUI(); };

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
    if (isExtra) { log.extra.amount += amount; log.extra.finalHex = p.hex; log.order = log.order.filter(k=>k!=='extra'); log.order.push('extra'); }
    else if (amount > 0) { log.pos.amount += amount; log.pos.finalHex = p.hex; log.order = log.order.filter(k=>k!=='pos'); log.order.push('pos'); }
    else if (amount < 0) { log.neg.amount += Math.abs(amount); log.neg.finalHex = p.hex; log.order = log.order.filter(k=>k!=='neg'); log.order.push('neg'); }
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
window.mostrarResumen  = () => { estadoUI.vistaActual = 'resumen';  refrescarVistas(); window.scrollTo(0,0); };
window.abrirDetalle    = (nombre) => { estadoUI.personajeSeleccionado = nombre; estadoUI.vistaActual = 'detalle'; refrescarVistas(); window.scrollTo(0,0); };

window.abrirMenuOP = () => {
    if (estadoUI.esAdmin) {
        if (estadoUI.vistaActual !== 'detalle') estadoUI.vistaActual = 'hex';
        refrescarVistas();
    }
};

window.abrirGestion = () => {
    estadoUI.vistaActual = 'hex';
    refrescarVistas();
};

window.mostrarPaginaOP = (subvista) => { estadoUI.vistaActual = subvista; refrescarVistas(); };
window.setFiltro = (tipo, valor) => { if(tipo==='rol') estadoUI.filtroRol=valor; if(tipo==='act') estadoUI.filtroAct=valor; window.sincronizarUI(); };

// ============================================================================
// 5. SINCRONIZACIÓN CON SUPABASE
// ============================================================================
window.encolarCambio = (nombre) => {
    try {
        if (!estadoUI.colaCambios.stats[nombre]) estadoUI.colaCambios.stats[nombre] = {};
        estadoUI.colaCambios.stats[nombre].__modificado = true;
    } catch(e) { console.error("Error al encolar:", e); }
};

window.actualizarBotonSync = () => {
    const btn = document.getElementById('btn-sync-global'); if (!btn) return;
    const count = Object.keys(estadoUI.colaCambios.stats || {}).length;
    if (count > 0) {
        btn.classList.remove('oculto');
        btn.innerText = `🔥 GUARDAR CAMBIOS AL SERVIDOR (${count}) 🔥`;
    } else {
        btn.classList.add('oculto');
    }
};

window.ejecutarSincronizacion = async () => {
    const btn = document.getElementById('btn-sync-global');
    const textoOriginal = btn.innerText; 
    btn.innerText = "Guardando Datos..."; 
    btn.disabled = true;
    let erroresGlobales = [];

    try {
        for (const [nombre, campos] of Object.entries(estadoUI.colaCambios.stats)) {
            if (!estadoUI.esAdmin && statsGlobal[nombre]?.isPlayer) {
                console.warn(`Acceso bloqueado: no se puede guardar al jugador "${nombre}" en modo público.`);
                continue;
            }

            if (campos.__ELIMINAR_PERSONAJE__) {
                const exito = await db.personajes.eliminar(nombre);
                if (!exito) erroresGlobales.push(`Error borrando a: ${nombre}`);
                continue;
            }

            const p = statsGlobal[nombre];
            if (!p) continue;

            const hz  = p.hechizos       || {};
            const ef  = p.hechizosEfecto || {};
            const bf  = p.buffs          || {};
            const afB = p.afinidadesBase || {};

            const payloadSeguro = {
                hex:        parseInt(p.hex)        || 0,
                asistencia: parseInt(p.asistencia) || 1,
                vex:        p.isPlayer ? 0 : (parseInt(p.vex) || 0),
                is_active:  p.isActive  ?? true,
                is_player:  p.isPlayer  ?? false,
                npc_tipo:   p.isPlayer ? null : (p.npc_tipo || 'sistema'),
                icono_override: p.iconoOverride || '',

                vida_roja_actual:   parseInt(p.vidaRojaActual)   || 0,
                base_vida_roja_max: parseInt(p.baseVidaRojaMax)  || 10,
                base_vida_azul:     parseInt(p.baseVidaAzul)     || 0,
                base_guarda_dorada: parseInt(p.baseGuardaDorada) || 0,

                base_dano_rojo:   parseInt(p.baseDanoRojo)   || 0,
                base_dano_azul:   parseInt(p.baseDanoAzul)   || 0,
                base_elim_dorada: parseInt(p.baseElimDorada) || 0,

                af_fisica:     parseInt(afB.fisica)     || 0,
                af_energetica: parseInt(afB.energetica) || 0,
                af_espiritual: parseInt(afB.espiritual) || 0,
                af_mando:      parseInt(afB.mando)      || 0,
                af_psiquica:   parseInt(afB.psiquica)   || 0,
                af_oscura:     parseInt(afB.oscura)     || 0,

                hz_fisica:     parseInt(hz.fisica)     || 0,
                hz_energetica: parseInt(hz.energetica) || 0,
                hz_espiritual: parseInt(hz.espiritual) || 0,
                hz_mando:      parseInt(hz.mando)      || 0,
                hz_psiquica:   parseInt(hz.psiquica)   || 0,
                hz_oscura:     parseInt(hz.oscura)     || 0,
                
                hechizo_vida_roja:  parseInt(hz.vidaRojaMaxExtra)  || 0,
                hechizo_vida_azul:  parseInt(hz.vidaAzulExtra)     || 0,
                hechizo_guarda:     parseInt(hz.guardaDoradaExtra) || 0,
                hechizo_dano_rojo:  parseInt(hz.danoRojo)          || 0,
                hechizo_dano_azul:  parseInt(hz.danoAzul)          || 0,
                hechizo_elim:       parseInt(hz.elimDorada)        || 0,

                ef_fisica:     parseInt(ef.fisica)     || 0,
                ef_energetica: parseInt(ef.energetica) || 0,
                ef_espiritual: parseInt(ef.espiritual) || 0,
                ef_mando:      parseInt(ef.mando)      || 0,
                ef_psiquica:   parseInt(ef.psiquica)   || 0,
                ef_oscura:     parseInt(ef.oscura)     || 0,
                
                efecto_vida_roja:  parseInt(ef.vidaRojaMaxExtra)  || 0,
                efecto_vida_azul:  parseInt(ef.vidaAzulExtra)     || 0,
                efecto_guarda:     parseInt(ef.guardaDoradaExtra) || 0,
                efecto_dano_rojo:  parseInt(ef.danoRojo)          || 0,
                efecto_dano_azul:  parseInt(ef.danoAzul)          || 0,
                efecto_elim:       parseInt(ef.elimDorada)        || 0,

                bf_fisica:     parseInt(bf.fisica)     || 0,
                bf_energetica: parseInt(bf.energetica) || 0,
                bf_espiritual: parseInt(bf.espiritual) || 0,
                bf_mando:      parseInt(bf.mando)      || 0,
                bf_psiquica:   parseInt(bf.psiquica)   || 0,
                bf_oscura:     parseInt(bf.oscura)     || 0,
                
                buff_vida_roja:  parseInt(bf.vidaRojaMaxExtra)  || 0,
                buff_vida_azul:  parseInt(bf.vidaAzulExtra)     || 0,
                buff_guarda:     parseInt(bf.guardaDoradaExtra) || 0,
                buff_dano_rojo:  parseInt(bf.danoRojo)          || 0,
                buff_dano_azul:  parseInt(bf.danoAzul)          || 0,
                buff_elim:       parseInt(bf.elimDorada)        || 0,

                estados: p.estados ? JSON.parse(JSON.stringify(p.estados)) : {}
            };

            const { error } = await supabase
                .from('personajes')
                .update(payloadSeguro)
                .eq('nombre', nombre);

            if (error) {
                console.error(`Supabase rechazó la actualización de ${nombre}:`, error);
                erroresGlobales.push(`[${nombre}]: ${error.message}`);
            }
        }

        if (erroresGlobales.length > 0) {
            alert("⚠️ Supabase rechazó la operación:\n\n" + erroresGlobales.join('\n'));
            btn.innerText = "Reintentar Guardado";
            btn.disabled = false;
        } else {
            estadoUI.colaCambios.stats = {};
            const alertBox = document.createElement('div');
            alertBox.innerHTML = "¡Guardado Exitoso! ✅";
            alertBox.style.cssText = "position:fixed; top:30px; left:50%; transform:translateX(-50%); background:var(--gold); color:#000; padding:15px 40px; border-radius:8px; font-weight:bold; font-size:1.2em; z-index:99999; box-shadow:0 0 20px var(--gold);";
            document.body.appendChild(alertBox);
            setTimeout(() => window.location.reload(), 1000);
        }

    } catch(e) {
        alert("Error crítico al guardar:\n" + e.message);
        console.error(e);
        btn.innerText = "Reintentar Guardado";
        btn.disabled = false;
        window.sincronizarUI();
    }
};

// ============================================================================
// 6. UTILIDADES
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
    } catch (e) {}
};

const dragHeader = document.getElementById('modal-drag-header');
const modalContent = document.getElementById('hex-modal-content');
let isDragging = false, startX, startY, initialX, initialY;
if (dragHeader && modalContent) {
    dragHeader.onmousedown = (e) => {
        isDragging = true; startX = e.clientX; startY = e.clientY;
        const rect = modalContent.getBoundingClientRect();
        modalContent.style.position = 'absolute'; modalContent.style.left = rect.left+'px'; modalContent.style.top = rect.top+'px'; modalContent.style.transform = 'none'; modalContent.style.margin = '0';
        initialX = rect.left; initialY = rect.top; e.preventDefault();
    };
    window.onmousemove = (e) => { if (!isDragging) return; modalContent.style.left=(initialX+(e.clientX-startX))+'px'; modalContent.style.top=(initialY+(e.clientY-startY))+'px'; };
    window.onmouseup = () => { isDragging = false; };
}

window.descargarAumentada = () => { descargarArchivoCSV(generarCSVExportacion(), "HEX_ESTADOS_AUMENTADO.csv"); };

// ============================================================================
// 7. CREACIÓN Y BORRADO DIRECTO EN SUPABASE
// ============================================================================
window.toggleCrearRol = () => {
    const btn = document.getElementById('btn-crear-rol');
    const selectorTipo = document.getElementById('npc-tipo-selector');
    if (btn.dataset.val === 'npc') {
        btn.dataset.val = 'jugador';
        btn.innerText = '🎭 ROL: JUGADOR';
        btn.style.background = '#003300';
        btn.style.borderColor = '#00e676';
        if (selectorTipo) selectorTipo.style.display = 'none';
    } else {
        btn.dataset.val = 'npc';
        btn.innerText = '🎭 ROL: NPC';
        btn.style.background = '#330000';
        btn.style.borderColor = '#ff1744';
        if (selectorTipo) selectorTipo.style.display = 'flex';
    }
};

window.toggleCrearNpcTipo = () => {
    const btn = document.getElementById('btn-crear-npc-tipo');
    if (!btn) return;
    if (btn.dataset.val === 'sistema') {
        btn.dataset.val = 'jugador';
        btn.innerText = '🧑 NPC TIPO: JUGADOR';
        btn.style.background = '#001a33';
        btn.style.borderColor = '#4a90e2';
    } else {
        btn.dataset.val = 'sistema';
        btn.innerText = '⚙️ NPC TIPO: SISTEMA';
        btn.style.background = '#1a0900';
        btn.style.borderColor = '#ff9900';
    }
};
window.toggleCrearAct = () => { const btn=document.getElementById('btn-crear-act'); if(btn.dataset.val==='activo'){btn.dataset.val='inactivo';btn.innerText='🌟 ESTADO: INACTIVO';btn.style.background='#330000';btn.style.borderColor='#ff1744';}else{btn.dataset.val='activo';btn.innerText='🌟 ESTADO: ACTIVO';btn.style.background='#003300';btn.style.borderColor='#00e676';} };
window.updateCreationAfinitySum = () => {
    const gv = (id) => parseInt(document.getElementById(id)?.value) || 0;
    const fis = gv('npc-fis');
    const ene = gv('npc-ene');
    const esp = gv('npc-esp');
    const man = gv('npc-man');
    const psi = gv('npc-psi');
    const osc = gv('npc-osc');
    const suma = fis + ene + esp + man + psi + osc;

    const vidaRoja  = 10 + Math.floor(fis / 2);
    const vidaAzul  = Math.floor((ene + esp + man + psi) / 4);
    const vexMax    = Math.round((osc * 300) / 4 / 50) * 50;

    const d = document.getElementById('creation-affinity-sum-display');
    if (d) d.innerHTML =
        `<span style="color:#aaa; font-size:0.85em;">Total Afinidades:</span> <strong>${suma}</strong>`
        + `<div style="display:flex; justify-content:center; gap:20px; margin-top:8px; font-size:0.9em; flex-wrap:wrap;">`
        + `<span>❤️ Vida Roja: <b style="color:#ff4444;">${vidaRoja}</b></span>`
        + `<span>💙 Vida Azul: <b style="color:#4a90e2;">${vidaAzul}</b></span>`
        + `<span>🔮 VEX Máx: <b style="color:#b3a0ff;">${vexMax}</b></span>`
        + `</div>`;

    const vrActual = document.getElementById('npc-vra');
    const vrMax    = document.getElementById('npc-vrm');
    const va       = document.getElementById('npc-va');
    if (vrActual && vrActual.dataset.manual !== 'true') vrActual.value = vidaRoja;
    if (vrMax    && vrMax.dataset.manual    !== 'true') vrMax.value    = vidaRoja;
    if (va       && va.dataset.manual       !== 'true') va.value       = vidaAzul;
};

window.modForm = (inputId, cantidad) => {
    const input = document.getElementById(inputId);
    if (input) {
        input.value = Math.max(0, (parseInt(input.value) || 0) + cantidad);
        const vidaIds = ['npc-vra', 'npc-vrm', 'npc-va'];
        if (vidaIds.includes(inputId)) input.dataset.manual = 'true';
        if (inputId.startsWith('npc-')) window.updateCreationAfinitySum();
    }
};

window.ejecutarCreacionNPC = async () => {
    const btn = document.querySelector('button[onclick="window.ejecutarCreacionNPC()"]');
    const txtOriginal = btn ? btn.innerText : 'FORJAR';
    if (btn) { btn.innerText = '⏳ FORJANDO EN SUPABASE...'; btn.disabled = true; }

    try {
        const nombre = document.getElementById('npc-nombre').value.trim(); 
        if(!nombre) { alert("Falta el nombre."); if(btn){btn.innerText=txtOriginal; btn.disabled=false;} return; }
        if(statsGlobal[nombre]) { alert("Ya existe un personaje con ese nombre."); if(btn){btn.innerText=txtOriginal; btn.disabled=false;} return; }
        
        const pV = (id) => parseInt(document.getElementById(id)?.value) || 0;
        let stInit = {}; listaEstados.forEach(e => { stInit[e.id] = (e.tipo==='numero') ? 0 : false; });
        
        const isPlayer = document.getElementById('btn-crear-rol').dataset.val === 'jugador';
        const isActive = document.getElementById('btn-crear-act').dataset.val === 'activo';
        const npc_tipo = isPlayer ? null : (document.getElementById('btn-crear-npc-tipo')?.dataset.val || 'sistema');

        const nuevoPJ = {
            nombre: nombre,
            is_player: isPlayer,
            is_active: isActive,
            npc_tipo: npc_tipo,
            icono_override: "",
            hex: pV('npc-hex'),
            asistencia: 1,
            vex: pV('npc-vex'),
            vida_roja_actual: pV('npc-vra'),
            base_vida_roja_max: pV('npc-vrm'),
            base_vida_azul: pV('npc-va'),
            base_guarda_dorada: pV('npc-gd'),
            base_dano_rojo: pV('npc-dr'),
            base_dano_azul: pV('npc-da'),
            base_elim_dorada: pV('npc-ed'),
            af_fisica: pV('npc-fis'),
            af_energetica: pV('npc-ene'),
            af_espiritual: pV('npc-esp'),
            af_mando: pV('npc-man'),
            af_psiquica: pV('npc-psi'),
            af_oscura: pV('npc-osc'),
            estados: stInit
        };

        const exito = await db.personajes.upsert(nuevoPJ);

        if (exito) {
            alert('¡Personaje forjado con éxito!');
            window.location.reload(); 
        } else {
            throw new Error("Conexión rechazada por Supabase.");
        }
    } catch (error) {
        alert("Error al forjar: " + error.message);
        if(btn) { btn.innerText = txtOriginal; btn.disabled = false; }
    }
};

window.borrarPersonaje = async (nombre, event) => {
    if(event) event.stopPropagation();
    const p = statsGlobal[nombre];
    if (!estadoUI.esAdmin && p?.isPlayer) {
        return alert("Solo el Máster puede eliminar personajes jugadores.");
    }
    const msg = estadoUI.esAdmin
        ? `⚠️ ADVERTENCIA CRÍTICA ⚠️\n\n¿Estás absolutamente seguro de que deseas DESTRUIR a [${nombre.toUpperCase()}] de la base de datos?\n\nEsta acción borrará sus stats, hechizos e inventario de objetos.`
        : `¿Eliminar al NPC [${nombre.toUpperCase()}]?\n\nEsta acción también borrará sus hechizos e inventario.`;
    if(confirm(msg)) {
        try {
            const norm = (str) => str.toString().trim().toLowerCase()
                .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e')
                .replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o')
                .replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
                .replace(/\s+/g,'_').replace(/[^a-z0-9_\-]/g,'');
            const iconoKey = norm(p?.iconoOverride || nombre) + 'icon';

            const [, , exitoP] = await Promise.all([
                supabase.from('hechizos_inventario').delete().eq('personaje_nombre', nombre),
                supabase.from('inventario_objetos').delete().eq('personaje_nombre', nombre),
                db.personajes.eliminar(nombre),
                supabase.storage.from('imagenes-hex').remove([
                    `imgpersonajes/${iconoKey}.png`,
                    `imgpersonajes/${iconoKey}.jpg`
                ])
            ]);
            if (exitoP) {
                alert(`${nombre} eliminado correctamente junto con su inventario.`);
                window.location.reload();
            } else {
                alert("Hubo un problema al eliminar el personaje de la base de datos.");
            }
        } catch (error) {
            alert("Error crítico al eliminar: " + error.message);
        }
    }
};

// ============================================================================
// 8. INICIO
// ============================================================================
async function iniciar() {
    try {
        const favicon = document.querySelector("link[rel='icon']");
        if (favicon) favicon.href = `${db.storage.urlBase}/imginterfaz/icon.png`;

        // 🌟 Limpieza de seguridad: borramos el caché viejo si existía
        if (performance.getEntriesByType("navigation")[0]?.type === "reload") {
            localStorage.removeItem('hex_stats_v2'); 
        }

        await hexAuth.init();

        if (hexAuth.estaLogueado() && !hexAuth.esAdmin()) {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: perfil } = await supabase.from('perfiles_usuario').select('rol, personaje_nombre').eq('id', user.id).single();
                    if (perfil) hexAuth._perfil = perfil;
                }
            } catch(e) { console.warn('No se pudo cargar perfil:', e); }
        }

        estadoUI.esAdmin = hexAuth.esAdmin();

        const badge = document.getElementById('hex-session-badge');
        const actualizarBadge = () => {
            if (!badge) return;
            if (hexAuth.esAdmin()) {
                badge.innerHTML = `<span style="background:#4a004a; color:#d4af37; border:1px dashed #d4af37; padding:8px 14px; border-radius:4px; font-weight:bold; font-family:'Cinzel'; cursor:pointer; font-size:0.85em;" onclick="window.abrirMenuOP()">⚙️ MÁSTER</span>`;
            } else if (hexAuth.estaLogueado()) {
                badge.innerHTML = hexAuth.renderStatusBadge();
            }
        };
        actualizarBadge();

        const loader = document.getElementById('loader');
        const barra  = document.getElementById('carga-progreso');

        await cargarDiccionarioEstados();

        // 🌟 LECTURA DE CACHÉ AISLADO (Solo la configuración visual de la Party)
        const partyCache = localStorage.getItem(`hex_party_${currentConfig.id}`);
        if (partyCache) {
            estadoUI.party = JSON.parse(partyCache);
        }

        // 🌟 Descarga de datos 100% puros desde la BD de la campaña actual
        await cargarTodoDesdeCSV(barra);

        if (loader) setTimeout(() => loader.classList.add('oculto'), 500);

        setTimeout(() => {
            const wasAdmin = estadoUI.esAdmin;
            estadoUI.esAdmin = hexAuth.esAdmin();
            if (estadoUI.esAdmin !== wasAdmin) window.sincronizarUI();
        }, 1500);

        const target = new URLSearchParams(window.location.search).get('pj') || decodeURIComponent(window.location.hash.replace('#detalle-','').replace('#inventario-','').replace(/_/g,' '));
        if (target) {
            const exactMatch = Object.keys(statsGlobal).find(k => k.toLowerCase() === target.toLowerCase());
            if (exactMatch) { estadoUI.personajeSeleccionado = exactMatch; estadoUI.vistaActual = 'detalle'; }
        }
    } catch (error) {
        console.error("Error crítico:", error);
    } finally {
        refrescarVistas();
    }
}

iniciar();

window.copiarHexLog = (event) => {
    const textarea = document.getElementById('hex-log-textarea');
    if (!textarea) return;
    navigator.clipboard.writeText(textarea.value).then(() => {
        const btn = event?.target;
        if (btn) { const orig = btn.innerText; btn.innerText = '✅ COPIADO'; setTimeout(() => btn.innerText = orig, 1500); }
    });
};
