import { statsGlobal, listaEstados, estadoUI, dbExtra } from './stats-state.js';

const CSV_ESTADOS = './estados.csv'; 
const CSV_PERSONAJES = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQOl-ENpkVGioSaquRc1pkuNUyk-vCEQGGSAN3MMtzwcP5AjlLTLbjsc4wAdy3fcQgRhzQAZ2CtRWbx/pub?output=csv';
const CSV_OBJETOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQDaZ1Zr9YWmgW05Hzpv4IQzpMaKrgSvVUm_Yrps3DdwwPpIjD4iHrdLyPHGucuTHnwwYdM7bPrcnRO/pub?output=csv';
const API_HECHIZOS = 'https://script.google.com/macros/s/AKfycby1jLgF-2bGWv0QW0Eg8u7msZ-ab2eQa--olIWQHsin8Kyz0y0xHevK7YyGyMyzq1BWKw/exec';
const CSV_MISIONES = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTI_7MnwczeHhMCuQ_YInOHBvVUFv7ZSp_bsvFqkTmC_GvSdINkoskGPk__u9dq9XHTeVo4AMAMQl7v/pub?output=csv';

// Carga simultánea con barra de progreso animada
export async function cargarTodoDesdeCSV(barraProgreso) {
    try {
        let progresoActual = 10; // Inicia en 10%
        if (barraProgreso) barraProgreso.style.width = progresoActual + '%';

        const avanzarProgreso = () => {
            progresoActual += 20;
            if (barraProgreso) barraProgreso.style.width = progresoActual + '%';
        };

        const [textoPj, textoObj, textoHz, textoMis] = await Promise.all([
            fetch(CSV_PERSONAJES + '&cb=' + new Date().getTime()).then(r => r.text()).then(t => { avanzarProgreso(); return t; }),
            fetch(CSV_OBJETOS + '&cb=' + new Date().getTime()).then(r => r.text()).then(t => { avanzarProgreso(); return t; }),
            fetch(API_HECHIZOS).then(r => r.text()).then(t => { avanzarProgreso(); return t; }),
            fetch(CSV_MISIONES + '&cb=' + new Date().getTime()).then(r => r.text()).then(t => { avanzarProgreso(); return t; })
        ]);
        
        procesarTextoCSV(textoPj);
        procesarObjetos(textoObj);
        dbExtra.hechizos = JSON.parse(decodeURIComponent(escape(window.atob(textoHz))));
        
        // PROCESAR LISTA DE MISIONES ACTIVAS (NOMBRES EXACTOS)
        dbExtra.misionesActivas = {};
        textoMis.split(/\r?\n/).slice(1).forEach(l => {
            let matches = l.match(/(\s*"[^"]+"\s*|\s*[^,]+|,)(?=,|$)/g);
            if(!matches) return;
            let c = matches.map(m => m.replace(/^,/, '').replace(/^"|"$/g, '').trim());
            if(!c[0]) return;

            let titulo = c[0];
            let estado = parseInt(c[3]) || 0;
            
            // Solo recopila Pendientes (1) y En Proceso (2)
            if (estado === 1 || estado === 2) { 
                let jugs = (c[7] || '').split(',').map(j => j.trim().toLowerCase());
                jugs.forEach(j => { 
                    if(j) {
                        if (!dbExtra.misionesActivas[j]) dbExtra.misionesActivas[j] = [];
                        dbExtra.misionesActivas[j].push(titulo);
                    }
                });
            }
        });
        
    } catch (error) { 
        console.error("Error cargando bases de datos cruzadas:", error); 
    }
}

function procesarObjetos(texto) {
    const filas = texto.split(/\r?\n/).map(l => l.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim()));
    dbExtra.objetosCount = {};
    dbExtra.inventarios = {};
    dbExtra.infoObjetos = {};

    filas.slice(1).forEach(f => {
        const nombre = f[0]; if (!nombre) return;
        dbExtra.infoObjetos[nombre] = { rar: f[4] || 'Común' };

        const jugs = f[5] ? f[5].split(',').map(j => j.trim().toLowerCase()) : [];
        const cants = f[6] ? f[6].split(',').map(c => parseInt(c.trim()) || 0) : [];
        
        jugs.forEach((j, i) => {
            const count = cants[i] || 0;
            if (!dbExtra.objetosCount[j]) dbExtra.objetosCount[j] = 0;
            if (!dbExtra.inventarios[j]) dbExtra.inventarios[j] = [];
            
            dbExtra.objetosCount[j] += count;
            if (count > 0) dbExtra.inventarios[j].push(nombre);
        });
    });
}

export function procesarTextoCSV(texto) {
    const filas = texto.split(/\r?\n/).map(l => {
        let matches = l.match(/(\s*"[^"]+"\s*|\s*[^,]+|,)(?=,|$)/g);
        if(!matches) return []; return matches.map(m => m.replace(/^,/, '').replace(/^"|"$/g, '').trim());
    });
    
    for (let k in statsGlobal) delete statsGlobal[k];

    filas.slice(1).forEach(f => {
        if(!f[0]) return;
        const nombre = f[0];
        const hexParts = (f[1] || '0_1').split('_'); const idenParts = (f[17] || '0_1').split('_');
        
        const getTotal = (idx) => parseInt((f[idx] || '0').split('_')[0]) || 0;
        const getBase = (idx) => parseInt((f[idx] || '0').split('_')[1]) || 0;
        const getSpell = (idx) => parseInt((f[idx] || '0').split('_')[2]) || 0;
        const getSpellEff = (idx) => parseInt((f[idx] || '0').split('_')[3]) || 0;
        const getBuff = (idx) => parseInt((f[idx] || '0').split('_')[4]) || 0;
        
        let stData = {};
        if (f[16]) {
            const arr = f[16].split('-');
            listaEstados.forEach((e, i) => {
                if (e.tipo === 'booleano') stData[e.id] = (arr[i] === '1');
                else stData[e.id] = parseInt(arr[i]) || 0;
            });
        } else {
            listaEstados.forEach(e => { stData[e.id] = (e.tipo === 'numero') ? 0 : false; });
        }

        statsGlobal[nombre] = {
            isPlayer: idenParts[0] === '1', isNPC: idenParts[0] === '0', isActive: idenParts[1] === '1',
            hex: parseInt(hexParts[0]) || 0, asistencia: parseInt(hexParts[1]) || 1, vex: parseInt(f[2]) || 0,
            
            vidaRojaActual: parseInt(f[9]) || 0, 
            vidaRojaMax: getTotal(10), baseVidaRojaMax: getBase(10),
            vidaAzul: getTotal(11), baseVidaAzul: getBase(11),
            guardaDorada: getTotal(12), baseGuardaDorada: getBase(12),
            danoRojo: getTotal(13), baseDanoRojo: getBase(13),
            danoAzul: getTotal(14), baseDanoAzul: getBase(14),
            elimDorada: getTotal(15), baseElimDorada: getBase(15),
            
            afinidades: { fisica: getTotal(3), energetica: getTotal(4), espiritual: getTotal(5), mando: getTotal(6), psiquica: getTotal(7), oscura: getTotal(8) },
            afinidadesBase: { fisica: getBase(3), energetica: getBase(4), espiritual: getBase(5), mando: getBase(6), psiquica: getBase(7), oscura: getBase(8) },
            hechizos: { fisica: getSpell(3), energetica: getSpell(4), espiritual: getSpell(5), mando: getSpell(6), psiquica: getSpell(7), oscura: getSpell(8), danoRojo: getSpell(13), danoAzul: getSpell(14), elimDorada: getSpell(15), vidaRojaMaxExtra: getSpell(10), vidaAzulExtra: getSpell(11), guardaDoradaExtra: getSpell(12) },
            hechizosEfecto: { fisica: getSpellEff(3), energetica: getSpellEff(4), espiritual: getSpellEff(5), mando: getSpellEff(6), psiquica: getSpellEff(7), oscura: getSpellEff(8), danoRojo: getSpellEff(13), danoAzul: getSpellEff(14), elimDorada: getSpellEff(15), vidaRojaMaxExtra: getSpellEff(10), vidaAzulExtra: getSpellEff(11), guardaDoradaExtra: getSpellEff(12) },
            buffs: { fisica: getBuff(3), energetica: getBuff(4), espiritual: getBuff(5), mando: getBuff(6), psiquica: getBuff(7), oscura: getBuff(8), danoRojo: getBuff(13), danoAzul: getBuff(14), elimDorada: getBuff(15), vidaRojaMaxExtra: getBuff(10), vidaAzulExtra: getBuff(11), guardaDoradaExtra: getBuff(12) },
            
            estados: stData, iconoOverride: f[18] || ""
        };
    });
}

export async function cargarDiccionarioEstados() {
    try {
        const res = await fetch(CSV_ESTADOS + '?cb=' + new Date().getTime());
        if(!res.ok) throw new Error("No se encontró el archivo de estados");
        const texto = await res.text();
        
        const filas = texto.split(/\r?\n/);
        listaEstados.length = 0;

        filas.slice(1).forEach(f => {
            if(!f.trim()) return;
            const partes = f.split(',');
            if (partes.length < 5) return;

            const id = partes[0].replace(/^"|"$/g, '').trim();
            const nombre = partes[1].replace(/^"|"$/g, '').trim() || id;
            const tipo = partes[2].replace(/^"|"$/g, '').trim() || 'booleano';
            const bg = partes[3].replace(/^"|"$/g, '').trim() || '#000';
            const border = partes[4].replace(/^"|"$/g, '').trim() || '#fff';
            let desc = partes.slice(5).join(',').replace(/^"|"$/g, '').trim();
            if (!desc) desc = 'Sin descripción';

            listaEstados.push({ id, nombre, tipo, bg, border, desc });
        });
    } catch(e) {
        console.warn("Fallo al cargar estados.csv. Verifica ruta local.");
    }
}


