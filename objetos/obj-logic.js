import { invGlobal, objGlobal, historial, estadoUI, guardar } from './obj-state.js';

// Prepara la info del objeto modificado para enviarla al servidor
export function encolarCambioObjeto(nombreObj) {
    let duenos = [];
    let cants = [];
    
    Object.keys(invGlobal).forEach(j => {
        if (invGlobal[j][nombreObj] > 0) {
            duenos.push(j);
            cants.push(invGlobal[j][nombreObj]);
        }
    });

    const info = objGlobal[nombreObj] || {};
    estadoUI.colaCambios[nombreObj] = {
        objeto: nombreObj,
        tipo: info.tipo || '-', mat: info.mat || '-',
        eff: info.eff || 'Sin descripción', rar: info.rar || 'Común',
        duenos: duenos.join(", "), 
        cantidades: cants.join(", ") 
    };
}

export function modificar(j, o, c, callback) {
    if (!invGlobal[j]) invGlobal[j] = {};
    invGlobal[j][o] = Math.max(0, (invGlobal[j][o] || 0) + c);
    historial.push({ fecha: new Date().toLocaleString(), jugador: j, objeto: o, cambio: c, total: invGlobal[j][o] });
    
    encolarCambioObjeto(o); 
    guardar(); if(callback) callback(); 
}

export function modificarMulti(jugadores, obj, cant, callback) {
    jugadores.forEach(j => {
        if (!invGlobal[j]) invGlobal[j] = {};
        invGlobal[j][obj] = Math.max(0, (invGlobal[j][obj] || 0) + cant);
        historial.push({ fecha: new Date().toLocaleString(), jugador: j, objeto: obj, cambio: cant, total: invGlobal[j][obj] });
    });
    
    encolarCambioObjeto(obj); 
    guardar(); if(callback) callback();
}

export function transferir(origen, destino, obj, cant, callback) {
    if (!invGlobal[origen] || !invGlobal[destino]) return;
    const disp = invGlobal[origen][obj] || 0;
    const aMover = Math.min(disp, cant);
    if (aMover <= 0) return;

    invGlobal[origen][obj] -= aMover;
    invGlobal[destino][obj] = (invGlobal[destino][obj] || 0) + aMover;
    
    historial.push({ fecha: new Date().toLocaleString(), jugador: origen, objeto: obj, cambio: -aMover, total: invGlobal[origen][obj] });
    historial.push({ fecha: new Date().toLocaleString(), jugador: destino, objeto: obj, cambio: aMover, total: invGlobal[destino][obj] });
    
    encolarCambioObjeto(obj); 
    guardar(); if(callback) callback();
}

// 1. FUNCIÓN RECUPERADA: CREACIÓN INDIVIDUAL
export function agregarObjetoManual(datos, reparticion, callback) {
    const { nombre, tipo, mat, eff, rar } = datos;
    if (!nombre) return alert("Falta nombre.");
    objGlobal[nombre] = { tipo, mat, eff, rar };
    Object.keys(reparticion).forEach(j => {
        const cant = parseInt(reparticion[j]) || 0;
        if (cant > 0) {
            if (!invGlobal[j]) invGlobal[j] = {};
            invGlobal[j][nombre] = (invGlobal[j][nombre] || 0) + cant;
            historial.push({ fecha: new Date().toLocaleString(), jugador: j, objeto: nombre, cambio: cant, total: invGlobal[j][nombre] });
        }
    });
    
    encolarCambioObjeto(nombre); 
    guardar(); if(callback) callback();
}

// 2. NUEVA FUNCIÓN: FORJA MÚLTIPLE (5 objetos)
export function agregarObjetosMulti(listaDatos, destPlayer, callback) {
    let creados = 0;
    listaDatos.forEach(datos => {
        const { nombre, tipo, mat, eff, rar, cant } = datos;
        if (!nombre) return;
        
        objGlobal[nombre] = { tipo, mat, eff, rar };
        
        if (destPlayer && cant > 0) {
            if (!invGlobal[destPlayer]) invGlobal[destPlayer] = {};
            invGlobal[destPlayer][nombre] = (invGlobal[destPlayer][nombre] || 0) + cant;
            historial.push({ fecha: new Date().toLocaleString(), jugador: destPlayer, objeto: nombre, cambio: cant, total: invGlobal[destPlayer][nombre] });
        }
        
        encolarCambioObjeto(nombre);
        creados++;
    });
    
    if (creados > 0) {
        guardar(); 
        if(callback) callback(creados);
    } else {
        alert("No escribiste el nombre de ningún objeto.");
    }
}

export function descargarEstadoCSV() {
    let csv = "\uFEFFObjeto,Tipo,Material,Efecto,Rareza,Dueños,Cantidades\n"; 
    Object.keys(objGlobal).sort().forEach(o => {
        const info = objGlobal[o]; let d = [], c = [];
        Object.keys(invGlobal).forEach(jug => { if (invGlobal[jug][o] > 0) { d.push(jug); c.push(invGlobal[jug][o]); } });
        if(d.length > 0) { csv += `"${o}","${info.tipo}","${info.mat}","${info.eff}","${info.rar}","${d.join(',')}","${c.join(',')}"\n`; } 
        else { csv += `"${o}","${info.tipo}","${info.mat}","${info.eff}","${info.rar}","",""\n`; }
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `HEX_OBJ_ESTADO.csv`; link.click();
}

export function descargarEstadoExcel() {
    let data = [["Objeto", "Tipo", "Material", "Efecto", "Rareza", "Dueños", "Cantidades"]];
    Object.keys(objGlobal).sort().forEach(o => {
        const info = objGlobal[o]; let d = [], c = [];
        Object.keys(invGlobal).forEach(jug => { if (invGlobal[jug][o] > 0) { d.push(jug); c.push(invGlobal[jug][o]); } });
        if(d.length > 0) { data.push([o, info.tipo, info.mat, info.eff, info.rar, d.join(', '), c.join(', ')]); } 
        else { data.push([o, info.tipo, info.mat, info.eff, info.rar, "", ""]); }
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventarios");
    XLSX.writeFile(wb, "HEX_OBJ_ESTADO.xlsx");
}

export function descargarLogExcel() {
    let data = [["Fecha", "Jugador", "Objeto", "Cambio", "Total"]];
    historial.forEach(h => data.push([h.fecha, h.jugador, h.objeto, h.cambio, h.total]));
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial");
    XLSX.writeFile(wb, "HEX_LOG_OBJETOS.xlsx");
}
