import { statsGlobal, listaEstados, estadoUI, dbExtra } from './stats-state.js';
import { calcularVidaRojaMax, calcularVexMax, getMayorAfinidad } from './stats-logic.js';

const normalizar = (str) => str.toString().trim().toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/\s+/g,'_').replace(/[^a-z0-9ñ_]/g,'');
const calcTotal = (base, spells, spellEff, buff) => (base || 0) + (spells || 0) + (spellEff || 0) + (buff || 0);

const bTextSplit = (spells, spellEff, buff) => {
    let parts = [];
    if (spells !== 0) parts.push(`<span style="color:var(--cyan-magic); font-weight:bold;">Hcz: ${spells > 0 ? '+' : ''}${spells}</span>`);
    if (spellEff !== 0) parts.push(`<span style="color:#4a90e2; font-weight:bold;">Alt: ${spellEff > 0 ? '+' : ''}${spellEff}</span>`);
    if (buff !== 0) parts.push(`<span style="color:${buff > 0 ? '#00ff00' : '#ff4444'}; font-weight:bold;">Ext: ${buff > 0 ? '+' : ''}${buff}</span>`);
    
    if (parts.length === 0) return '';
    return `<div style="font-size:0.75em; display:flex; flex-direction:column; gap:4px; margin-top:8px; border-top:1px dashed #444; padding-top:8px;">${parts.join('')}</div>`;
};

const imgError = "this.onerror=null; this.src='../img/imgobjetos/no_encontrado.png'";
const raridadValor = { "Legendario": 3, "Raro": 2, "Común": 1, "-": 0 };

function AsegurarGuardaD(p) { if(p.guardaDorada === undefined) p.guardaDorada = 0; if(p.baseGuardaDorada === undefined) p.baseGuardaDorada = 0; }

function asegurarEstructuras(p) {
    AsegurarGuardaD(p);
    if(!p.buffs) p.buffs = {}; if(!p.hechizos) p.hechizos = {}; if(!p.hechizosEfecto) p.hechizosEfecto = {}; if(!p.estados) p.estados = {};
    listaEstados.forEach(e => { if (p.estados[e.id] === undefined) p.estados[e.id] = (e.tipo === 'numero') ? 0 : false; });
    const props = ['fisica', 'energetica', 'espiritual', 'mando', 'psiquica', 'oscura', 'danoRojo', 'danoAzul', 'elimDorada', 'vidaRojaMaxExtra', 'vidaAzulExtra', 'guardaDoradaExtra'];
    props.forEach(pr => { p.buffs[pr] = p.buffs[pr] || 0; p.hechizos[pr] = p.hechizos[pr] || 0; p.hechizosEfecto[pr] = p.hechizosEfecto[pr] || 0; if (p.afinidades && p.afinidades[pr] === undefined) p.afinidades[pr] = 0; if(p.afinidadesBase && p.afinidadesBase[pr] === undefined) p.afinidadesBase[pr] = 0;});
    if(p.isActive === undefined) p.isActive = true;
}

function generarVidasHTML(p) {
    const maxRojo = calcularVidaRojaMax(p);
    let normalRojo = Math.min(p.vidaRojaActual, maxRojo); let vaciosRojo = Math.max(0, maxRojo - normalRojo); let extraRojo = Math.max(0, p.vidaRojaActual - maxRojo);
    let rojasHTML = ''; for(let i=0; i<normalRojo; i++) rojasHTML += `<div class="heart-red"></div>`; for(let i=0; i<vaciosRojo; i++) rojasHTML += `<div class="heart-red empty"></div>`; for(let i=0; i<extraRojo; i++) rojasHTML += `<div class="heart-red" style="background:#800000; border:1px solid #ff0000; transform:scale(0.9); box-shadow: 0 0 5px red;"></div>`;
    
    const azulTotal = calcTotal(p.baseVidaAzul, p.hechizos.vidaAzulExtra, p.hechizosEfecto.vidaAzulExtra, p.buffs.vidaAzulExtra);
    let azulesHTML = ''; for(let i=0; i<azulTotal; i++) azulesHTML += `<div class="heart-blue"></div>`;
    
    const guardaTotal = calcTotal(p.baseGuardaDorada, p.hechizos.guardaDoradaExtra, p.hechizosEfecto.guardaDoradaExtra, p.buffs.guardaDoradaExtra);
    let guardasHTML = ''; for(let i=0; i<guardaTotal; i++) guardasHTML += `<div class="guard-gold"></div>`;
    
    return { rojasHTML, azulesHTML, guardasHTML, maxRojo, azulTotal, guardaTotal };
}

function generarGeometriaSVG(tipo, valor, maxVex, nroLados) {
    const size = 150; const center = size / 2; const radius = (size / 2) - 10;
    const points = [];
    for (let i = 0; i < nroLados; i++) {
        const angle = (i * 2 * Math.PI / nroLados);
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        points.push(`${x},${y}`);
    }
    const pathData = `M ${points.join(' L ')} Z`;
    
    let porcentaje = 0;
    if (tipo === 'hex') { porcentaje = Math.min((valor / 4000), 1); } 
    else { porcentaje = maxVex > 0 ? Math.min((valor / maxVex), 1) : 0; }
    
    const perimeter = radius * 2 * nroLados * Math.sin(Math.PI/nroLados);
    const strokeDasharray = perimeter;
    const strokeDashoffset = perimeter * (1 - porcentaje);

    return `
        <svg viewBox="0 0 ${size} ${size}" class="${tipo}-svg">
            <path class="bg-path" d="${pathData}" style="stroke: #333; stroke-width: 2px; fill: rgba(0,0,0,0.5);" />
            <path class="bar-path" d="${pathData}" 
                style="stroke-dasharray: ${strokeDasharray}; stroke-dashoffset: ${strokeDashoffset}; stroke: ${tipo==='hex' ? 'var(--gold)' : '#4a90e2'}; stroke-width: 4px; fill: transparent; transition: stroke-dashoffset 0.5s ease-out;" />
        </svg>
    `;
}

// ============================================================================
// VISTAS PRINCIPALES
// ============================================================================

export function dibujarCatalogo() {
    const contenedor = document.getElementById('vista-catalogo'); contenedor.className = ''; 
    estadoUI.filtroRol = estadoUI.filtroRol || 'Todos'; estadoUI.filtroAct = estadoUI.filtroAct || 'Todos';

    let html = `
    <div style="display:flex; justify-content:center; gap:20px; margin-bottom:30px; flex-wrap:wrap; border-bottom:2px solid #222; padding-bottom:15px; background: rgba(0,0,0,0.4); padding: 15px; border-radius: 8px;">
        <div class="filter-group" style="margin:0; display:flex; gap:10px;">
            <button onclick="window.setFiltro('rol', 'Todos')" class="${estadoUI.filtroRol === 'Todos' ? 'btn-active' : ''}">👥 Todos</button>
            <button onclick="window.setFiltro('rol', 'Jugador')" class="${estadoUI.filtroRol === 'Jugador' ? 'btn-active' : ''}">⚔️ Jugadores</button>
            <button onclick="window.setFiltro('rol', 'NPC')" class="${estadoUI.filtroRol === 'NPC' ? 'btn-active' : ''}">🎭 NPCs</button>
        </div>
        <div class="filter-group" style="margin:0; display:flex; gap:10px;">
            <button onclick="window.setFiltro('act', 'Todos')" class="${estadoUI.filtroAct === 'Todos' ? 'btn-active' : ''}">🌟 Ambos</button>
            <button onclick="window.setFiltro('act', 'Activo')" class="${estadoUI.filtroAct === 'Activo' ? 'btn-active' : ''}">🟢 Activos</button>
            <button onclick="window.setFiltro('act', 'Inactivo')" class="${estadoUI.filtroAct === 'Inactivo' ? 'btn-active' : ''}">🔴 Inactivos</button>
        </div>
    </div>
    <div class="catalogo-grid">`;

    const getSortValue = (p) => { if (p.isPlayer && p.isActive) return 1; if (!p.isPlayer && p.isActive) return 2; if (!p.isPlayer && !p.isActive) return 3; if (p.isPlayer && !p.isActive) return 4; return 5; };
    const sortedNames = Object.keys(statsGlobal).sort((a, b) => { const valA = getSortValue(statsGlobal[a]); const valB = getSortValue(statsGlobal[b]); if (valA !== valB) return valA - valB; return a.localeCompare(b); });

    sortedNames.forEach(nombre => {
        const p = statsGlobal[nombre]; asegurarEstructuras(p);
        if (estadoUI.filtroRol === 'Jugador' && !p.isPlayer) return; if (estadoUI.filtroRol === 'NPC' && p.isPlayer) return;
        if (estadoUI.filtroAct === 'Activo' && !p.isActive) return; if (estadoUI.filtroAct === 'Inactivo' && p.isActive) return;

        const iconoMuestra = normalizar(p.iconoOverride || nombre);
        let borderStyle = ""; let bgStyle = "background: #11001c;"; 
        
        if (p.isPlayer && p.isActive) { borderStyle = "border: 2px solid var(--gold); box-shadow: 0 4px 15px rgba(212, 175, 55, 0.2);"; } 
        else if (!p.isPlayer && p.isActive) { borderStyle = "border: 2px solid #00ffff; box-shadow: 0 4px 10px rgba(0, 255, 255, 0.1);"; bgStyle = "background: #060b19;"; } 
        else if (!p.isPlayer && !p.isActive) { borderStyle = "border: 2px solid #444;"; bgStyle = "background: #0a0a0a;"; } 
        else if (p.isPlayer && !p.isActive) { borderStyle = "border: 2px solid #cc0000; box-shadow: 0 4px 10px rgba(204, 0, 0, 0.2);"; bgStyle = "background: #1a0000;"; }

        const claseInactiva = p.isActive ? '' : 'inactive-card';
        
        // BOTÓN DE ELIMINAR MEJORADO (Basurero sutil interior)
        let btnEliminar = '';
        if (estadoUI.esAdmin) {
            btnEliminar = `<button onclick="window.borrarPersonaje('${nombre}', event)" style="position: absolute; top: 12px; right: 12px; background: rgba(255, 0, 0, 0.1); color: #ff5555; border: 1px solid rgba(255, 0, 0, 0.3); border-radius: 6px; width: 32px; height: 32px; font-size: 1.1em; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; z-index: 10;" onmouseover="this.style.background='#ff0000'; this.style.color='#fff'; this.style.borderColor='#ff0000';" onmouseout="this.style.background='rgba(255, 0, 0, 0.1)'; this.style.color='#ff5555'; this.style.borderColor='rgba(255, 0, 0, 0.3)';" title="Eliminar Personaje">🗑️</button>`;
        }

        html += `
        <div class="char-card ${claseInactiva}" style="position: relative; ${borderStyle} ${bgStyle} padding: 15px; border-radius: 12px; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'" onclick="window.abrirDetalle('${nombre}')">
            ${btnEliminar}
            <img src="../img/imgpersonajes/${iconoMuestra}icon.png" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,0.2); margin-bottom: 10px;" onerror="${imgError}">
            <h3 style="margin: 0 0 10px 0; font-family: 'Cinzel', serif; font-size: 1.2em; text-transform: uppercase;">${nombre}</h3>
            <div style="background: rgba(0,0,0,0.5); padding: 8px; border-radius: 6px;">
                <p style="margin: 0; font-size: 0.9em; color: #ddd;">HEX: <strong style="color: var(--gold);">${p.hex}</strong></p>
                <p style="margin: 5px 0 0 0; font-size: 0.9em; color: #4a90e2;">VEX: <strong style="color: #4a90e2;">${calcularVexMax(p)}</strong></p>
            </div>
        </div>`;
    }); 
    contenedor.innerHTML = html + `</div>`;
}

export function dibujarResumenVisual() {
    const contenedor = document.getElementById('vista-resumen');
    let html = `<h2 style="text-align:center; color:var(--gold); margin-bottom:30px; font-family:'Cinzel'; text-shadow:0 0 10px rgba(212,175,55,0.8);">Visión Táctica de la Party</h2>
                <div class="resumen-grid">`;

    const afiMap = { 'Física':'fisica', 'Energética':'energetica', 'Espiritual':'espiritual', 'Mando':'mando', 'Psíquica':'psiquica', 'Oscura':'oscura' };
    const allNodos = [...(dbExtra.hechizos.nodos||[]), ...(dbExtra.hechizos.nodosOcultos||[])];

    Object.keys(statsGlobal).sort().forEach(nombre => {
        const p = statsGlobal[nombre];
        if(!p.isPlayer || !p.isActive) return; 
        
        const pjNameLower = nombre.toLowerCase();
        const iconoGrande = normalizar(p.iconoOverride || nombre);
        const objCount = dbExtra.objetosCount[pjNameLower] || 0;
        
        const myMissions = dbExtra.misionesActivas ? (dbExtra.misionesActivas[pjNameLower] || []) : [];
        const countMis = myMissions.length;
        let missionsHtml = myMissions.map(m => `<span class="mini-spell-tag copy-wrap" style="border-color:#ffaa00; color:#ffaa00; font-style:italic;" title="${m}" onclick="window.copySilently('${m.replace(/'/g, "\\'")}', event)">${m}</span>`).join('');
        
        const linkObj = `../objetos/index.html?pj=${encodeURIComponent(nombre)}#inventario-${normalizar(nombre)}`;

        const myItems = dbExtra.inventarios[pjNameLower] || [];
        const topItems = myItems.sort((a,b) => (raridadValor[dbExtra.infoObjetos[b]?.rar]||0) - (raridadValor[dbExtra.infoObjetos[a]?.rar]||0)).slice(0, 5);
        let itemsHtml = topItems.map(o => {
            const rarClase = dbExtra.infoObjetos[o]?.rar === 'Raro' ? 'rarity-raro' : (dbExtra.infoObjetos[o]?.rar === 'Legendario' ? 'rarity-legendario' : 'rarity-comun');
            return `<a href="${linkObj}" target="_blank" class="mini-item-card ${rarClase}" title="${o} (Clic para ir al inventario)" onclick="event.stopPropagation();"><img src="../img/imgobjetos/${normalizar(o)}.png" onerror="${imgError}"></a>`;
        }).join('');

        const mySpells = (dbExtra.hechizos.inventario || []).filter(i => i.Personaje.toLowerCase() === pjNameLower);
        mySpells.forEach(s => {
            const info = allNodos.find(n => normalizar(n.Nombre) === normalizar(s.Hechizo) || normalizar(n.ID) === normalizar(s.Hechizo));
            s.costo = info ? (parseInt(info.HEX) || 0) : 0;
            
            // NUEVA LÓGICA: Mostrar nombre siempre, pero marcar si no está descubierto
            s.isUndiscovered = (info && (!info.Conocido || String(info.Conocido).trim().toLowerCase() !== 'si'));
            s.displayName = s.Hechizo;
        });
        const topSpells = mySpells.sort((a,b) => b.costo - a.costo).slice(0, 10);
        let spellsHtml = topSpells.map(s => {
            if (s.isUndiscovered) {
                return `<span class="mini-spell-tag copy-wrap" style="color:var(--gold); border-color:#b8860b; font-style:italic;" title="${s.displayName} (No Descubierto - ${s.costo} HEX)" onclick="window.copySilently('${s.displayName.replace(/'/g, "\\'")}', event)">🔒 ${s.displayName}</span>`;
            } else {
                return `<span class="mini-spell-tag copy-wrap" title="${s.displayName} (${s.costo} HEX)" onclick="window.copySilently('${s.displayName.replace(/'/g, "\\'")}', event)">${s.displayName}</span>`;
            }
        }).join('');
        
        const mayorAf = getMayorAfinidad(p);
        const mKey = afiMap[mayorAf] || 'fisica';
        const calcAfT = (k) => (p.afinidadesBase[k]||0)+(p.hechizos[k]||0)+(p.hechizosEfecto[k]||0)+(p.buffs[k]||0);
        
        const valMayorAf = calcAfT(mKey);
        const sumAf = ['fisica','energetica','espiritual','mando','psiquica','oscura'].reduce((a,k)=>a+calcAfT(k),0);
        
        const vidas = generarVidasHTML(p);
        const vexVisual = calcularVexMax(p);

        html += `
        <div class="resumen-row" onclick="window.abrirDetalle('${nombre}')" style="background:#111; border-color:#333;">
            <div class="resumen-left">
                <img src="../img/imgpersonajes/${iconoGrande}icon.png" style="border: 2px solid var(--gold);" onerror="${imgError}">
                <h3 style="margin:8px 0 0 0; font-size:1.1em; color:var(--gold); text-transform:uppercase; font-family:'Cinzel';">${nombre}</h3>
                <div class="copy-wrap hex-label" onclick="window.copySilently('HEX: ${p.hex}', event)">
                    ${p.hex}<br><span style="font-size:0.5em; color:#fff;">HEX</span>
                </div>
                <div class="copy-wrap vex-label" onclick="window.copySilently('VEX: ${vexVisual}', event)">
                    ${vexVisual}<br><span style="font-size:0.6em; color:#fff;">VEX</span>
                </div>
            </div>
            
            <div class="resumen-right">
                <div class="resumen-badges">
                    <span class="copy-wrap" style="background:#1a1a00; border:1px solid var(--gold); padding:4px 8px; border-radius:4px;" onclick="window.copySilently('Afinidad Primaria: ${mayorAf} (${valMayorAf}) | Suma Total: ${sumAf}', event)">
                        ✨ Afin. Principal: <b style="color:var(--gold)">${mayorAf} (${valMayorAf})</b> | Suma: ${sumAf}
                    </span>
                </div>
                
                <div class="resumen-badges" style="margin-top:5px; background:#050505; padding:10px; border-radius:8px; border:1px dashed #333; width:fit-content; display:flex; gap:10px;">
                    <div class="copy-wrap health-grid" onclick="window.copySilently('Vida Roja: ${p.vidaRojaActual}/${vidas.maxRojo}', event)" style="margin:0;">
                        ${vidas.rojasHTML}
                    </div>
                    ${vidas.azulesHTML ? `<div class="copy-wrap health-grid" onclick="window.copySilently('Vida Azul: ${vidas.azulTotal}', event)" style="margin:0; border-left:1px solid #333; padding-left:15px;">${vidas.azulesHTML}</div>` : ''}
                    ${vidas.guardasHTML ? `<div class="copy-wrap health-grid" onclick="window.copySilently('Guardas: ${vidas.guardaTotal}', event)" style="margin:0; border-left:1px solid #333; padding-left:15px;">${vidas.guardasHTML}</div>` : ''}
                </div>
                
                <div style="display:flex; gap:8px; margin-top:5px; flex-wrap:wrap; align-items:center;">
                    <span class="copy-wrap" style="background:#0a1128; border:1px solid #00ffff; padding:3px 6px; border-radius:4px; font-size:0.8em;" onclick="window.copySilently('Objetos Unicos: ${objCount}', event)">
                        🎒 Obj: <b style="color:#00ffff">${objCount}</b>
                    </span>
                    ${itemsHtml}
                </div>

                <div style="display:flex; gap:8px; margin-top:5px; flex-wrap:wrap; align-items:center;">
                    <span class="copy-wrap" style="background:#110022; border:1px solid var(--cyan-magic); padding:3px 6px; border-radius:4px; font-size:0.8em;" onclick="window.copySilently('Hechizos Conocidos: ${mySpells.length}', event)">
                        📖 Hcz: <b style="color:var(--cyan-magic)">${mySpells.length}</b>
                    </span>
                    ${spellsHtml}
                </div>

                <div style="display:flex; gap:8px; margin-top:5px; flex-wrap:wrap; align-items:center;">
                    <span class="copy-wrap" style="background:#1a0a00; border:1px solid #ffaa00; padding:3px 6px; border-radius:4px; font-size:0.8em;" onclick="window.copySilently('Misiones Activas: ${countMis}', event)">
                        📜 Mis: <b style="color:#ffaa00">${countMis}</b>
                    </span>
                    ${missionsHtml}
                </div>
            </div>
        </div>`;
    });
    html += `</div>`;
    contenedor.innerHTML = html;
}

export function dibujarDetalle() {
    const nombre = estadoUI.personajeSeleccionado; const p = statsGlobal[nombre];
    if(!p) return; asegurarEstructuras(p);
    const contenedor = document.getElementById('vista-detalle');

    let vexVisual = calcularVexMax(p);
    const vidas = generarVidasHTML(p);

    let estadosHTML = ''; 
    if (p.iconoOverride) estadosHTML += `<div class="status-badge" style="background:#2e004f; border: 1px dashed var(--gold); color:var(--gold);" title="Este personaje es un clon visual.">🎭 COPIA VISUAL DE: ${p.iconoOverride.toUpperCase()}</div>`;
    
    listaEstados.forEach(e => {
        let val = p.estados[e.id];
        if (e.tipo === 'numero' && val > 0) {
            estadosHTML += `<div class="status-badge" style="background:${e.bg}; border-color:${e.border}; color:#fff;" title="${e.desc}">${e.nombre} <b style="background: rgba(0,0,0,0.3); padding: 0 4px; border-radius: 4px; margin-left: 4px;">${val}</b><span class="tooltiptext">${e.desc}</span></div>`;
        } else if (e.tipo === 'booleano' && val) { 
            let colorTexto = e.id === 'huesos' ? '#000' : '#fff'; 
            let bStyle = e.id === 'secuestrado' ? 'dashed' : 'solid'; 
            estadosHTML += `<div class="status-badge" style="background:${e.bg}; border: 1px ${bStyle} ${e.border}; color:${colorTexto};" title="${e.desc}">${e.nombre}<span class="tooltiptext">${e.desc}</span></div>`; 
        }
    });

    const iconoGrande = normalizar(p.iconoOverride || nombre);
    let asisUI = p.isPlayer ? `<div style="color:#888; font-size:0.85em; margin-top:8px; font-weight:bold; letter-spacing: 1px;">ASISTENCIA: <span style="color:var(--gold); background: #222; padding: 2px 6px; border-radius: 4px; border: 1px solid #444;">${p.asistencia || 1}/7</span></div>` : '';

    const pjNameLower = nombre.toLowerCase();
    const pjNorm = normalizar(nombre);
    
    const countObj = dbExtra.objetosCount[pjNameLower] || 0;
    const myMissions = dbExtra.misionesActivas ? (dbExtra.misionesActivas[pjNameLower] || []) : [];
    const countMis = myMissions.length;
    const mySpells = (dbExtra.hechizos.inventario || []).filter(i => i.Personaje.toLowerCase() === pjNameLower);
    
    const allNodos = [...(dbExtra.hechizos.nodos||[]), ...(dbExtra.hechizos.nodosOcultos||[])];

    mySpells.forEach(s => {
        const info = allNodos.find(n => normalizar(n.Nombre) === normalizar(s.Hechizo) || normalizar(n.ID) === normalizar(s.Hechizo));
        s.costo = info ? (parseInt(info.HEX) || 0) : 0;
        
        // NUEVA LÓGICA: Mostrar nombre siempre, colorear amarillo si no está descubierto
        s.isUndiscovered = (info && (!info.Conocido || String(info.Conocido).trim().toLowerCase() !== 'si'));
        s.displayName = s.Hechizo;
    });
    mySpells.sort((a,b) => a.displayName.localeCompare(b.displayName));
    
    const afiMap = { 'Física':'fisica', 'Energética':'energetica', 'Espiritual':'espiritual', 'Mando':'mando', 'Psíquica':'psiquica', 'Oscura':'oscura' };
    const mayorAf = getMayorAfinidad(p);
    const mKey = afiMap[mayorAf] || 'fisica';
    const calcAfT = (k) => (p.afinidadesBase[k]||0)+(p.hechizos[k]||0)+(p.hechizosEfecto[k]||0)+(p.buffs[k]||0);
    const valMayorAf = calcAfT(mKey);

    const linkObjetos = `../objetos/index.html?pj=${encodeURIComponent(nombre)}#inventario-${pjNorm}`;
    const linkHechizos = `../hechizos/index.html?pj=${encodeURIComponent(nombre)}`;
    const linkMisiones = `../misiones/index.html`;

    const btnIr = (url, color) => `<a href="${url}" target="_blank" onclick="event.stopPropagation();" title="Ir a la Base de Datos" style="display:inline-block; background:#000; color:#aaa; border:1px solid #444; padding:3px 8px; font-size:0.8em; border-radius:4px; text-decoration:none; transition: 0.2s;" onmouseover="this.style.borderColor='${color}'; this.style.color='#fff';" onmouseout="this.style.borderColor='#444'; this.style.color='#aaa';">IR ↗</a>`;

    const uiMisiones = p.isPlayer ? `
        <div style="display:flex; align-items:center; gap:8px; background: rgba(0,0,0,0.4); padding: 5px 10px; border-radius: 6px;">
            <span class="copy-wrap" onclick="window.copySilently('Misiones: ${countMis}', event)" style="margin:0;">📜 MISIONES: <b style="color:#ffaa00; font-size: 1.2em;">${countMis}</b></span>
            ${btnIr(linkMisiones, '#ffaa00')}
        </div>` : '';

    let html = `
    <div style="display: flex; align-items: center; gap: 30px; border-bottom: 2px solid #333; padding-bottom: 25px; opacity:${p.isActive ? '1' : '0.5'}; flex-wrap:wrap;">
        
        <div style="position: relative;">
            <img src="../img/imgpersonajes/${iconoGrande}icon.png" style="width: 140px; height: 140px; border-radius: 50%; border: 4px solid var(--gold); box-shadow: 0 0 20px rgba(212,175,55,0.3); object-fit: cover; background:#000;" onerror="${imgError}">
            ${p.isNPC ? `<span style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); background: #4a0000; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.7em; font-weight: bold; border: 1px solid #ff0000;">NPC</span>` : ''}
        </div>

        <div style="text-align:left; flex:1;">
            <h1 style="margin: 0; font-family: 'Cinzel'; font-size: 2.5em; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">
                ${nombre.toUpperCase()} 
                ${!p.isActive ? '<span style="font-size:0.4em; color:#ff4444; vertical-align: middle; margin-left: 10px; border: 1px solid #ff4444; padding: 2px 6px; border-radius: 4px;">INACTIVO</span>' : ''}
            </h1>
            ${asisUI}
            <div class="status-container" style="margin-top: 15px;">${estadosHTML}</div>
            
            <div style="background: linear-gradient(90deg, #111 0%, #1a1a1a 100%); border:1px solid #333; padding:15px; border-radius:8px; margin-top:20px; display:flex; justify-content:flex-start; flex-wrap:wrap; gap:15px; align-items:center;">
               
               <div style="display:flex; align-items:center; gap:8px; background: rgba(0,0,0,0.4); padding: 5px 10px; border-radius: 6px;">
                   <span class="copy-wrap" onclick="window.copySilently('Objetos: ${countObj}', event)" style="margin:0;">🎒 OBJETOS: <b style="color:var(--gold); font-size: 1.2em;">${countObj}</b></span>
                   ${btnIr(linkObjetos, 'var(--gold)')}
               </div>

               <div style="display:flex; align-items:center; gap:8px; background: rgba(0,0,0,0.4); padding: 5px 10px; border-radius: 6px;">
                   <span class="copy-wrap" onclick="window.copySilently('Hechizos: ${mySpells.length}', event)" style="margin:0;">📖 HECHIZOS: <b style="color:var(--cyan-magic); font-size: 1.2em;">${mySpells.length}</b></span>
                   ${btnIr(linkHechizos, 'var(--cyan-magic)')}
               </div>

               ${uiMisiones}

               <div style="display:flex; align-items:center; gap:8px; background: rgba(212,175,55,0.1); padding: 5px 10px; border-radius: 6px; border: 1px solid rgba(212,175,55,0.3);">
                   <span class="copy-wrap" onclick="window.copySilently('Afinidad Primaria: ${mayorAf} (${valMayorAf})', event)" style="margin:0;">✨ AFIN. PRIMARIA: <b style="color:var(--gold); font-size: 1.1em;">${mayorAf} (${valMayorAf})</b></span>
               </div>

            </div>
        </div>

        ${estadoUI.esAdmin ? `
        <div style="display: flex; flex-direction: column; gap: 10px; align-items: flex-end;">
            <button onclick="window.abrirModalOP()" style="background: linear-gradient(135deg, #4a004a 0%, #2e004f 100%); border: 2px solid #ff00ff; padding: 15px 25px; font-size: 1.1em; color: white; font-weight: bold; border-radius: 8px; box-shadow: 0 0 15px rgba(255,0,255,0.3); transition: 0.3s; cursor: pointer;" onmouseover="this.style.boxShadow='0 0 25px rgba(255,0,255,0.6)'" onmouseout="this.style.boxShadow='0 0 15px rgba(255,0,255,0.3)'">⚙️ PANEL DE MÁSTER</button>
            <span style="color: #666; font-size: 0.8em; font-style: italic;">Modo Edición Activado</span>
        </div>` : ''}
    </div>

    <div class="circle-wrap" style="margin: 40px 0; display: flex; justify-content: center; gap: 50px;">
        <div class="stat-geom hex-geom copy-wrap" style="position: relative; width: 150px; height: 150px; cursor: pointer;" onclick="window.copySilently('HEX: ${p.hex}', event)">
            ${generarGeometriaSVG('hex', p.hex, 0, 6)}
            <div class="inner-text" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                <strong style="display: block; font-size: 1.8em; color: var(--gold); text-shadow: 0 0 10px rgba(212,175,55,0.5);">${p.hex}</strong>
                <span style="font-size: 0.8em; color: #aaa; letter-spacing: 2px;">HEX</span>
            </div>
        </div>
        
        <div class="stat-geom vex-geom copy-wrap" style="position: relative; width: 150px; height: 150px; cursor: pointer;" onclick="window.copySilently('VEX: ${vexVisual}', event)">
            ${generarGeometriaSVG('vex', vexVisual, calcularVexMax(p, true), 7)}
            <div class="inner-text" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                <strong style="display: block; font-size: 1.8em; color: #4a90e2; text-shadow: 0 0 10px rgba(74,144,226,0.5);">${vexVisual}</strong>
                <span style="font-size: 0.8em; color: #aaa; letter-spacing: 2px;">VEX</span>
            </div>
        </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 30px;">
        
        <div style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: 12px; border: 1px solid #222;">
            <h3 style="margin-top:0; font-family:'Cinzel'; font-size: 1.5em; border-bottom: 1px solid #444; padding-bottom: 10px; color: #eee;">🤍 Vida</h3>
            
            <div class="health-box copy-wrap" style="display:block; width:100%; box-sizing:border-box; padding:15px; background: #110000; border: 1px solid #300; border-radius: 8px; margin-bottom: 10px;" onclick="window.copySilently('Vida Roja: ${p.vidaRojaActual}/${vidas.maxRojo}', event)">
                <label style="color:var(--red-life); font-weight:bold; display: block; margin-bottom: 10px; font-size: 1.1em;">VIDA ROJA (${p.vidaRojaActual} / ${vidas.maxRojo})</label>
                <div class="health-grid" style="justify-content: flex-start;">${vidas.rojasHTML}</div>
            </div>
            
            <div class="health-box copy-wrap" style="display:block; width:100%; box-sizing:border-box; padding:15px; background: #000a1a; border: 1px solid #001a33; border-radius: 8px; margin-bottom: 10px;" onclick="window.copySilently('Vida Azul: ${vidas.azulTotal}', event)">
                <label style="color:var(--blue-life); font-weight:bold; display: block; margin-bottom: 10px; font-size: 1.1em;">VIDA AZUL (${vidas.azulTotal})</label>
                <div class="health-grid" style="justify-content: flex-start;">${vidas.azulesHTML}</div>
            </div>
            
            <div class="health-box copy-wrap" style="display:block; width:100%; box-sizing:border-box; padding:15px; background: #1a1a00; border: 1px solid #333300; border-radius: 8px;" onclick="window.copySilently('Guardas: ${vidas.guardaTotal}', event)">
                <label style="color:var(--gold); font-weight:bold; display: block; margin-bottom: 10px; font-size: 1.1em;">GUARDA DORADA (${vidas.guardaTotal})</label>
                <div class="health-grid" style="justify-content: flex-start;">${vidas.guardasHTML}</div>
            </div>
            
            <h3 style="margin-top:30px; font-family:'Cinzel'; font-size: 1.5em; border-bottom: 1px solid #444; padding-bottom: 10px; color: #eee;">⚔️ Puntos de Ataque</h3>
            <div class="affinities-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                <div class="affinity-box copy-wrap" style="background: #1a0505; border-color: #500;" onclick="window.copySilently('Daño Rojo: ${calcTotal(p.baseDanoRojo, p.hechizos.danoRojo, p.hechizosEfecto.danoRojo, p.buffs.danoRojo)}', event)"><label style="color:var(--red-life)">Daño Rojo</label><span style="font-size:1.6em; font-weight:bold;">${calcTotal(p.baseDanoRojo, p.hechizos.danoRojo, p.hechizosEfecto.danoRojo, p.buffs.danoRojo)}</span>${bTextSplit(p.hechizos.danoRojo, p.hechizosEfecto.danoRojo, p.buffs.danoRojo)}</div>
                <div class="affinity-box copy-wrap" style="background: #050a1a; border-color: #002;" onclick="window.copySilently('Daño Azul: ${calcTotal(p.baseDanoAzul, p.hechizos.danoAzul, p.hechizosEfecto.danoAzul, p.buffs.danoAzul)}', event)"><label style="color:var(--blue-life)">Daño Azul</label><span style="font-size:1.6em; font-weight:bold;">${calcTotal(p.baseDanoAzul, p.hechizos.danoAzul, p.hechizosEfecto.danoAzul, p.buffs.danoAzul)}</span>${bTextSplit(p.hechizos.danoAzul, p.hechizosEfecto.danoAzul, p.buffs.danoAzul)}</div>
                <div class="affinity-box copy-wrap" style="background: #1a1a05; border-color: #550;" onclick="window.copySilently('Elim. Dorada: ${calcTotal(p.baseElimDorada, p.hechizos.elimDorada, p.hechizosEfecto.elimDorada, p.buffs.elimDorada)}', event)"><label style="color:var(--gold)">Elim. Dorada</label><span style="font-size:1.6em; font-weight:bold;">${calcTotal(p.baseElimDorada, p.hechizos.elimDorada, p.hechizosEfecto.elimDorada, p.buffs.elimDorada)}</span>${bTextSplit(p.hechizos.elimDorada, p.hechizosEfecto.elimDorada, p.buffs.elimDorada)}</div>
            </div>
        </div>

        <div style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: 12px; border: 1px solid #222;">
            <h3 style="margin-top:0; font-family:'Cinzel'; font-size: 1.5em; border-bottom: 1px solid #444; padding-bottom: 10px; color: #eee; text-align: left;">🔮 Afinidades Totales</h3>
            <div class="affinities-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                <div class="affinity-box copy-wrap" onclick="window.copySilently('Física: ${calcTotal(p.afinidadesBase.fisica, p.hechizos.fisica, p.hechizosEfecto.fisica, p.buffs.fisica)}', event)"><label>Física</label><span style="font-size:1.8em; font-weight:bold; color: #fff;">${calcTotal(p.afinidadesBase.fisica, p.hechizos.fisica, p.hechizosEfecto.fisica, p.buffs.fisica)}</span>${bTextSplit(p.hechizos.fisica, p.hechizosEfecto.fisica, p.buffs.fisica)}</div>
                <div class="affinity-box copy-wrap" onclick="window.copySilently('Energética: ${calcTotal(p.afinidadesBase.energetica, p.hechizos.energetica, p.hechizosEfecto.energetica, p.buffs.energetica)}', event)"><label>Energética</label><span style="font-size:1.8em; font-weight:bold; color: #fff;">${calcTotal(p.afinidadesBase.energetica, p.hechizos.energetica, p.hechizosEfecto.energetica, p.buffs.energetica)}</span>${bTextSplit(p.hechizos.energetica, p.hechizosEfecto.energetica, p.buffs.energetica)}</div>
                <div class="affinity-box copy-wrap" onclick="window.copySilently('Espiritual: ${calcTotal(p.afinidadesBase.espiritual, p.hechizos.espiritual, p.hechizosEfecto.espiritual, p.buffs.espiritual)}', event)"><label>Espiritual</label><span style="font-size:1.8em; font-weight:bold; color: #fff;">${calcTotal(p.afinidadesBase.espiritual, p.hechizos.espiritual, p.hechizosEfecto.espiritual, p.buffs.espiritual)}</span>${bTextSplit(p.hechizos.espiritual, p.hechizosEfecto.espiritual, p.buffs.espiritual)}</div>
                <div class="affinity-box copy-wrap" onclick="window.copySilently('Mando: ${calcTotal(p.afinidadesBase.mando, p.hechizos.mando, p.hechizosEfecto.mando, p.buffs.mando)}', event)"><label>Mando</label><span style="font-size:1.8em; font-weight:bold; color: #fff;">${calcTotal(p.afinidadesBase.mando, p.hechizos.mando, p.hechizosEfecto.mando, p.buffs.mando)}</span>${bTextSplit(p.hechizos.mando, p.hechizosEfecto.mando, p.buffs.mando)}</div>
                <div class="affinity-box copy-wrap" onclick="window.copySilently('Psíquica: ${calcTotal(p.afinidadesBase.psiquica, p.hechizos.psiquica, p.hechizosEfecto.psiquica, p.buffs.psiquica)}', event)"><label>Psíquica</label><span style="font-size:1.8em; font-weight:bold; color: #fff;">${calcTotal(p.afinidadesBase.psiquica, p.hechizos.psiquica, p.hechizosEfecto.psiquica, p.buffs.psiquica)}</span>${bTextSplit(p.hechizos.psiquica, p.hechizosEfecto.psiquica, p.buffs.psiquica)}</div>
                <div class="affinity-box copy-wrap" onclick="window.copySilently('Oscura: ${calcTotal(p.afinidadesBase.oscura, p.hechizos.oscura, p.hechizosEfecto.oscura, p.buffs.oscura)}', event)"><label>Oscura</label><span style="font-size:1.8em; font-weight:bold; color: #fff;">${calcTotal(p.afinidadesBase.oscura, p.hechizos.oscura, p.hechizosEfecto.oscura, p.buffs.oscura)}</span>${bTextSplit(p.hechizos.oscura, p.hechizosEfecto.oscura, p.buffs.oscura)}</div>
                
                <div class="copy-wrap" onclick="window.copySilently('Suma Total Afinidades: ${['fisica','energetica','espiritual','mando','psiquica','oscura'].reduce((a,k)=>a+calcTotal(p.afinidadesBase[k],p.hechizos[k],p.hechizosEfecto[k],p.buffs[k]),0)}', event)" style="grid-column: 1 / -1; background: #111; padding: 10px; border-radius: 6px; text-align:center; color:#aaa; font-size:0.9em; margin-top:10px; font-weight:bold; border:1px dashed #444; cursor: pointer; transition: 0.2s;" onmouseover="this.style.borderColor='var(--gold)'; this.style.color='var(--gold)';" onmouseout="this.style.borderColor='#444'; this.style.color='#aaa';">
                    Suma Total Absoluta: ${['fisica','energetica','espiritual','mando','psiquica','oscura'].reduce((a,k)=>a+calcTotal(p.afinidadesBase[k],p.hechizos[k],p.hechizosEfecto[k],p.buffs[k]),0)}
                </div>
            </div>
        </div>
    </div>`;

    html += `
    <div style="margin-top: 40px; background: rgba(0,0,0,0.3); padding: 25px; border-radius: 12px; border: 1px solid #222;">
        <h3 style="margin-top:0; font-family:'Cinzel'; font-size: 1.5em; color:#4a90e2; border-bottom:1px solid #4a90e2; padding-bottom:10px; display: flex; justify-content: space-between; align-items: flex-end;">
            <span>📖 Grimorio (Hechizos Aprendidos)</span>
            <span style="font-size:0.5em; color:#888; font-family: sans-serif; text-transform: none;">* Clic para copiar al portapapeles</span>
        </h3>
        <div class="spell-grid-4" style="margin-top: 20px;">
            ${mySpells.map(s => {
                if (s.isUndiscovered) {
                    return `<button type="button" class="spell-button" style="background: #1a1a00; border: 1px dashed #b8860b; color: var(--gold); font-style: italic; padding: 12px; border-radius: 6px; cursor: pointer; transition: 0.2s; text-align: left; font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" onmouseover="this.style.background='#332b00'; this.style.borderColor='#ffd700';" onmouseout="this.style.background='#1a1a00'; this.style.borderColor='#b8860b';" onclick="window.copySilently('${s.displayName.replace(/'/g, "\\'")}', event)">🔒 ${s.displayName}</button>`;
                } else {
                    return `<button type="button" class="spell-button" style="background: #0a1128; border: 1px solid #1a365d; color: #c0d6e4; padding: 12px; border-radius: 6px; cursor: pointer; transition: 0.2s; text-align: left; font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" onmouseover="this.style.background='#1a365d'; this.style.borderColor='#4a90e2';" onmouseout="this.style.background='#0a1128'; this.style.borderColor='#1a365d';" onclick="window.copySilently('${s.displayName.replace(/'/g, "\\'")}', event)">🔹 ${s.displayName}</button>`;
                }
            }).join('') || '<div style="grid-column:1/-1; text-align:center; color:#666; padding:20px; font-style: italic; background: #050505; border-radius: 8px;">Este personaje aún no ha registrado ningún hechizo en su Grimorio.</div>'}
        </div>
    </div>`;

    contenedor.innerHTML = html;
}

// ============================================================================
// COMPONENTES DEL PANEL MÁSTER (OP)
// ============================================================================

function genCard(f, tipoAccion) {
    let clickMod = '';
    if (tipoAccion === 'buff') clickMod = 'window.modificarBuff'; 
    else if (tipoAccion === 'baseTop') clickMod = 'window.modBaseTop'; 
    else if (tipoAccion === 'baseAfin') clickMod = 'window.modBaseAfin'; 
    else if (tipoAccion === 'spellEffTop') clickMod = 'window.modSpellEffTop'; 
    else if (tipoAccion === 'spellEffAfin') clickMod = 'window.modSpellEffAfin'; 
    else if (tipoAccion === 'form') clickMod = 'window.modForm';

    const visualVal = f.val !== undefined ? f.val : 0;
    const isForm = tipoAccion === 'form';
    const inputId = isForm ? f.id : `inp-${tipoAccion}-${f.id}`;
    const paramId = isForm ? inputId : f.id;
    
    let html = `<div class="edit-card" style="background: #111; border: 1px solid #333; border-radius: 8px; padding: 12px; text-align: center; display: flex; flex-direction: column; justify-content: space-between; height: 100%;">`;
    html += `<h4 style="margin: 0 0 10px 0; font-size: 0.9em; color: #ddd; min-height: 2.4em; display: flex; align-items: center; justify-content: center;">${f.label}</h4>`;
    
    if (isForm) {
        html += `<input type="number" id="${inputId}" value="${visualVal}" oninput="window.updateCreationAfinitySum()" style="width:100%; text-align:center; background:#000; color:white; border:1px solid #444; border-radius: 4px; margin-bottom:15px; font-size:1.5em; font-weight: bold; padding:8px; box-sizing:border-box;">`;
    } else {
        html += `<div style="font-size: 1.8em; font-weight: bold; color: white; background: #000; padding: 8px; border-radius: 6px; border: 1px solid #222; margin-bottom: 15px;">${visualVal}</div>`;
    }

    const btnStyleBase = "border: none; border-radius: 4px; color: white; font-weight: bold; cursor: pointer; padding: 6px 0; transition: filter 0.2s;";
    const btnAdd1 = `style="${btnStyleBase} background: #1b5e20;" onmouseover="this.style.filter='brightness(1.3)'" onmouseout="this.style.filter='brightness(1)'"`;
    const btnSub1 = `style="${btnStyleBase} background: #b71c1c;" onmouseover="this.style.filter='brightness(1.3)'" onmouseout="this.style.filter='brightness(1)'"`;
    
    const btnAdd2 = `style="${btnStyleBase} background: #004d40;" onmouseover="this.style.filter='brightness(1.3)'" onmouseout="this.style.filter='brightness(1)'"`;
    const btnSub2 = `style="${btnStyleBase} background: #d84315;" onmouseover="this.style.filter='brightness(1.3)'" onmouseout="this.style.filter='brightness(1)'"`;

    const btnAdd3 = `style="${btnStyleBase} background: #4a148c;" onmouseover="this.style.filter='brightness(1.3)'" onmouseout="this.style.filter='brightness(1)'"`;
    const btnSub3 = `style="${btnStyleBase} background: #880e4f;" onmouseover="this.style.filter='brightness(1.3)'" onmouseout="this.style.filter='brightness(1)'"`;

    html += `<div style="display: flex; flex-direction: column; gap: 6px;">`;
    
    if (f.esHex) {
        html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;"><button type="button" ${btnAdd1} onclick="${clickMod}('${paramId}', 10)">+10</button><button type="button" ${btnSub1} onclick="${clickMod}('${paramId}', -10)">-10</button></div>`;
        html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;"><button type="button" ${btnAdd2} onclick="${clickMod}('${paramId}', 50)">+50</button><button type="button" ${btnSub2} onclick="${clickMod}('${paramId}', -50)">-50</button></div>`;
        html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;"><button type="button" ${btnAdd3} onclick="${clickMod}('${paramId}', 100)">+100</button><button type="button" ${btnSub3} onclick="${clickMod}('${paramId}', -100)">-100</button></div>`;
        html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;"><button type="button" style="${btnStyleBase} background: #263238;" onclick="${clickMod}('${paramId}', 500)">+500</button><button type="button" style="${btnStyleBase} background: #3e2723;" onclick="${clickMod}('${paramId}', -500)">-500</button></div>`;
    } else {
        html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;"><button type="button" ${btnAdd1} onclick="${clickMod}('${paramId}', 1)">+1</button><button type="button" ${btnSub1} onclick="${clickMod}('${paramId}', -1)">-1</button></div>`;
        html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;"><button type="button" ${btnAdd2} onclick="${clickMod}('${paramId}', 5)">+5</button><button type="button" ${btnSub2} onclick="${clickMod}('${paramId}', -5)">-5</button></div>`;
        html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;"><button type="button" ${btnAdd3} onclick="${clickMod}('${paramId}', 10)">+10</button><button type="button" ${btnSub3} onclick="${clickMod}('${paramId}', -10)">-10</button></div>`;
    }
    
    html += `</div></div>`;
    return html;
}

export function dibujarPanelEdicionOP() {
    const nombre = estadoUI.personajeSeleccionado; const p = statsGlobal[nombre];
    if(!p) return ``;
    
    const pAfinidadesBase = [ { id: 'fisica', label: 'Física (BASE)', val: p.afinidadesBase.fisica }, { id: 'energetica', label: 'Energética (BASE)', val: p.afinidadesBase.energetica }, { id: 'espiritual', label: 'Espiritual (BASE)', val: p.afinidadesBase.espiritual }, { id: 'mando', label: 'Mando (BASE)', val: p.afinidadesBase.mando }, { id: 'psiquica', label: 'Psíquica (BASE)', val: p.afinidadesBase.psiquica }, { id: 'oscura', label: 'Oscura (BASE)', val: p.afinidadesBase.oscura } ];

    const pAfinidadesSpellEff = [ { id: 'fisica', label: 'Física (ALT)', val: p.hechizosEfecto.fisica }, { id: 'energetica', label: 'Energética (ALT)', val: p.hechizosEfecto.energetica }, { id: 'espiritual', label: 'Espiritual (ALT)', val: p.hechizosEfecto.espiritual }, { id: 'mando', label: 'Mando (ALT)', val: p.hechizosEfecto.mando }, { id: 'psiquica', label: 'Psíquica (ALT)', val: p.hechizosEfecto.psiquica }, { id: 'oscura', label: 'Oscura (ALT)', val: p.hechizosEfecto.oscura }, { id: 'danoRojo', label: 'Daño Rojo (ALT)', val: p.hechizosEfecto.danoRojo }, { id: 'danoAzul', label: 'Daño Azul (ALT)', val: p.hechizosEfecto.danoAzul }, { id: 'elimDorada', label: 'Elim. Dorada (ALT)', val: p.hechizosEfecto.elimDorada } ];
    const pBuffs = [ { id: 'fisica', label: 'Física (EXT)', val: p.buffs.fisica }, { id: 'energetica', label: 'Energética (EXT)', val: p.buffs.energetica }, { id: 'espiritual', label: 'Espiritual (EXT)', val: p.buffs.espiritual }, { id: 'mando', label: 'Mando (EXT)', val: p.buffs.mando }, { id: 'psiquica', label: 'Psíquica (EXT)', val: p.buffs.psiquica }, { id: 'oscura', label: 'Oscura (EXT)', val: p.buffs.oscura }, { id: 'danoRojo', label: 'Daño Rojo (EXT)', val: p.buffs.danoRojo }, { id: 'danoAzul', label: 'Daño Azul (EXT)', val: p.buffs.danoAzul }, { id: 'elimDorada', label: 'Elim. Dorada (EXT)', val: p.buffs.elimDorada } ];

    const renderHeader = (num, title, color) => `<h3 style="color:${color}; border-bottom:2px solid ${color}; padding-bottom:8px; text-align:left; margin: 30px 0 15px 0; font-family:'Cinzel'; text-transform: uppercase; font-size: 1.1em; opacity: 0.9;"><span style="background:${color}; color:#000; padding:2px 8px; border-radius:4px; margin-right:8px; font-weight:bold;">${num}</span> ${title}</h3>`;

    let html = `
        <div style="display:flex; justify-content:center; gap:15px; margin-bottom:25px; background: #0a0a0a; padding: 15px; border-radius: 8px; border: 1px solid #333;">
            <button type="button" onclick="window.toggleIdentidad('isPlayer')" style="flex: 1; padding: 12px; font-weight: bold; border-radius: 6px; cursor: pointer; border: 2px solid ${p.isPlayer ? '#00e676' : '#ff1744'}; background: ${p.isPlayer ? '#003300' : '#330000'}; color: white; transition: 0.2s;">🎭 ${p.isPlayer ? 'ROL: JUGADOR' : 'ROL: NPC'}</button>
            <button type="button" onclick="window.toggleIdentidad('isActive')" style="flex: 1; padding: 12px; font-weight: bold; border-radius: 6px; cursor: pointer; border: 2px solid ${p.isActive ? '#00e676' : '#ff1744'}; background: ${p.isActive ? '#003300' : '#330000'}; color: white; transition: 0.2s;">🌟 ${p.isActive ? 'ESTADO: ACTIVO' : 'ESTADO: INACTIVO'}</button>
        </div>
        
        ${renderHeader(1, 'Acciones Rápidas (Vida y Energía)', 'var(--gold)')}
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
            
            <div class="edit-card" style="background: #111; border: 1px solid var(--gold); border-radius: 8px; padding: 15px; text-align: center;">
                <h4 style="margin: 0 0 15px 0; color: var(--gold);">🪙 Sumar/Restar HEX</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                    <button type="button" style="background:#1b5e20; border:none; color:white; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modHexInd('${nombre}', 10)">+10</button>
                    <button type="button" style="background:#b71c1c; border:none; color:white; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modHexInd('${nombre}', -10)">-10</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                    <button type="button" style="background:#004d40; border:none; color:white; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modHexInd('${nombre}', 50)">+50</button>
                    <button type="button" style="background:#d84315; border:none; color:white; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modHexInd('${nombre}', -50)">-50</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button type="button" style="background:#4a148c; border:none; color:white; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modHexInd('${nombre}', 100)">+100</button>
                    <button type="button" style="background:#880e4f; border:none; color:white; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modHexInd('${nombre}', -100)">-100</button>
                </div>
            </div>

            <div class="edit-card" style="background: #110000; border: 1px solid var(--red-life); border-radius: 8px; padding: 15px; text-align: center;">
                <h4 style="margin: 0 0 15px 0; color: var(--red-life);">❤️ Curar/Dañar (Vida Roja)</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                    <button type="button" style="background:#1b5e20; border:none; color:white; padding:12px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modLibre('vidaRojaActual', 1)">+1 (Cura)</button>
                    <button type="button" style="background:#b71c1c; border:none; color:white; padding:12px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modLibre('vidaRojaActual', -1)">-1 (Daño)</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button type="button" style="background:#004d40; border:none; color:white; padding:12px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modLibre('vidaRojaActual', 5)">+5 (Cura)</button>
                    <button type="button" style="background:#d84315; border:none; color:white; padding:12px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modLibre('vidaRojaActual', -5)">-5 (Daño)</button>
                </div>
            </div>

            <div class="edit-card" style="background: linear-gradient(180deg, #1a1a00 0%, #332b00 100%); border: 1px solid var(--gold); border-radius: 8px; padding: 15px; text-align: center; display: flex; flex-direction: column; justify-content: center;">
                <h4 style="margin: 0 0 10px 0; color: #fff;">⚖️ Restauración Óptima</h4>
                <p style="font-size:0.75em; color:#ddd; margin: 0 0 15px 0; line-height: 1.4;">Resetea las bases calculando: Límite Rojo [10 + Fis/2], Vida Azul [Magia/4] y cura al máximo.</p>
                <button type="button" onclick="window.recalcularBases()" style="background:var(--gold); color:#000; font-weight:bold; width:100%; padding:15px; font-size:1.1em; border-radius:6px; cursor: pointer; border: none; font-family:'Cinzel'; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">RECALCULAR CORAZONES</button>
            </div>
        </div>

        ${renderHeader(2, 'Límites de Vitalidad (BASE y EXT)', '#ff4444')}
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px;">
            ${genCard({id: 'vidaRojaMax', label: 'Límite Rojo (BASE)', val: p.baseVidaRojaMax}, 'baseTop')}
            ${genCard({id: 'vidaAzul', label: 'C. Azules (BASE)', val: p.baseVidaAzul}, 'baseTop')}
            ${genCard({id: 'guardaDorada', label: 'G. Dorada (BASE)', val: p.baseGuardaDorada}, 'baseTop')}
            ${genCard({id: 'vidaRojaMaxExtra', label: 'Límite Rojo <span style="color:#00e676">(EXT)</span>', val: p.buffs.vidaRojaMaxExtra}, 'buff')}
            ${genCard({id: 'vidaAzulExtra', label: 'C. Azules <span style="color:#00e676">(EXT)</span>', val: p.buffs.vidaAzulExtra}, 'buff')}
            ${genCard({id: 'guardaDoradaExtra', label: 'G. Dorada <span style="color:#00e676">(EXT)</span>', val: p.buffs.guardaDoradaExtra}, 'buff')}
        </div>

        ${renderHeader(3, 'Atributos y Afinidades BASE (Permanentes)', '#fff')}
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px;">
            ${genCard({id: 'danoRojo', label: 'Daño Rojo (BASE)', val: p.baseDanoRojo}, 'baseTop')}
            ${genCard({id: 'danoAzul', label: 'Daño Azul (BASE)', val: p.baseDanoAzul}, 'baseTop')}
            ${genCard({id: 'elimDorada', label: 'Elim. Dorada (BASE)', val: p.baseElimDorada}, 'baseTop')}
            ${pAfinidadesBase.map(f => genCard(f, 'baseAfin')).join('')}
        </div>

        ${renderHeader(4, 'Alteración por Efectos de Hechizos (ALT)', '#4a90e2')}
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px;">
            ${pAfinidadesSpellEff.map(f => genCard(f, 'spellEffAfin')).join('')}
        </div>

        ${renderHeader(5, 'Extras Temporales Buffs/Objetos (EXT)', '#00e676')}
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px;">
            ${pBuffs.map(f => genCard(f, 'buff')).join('')}
        </div>

        ${renderHeader(6, 'Efectos de Estado', '#aaaaaa')}
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom:20px;">
    `;

    let estadosHtml = '';
    listaEstados.forEach(e => {
        let val = p.estados[e.id];
        if (e.tipo === 'numero') {
            estadosHtml += `<div class="edit-card" style="background: #111; border: 1px solid ${e.border}; border-radius: 8px; padding: 10px; text-align: center;" title="${e.desc}">
                <h4 style="margin: 0 0 10px 0; color: #ddd; font-size: 0.9em;">${e.nombre}</h4>
                <span style="color:${e.border}; font-size:1.8em; font-weight:bold; display:block; margin-bottom: 10px;">${val}</span>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                    <button type="button" style="background:#1b5e20; border:none; color:white; padding:6px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modEstado('${e.id}', 1)">+1</button>
                    <button type="button" style="background:#b71c1c; border:none; color:white; padding:6px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modEstado('${e.id}', -1)">-1</button>
                </div>
            </div>`;
        } else {
            let extraStyle = val ? `background:${e.bg}; color:${e.id==='huesos'?'#000':'#fff'}; border-color:${e.border}; box-shadow: 0 0 10px ${e.border};` : `background: #111; color: #555; border-color: #333;`;
            estadosHtml += `<button type="button" class="status-toggle ${val ? 'active' : ''}" style="padding: 12px; border-radius: 6px; border: 2px solid; font-weight: bold; cursor: pointer; transition: 0.2s; ${extraStyle}" title="${e.desc}" onclick="window.toggleEstado('${e.id}')">${e.nombre}</button>`;
        }
    });
    html += estadosHtml + `</div>`;

    html += `
        <div style="margin-top:30px; background: linear-gradient(135deg, #1a0033 0%, #0a001a 100%); border: 1px solid var(--gold); padding: 20px; border-radius: 12px; text-align: center;">
            <h3 style="margin: 0 0 15px 0; color: var(--gold); font-family: 'Cinzel'; text-transform: uppercase;">🛠️ Clonación e Importación de Datos</h3>
            <div style="display:flex; justify-content:center; align-items:stretch; gap:10px; flex-wrap:wrap;">
                <select id="clon-source" style="padding: 12px; background: #000; color: white; border: 1px solid var(--gold); border-radius: 6px; font-family: 'Cinzel'; min-width: 250px; font-size: 1em;">
                    <option value="" disabled selected>-- Selecciona Origen --</option>
                    ${Object.keys(statsGlobal).filter(n => n !== nombre).sort().map(n => `<option value="${n}">${n}</option>`).join('')}
                </select>
                <button type="button" onclick="window.ejecutarClonacion('estados')" style="background:#004a4a; border:none; border-bottom: 3px solid #00ffff; border-radius: 6px; padding:10px 15px; color:white; font-weight:bold; cursor:pointer; transition:0.2s;" onmouseover="this.style.filter='brightness(1.2)'" onmouseout="this.style.filter='brightness(1)'">Importar Estados</button>
                <button type="button" onclick="window.ejecutarClonacion('efectosExtras')" style="background:#4a90e2; border:none; border-bottom: 3px solid #1a365d; border-radius: 6px; padding:10px 15px; color:#111; font-weight:bold; cursor:pointer; transition:0.2s;" onmouseover="this.style.filter='brightness(1.2)'" onmouseout="this.style.filter='brightness(1)'">Copiar Efectos</button>
                <button type="button" onclick="window.ejecutarClonacion('hex')" style="background:#b8860b; border:none; border-bottom: 3px solid #ffd700; border-radius: 6px; padding:10px 15px; color:#000; font-weight:bold; cursor:pointer; transition:0.2s;" onmouseover="this.style.filter='brightness(1.2)'" onmouseout="this.style.filter='brightness(1)'">Copiar HEX</button>
                <button type="button" onclick="window.ejecutarClonacion('completo')" style="background:#4a004a; border:none; border-bottom: 3px solid #ff00ff; border-radius: 6px; padding:10px 15px; color:white; font-weight:bold; cursor:pointer; transition:0.2s;" onmouseover="this.style.filter='brightness(1.2)'" onmouseout="this.style.filter='brightness(1)'">Clonar Todo</button>
            </div>
        </div>
    `;

    return html;
}

export function dibujarMenuOP() {
    return `
        <h3 style="color: var(--gold); font-family: 'Cinzel'; text-align: center; font-size: 2em; margin-bottom: 30px; text-transform: uppercase; text-shadow: 0 0 10px rgba(212,175,55,0.5);">PANEL GENERAL MÁSTER</h3>
        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; margin-bottom: 30px;">
            <button type="button" onclick="window.mostrarPaginaOP('hex')" style="background: linear-gradient(135deg, #b8860b 0%, #d4af37 100%); color: #000; font-weight: bold; border: none; padding: 12px 25px; border-radius: 8px; font-size: 1.1em; cursor: pointer; box-shadow: 0 4px 10px rgba(212,175,55,0.3); transition: 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">⚔️ Gestión de HEX y Party</button>
            <button type="button" onclick="window.mostrarPaginaOP('crear')" style="background: linear-gradient(135deg, #004a4a 0%, #008080 100%); color: white; font-weight: bold; border: none; padding: 12px 25px; border-radius: 8px; font-size: 1.1em; cursor: pointer; box-shadow: 0 4px 10px rgba(0,128,128,0.3); transition: 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">🛠️ Forjar Nuevo NPC</button>
            <button type="button" onclick="window.descargarAumentada()" style="background: linear-gradient(135deg, #333 0%, #555 100%); color: white; font-weight: bold; border: none; padding: 12px 25px; border-radius: 8px; font-size: 1.1em; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transition: 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">📥 Descargar CSV Aumentado</button>
        </div>
        <div id="sub-vista-op"></div>
    `;
}

export function dibujarHexOP() {
    let html = `<div style="text-align:center; max-width:1200px; margin:0 auto;">
        <h2 style="color:var(--gold); margin-top:0; font-family: 'Cinzel';">Gestión de HEX y Party (MÁSTER)</h2>
        
        <div style="background:#1a0033; padding:20px; border-radius:12px; border:1px solid var(--gold); margin-bottom:25px; box-shadow: 0 0 15px rgba(212,175,55,0.1);">
            <h3 style="color:var(--gold); margin-top:0;">Party Activa (Máx 6 Slots)</h3>
            <div style="display:flex; justify-content:center; gap:15px; flex-wrap:wrap; margin-bottom:20px;">`;
    
    for(let i=0; i<6; i++) {
        const char = estadoUI.party[i];
        if(char && statsGlobal[char]) {
            const icono = normalizar(statsGlobal[char]?.iconoOverride || char);
            html += `<div style="width:90px; height:90px; border:3px solid var(--gold); border-radius:10px; background:url('../img/imgpersonajes/${icono}icon.png') center/cover; position:relative; box-shadow: 0 4px 8px rgba(0,0,0,0.5);" title="${char}">
                <button onclick="window.togglePartyMember('${char}', false)" style="position:absolute; top:-10px; right:-10px; background:#ff0000; color:white; border-radius:50%; width:28px; height:28px; font-size:16px; font-weight:bold; border:2px solid #fff; cursor:pointer; padding:0; display:flex; align-items:center; justify-content:center; transition: 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">X</button>
                <div style="position:absolute; bottom:0; background:rgba(0,0,0,0.8); width:100%; font-size:0.7em; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:4px 0; border-radius:0 0 7px 7px; color: var(--gold); font-weight: bold;">${char}</div>
            </div>`;
        } else {
            html += `<div style="width:90px; height:90px; border:2px dashed #555; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:2em; color:#555; background:#0a0a0a;">${i+1}</div>`;
        }
    }
    
    html += `</div>
            
            <div style="margin: 15px auto; max-width: 800px; background: #050510; border: 1px solid #4a90e2; border-radius: 8px; padding: 20px; text-align: left;">
                <h4 style="margin: 0 0 15px 0; color: #4a90e2; text-align: center;">Seleccionar Jugadores de la Lista</h4>
                <div style="max-height: 200px; overflow-y: auto; padding-right: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">`;
    
    Object.keys(statsGlobal).sort().forEach(nombre => {
        const p = statsGlobal[nombre];
        if (p.isPlayer) {
            const isChecked = estadoUI.party.includes(nombre) ? 'checked' : '';
            const iconoMuestra = normalizar(p.iconoOverride || nombre);
            html += `
                <label style="display:flex; align-items:center; gap:10px; background:#111; padding:10px; border-radius:6px; border:1px solid #333; cursor:pointer; transition:0.2s; user-select:none;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='#333'">
                    <input type="checkbox" ${isChecked} onchange="window.togglePartyMember('${nombre}', this.checked)" style="transform:scale(1.4); cursor:pointer; margin-left: 5px;">
                    <img src="../img/imgpersonajes/${iconoMuestra}icon.png" style="width:35px; height:35px; border-radius:50%; border:1px solid #fff; object-fit:cover;" onerror="${imgError}">
                    <span style="color:white; font-size:0.9em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:bold; flex:1;">${nombre}</span>
                </label>
            `;
        }
    });

    html += `   </div>
            </div>
            <div style="display:flex; justify-content:center; gap:15px; flex-wrap:wrap; margin-top:25px;">
                <button type="button" onclick="window.establecerPartyActiva()" style="background: linear-gradient(135deg, #004a00 0%, #006600 100%); border: none; color: white; font-weight: bold; padding: 12px 20px; border-radius: 6px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.filter='brightness(1.2)'" onmouseout="this.style.filter='brightness(1)'">✓ ESTABLECER COMO ÚNICOS ACTIVOS</button>
                <button type="button" onclick="window.vaciarParty()" style="background: linear-gradient(135deg, #4a0000 0%, #660000 100%); border: none; color: white; padding: 12px 20px; border-radius: 6px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.filter='brightness(1.2)'" onmouseout="this.style.filter='brightness(1)'">🗑️ VACIAR SLOTS</button>
                <button type="button" onclick="window.addAsistenciaGlobal()" style="background: linear-gradient(135deg, #4a004a 0%, #660066 100%); border: none; color: white; font-weight: bold; padding: 12px 20px; border-radius: 6px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.filter='brightness(1.2)'" onmouseout="this.style.filter='brightness(1)'">⭐ SUMAR ASISTENCIA (+1) A PARTY</button>
            </div>
        </div>
        
        <div style="background:#050a1a; padding:20px; border-radius:12px; border:1px solid var(--blue-life); margin-bottom:25px; box-shadow: 0 0 15px rgba(74,144,226,0.1);">
            <h3 style="color:var(--blue-life); margin-top:0;">Dar HEX Global (A todos los presentes en los Slots)</h3>
            <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
                <button type="button" onclick="window.modHexGlobal(10)" style="background:#1b5e20; color:white; border:none; padding:10px 15px; border-radius:6px; font-weight:bold; cursor:pointer;">+10</button>
                <button type="button" onclick="window.modHexGlobal(-10)" style="background:#b71c1c; color:white; border:none; padding:10px 15px; border-radius:6px; font-weight:bold; cursor:pointer;">-10</button>
                <button type="button" onclick="window.modHexGlobal(50)" style="background:#004d40; color:white; border:none; padding:10px 15px; border-radius:6px; font-weight:bold; cursor:pointer; margin-left: 10px;">+50</button>
                <button type="button" onclick="window.modHexGlobal(-50)" style="background:#d84315; color:white; border:none; padding:10px 15px; border-radius:6px; font-weight:bold; cursor:pointer;">-50</button>
                <button type="button" onclick="window.modHexGlobal(100)" style="background:#4a148c; color:white; border:none; padding:10px 15px; border-radius:6px; font-weight:bold; cursor:pointer; margin-left: 10px;">+100</button>
                <button type="button" onclick="window.modHexGlobal(-100)" style="background:#880e4f; color:white; border:none; padding:10px 15px; border-radius:6px; font-weight:bold; cursor:pointer;">-100</button>
                <button type="button" onclick="window.modHexGlobal(500)" style="background:#263238; color:white; border:none; padding:10px 15px; border-radius:6px; font-weight:bold; cursor:pointer; margin-left: 10px;">+500</button>
                <button type="button" onclick="window.modHexGlobal(-500)" style="background:#3e2723; color:white; border:none; padding:10px 15px; border-radius:6px; font-weight:bold; cursor:pointer;">-500</button>
                <button type="button" onclick="window.modHexGlobal(1000)" style="background:#000; border: 1px solid var(--gold); color:var(--gold); padding:10px 15px; border-radius:6px; font-weight:bold; cursor:pointer; margin-left: 10px;">+1000</button>
            </div>
        </div>

        <div class="edit-grid-6" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">`;

    estadoUI.party.forEach(nombre => {
        if (nombre && statsGlobal[nombre]) {
            const p = statsGlobal[nombre];
            const asisTexto = p.isPlayer ? `(${p.asistencia || 1}/7)` : `(NPC)`;
            const iconoMuestra = normalizar(p.iconoOverride || nombre);
            html += `
            <div class="edit-card" style="background: #111; border: 1px solid var(--gold); border-radius: 12px; padding: 20px;">
                <div style="display:flex; align-items:center; gap:15px; margin-bottom:15px; border-bottom: 1px solid #333; padding-bottom: 15px;">
                    <img src="../img/imgpersonajes/${iconoMuestra}icon.png" style="width:60px; height:60px; border-radius:50%; border:2px solid var(--gold); object-fit:cover; background:#000;" onerror="${imgError}">
                    <div style="text-align:left;">
                        <h4 style="margin:0 0 5px 0; font-size:1.1em; color: #fff;">${nombre}</h4>
                        <div style="color:var(--gold); font-size:1.1em; font-weight:bold;">HEX: ${p.hex}</div>
                        <div style="color:#aaa; font-size:0.8em; margin-top: 2px;">Asistencia: ${asisTexto}</div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                    <button type="button" style="background:#1b5e20; border:none; color:white; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modHexInd('${nombre}', 10)">+10</button>
                    <button type="button" style="background:#b71c1c; border:none; color:white; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modHexInd('${nombre}', -10)">-10</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                    <button type="button" style="background:#004d40; border:none; color:white; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modHexInd('${nombre}', 50)">+50</button>
                    <button type="button" style="background:#d84315; border:none; color:white; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modHexInd('${nombre}', -50)">-50</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                    <button type="button" style="background:#4a148c; border:none; color:white; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modHexInd('${nombre}', 100)">+100</button>
                    <button type="button" style="background:#880e4f; border:none; color:white; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modHexInd('${nombre}', -100)">-100</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button type="button" style="background:#263238; border:none; color:white; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modHexInd('${nombre}', 500)">+500</button>
                    <button type="button" style="background:#3e2723; border:none; color:white; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modHexInd('${nombre}', -500)">-500</button>
                </div>
            </div>`;
        }
    });

    html += `</div>
        <div style="margin-top:30px; background:#1a0033; padding:20px; border:1px dashed var(--gold); border-radius:12px;">
            <h3 style="margin-top:0; color:var(--gold); font-family: 'Cinzel';">Registro de HEX Unificado (Portapapeles)</h3>
            <textarea id="hex-log-textarea" readonly style="width:100%; box-sizing: border-box; height:180px; background:#000; color:#fff; border:1px solid #444; border-radius: 6px; padding:15px; font-family:monospace; font-size: 1.1em; margin-bottom:15px; resize: none;"></textarea>
            <div style="display:flex; gap:15px;">
                <button type="button" onclick="window.copiarHexLog(event)" style="flex:3; background:var(--gold); color:black; font-weight:bold; font-family:'Cinzel'; border: none; padding: 15px; border-radius: 6px; font-size: 1.2em; cursor: pointer; transition: 0.2s;" onmouseover="this.style.filter='brightness(1.2)'" onmouseout="this.style.filter='brightness(1)'">📄 COPIAR LOG</button>
                <button type="button" onclick="window.limpiarHexLog()" style="flex:1; background:#4a0000; color:white; font-family:'Cinzel'; border: none; padding: 15px; border-radius: 6px; font-size: 1.2em; cursor: pointer; transition: 0.2s;" onmouseover="this.style.filter='brightness(1.2)'" onmouseout="this.style.filter='brightness(1)'">🗑️ LIMPIAR</button>
            </div>
        </div>
    </div>`;
    return html;
}

export function dibujarFormularioCrear() {
    const pEnergia = [ { id:'npc-hex', label:'HEX Inicial', val:0, esHex:true }, { id:'npc-vex', label:'VEX Inicial', val:0, esHex:true } ];
    const pVidaDano = [ { id:'npc-vra', label:'Corazones Actuales', val:10 }, { id:'npc-vrm', label:'Corazones (Límite Máx)', val:10 }, { id:'npc-va', label:'Corazones Azules', val:0 }, { id:'npc-gd', label:'Guarda Dorada', val:0 }, { id:'npc-dr', label:'Daño Rojo', val:1 }, { id:'npc-da', label:'Daño Azul', val:0 }, { id:'npc-ed', label:'Elim. Dorada', val:0 } ];
    const pAfinidades = [ { id:'npc-fis', label:'Física' }, { id:'npc-ene', label:'Energética' }, { id:'npc-esp', label:'Espiritual' }, { id:'npc-man', label:'Mando' }, { id:'npc-psi', label:'Psíquica' }, { id:'npc-osc', label:'Oscura' } ];
    
    let afinGridHtml = '';
    pAfinidades.forEach(f => {
        afinGridHtml += `
        <div class="edit-card" style="background: #111; border: 1px solid #333; padding: 15px; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #aaa;">Afin. ${f.label}</h4>
            <input type="number" id="${f.id}" value="0" oninput="window.updateCreationAfinitySum()" style="width:100%; text-align:center; background:#000; color:white; border:1px solid #444; border-radius: 4px; margin-bottom:10px; font-size:1.5em; padding:8px; box-sizing:border-box;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px;"><button type="button" style="background:#1b5e20; border:none; color:white; padding:6px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modForm('${f.id}', 1); window.updateCreationAfinitySum();">+1</button><button type="button" style="background:#b71c1c; border:none; color:white; padding:6px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modForm('${f.id}', -1); window.updateCreationAfinitySum();">-1</button></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;"><button type="button" style="background:#004d40; border:none; color:white; padding:6px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modForm('${f.id}', 5); window.updateCreationAfinitySum();">+5</button><button type="button" style="background:#d84315; border:none; color:white; padding:6px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.modForm('${f.id}', -5); window.updateCreationAfinitySum();">-5</button></div>
        </div>`;
    });

    return `
    <div style="text-align:center; max-width:1000px; margin:0 auto; padding: 20px; background: rgba(0,0,0,0.5); border-radius: 12px; border: 1px solid #222;">
        <h3 style="margin-top:0; color:var(--gold); font-family: 'Cinzel'; font-size: 2em; margin-bottom: 30px;">Forja de Personaje MÁSTER</h3>
        
        <input type="text" id="npc-nombre" placeholder="Nombre del Personaje..." style="width:100%; max-width:500px; margin-bottom:30px; padding:15px; background:#000; color:var(--gold); border:2px solid var(--gold); border-radius: 8px; font-size:1.5em; text-align:center; font-family:'Cinzel'; box-shadow: 0 0 15px rgba(212,175,55,0.2);">
        
        <div style="background:#1a0033; padding:20px; border-radius:12px; margin-bottom:30px; border:1px solid var(--gold); max-width:600px; margin-left:auto; margin-right:auto;">
            <h3 style="color:var(--gold); margin-top:0; font-family: 'Cinzel';">Identidad Inicial</h3>
            <div style="display:flex; justify-content:center; gap:20px;">
                <button type="button" id="btn-crear-rol" onclick="window.toggleCrearRol()" data-val="npc" style="flex: 1; padding: 15px; background:#4a0000; border: 2px solid #ff0000; border-radius: 8px; color:white; font-weight: bold; font-size: 1.1em; cursor: pointer; transition: 0.2s;">🎭 ROL: NPC</button>
                <button type="button" id="btn-crear-act" onclick="window.toggleCrearAct()" data-val="activo" style="flex: 1; padding: 15px; background:#004a00; border: 2px solid #00ff00; border-radius: 8px; color:white; font-weight: bold; font-size: 1.1em; cursor: pointer; transition: 0.2s;">🌟 ESTADO: ACTIVO</button>
            </div>
        </div>

        <h3 style="color:#aaa; border-bottom: 1px solid #333; padding-bottom: 10px; text-align: left; font-family: 'Cinzel'; margin-top: 30px;">1. Energía Base</h3>
        <div class="edit-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px;">
            ${pEnergia.map(f => genCard(f, 'form')).join('')}
        </div>
        
        <h3 style="color:#aaa; border-bottom: 1px solid #333; padding-bottom: 10px; text-align: left; font-family: 'Cinzel'; margin-top: 30px;">2. Vitalidad y Ofensiva Base</h3>
        <div class="edit-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px;">
            ${pVidaDano.map(f => genCard(f, 'form')).join('')}
        </div>
        
        <h3 style="color:#aaa; border-bottom: 1px solid #333; padding-bottom: 10px; text-align: left; font-family: 'Cinzel'; margin-top: 30px;">3. Afinidades Base</h3>
        <div class="edit-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 15px;">
            ${afinGridHtml}
        </div>
        <div id="creation-affinity-sum-display" style="text-align:center; color:var(--gold); background: #111; padding: 10px; border-radius: 6px; border: 1px dashed var(--gold); font-weight:bold; font-size:1.2em; margin-bottom:40px; font-family:monospace; max-width: 300px; margin-left: auto; margin-right: auto;">Total Afinidades: 0</div>
        
        <button type="button" onclick="window.ejecutarCreacionNPC()" style="width:100%; max-width:500px; background: linear-gradient(135deg, #b8860b 0%, #d4af37 100%); border: none; color:black; font-weight:bold; font-size:1.5em; padding:20px; border-radius:8px; font-family:'Cinzel'; cursor: pointer; box-shadow: 0 5px 15px rgba(212,175,55,0.4); transition: 0.2s;" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'">✨ FORJAR PERSONAJE ✨</button>
    </div>`;
}

export function dibujarFormularioEditar() {
    return `<p>Editor movido a Modal OP dentro de la ficha.</p>`;
}




