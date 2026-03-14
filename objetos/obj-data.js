import { invGlobal, objGlobal, statsGlobal, guardar } from './obj-state.js';

const API_OBJETOS = 'https://script.google.com/macros/s/AKfycbzPv0e8nKY8hTX7_rIJixL4EmFLDHaX-QHjNTNFonMz7hamiJfn__GAH1PtZeFFG5eU/exec'; 

export async function cargarTodoDesdeCSV() {
    const sheetObjURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQDaZ1Zr9YWmgW05Hzpv4IQzpMaKrgSvVUm_Yrps3DdwwPpIjD4iHrdLyPHGucuTHnwwYdM7bPrcnRO/pub?output=csv&cachebust=" + new Date().getTime();
    const sheetStatsURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOl-ENpkVGioSaquRc1pkuNUyk-vCEQGGSAN3MMtzwcP5AjlLTLbjsc4wAdy3fcQgRhzQAZ2CtRWbx/pub?output=csv&cachebust=" + new Date().getTime();

    try {
        const [resObj, resStats] = await Promise.all([
            fetch(sheetObjURL).then(r => r.text()),
            fetch(sheetStatsURL).then(r => r.text())
        ]);
        
        // 1. PROCESAR OBJETOS
        const filasObj = resObj.split(/\r?\n/).map(l => l.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim()));
        for (let k in invGlobal) delete invGlobal[k];
        for (let k in objGlobal) delete objGlobal[k];

        filasObj.slice(1).forEach(f => {
            const nombre = f[0]; if (!nombre) return;
            objGlobal[nombre] = { 
                tipo: f[1] || '-', mat: f[2] || '-', eff: f[3] || 'Sin descripción', rar: f[4] || 'Común',
                desc: f[7] || '', 
                afinidades: { "Física": parseInt(f[8]) || 0, "Energética": parseInt(f[9]) || 0, "Espiritual": parseInt(f[10]) || 0, "Mando": parseInt(f[11]) || 0, "Psíquica": parseInt(f[12]) || 0, "Oscura": parseInt(f[13]) || 0 }
            };
            const jugs = f[5] ? f[5].split(',').map(j => j.trim()) : [];
            const cants = f[6] ? f[6].split(',').map(c => parseInt(c.trim()) || 0) : [];
            jugs.forEach((j, i) => {
                if (!invGlobal[j]) invGlobal[j] = {};
                invGlobal[j][nombre] = (cants[i] || 0);
            });
        });

        // 2. PROCESAR ESTADÍSTICAS (Identidades)
        const filasStats = resStats.split(/\r?\n/).map(l => l.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim()));
        for (let k in statsGlobal) delete statsGlobal[k];

        filasStats.slice(1).forEach(f => {
            const nombre = f[0]; if (!nombre) return;
            const idenParts = (f[17] || '0_1').split('_');
            statsGlobal[nombre] = {
                isPlayer: idenParts[0] === '1', 
                isActive: idenParts[1] === '1',
                iconoOverride: f[18] || ""
            };
            // Inicializar su inventario en 0 si no estaba en la BD de objetos
            if (!invGlobal[nombre]) invGlobal[nombre] = {};
        });

        guardar();
    } catch (e) { console.error("Error cargando CSVs:", e); }
}

export async function sincronizarObjetosBD(cola) {
    try {
        const actualizaciones = Object.values(cola);
        if(actualizaciones.length === 0) return true;

        const response = await fetch(API_OBJETOS, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ accion: 'sync_objetos', actualizaciones })
        });
        
        const resText = await response.text();
        try {
            const result = JSON.parse(resText);
            if(result.status === 'success') return true;
            alert("Error en Apps Script:\n" + result.message);
            return false;
        } catch(e) {
            alert("Google bloqueó la solicitud o el código crashó.");
            return false;
        }
    } catch (e) { 
        alert("Fallo crítico de Red. Revisa el link de API_OBJETOS.");
        return false; 
    }
}
