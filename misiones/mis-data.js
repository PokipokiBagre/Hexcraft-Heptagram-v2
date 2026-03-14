import { misGlobal, jugadoresActivos, estadoUI } from './mis-state.js';

const CSV_MISIONES = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTI_7MnwczeHhMCuQ_YInOHBvVUFv7ZSp_bsvFqkTmC_GvSdINkoskGPk__u9dq9XHTeVo4AMAMQl7v/pub?output=csv'; 
const CSV_STATS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQOl-ENpkVGioSaquRc1pkuNUyk-vCEQGGSAN3MMtzwcP5AjlLTLbjsc4wAdy3fcQgRhzQAZ2CtRWbx/pub?output=csv';
const API_MISIONES = 'https://script.google.com/macros/s/AKfycbyDBdYRAVyt1ZxgjXu7_MzLCXothXR_mtocQfctwA8vnSa8Qm_GGfsquq2jAAiyciUe/exec'; 

export async function cargarDatos() {
    try {
        const [resMis, resStats] = await Promise.all([
            fetch(CSV_MISIONES + '&cb=' + new Date().getTime()),
            fetch(CSV_STATS + '&cb=' + new Date().getTime())
        ]);
        
        parsearStats(await resStats.text());
        parsearMisiones(await resMis.text());
    } catch (e) {
        console.error("Error cargando CSVs:", e);
    }
}

function csvSplit(row) {
    let result = []; let cur = ''; let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
        let char = row[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { result.push(cur); cur = ''; } 
        else cur += char;
    }
    result.push(cur); return result;
}

function parsearStats(texto) {
    const filas = texto.split(/\r?\n/);
    jugadoresActivos.length = 0;
    
    filas.slice(1).forEach(f => {
        if(!f.trim()) return;
        const c = csvSplit(f).map(m => m.replace(/^"|"$/g, '').trim());

        if (c.length > 17) {
            const nombre = c[0];
            const idenParts = (c[17] || '0_1').split('_');
            const isPlayer = idenParts[0] === '1';
            const isActive = idenParts[1] === '1';
            const icon = c[18] ? c[18] : nombre;

            const afis = { 
                'Física': parseInt((c[3]||'0').split('_')[0])||0, 
                'Energética': parseInt((c[4]||'0').split('_')[0])||0, 
                'Espiritual': parseInt((c[5]||'0').split('_')[0])||0, 
                'Mando': parseInt((c[6]||'0').split('_')[0])||0, 
                'Psíquica': parseInt((c[7]||'0').split('_')[0])||0, 
                'Oscura': parseInt((c[8]||'0').split('_')[0])||0 
            };
            let max = -1; let mayor = "Física";
            for(let key in afis) { if(afis[key] > max && afis[key] > 0) { max = afis[key]; mayor = key; } }
            
            if (isPlayer && isActive) {
                jugadoresActivos.push({ nombre, icon, afinidad: mayor });
            }
        }
    });
}

function parsearMisiones(texto) {
    const filas = texto.split(/\r?\n/);
    misGlobal.length = 0; 
    filas.slice(1).forEach((f, index) => {
        if(!f.trim()) return;
        const c = csvSplit(f).map(m => m.replace(/^"|"$/g, '').trim());
        if(!c[0]) return;
        
        misGlobal.push({
            id: c[0], 
            titulo: c[0], 
            tipo: c[1] || 'Personalizada', 
            cupos: !isNaN(parseInt(c[2])) ? parseInt(c[2]) : 2,
            estado: parseInt(c[3]) || 0, 
            clase: c[4] ? c[4].replace(/Clase/gi, '').trim() : '1', 
            desc: c[5] || '', 
            notaOP: c[6] || '', 
            jugadores: c[7] ? c[7].split(',').map(j=>j.trim()).filter(j=>j) : [], 
            autor: c[9] || 'OP', 
            orden: index 
        });
    });
}

export async function sincronizarBD() {
    try {
        const payload = { accion: 'sincronizar_misiones', misiones: estadoUI.colaCambios.misiones };
        const res = await fetch(API_MISIONES, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
        const data = await res.json();
        return data.status === 'success';
    } catch(e) { return false; }
}
