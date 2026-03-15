import { statsGlobal, listaEstados, estadoUI, dbExtra } from './stats-state.js';
import { cargarTodoDesdeCSV, procesarTextoCSV, cargarDiccionarioEstados } from './stats-data.js';
import { dibujarCatalogo, dibujarResumenVisual, dibujarDetalle, dibujarMenuOP, dibujarHexOP, dibujarFormularioCrear, dibujarPanelEdicionOP } from './stats-ui.js';
import { generarCSVExportacion, descargarArchivoCSV, calcularVidaRojaMax, getMysticBonus } from './stats-logic.js';
import { hexAuth, supabase } from '../hex-auth.js';
import { db } from '../hex-db.js';

// ============================================================
// stats-main.js — VERSIÓN SUPABASE (OPTIMIZADA LOTE)
// ============================================================

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

    const _badge = document.getElementById('hex-session-badge');
    if (_badge) {
        if (hexAuth.esAdmin()) {
            _badge.innerHTML = `<span style="background:#4a004a; color:#d4af37; border:1px dashed #d4af37; padding:8px 14px; border-radius:4px; font-weight:bold; font-family:'Cinzel'; cursor:pointer; font-size:0.85em;" onclick="window.abrirMenuOP()">⚙️ MÁSTER</span>`;
        } else {
            _badge.innerHTML = hexAuth.renderStatusBadge();
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

window.togglePartyMember = (nombre, isChecked) => {
    if (isChecked) { const e = estadoUI.party.indexOf(null); if (e !== -1) estadoUI.party[e] = nombre; else alert("Máximo de 6 alcanzado."); }
    else { const c = estadoUI.party.indexOf(nombre); if (c !== -1) estadoUI.party[c] = null; }
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

window.mostrarPaginaOP = (subvista) => { estadoUI.vistaActual = subvista; refrescarVistas(); };
window.setFiltro = (tipo, valor) => { if(tipo==='rol') estadoUI.filtroRol=valor; if(tipo==='act') estadoUI.filtroAct=valor; window.sincronizarUI(); };

// ============================================================================
// 5. SINCRONIZACIÓN CON SUPABASE (GUARDADO MASIVO RÁPIDO)
// ============================================================================
// 👉 LIMPIO Y DIRECTO: Marcamos quién cambió sin ensuciar la memoria
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

// 👉 NUEVO GUARDADO POR LOTES: 1 Sola llamada a base de datos
window.ejecutarSincronizacion = async () => {
    const btn = document.getElementById('btn-sync-global');
    btn.innerText = "Guardando por Lote..."; btn.disabled = true;

    try {
        const personajesParaUpsert = [];

        for (const [nombre, campos] of Object.entries(estadoUI.colaCambios.stats)) {
            // Si hay comando de borrado, lo hacemos individual (es muy raro borrar a muchos a la vez)
            if (campos.__ELIMINAR_PERSONAJE__) {
                await db.personajes.eliminar(nombre);
                continue;
            }

            const p = statsGlobal[nombre];
            if (!p) continue;

            // Preparamos los datos del personaje para el paquete
            personajesParaUpsert.push({
                nombre,
                is_player:  p.isPlayer,
                is_active:  p.isActive,
                icono_override: p.iconoOverride || '',
                hex:        p.hex        || 0,
                asistencia: p.asistencia || 1,
                vex:        p.isPlayer ? 0 : (p.vex || 0),

                vida_roja_actual:  p.vidaRojaActual  || 0,
                base_vida_roja_max: p.baseVidaRojaMax || 10,
                hechizo_vida_roja:  p.hechizos?.vidaRojaMaxExtra  || 0,
                efecto_vida_roja:   p.hechizosEfecto?.vidaRojaMaxExtra || 0,
                buff_vida_roja:     p.buffs?.vidaRojaMaxExtra     || 0,

                base_vida_azul:    p.baseVidaAzul   || 0,
                hechizo_vida_azul: p.hechizos?.vidaAzulExtra  || 0,
                efecto_vida_azul:  p.hechizosEfecto?.vidaAzulExtra || 0,
                buff_vida_azul:    p.buffs?.vidaAzulExtra     || 0,

                base_guarda_dorada: p.baseGuardaDorada || 0,
                hechizo_guarda:     p.hechizos?.guardaDoradaExtra  || 0,
                efecto_guarda:      p.hechizosEfecto?.guardaDoradaExtra || 0,
                buff_guarda:        p.buffs?.guardaDoradaExtra     || 0,

                base_dano_rojo:    p.baseDanoRojo   || 0,
                hechizo_dano_rojo: p.hechizos?.danoRojo  || 0,
                efecto_dano_rojo:  p.hechizosEfecto?.danoRojo || 0,
                buff_dano_rojo:    p.buffs?.danoRojo     || 0,

                base_dano_azul:    p.baseDanoAzul   || 0,
                hechizo_dano_azul: p.hechizos?.danoAzul  || 0,
                efecto_dano_azul:  p.hechizosEfecto?.danoAzul || 0,
                buff_dano_azul:    p.buffs?.danoAzul     || 0,

                base_elim_dorada:  p.baseElimDorada || 0,
                hechizo_elim:      p.hechizos?.elimDorada  || 0,
                efecto_elim:       p.hechizosEfecto?.elimDorada || 0,
                buff_elim:         p.buffs?.elimDorada     || 0,

                af_fisica:     p.afinidadesBase?.fisica     || 0,
                af_energetica: p.afinidadesBase?.energetica || 0,
                af_espiritual: p.afinidadesBase?.espiritual || 0,
                af_mando:      p.afinidadesBase?.mando      || 0,
                af_psiquica:   p.afinidadesBase?.psiquica   || 0,
                af_oscura:     p.afinidadesBase?.oscura     || 0,

                hz_fisica:     p.hechizos?.fisica     || 0,
                hz_energetica: p.hechizos?.energetica || 0,
                hz_espiritual: p.hechizos?.espiritual || 0,
                hz_mando:      p.hechizos?.mando      || 0,
                hz_psiquica:   p.hechizos?.psiquica   || 0,
                hz_oscura:     p.hechizos?.oscura     || 0,

                ef_fisica:     p.hechizosEfecto?.fisica     || 0,
                ef_energetica: p.hechizosEfecto?.energetica || 0,
                ef_espiritual: p.hechizosEfecto?.espiritual || 0,
                ef_mando:      p.hechizosEfecto?.mando      || 0,
                ef_psiquica:   p.hechizosEfecto?.psiquica   || 0,
                ef_oscura:     p.hechizosEfecto?.oscura     || 0,

                bf_fisica:     p.buffs?.fisica     || 0,
                bf_energetica: p.buffs?.energetica || 0,
                bf_espiritual: p.buffs?.espiritual || 0,
                bf_mando:      p.buffs?.mando      || 0,
                bf_psiquica:   p.buffs?.psiquica   || 0,
                bf_oscura:     p.buffs?.oscura     || 0,

                estados: p.estados || {}
            });
        }

        // Enviamos todo el bloque de una sola vez
        if (personajesParaUpsert.length > 0) {
            const exito = await db.personajes.upsertBatch(personajesParaUpsert);
            if (!exito) throw new Error("Fallo en la actualización masiva.");
        }

        estadoUI.colaCambios.stats = {};
        const alertBox = document.createElement('div');
        alertBox.innerHTML = "¡Actualización Masiva Exitosa! ✅";
        alertBox.style.cssText = "position:fixed; top:30px; left:50%; transform:translateX(-50%); background:var(--gold); color:#000; padding:15px 40px; border-radius:8px; font-weight:bold; font-size:1.2em; z-index:99999; box-shadow:0 0 20px var(--gold);";
        document.body.appendChild(alertBox);
        setTimeout(() => window.location.reload(), 1000);

    } catch(e) {
        alert("Error de red con Supabase al intentar guardar los cambios.");
        console.error(e);
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
window.toggleCrearRol = () => { const btn=document.getElementById('btn-crear-rol'); if(btn.dataset.val==='npc'){btn.dataset.val='jugador';btn.innerText='🎭 ROL: JUGADOR';btn.style.background='#003300';btn.style.borderColor='#00e676';}else{btn.dataset.val='npc';btn.innerText='🎭 ROL: NPC';btn.style.background='#330000';btn.style.borderColor='#ff1744';} };
window.toggleCrearAct = () => { const btn=document.getElementById('btn-crear-act'); if(btn.dataset.val==='activo'){btn.dataset.val='inactivo';btn.innerText='🌟 ESTADO: INACTIVO';btn.style.background='#330000';btn.style.borderColor='#ff1744';}else{btn.dataset.val='activo';btn.innerText='🌟 ESTADO: ACTIVO';btn.style.background='#003300';btn.style.borderColor='#00e676';} };
window.updateCreationAfinitySum = () => { const s=['fis','ene','esp','man','psi','osc'].reduce((acc,id)=>acc+(parseInt(document.getElementById('npc-'+id)?.value)||0),0); const d=document.getElementById('creation-affinity-sum-display'); if(d) d.innerText=`Total Afinidades: ${s}`; };
window.modForm = (inputId, cantidad) => { const input=document.getElementById(inputId); if(input){input.value=Math.max(0,(parseInt(input.value)||0)+cantidad); if(inputId.startsWith('npc-')) window.updateCreationAfinitySum();} };

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

        const nuevoPJ = {
            nombre: nombre,
            is_player: isPlayer,
            is_active: isActive,
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
    if(confirm(`⚠️ ADVERTENCIA CRÍTICA ⚠️\n\n¿Estás absolutamente seguro de que deseas DESTRUIR a [${nombre.toUpperCase()}] de la base de datos?\n\nEsta acción es irreversible y borrará sus stats de la existencia.`)) {
        try {
            const exito = await db.personajes.eliminar(nombre);
            if (exito) {
                alert(`El personaje ${nombre} ha sido erradicado de Supabase.`);
                window.location.reload();
            } else {
                alert("Hubo un problema al intentar eliminar al personaje desde la base de datos.");
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

        if (performance.getEntriesByType("navigation")[0]?.type === "reload") localStorage.removeItem('hex_stats_v2');

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
