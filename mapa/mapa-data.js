import { estadoMapa, ESTETICA } from './mapa-state.js';

export const API_HECHIZOS = 'https://script.google.com/macros/s/AKfycby1jLgF-2bGWv0QW0Eg8u7msZ-ab2eQa--olIWQHsin8Kyz0y0xHevK7YyGyMyzq1BWKw/exec';
const CSV_ESTADISTICAS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQOl-ENpkVGioSaquRc1pkuNUyk-vCEQGGSAN3MMtzwcP5AjlLTLbjsc4wAdy3fcQgRhzQAZ2CtRWbx/pub?output=csv';

export async function cargarDatos(barra) {
    try {
        if(barra) barra.style.width = '10%';
        
        // 1. CARGAMOS A LOS JUGADORES DESDE EL CSV DE ESTADÍSTICAS
        const csvRes = await fetch(CSV_ESTADISTICAS);
        const csvText = await csvRes.text();
        procesarCSVJugadores(csvText);
        
        if(barra) barra.style.width = '25%';

        // 2. CARGAMOS LA API PRINCIPAL (NODOS, INVENTARIO Y AFINIDADES)
        const res = await fetch(API_HECHIZOS);
        if(barra) barra.style.width = '60%';

        const jsonText = await res.text();
        const json = JSON.parse(decodeURIComponent(escape(window.atob(jsonText))));
        
        // --- NUEVO: PROCESAR COLORES DESDE EL EXCEL ---
        window.mapaColores = {};
        if (json.afinidades && json.afinidades.length > 0) {
            json.afinidades.forEach(row => {
                if (row[0]) {
                    // row[0] es el nombre de afinidad, row[1] el color hex principal, row[2] el color de borde (opcional)
                    window.mapaColores[row[0].trim()] = { 
                        t: row[1] ? row[1].toString().trim() : '#ffffff', 
                        b: row[2] ? row[2].toString().trim() : '#555555' 
                    };
                }
            });
        }
        // ----------------------------------------------
        
        procesarInventario(json);
        procesarNodos(json);
        procesarEnlaces(json.String || json.string || json.Strings || []);
        
        if(barra) barra.style.width = '100%';
        return true;
    } catch(e) {
        console.error("Error cargando mapa:", e);
        return false;
    }
}

function procesarCSVJugadores(csvText) {
    const lines = csvText.split('\n');
    if(lines.length < 1) return;
    const headers = lines[0].split(',').map(h => h.trim().replace(/\r/g, ''));
    const pIdx = headers.indexOf('Personaje');
    const jIdx = headers.indexOf('Jugador_Activo');
    
    estadoMapa.jugadores = [];
    if (pIdx > -1 && jIdx > -1) {
        for(let i = 1; i < lines.length; i++) {
            let row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if(row.length > jIdx) {
                let jActivo = row[jIdx].trim().replace(/\r/g, '');
                if(jActivo === '1_1') {
                    estadoMapa.jugadores.push(row[pIdx].trim().replace(/^"|"$/g, ''));
                }
            }
        }
    }
}

function procesarInventario(json) {
    estadoMapa.inventario = {};
    if (json.inventario) {
        json.inventario.forEach(row => {
            let pj = row.Personaje ? row.Personaje.trim() : '';
            let he = row.Hechizo ? row.Hechizo.trim() : '';
            if(pj && he) {
                if(!estadoMapa.inventario[pj]) estadoMapa.inventario[pj] = new Set();
                estadoMapa.inventario[pj].add(he.replace(/\s*\(\d+\)$/, '').trim().toLowerCase());
            }
        });
    }
}

function parseGephiCoord(val) {
    if (val === undefined || val === null || val === '') return null;
    let str = String(val).trim().replace(/,/g, '.').replace(/[^0-9\.\-]/g, '');
    let num = parseFloat(str);
    return isNaN(num) ? null : num;
}

function procesarNodos(json) {
    const todos = [].concat(json.nodos || []).concat(json.nodosOcultos || []);
    estadoMapa.nodos = [];
    const nodosProcesados = new Set();
    
    // Primero, encontramos el máximo valor absoluto para saber si necesitamos achicar coordenadas de Gephi gigantes
    let maxVal = 0;

    todos.forEach(n => {
        if (!n.ID && !n.Nombre) return;
        const keyX = Object.keys(n).find(k => k.trim().toLowerCase() === 'x');
        const keyY = Object.keys(n).find(k => k.trim().toLowerCase() === 'y');
        
        let rawX = keyX ? parseGephiCoord(n[keyX]) : null;
        let rawY = keyY ? parseGephiCoord(n[keyY]) : null;
        
        if (rawX !== null && Math.abs(rawX) > maxVal) maxVal = Math.abs(rawX);
        if (rawY !== null && Math.abs(rawY) > maxVal) maxVal = Math.abs(rawY);
    });

    // Si los números son mayores a 10,000, asumimos que viene en formato bruto de Gephi y lo achicamos.
    // Si no, asumimos que son coordenadas de pantalla ya guardadas y las dejamos intactas.
    const isGephiRaw = maxVal > 15000;
    const scaleFactor = isGephiRaw ? (3500 / maxVal) : 1;

    todos.forEach(n => {
        if (!n.ID && !n.Nombre) return;

        const idReal = n.ID ? n.ID.toString().trim() : '';
        const nombreReal = n.Nombre && n.Nombre.trim() !== "" ? n.Nombre.trim() : idReal;
        const idUnico = (idReal || nombreReal).toLowerCase();
        
        if (nodosProcesados.has(idUnico)) return;
        nodosProcesados.add(idUnico);

        const esConocido = n.Conocido && n.Conocido.toString().trim().toLowerCase() === 'si';
        const hexCost = parseInt(n.HEX) || 0;
        const isHexNode = (idUnico === 'hex' || idUnico === 'hechizo hex');

        let baseName = nombreReal.replace(/\s*\(\d+\)$/, '').trim(); 
        let nombreMostrar = (esConocido || isHexNode) ? 
            (isHexNode ? "HEX" : `${baseName} (${hexCost})`) : 
            `${idReal.toLowerCase().includes('hechizo') ? idReal : `Hechizo ${idReal}`} (${hexCost})`;

        const keyX = Object.keys(n).find(k => k.trim().toLowerCase() === 'x');
        const keyY = Object.keys(n).find(k => k.trim().toLowerCase() === 'y');
        
        let rawX = keyX ? parseGephiCoord(n[keyX]) : null;
        let rawY = keyY ? parseGephiCoord(n[keyY]) : null;

        // Si no hay coordenadas, le damos una posición aleatoria central
        if (rawX === null) rawX = (Math.random() * 800) - 400;
        if (rawY === null) rawY = (Math.random() * 800) - 400;

        let finalX = rawX * scaleFactor;
        let finalY = rawY * scaleFactor;

        let radio = isHexNode ? 65 : (esConocido ? 35 : 28);

        const extData = (key) => {
            const foundKey = Object.keys(n).find(k => k.trim().toLowerCase().includes(key));
            return foundKey ? n[foundKey] : '';
        };

        estadoMapa.nodos.push({
            id: idReal,
            nombreOriginal: nombreReal,
            nombre: nombreMostrar,
            afinidad: n.Afinidad || 'Desconocida', 
            clase: n.Clase || '-',
            hex: hexCost,
            resumen: n.Resumen || 'Sin descripción',
            efecto: n.Efecto || '',
            overcast: extData('overcast'), 
            undercast: extData('undercast'), 
            especial: extData('especial'),
            esConocido: esConocido,
            isHexNode: isHexNode,
            x: finalX,
            y: finalY,
            radio: radio,
            incomingSources: [],
            // Si el mapa era de Gephi, forzamos que se marque como modificado para que el usuario pueda guardarlo arreglado.
            modificado: isGephiRaw 
        });
    });
}

function procesarEnlaces(arrayStrings) {
    estadoMapa.enlaces = [];
    const findNode = (val) => {
        if (!val) return null;
        const str = String(val).trim().toLowerCase();
        const strNum = str.replace(/^hechizo\s+/i, '').trim();

        return estadoMapa.nodos.find(n => {
            const nid = String(n.id).trim().toLowerCase();
            const nnom = String(n.nombreOriginal).trim().toLowerCase();
            const nidNum = nid.replace(/^hechizo\s+/i, '').trim();
            const nnomNum = nnom.replace(/^hechizo\s+/i, '').trim();
            return nid === str || nnom === str || nidNum === strNum || nnomNum === strNum;
        });
    };

    arrayStrings.forEach(rel => {
        if (!rel) return;
        const vals = Object.values(rel).map(v => String(v).trim());
        if (vals.length < 2) return;

        const sourceNode = findNode(vals[0]);
        const targetNode = findNode(vals[1]);

        if (sourceNode && targetNode && sourceNode !== targetNode) {
            estadoMapa.enlaces.push({ source: sourceNode, target: targetNode });
            targetNode.incomingSources.push(sourceNode);
        }
    });
    actualizarColoresFlechas();
}

export function actualizarColoresFlechas() {
    estadoMapa.nodos.forEach(nodo => {
        if (nodo.incomingSources.length === 0) {
            nodo.arrowColor = ESTETICA.lineaDescubierta; 
            return;
        }
        const total = nodo.incomingSources.length;
        const conocidos = nodo.incomingSources.filter(n => n.esConocido).length;
        
        if (conocidos === total) {
            nodo.arrowColor = ESTETICA.lineaDescubierta; 
        } else if (conocidos > 0) {
            nodo.arrowColor = ESTETICA.lineaMostaza; 
        } else {
            nodo.arrowColor = ESTETICA.lineaRosa; 
        }
    });
}
