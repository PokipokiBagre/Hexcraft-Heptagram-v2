import { estadoUI, db } from './inventario-state.js';
import { inicializarDatos, sincronizarColaBD } from './inventario-data.js';
import { dibujarCatalogo, renderHeaders, dibujarGrimorioGrid, dibujarGestionGrid, dibujarAprendizajeGrid, dibujarCatalogoHechizos, getValInfo } from './inventario-ui.js';
import { getInventarioCombinado } from './inventario-logic.js';
import { hexAuth } from '../hex-auth.js';

// Nueva clave de caché (v2) para evitar conflictos con el caché viejo del CSV
const CACHE_KEY = 'hex_hechizos_v2';

window.onload = async () => {
    const perf = performance.getEntriesByType("navigation")[0];
    if (perf && perf.type === "reload") localStorage.removeItem(CACHE_KEY);

    const loader = document.getElementById('loader');
    const barra  = document.getElementById('carga-progreso');

    // Inicializar auth
    await hexAuth.init();
    estadoUI.esAdmin = hexAuth.esAdmin();

    const enrutarPorURL = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const pjQuery   = urlParams.get('pj');
        let hashQuery   = window.location.hash.replace('#grimorio-', '');
        if (hashQuery) hashQuery = decodeURIComponent(hashQuery).replace(/_/g, ' ');

        const target = pjQuery || hashQuery;
        if (target) {
            const exactMatch = Object.keys(db.personajes).find(k => k.toLowerCase() === target.toLowerCase());
            if (exactMatch) { window.abrirGrimorio(exactMatch); return; }
        }
        window.cambiarVista('catalogo');
    };

    const cacheData = localStorage.getItem(CACHE_KEY);
    if (cacheData) {
        try {
            const parsed = JSON.parse(cacheData);
            Object.assign(db.personajes, parsed.personajes);
            db.hechizos = parsed.hechizos;
            if (loader) loader.style.display = 'none';

            enrutarPorURL();

            await inicializarDatos(null);
            localStorage.setItem(CACHE_KEY, JSON.stringify({ personajes: db.personajes, hechizos: db.hechizos }));
            if (estadoUI.vistaActual !== 'catalogo') window.cambiarVista(estadoUI.vistaActual);
            return;
        } catch(e) { console.warn("Caché obsoleto, recargando..."); localStorage.removeItem(CACHE_KEY); }
    }

    const ok = await inicializarDatos(barra);
    if (!ok) { if(loader) loader.innerHTML = "<span style='color:red'>Fallo Crítico al cargar Servidores.</span>"; return; }
    localStorage.setItem(CACHE_KEY, JSON.stringify({ personajes: db.personajes, hechizos: db.hechizos }));
    setTimeout(() => { if(loader) loader.style.display = 'none'; enrutarPorURL(); }, 400);
};

window.cambiarVista = (vista) => {
    estadoUI.vistaActual = vista;
    document.querySelectorAll('.vista-seccion').forEach(el => el.classList.add('oculto'));
    const sec = document.getElementById(`c-${vista}`);
    if(sec) sec.classList.remove('oculto');

    const btnCat = document.getElementById('btn-nav-catalogo');
    const btnAll = document.getElementById('btn-nav-all-hechizos');
    if(btnCat) { if(vista === 'catalogo') btnCat.classList.add('oculto'); else btnCat.classList.remove('oculto'); }
    if(btnAll) { if(vista === 'catalogo-hechizos') btnAll.classList.add('oculto'); else btnAll.classList.remove('oculto'); }

    if (vista === 'catalogo')          { dibujarCatalogo(); }
    else if (vista === 'catalogo-hechizos') { dibujarCatalogoHechizos(); }
    else {
        renderHeaders();
        if (vista === 'grimorio')    dibujarGrimorioGrid();
        if (vista === 'gestion')     { actualizarTextoLogOP(); dibujarGestionGrid(); }
        if (vista === 'aprendizaje') dibujarAprendizajeGrid();
        if (vista === 'casteo')      window.generarFilasCasteo();
    }
    actualizarBotonSync();
};

window.abrirGrimorio = (pj) => {
    estadoUI.personajeSeleccionado = pj;
    estadoUI.filtrosGrimorio = { afinidad: 'Todos', busqueda: '' };
    window.cambiarVista('grimorio');
    window.scrollTo(0, 0);
};

// Login con hexAuth en lugar de prompt/atob
window.abrirMenuOP = async () => {
    if (hexAuth.esAdmin()) {
        estadoUI.esAdmin = false;
        alert("Modo OP Desactivado.");
        window.cambiarVista('catalogo');
        return;
    }
    await hexAuth._mostrarModalLogin();
    estadoUI.esAdmin = hexAuth.esAdmin();
    if (estadoUI.esAdmin) window.cambiarVista(estadoUI.vistaActual);
};

window.setFiltro = (tipo, valor) => {
    if(tipo === 'rol') { estadoUI.filtroRol = valor; ['Todos','Jugador','NPC'].forEach(k => document.getElementById('btn-rol-'+k)?.classList.remove('btn-active')); document.getElementById('btn-rol-'+valor)?.classList.add('btn-active'); }
    if(tipo === 'act') { estadoUI.filtroAct = valor; ['Todos','Activo','Inactivo'].forEach(k => document.getElementById('btn-act-'+k)?.classList.remove('btn-active')); document.getElementById('btn-act-'+valor)?.classList.add('btn-active'); }
    dibujarCatalogo();
};

window.aplicarFiltrosGrimorio   = () => { estadoUI.filtrosGrimorio.afinidad = document.getElementById('f-grim-afinidad').value; estadoUI.filtrosGrimorio.busqueda = document.getElementById('f-grim-texto').value; dibujarGrimorioGrid(); };
window.aplicarFiltrosGestion    = () => { estadoUI.filtrosGestion.afinidad = document.getElementById('op-f-afinidad').value; estadoUI.filtrosGestion.clase = document.getElementById('op-f-clase').value; estadoUI.filtrosGestion.busqueda = document.getElementById('op-f-texto').value; dibujarGestionGrid(); };
window.aplicarFiltrosAprendizaje = () => { estadoUI.filtrosAprendizaje.afinidad = document.getElementById('f-apr-afinidad').value; estadoUI.filtrosAprendizaje.clase = document.getElementById('f-apr-clase').value; estadoUI.filtrosAprendizaje.busqueda = document.getElementById('f-apr-texto').value; dibujarAprendizajeGrid(); };
window.aplicarFiltrosAll        = () => { estadoUI.filtrosAll.afinidad = document.getElementById('f-all-afinidad').value; estadoUI.filtrosAll.clase = document.getElementById('f-all-clase').value; estadoUI.filtrosAll.estado = document.getElementById('f-all-estado').value; estadoUI.filtrosAll.busqueda = document.getElementById('f-all-texto').value; dibujarCatalogoHechizos(); };

window.toggleRestarHex  = (c) => { estadoUI.restarHexAsignacion = c; };
window.toggleCastConsumo = (val) => { estadoUI.consumoCast = val; };
window.toggleCastEfectos = (val) => { estadoUI.efectosCast = val; };

// ── Botón de descarga de CSV queda como stub (los datos viven en Supabase) ──
window.descargarCSVHex = () => {
    alert("Los datos ahora viven en Supabase. Usa el panel de Estadísticas para exportar.");
};

// ── Recalcular afinidades de hechizos tras asignar/quitar ────
// Actualiza charData.afinidadesHz + afinidades totales y encola hz_* en colaCambios.stats
function recalcularEstadisticasPersonaje(pj) {
    const charData = db.personajes[pj];
    if (!charData) return;

    const inv = getInventarioCombinado(pj);
    const todosNodos = [...(db.hechizos.nodos || []), ...(db.hechizos.nodosOcultos || [])];

    // Contar hechizos por afinidad usando claves Supabase (snake_case)
    const conteo = { fisica: 0, energetica: 0, espiritual: 0, mando: 0, psiquica: 0, oscura: 0 };
    const mapNombreAKey = { 'Física': 'fisica', 'Energética': 'energetica', 'Espiritual': 'espiritual', 'Mando': 'mando', 'Psíquica': 'psiquica', 'Oscura': 'oscura' };

    inv.forEach(item => {
        const itemNorm = item.Hechizo.trim().toLowerCase();
        const info = todosNodos.find(n => (n.Nombre||"").trim().toLowerCase() === itemNorm || (n.ID||"").trim().toLowerCase() === itemNorm) || {};
        const af    = item["Hechizo Afinidad"] || info.Afinidad;
        const afKey = mapNombreAKey[af];
        if (afKey !== undefined) conteo[afKey]++;
    });

    if (!estadoUI.colaCambios.stats)       estadoUI.colaCambios.stats = {};
    if (!estadoUI.colaCambios.stats[pj])   estadoUI.colaCambios.stats[pj] = {};

    for (const [afKey, count] of Object.entries(conteo)) {
        // Actualizar en memoria
        charData.afinidadesHz[afKey] = count;
        charData.afinidades[afKey]   = (charData.afinidadesBase[afKey] || 0) + count
                                     + (charData.afinidadesEf[afKey]  || 0)
                                     + (charData.afinidadesBf[afKey]  || 0);
        // Encolar para Supabase (columnas hz_*)
        estadoUI.colaCambios.stats[pj][`hz_${afKey}`] = count;
    }
}

// ── Restar hex al personaje en memoria y encolar el cambio ───
function restarHexPersonaje(pj, hex) {
    const charObj = db.personajes[pj];
    charObj.hex = Math.max(0, charObj.hex - hex);

    if (!estadoUI.colaCambios.stats)     estadoUI.colaCambios.stats = {};
    if (!estadoUI.colaCambios.stats[pj]) estadoUI.colaCambios.stats[pj] = {};
    estadoUI.colaCambios.stats[pj].hex = charObj.hex;
}

function actualizarTextoLogOP() {
    const textarea = document.getElementById('op-log-textarea'); if(!textarea) return;
    const pj = estadoUI.personajeSeleccionado; const char = db.personajes[pj];
    let out = "";

    estadoUI.logOP.descubiertos.forEach(d => { out += `Hechizo descubierto: ${d}\n`; });

    const cobrados  = estadoUI.logOP.aprendidos.filter(a => a.cobrado);
    const gratuitos = estadoUI.logOP.aprendidos.filter(a => !a.cobrado);

    if (cobrados.length > 0) {
        const list = cobrados.map(c => c.spell).join(", ");
        out += `Hechizo aprendido: ${list} -${estadoUI.logOP.hexGastado} Hex (${char ? char.hex : 0})\n`;
    }
    gratuitos.forEach(g => { out += `${pj} | Hechizo aprendido | ${g.spell}\n`; });

    textarea.value = out; textarea.scrollTop = textarea.scrollHeight;
}

window.copiarLogOP  = () => { const t = document.getElementById('op-log-textarea'); if(t) { t.select(); document.execCommand('copy'); } };
window.limpiarLogOP = () => { estadoUI.logOP = { descubiertos: [], aprendidos: [], hexGastado: 0 }; actualizarTextoLogOP(); };

window.toggleVisibilidad = (idHechizo, nombreHechizo, nuevoEstado) => {
    estadoUI.colaCambios.toggleConocido.push({ ID: idHechizo, Nombre: nombreHechizo, Estado: nuevoEstado });

    const todosNodos = [...(db.hechizos.nodos || []), ...(db.hechizos.nodosOcultos || [])];
    const info = todosNodos.find(n => n.ID === idHechizo || n.Nombre === nombreHechizo);
    if (info) info.Conocido = nuevoEstado;

    if(estadoUI.vistaActual === 'gestion')           { renderHeaders(); dibujarGestionGrid(); actualizarTextoLogOP(); }
    else if(estadoUI.vistaActual === 'grimorio')      { dibujarGrimorioGrid(); }
    else if(estadoUI.vistaActual === 'catalogo-hechizos') { dibujarCatalogoHechizos(); }
    actualizarBotonSync();
};

window.accionCola = (accion, nombreHechizo, afinidad = '', hex = 0) => {
    const pj = estadoUI.personajeSeleccionado;
    const todosNodos = [...(db.hechizos.nodos || []), ...(db.hechizos.nodosOcultos || [])];
    const info = todosNodos.find(n => n.Nombre === nombreHechizo);

    if (accion === 'agregar') {
        const origen = document.getElementById('slicer-origen')?.value || 'OP Admin';
        estadoUI.colaCambios.agregar.push([pj, nombreHechizo, afinidad, hex, "Normal", origen]);

        estadoUI.logOP.aprendidos.push({ spell: nombreHechizo, cost: hex, cobrado: estadoUI.restarHexAsignacion });

        if (estadoUI.restarHexAsignacion) {
            restarHexPersonaje(pj, hex);
            estadoUI.logOP.hexGastado += hex;
        }

        if (info && (!info.Conocido || info.Conocido.toString().trim().toLowerCase() !== 'si')) {
            estadoUI.colaCambios.toggleConocido.push({ ID: info.ID, Nombre: info.Nombre, Estado: 'si' });
            info.Conocido = 'si';
            estadoUI.logOP.descubiertos.push(`${info.ID} - ${info.Nombre}`);
        }

    } else if (accion === 'quitar') {
        estadoUI.colaCambios.quitar.push({ Personaje: pj, Hechizo: nombreHechizo });
    }

    recalcularEstadisticasPersonaje(pj);

    if(estadoUI.vistaActual === 'gestion')      { renderHeaders(); dibujarGestionGrid(); actualizarTextoLogOP(); }
    else if(estadoUI.vistaActual === 'grimorio') { dibujarGrimorioGrid(); }
    actualizarBotonSync();
};

function actualizarBotonSync() {
    const btn = document.getElementById('btn-sync-global'); if(!btn) return;
    const hexChanges   = estadoUI.colaCambios.hexCasts ? estadoUI.colaCambios.hexCasts.length : 0;
    const statsChanges = Object.keys(estadoUI.colaCambios.stats || {}).length;
    const h = estadoUI.colaCambios.agregar.length + estadoUI.colaCambios.quitar.length
            + estadoUI.colaCambios.toggleConocido.length + hexChanges + statsChanges;
    if (h > 0) { btn.classList.remove('oculto'); btn.innerText = `🔥 GUARDAR CAMBIOS AL SERVIDOR (${h}) 🔥`; }
    else btn.classList.add('oculto');
}

window.ejecutarSincronizacion = async () => {
    const btn = document.getElementById('btn-sync-global');
    btn.innerText = "Sincronizando..."; btn.disabled = true;

    if (await sincronizarColaBD(estadoUI.colaCambios)) {
        estadoUI.colaCambios = { agregar: [], quitar: [], toggleConocido: [], hexCasts: [], stats: {} };

        const cartelito = document.createElement('div');
        cartelito.innerHTML = "¡Guardado Exitoso! ✅";
        cartelito.style.cssText = "position:fixed; top:30px; left:50%; transform:translateX(-50%); background:var(--gold); color:#000; padding:15px 40px; border-radius:8px; font-weight:bold; font-size:1.2em; z-index:9999; box-shadow:0 0 20px var(--gold); font-family:'Cinzel', serif; text-align:center;";
        document.body.appendChild(cartelito);

        localStorage.removeItem(CACHE_KEY);
        setTimeout(() => { window.location.reload(); }, 500);
    } else {
        alert("Error de conexión. Reintenta.");
        actualizarBotonSync();
        btn.disabled = false;
    }
};

// =========================================================================
// MOTOR DE CASTEO DE HECHIZOS (VEX/HEX)
// =========================================================================

window.copiarLogCasteo = () => { const t = document.getElementById('log-casteo-textarea'); if(t) { t.select(); document.execCommand('copy'); } };
window.limpiarLogCasteo = () => { const t = document.getElementById('log-casteo-textarea'); if(t) t.value = ''; };

window.scrollCasteo = (e) => {
    e.preventDefault();
    const input = document.getElementById('cast-num'); if(!input) return;
    let val = parseInt(input.value) || 3;
    if (e.deltaY < 0) val++; else val--;
    val = Math.max(1, Math.min(50, val));
    if(input.value != val) { input.value = val; window.generarFilasCasteo(); }
};

window.onGridKeydown = (e, row, col) => {
    const num = parseInt(document.getElementById('cast-num').value) || 3;

    if (e.key === 'Tab' && col === 1) {
        const input = document.getElementById(`spell-${row}`);
        const val = input.value.toLowerCase();
        if (val) {
            const pj = estadoUI.personajeSeleccionado;
            const invReal = db.hechizos.inventario.filter(i => i.Personaje === pj).map(i => i.Hechizo);
            invReal.sort((a, b) => a.localeCompare(b));
            const match = invReal.find(h => h.toLowerCase().startsWith(val));
            if (match && match.toLowerCase() !== val) {
                e.preventDefault();
                input.value = match;
                window.actualizarAfinidadCasteo(row);
                document.getElementById(`afinidad-${row}`)?.focus();
                return;
            }
        }
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        let nextRow = e.key === 'ArrowUp' ? Math.max(0, row - 1) : Math.min(num - 1, row + 1);
        const mapCol = {0: 'dado', 1: 'spell', 2: 'afinidad'};
        document.getElementById(`${mapCol[col]}-${nextRow}`)?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const target = e.target; let shouldMove = false;
        if (target.type === 'number') { shouldMove = true; }
        else if (target.type === 'text') {
            if (e.key === 'ArrowLeft'  && target.selectionStart === 0)              shouldMove = true;
            if (e.key === 'ArrowRight' && target.selectionEnd === target.value.length) shouldMove = true;
        }
        if (shouldMove) {
            e.preventDefault();
            const mapCol = {0: 'dado', 1: 'spell', 2: 'afinidad'};
            let nextCol = e.key === 'ArrowLeft' ? Math.max(0, col - 1) : Math.min(2, col + 1);
            document.getElementById(`${mapCol[nextCol]}-${row}`)?.focus();
        }
    }
};

window.generarFilasCasteo = () => {
    const contenedor = document.getElementById('casteo-filas'); if (!contenedor) return;
    const num = parseInt(document.getElementById('cast-num').value) || 3;
    const pj  = estadoUI.personajeSeleccionado;

    const invReal = db.hechizos.inventario.filter(i => i.Personaje === pj).map(i => i.Hechizo);
    if(invReal.length === 0) {
        contenedor.innerHTML = `<p style="color:#ff4444; text-align:center; padding:20px;">El personaje no tiene hechizos para lanzar.</p>`;
        return;
    }

    invReal.sort((a, b) => a.localeCompare(b));
    let datalistHtml = `<datalist id="spells-list-${pj}">`;
    invReal.forEach(h => datalistHtml += `<option value="${h}">`);
    datalistHtml += `</datalist>`;

    let html = datalistHtml;
    for(let i=0; i<num; i++) {
        html += `
        <div class="casteo-row" id="row-${i}">
            <div class="casteo-input-group" style="flex: 0.5;">
                <label style="color:var(--gold); font-size:0.8em;">DADO (1-100)</label>
                <div style="display:flex; gap:5px;">
                    <button onclick="window.lanzarDado(${i})" class="dice-btn" title="Lanzar Dado">🎲</button>
                    <input type="number" id="dado-${i}" class="input-casteo" placeholder="0" min="1" max="100" onkeydown="window.onGridKeydown(event, ${i}, 0)">
                </div>
            </div>
            <div class="casteo-input-group" style="flex: 2;">
                <label style="color:var(--gold); font-size:0.8em;">BUSCAR HECHIZO</label>
                <input type="text" list="spells-list-${pj}" id="spell-${i}" class="input-casteo" placeholder="Escribe o selecciona..." onchange="window.actualizarAfinidadCasteo(${i})" onkeydown="window.onGridKeydown(event, ${i}, 1)">
            </div>
            <div class="casteo-input-group" style="flex: 0.8;">
                <label style="color:var(--gold); font-size:0.8em;" id="afinidad-label-${i}">AFINIDAD</label>
                <input type="number" id="afinidad-${i}" class="input-casteo" value="0" onkeydown="window.onGridKeydown(event, ${i}, 2)">
            </div>
            <div class="casteo-result" id="result-${i}">
                <span style="color:#888; text-align:center; font-style:italic;">Esperando conjuro...</span>
            </div>
        </div>`;
    }
    contenedor.innerHTML = html;
};

window.lanzarDado = (idx) => {
    const input = document.getElementById(`dado-${idx}`);
    if (input) input.value = Math.floor(Math.random() * 100) + 1;
};

// Reemplaza rawRow[colIdx] con charData.afinidades[afKey]
window.actualizarAfinidadCasteo = (idx) => {
    const pj       = estadoUI.personajeSeleccionado;
    const charData = db.personajes[pj];
    const spellName = document.getElementById(`spell-${idx}`).value;

    const todosNodos = [...(db.hechizos.nodos || []), ...(db.hechizos.nodosOcultos || [])];
    const info = todosNodos.find(n => n.Nombre.trim().toLowerCase() === spellName.trim().toLowerCase());

    const label = document.getElementById(`afinidad-label-${idx}`);
    const input = document.getElementById(`afinidad-${idx}`);

    if (info && info.Afinidad) {
        label.innerText = info.Afinidad.toUpperCase();
        // Mapeo de nombre de afinidad a clave snake_case en charData.afinidades
        const mapAfin = { 'Física': 'fisica', 'Energética': 'energetica', 'Espiritual': 'espiritual', 'Mando': 'mando', 'Psíquica': 'psiquica', 'Oscura': 'oscura' };
        const afKey   = mapAfin[info.Afinidad];
        input.value   = afKey ? (charData.afinidades?.[afKey] || 0) : 0;
    } else {
        label.innerText = "AFINIDAD";
        input.value = 0;
    }
};

window.copiarPrimerHechizo = () => {
    const num = parseInt(document.getElementById('cast-num').value) || 3;
    const baseSpell = document.getElementById(`spell-0`)?.value; if (!baseSpell) return;
    for(let i=1; i<num; i++) { const input = document.getElementById(`spell-${i}`); if(input) { input.value = baseSpell; window.actualizarAfinidadCasteo(i); } }
};

window.copiarPrimerDado = () => {
    const num = parseInt(document.getElementById('cast-num').value) || 3;
    const baseDado = document.getElementById(`dado-0`)?.value; if (!baseDado) return;
    for(let i=1; i<num; i++) { const input = document.getElementById(`dado-${i}`); if(input) input.value = baseDado; }
};

window.conjurarHechizos = () => {
    const num      = parseInt(document.getElementById('cast-num').value) || 3;
    const pj       = estadoUI.personajeSeleccionado;
    const charData = db.personajes[pj];
    const todosNodos = [...(db.hechizos.nodos || []), ...(db.hechizos.nodosOcultos || [])];

    // VEX: calculado desde afinidad oscura total (en lugar de rawRow[8])
    const afOscura = charData.afinidades?.oscura || 0;
    const maxVex   = Math.round(((afOscura * 300) / 4) / 50) * 50;

    let availableVex = maxVex;
    let availableHex = charData.hex || 0;
    let totalVexConsumed = 0;
    let totalHexConsumed = 0;
    let agrupacionLogs = {};
    let conjurosRealizados = 0;

    for(let i=0; i<num; i++) {
        const dadoVal  = parseInt(document.getElementById(`dado-${i}`).value);
        const afinVal  = parseInt(document.getElementById(`afinidad-${i}`).value) || 0;
        const spellName = document.getElementById(`spell-${i}`).value;
        const resDiv   = document.getElementById(`result-${i}`);
        const rowDiv   = document.getElementById(`row-${i}`);

        if(!spellName) continue;
        if(isNaN(dadoVal) || dadoVal <= 0) {
            resDiv.innerHTML = `<span style="color:#ff4444;">Falta valor de Dado.</span>`;
            rowDiv.style.borderColor = "#ff4444";
            continue;
        }

        const spellNorm = spellName.trim().toLowerCase();
        const info = todosNodos.find(n => (n.Nombre && n.Nombre.trim().toLowerCase() === spellNorm) || (n.ID && n.ID.trim().toLowerCase() === spellNorm));
        if(!info) { resDiv.innerHTML = "Hechizo no encontrado."; continue; }

        const hexCost = parseInt(info.HEX) || 0;
        const NC = dadoVal * afinVal;
        conjurosRealizados++;

        const checkColaVis = estadoUI.colaCambios.toggleConocido.slice().reverse().find(c => c.ID === info.ID || c.Nombre === info.Nombre);
        const isPublicBase = info.Conocido && info.Conocido.toString().trim().toLowerCase() === 'si';
        const isKnown  = checkColaVis ? (checkColaVis.Estado === 'si') : isPublicBase;
        const isHidden = !estadoUI.esAdmin && !isKnown;

        let effect = getValInfo(info, ['efecto', 'Efecto']) || 'Ningún efecto base.';
        let over   = getValInfo(info, ['overcast 100%', 'overcast']);
        let under  = getValInfo(info, ['undercast 50%', 'undercast']);
        let esp    = getValInfo(info, ['especial', 'especiales']);

        if (isHidden) {
            effect = '<i style="color:#888;">Efecto desconocido (Hechizo sellado).</i>';
            over   = over  ? '<i style="color:#888;">Efecto oculto.</i>' : null;
            under  = under ? '<i style="color:#888;">Efecto oculto.</i>' : null;
            esp    = esp   ? '<i style="color:#888;">Efecto oculto.</i>' : null;
        }

        let htmlUI = `<div style="margin-bottom:5px;"><strong>Nivel de Casteo: <span style="font-size:1.2em; color:white;">${NC}</span></strong> <span style="color:#aaa; font-size:0.8em;">(Costo: ${hexCost})</span></div>`;
        let logStatus = ""; let logExtra = ""; let isSuccess = false;

        if ((availableVex + availableHex) < hexCost) {
            htmlUI += `<div style="color:#ff4444; font-weight:bold; font-size:1.1em; margin-bottom:5px;">FALLO ❌ (Falta de Hex/Vex)</div>`;
            rowDiv.style.borderColor = "#ff4444"; logStatus = "FALLO (Sin energía)";
        } else {
            if (NC >= hexCost * 2 && over) {
                htmlUI += `<div style="color:var(--gold); font-weight:bold; font-size:1.1em; margin-bottom:5px;">¡OVERCAST! ✨</div><div style="color:var(--cyan-magic); margin-bottom:5px;">${effect}</div><div style="color:var(--gold);"><strong>Efecto Overcast:</strong> ${over}</div>`;
                if(esp) htmlUI += `<div style="color:#dcb1f0; margin-top:5px;"><strong>Especial:</strong> ${esp}</div>`;
                rowDiv.style.borderColor = "var(--gold)"; logStatus = "ÉXITO (+Overcast)"; logExtra = ` | Efecto Overcast: ${over}${esp ? ' | Especial: ' + esp : ''}`; isSuccess = true;
            } else if (NC >= hexCost) {
                htmlUI += `<div style="color:var(--cyan-magic); font-weight:bold; font-size:1.1em; margin-bottom:5px;">¡ÉXITO! ✔️</div><div style="color:var(--cyan-magic);">${effect}</div>`;
                if(esp) htmlUI += `<div style="color:#dcb1f0; margin-top:5px;"><strong>Especial:</strong> ${esp}</div>`;
                rowDiv.style.borderColor = "var(--cyan-magic)"; logStatus = "ÉXITO"; logExtra = esp ? ` | Especial: ${esp}` : ''; isSuccess = true;
            } else if (NC >= hexCost * 0.5 && under) {
                htmlUI += `<div style="color:#ffaa00; font-weight:bold; font-size:1.1em; margin-bottom:5px;">UNDERCAST ⚠️</div><div style="color:#888; text-decoration:line-through; margin-bottom:5px;">${effect}</div><div style="color:#ffaa00;"><strong>Efecto Parcial:</strong> ${under}</div>`;
                rowDiv.style.borderColor = "#ffaa00"; logStatus = "ÉXITO (-Undercast)"; logExtra = ` | Efecto Parcial: ${under}`; isSuccess = true;
            } else {
                htmlUI += `<div style="color:#ff4444; font-weight:bold; font-size:1.1em; margin-bottom:5px;">FALLO ❌</div>`;
                rowDiv.style.borderColor = "#ff4444"; logStatus = "FALLO";
            }

            if (isSuccess) {
                let costoRestante = hexCost;
                let consumoVexAca = Math.min(availableVex, costoRestante);
                availableVex -= consumoVexAca; totalVexConsumed += consumoVexAca; costoRestante -= consumoVexAca;
                let consumoHexAca = Math.min(availableHex, costoRestante);
                availableHex -= consumoHexAca; totalHexConsumed += consumoHexAca;
            }
        }
        resDiv.innerHTML = htmlUI;

        const keyGroup = `${spellName}|${logStatus}`;
        if(!agrupacionLogs[keyGroup]) agrupacionLogs[keyGroup] = { spell: spellName, count: 0, status: logStatus, effect: effect, extra: logExtra };
        agrupacionLogs[keyGroup].count++;
    }

    if(conjurosRealizados === 0) return;

    if (estadoUI.esAdmin) {
        let textoLog = "";
        const mostrarEfectos = estadoUI.efectosCast !== false;

        Object.values(agrupacionLogs).forEach(g => {
            if (g.status.includes("FALLO") || !mostrarEfectos) textoLog += `${pj} | ${g.spell} x${g.count} | ${g.status}\n`;
            else textoLog += `${pj} | ${g.spell} x${g.count} | ${g.status} | ${g.effect}${g.extra}\n`;
        });

        if(totalVexConsumed > 0 || maxVex > 0) textoLog += `Vex: -${totalVexConsumed} (${maxVex}) (Regenerable)\n`;
        textoLog += `Hex: -${totalHexConsumed} (${availableHex})\n\n`;

        const textareaElement = document.getElementById('log-casteo-textarea');
        const oldLog  = textareaElement ? textareaElement.value : "";
        const logFinal = textoLog + oldLog;

        const toggleLog = document.getElementById('toggle-cast-consumo');
        if (toggleLog && toggleLog.checked && (totalVexConsumed > 0 || totalHexConsumed > 0)) {
            // Actualizar hex en memoria y encolar para Supabase
            // (sin rawRow — solo actualizamos charData.hex directamente)
            charData.hex = availableHex;

            if (!estadoUI.colaCambios.stats)     estadoUI.colaCambios.stats = {};
            if (!estadoUI.colaCambios.stats[pj]) estadoUI.colaCambios.stats[pj] = {};
            estadoUI.colaCambios.stats[pj].hex = availableHex;

            estadoUI.colaCambios.hexCasts.push(1);
            actualizarBotonSync();
        }

        renderHeaders();
        const newTextarea = document.getElementById('log-casteo-textarea');
        if(newTextarea) newTextarea.value = logFinal;
    } else {
        renderHeaders();
    }
};
