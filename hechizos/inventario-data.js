import { db } from './inventario-state.js';

const API_HECHIZOS = 'https://script.google.com/macros/s/AKfycby1jLgF-2bGWv0QW0Eg8u7msZ-ab2eQa--olIWQHsin8Kyz0y0xHevK7YyGyMyzq1BWKw/exec';

const API_ESTADISTICAS = 'https://script.google.com/macros/s/AKfycbwW4AXM9QSrPYR4vjXPdwSEhV1Q-t9S0exoskZQGoerVRJOsEMzReN1piMWzCfzW_RLmQ/exec'; 

const CSV_PERSONAJES = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQOl-ENpkVGioSaquRc1pkuNUyk-vCEQGGSAN3MMtzwcP5AjlLTLbjsc4wAdy3fcQgRhzQAZ2CtRWbx/pub?output=csv';

export async function inicializarDatos(barraProgreso) {
    try {
        if(barraProgreso) barraProgreso.style.width = '30%';
        const resPj = await fetch(CSV_PERSONAJES + '&cb=' + new Date().getTime());
        parsearCSVPersonajes(await resPj.text());

        if(barraProgreso) barraProgreso.style.width = '60%';
        const resHz = await fetch(API_HECHIZOS);
        db.hechizos = JSON.parse(decodeURIComponent(escape(window.atob(await resHz.text()))));

        if(barraProgreso) barraProgreso.style.width = '100%';
        return true;
    } catch (e) { return false; }
}

function parsearCSVPersonajes(texto) {
    const filas = texto.split(/\r?\n/).map(l => {
        let matches = l.match(/(\s*"[^"]+"\s*|\s*[^,]+|,)(?=,|$)/g);
        if(!matches) return []; return matches.map(m => m.replace(/^,/, '').replace(/^"|"$/g, '').trim());
    });
    db.csvHeadersPersonajes = filas[0];
    for (let k in db.personajes) delete db.personajes[k];

    filas.slice(1).forEach(f => {
        if(!f[0]) return;
        const nombre = f[0]; const idenParts = (f[17] || '0_1').split('_');
        const getBase = (idx) => parseInt((f[idx] || '0').split('_')[0]) || 0;
        
        const afis = { 'Física': getBase(3), 'Energética': getBase(4), 'Espiritual': getBase(5), 'Mando': getBase(6), 'Psíquica': getBase(7), 'Oscura': getBase(8) };
        
        let mayorAfinidad = 'Ninguna'; let maxVal = -1;
        for (const [key, val] of Object.entries(afis)) { if(val > maxVal && val > 0) { maxVal = val; mayorAfinidad = key; } }

        db.personajes[nombre] = {
            isPlayer: idenParts[0] === '1', isActive: idenParts[1] === '1',
            iconoOverride: f[18] !== '' ? f[18] : nombre,
            hex: f[1] ? parseInt(f[1].split('_')[0]) || 0 : 0,
            mayorAfinidad: mayorAfinidad, 
            afinidades: afis, 
            rawRow: f 
        };
    });
}

// Nueva función de guardado dual
export async function sincronizarColaBD(cola) {
    try {
        let successHechizos = true;
        let successStats = true;

        // 1. Enviar datos de Inventario a API Hechizos (Si hay cambios)
        if (cola.agregar.length > 0 || cola.quitar.length > 0 || cola.toggleConocido.length > 0) {
            console.log("Enviando Inventario a API Hechizos...");
            const resHechizos = await fetch(API_HECHIZOS, { 
                method: 'POST', 
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ 
                    accion: 'sincronizar_inventario', 
                    agregar: cola.agregar, 
                    quitar: cola.quitar, 
                    toggleConocido: cola.toggleConocido 
                }) 
            });
            const textHechizos = await resHechizos.text();
            try {
                const jsonHechizos = JSON.parse(textHechizos);
                if (jsonHechizos.status !== 'success') {
                    alert("Error en API Hechizos:\n" + jsonHechizos.message);
                    successHechizos = false;
                }
            } catch(e) {
                console.error("Error parseando resHechizos:", textHechizos);
                successHechizos = false;
            }
        }

        // 2. Enviar datos de Estadísticas a API Estadísticas (Si hay cambios)
        if (cola.stats && Object.keys(cola.stats).length > 0) {
            console.log("Enviando Estadísticas (Z) a API Estadísticas...", cola.stats);
            const resStats = await fetch(API_ESTADISTICAS, { 
                method: 'POST', 
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ 
                    accion: 'sincronizar_stats', 
                    stats: cola.stats 
                }) 
            });
            const textStats = await resStats.text();
            try {
                const jsonStats = JSON.parse(textStats);
                if (jsonStats.status !== 'success') {
                    alert("Error en API Estadísticas:\n" + jsonStats.message);
                    successStats = false;
                }
            } catch(e) {
                console.error("Error parseando resStats:", textStats);
                successStats = false;
            }
        }

        return successHechizos && successStats;

    } catch (e) { 
        alert("Fallo crítico de Red al intentar contactar a los servidores.");
        return false; 
    }
}

export function exportarCSVPersonajes() {
    let csv = db.csvHeadersPersonajes.join(",") + "\n";
    Object.keys(db.personajes).sort().forEach(n => {
        csv += db.personajes[n].rawRow.map((v, i) => (i===0||i===1||i===2||i===9) ? String(v) : `"${v}"`).join(",") + "\n";
    });
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = "HEX_PERSONAJES_MODIFICADO.csv"; link.click();
}
