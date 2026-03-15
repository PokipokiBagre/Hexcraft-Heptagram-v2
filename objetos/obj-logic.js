// ============================================================
// obj-logic.js — LÓGICA Y MODIFICACIONES
// ============================================================

import { invGlobal, objGlobal, historial, estadoUI, guardar } from './obj-state.js';

// Prepara la info del objeto modificado para enviarla a Supabase
export function encolarCambioObjeto(nombreObj) {
    let duenos = [];
    let cants = [];
    
    Object.keys(invGlobal).forEach(j => {
        if (invGlobal[j][nombreObj] > 0) {
            duenos.push(j);
            cants.push(invGlobal[j][nombreObj]);
        }
    });

    const info = objGlobal[nombreObj] || { tipo: '-', mat: '-', eff: 'Sin descripción', rar: 'Común' };
    
    // Se guarda en la cola en un formato que obj-data.js leerá para actualizar la Nube
    estadoUI.colaCambios[nombreObj] = {
        objeto: nombreObj,
        tipo: info.tipo, 
        mat: info.mat,
        eff: info.eff, 
        rar: info.rar,
        duenos: duenos.join(", "), 
        cantidades: cants.join(", ") 
    };
}

export function modificar(j, o, c, callback) {
    if (!invGlobal[j]) invGlobal[j] = {};
    invGlobal[j][o] = Math.max(0, (invGlobal[j][o] || 0) + c);
    
    if (c !== 0) {
        historial.push({ fecha: new Date().toLocaleString(), jugador: j, objeto: o, cambio: c, total: invGlobal[j][o] });
    }
    
    encolarCambioObjeto(o); 
    guardar(); 
    if(callback) callback();
}

export function modificarMulti(jugadores, o, c, callback) {
    jugadores.forEach(j => {
        if (!invGlobal[j]) invGlobal[j] = {};
        invGlobal[j][o] = Math.max(0, (invGlobal[j][o] || 0) + c);
        historial.push({ fecha: new Date().toLocaleString(), jugador: j, objeto: o, cambio: c, total: invGlobal[j][o] });
    });
    
    encolarCambioObjeto(o);
    guardar();
    if(callback) callback();
}

export function transferir(origen, destino, o, c, callback) {
    if (!invGlobal[origen]) invGlobal[origen] = {};
    if (!invGlobal[destino]) invGlobal[destino] = {};
    
    const realC = Math.min(c, invGlobal[origen][o] || 0);
    if (realC <= 0) return;

    invGlobal[origen][o] -= realC;
    invGlobal[destino][o] = (invGlobal[destino][o] || 0) + realC;

    historial.push({ fecha: new Date().toLocaleString(), jugador: origen, objeto: o, cambio: -realC, total: invGlobal[origen][o], nota: `Transferido a ${destino}` });
    historial.push({ fecha: new Date().toLocaleString(), jugador: destino, objeto: o, cambio: realC, total: invGlobal[destino][o], nota: `Recibido de ${origen}` });

    encolarCambioObjeto(o);
    guardar();
    if(callback) callback();
}

export function agregarObjetoManual(dataObj, repartos, callback) {
    const { nombre, tipo, mat, eff, rar } = dataObj;
    
    // Actualiza o crea la info global del objeto
    objGlobal[nombre] = { tipo, mat, eff, rar };

    Object.keys(repartos).forEach(j => {
        const cant = parseInt(repartos[j]) || 0;
        if (cant > 0) {
            if (!invGlobal[j]) invGlobal[j] = {};
            invGlobal[j][nombre] = (invGlobal[j][nombre] || 0) + cant;
            historial.push({ fecha: new Date().toLocaleString(), jugador: j, objeto: nombre, cambio: cant, total: invGlobal[j][nombre], nota: "Creación Manual" });
        }
    });

    encolarCambioObjeto(nombre);
    guardar();
    if(callback) callback(true);
}

export function agregarObjetosMulti(listaNuevos, destPlayer, callback) {
    if (listaNuevos.length === 0) return;

    listaNuevos.forEach(item => {
        const { nombre, tipo, mat, eff, rar, cant } = item;
        
        objGlobal[nombre] = { tipo, mat, eff, rar };

        if (destPlayer && destPlayer !== "") {
            if (!invGlobal[destPlayer]) invGlobal[destPlayer] = {};
            invGlobal[destPlayer][nombre] = (invGlobal[destPlayer][nombre] || 0) + cant;
            historial.push({ fecha: new Date().toLocaleString(), jugador: destPlayer, objeto: nombre, cambio: cant, total: invGlobal[destPlayer][nombre], nota: "Creación Multi" });
        }
        
        encolarCambioObjeto(nombre);
    });

    guardar();
    if(callback) callback(true);
}

export function descargarLogExcel() {
    let csv = "Fecha,Jugador,Objeto,Cambio,Total_Resultante,Notas\n";
    historial.forEach(h => { csv += `"${h.fecha}","${h.jugador}","${h.objeto}","${h.cambio}","${h.total}","${h.nota || ''}"\n`; });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `HEX_OBJ_LOG.csv`; link.click();
}

export function descargarEstadoExcel() {
    let data = [["Objeto", "Tipo", "Material", "Efecto", "Rareza", "Dueños", "Cantidades"]];
    Object.keys(objGlobal).sort().forEach(o => {
        const info = objGlobal[o]; let d = [], c = [];
        Object.keys(invGlobal).forEach(jug => { if (invGlobal[jug][o] > 0) { d.push(jug); c.push(invGlobal[jug][o]); } });
        if(d.length > 0) { data.push([o, info.tipo, info.mat, info.eff, info.rar, d.join(', '), c.join(', ')]); } 
        else { data.push([o, info.tipo, info.mat, info.eff, info.rar, "", ""]); }
    });
    
    // Si la librería XLSX está cargada en el index.html
    if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventario");
        XLSX.writeFile(wb, "HEX_OBJ_ESTADO.xlsx");
    } else {
        // Respaldo a CSV nativo si no detecta XLSX
        let csv = "Objeto,Tipo,Material,Efecto,Rareza,Dueños,Cantidades\n";
        data.slice(1).forEach(row => {
            csv += `"${row[0]}","${row[1]}","${row[2]}","${row[3]}","${row[4]}","${row[5]}","${row[6]}"\n`;
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        link.download = `HEX_OBJ_ESTADO.csv`; link.click();
    }

export function eliminarObjetoCompletamente(nombreObj, callback) {
    if(!confirm(`⚠️ ¿Estás seguro de ELIMINAR COMPLETAMENTE "${nombreObj}"?\n\nDesaparecerá del catálogo y de los inventarios de todos los jugadores para siempre.`)) return;

    // Lo marcamos en la cola para que el data.js lo borre de Supabase
    estadoUI.colaCambios[nombreObj] = {
        objeto: nombreObj,
        __ELIMINAR_OBJETO__: true
    };

    // Lo borramos de la memoria local para que la UI se actualice al instante
    delete objGlobal[nombreObj];
    Object.keys(invGlobal).forEach(j => {
        if (invGlobal[j][nombreObj] !== undefined) {
            delete invGlobal[j][nombreObj];
        }
    });

    // Limpiamos el caché de orden para que no intente renderizar un objeto borrado
    estadoUI.resetCacheOrder = true;

    guardar();
    if(callback) callback();
    } 
}
