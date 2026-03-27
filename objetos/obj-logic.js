// ============================================================
// obj-logic.js — LÓGICA Y MODIFICACIONES (VERSIÓN SUPABASE)
// ============================================================

import { invGlobal, objGlobal, historial, estadoUI, guardar, eqpGlobal } from './obj-state.js';

export function encolarCambioObjeto(nombreObj) {
    if (!estadoUI.colaCambios) estadoUI.colaCambios = {};
    estadoUI.colaCambios[nombreObj] = { objeto: nombreObj, __modificado: true };
}

// 🌟 NUEVA FUNCIÓN: EQUIPACIÓN
export function toggleEquipacion(j, o, callback) {
    if (!eqpGlobal[j]) eqpGlobal[j] = {};
    eqpGlobal[j][o] = !eqpGlobal[j][o]; // Invierte el estado
    
    const isEqp = eqpGlobal[j][o];
    const objDef = objGlobal[o] || {};
    const efecto = objDef.eff || 'Sin efecto detallado';
    
    // Registramos en el Log
    if (isEqp) {
        historial.push({ fecha: new Date().toLocaleString(), jugador: j, objeto: o, cambio: "Eqp.", total: invGlobal[j][o], extraLog: efecto });
    } else {
        historial.push({ fecha: new Date().toLocaleString(), jugador: j, objeto: o, cambio: "Dsqp.", total: invGlobal[j][o] });
    }
    
    encolarCambioObjeto(o); // Marcamos el objeto para sincronizar a Supabase
    guardar();
    if (callback) callback();
}

export function modificar(j, o, c, callback) {
    if (!invGlobal[j]) invGlobal[j] = {};
    invGlobal[j][o] = Math.max(0, (invGlobal[j][o] || 0) + c);
    
    // 🌟 Si pierde el objeto, se desequipa automáticamente
    if (invGlobal[j][o] === 0 && eqpGlobal[j]) eqpGlobal[j][o] = false;

    if (c !== 0) historial.push({ fecha: new Date().toLocaleString(), jugador: j, objeto: o, cambio: c, total: invGlobal[j][o] });
    
    encolarCambioObjeto(o); guardar(); if(callback) callback();
}

export function modificarMulti(jugadores, o, c, callback) {
    jugadores.forEach(j => {
        if (!invGlobal[j]) invGlobal[j] = {};
        invGlobal[j][o] = Math.max(0, (invGlobal[j][o] || 0) + c);
        if (invGlobal[j][o] === 0 && eqpGlobal[j]) eqpGlobal[j][o] = false; // 🌟 Desequipar Auto
        if (c !== 0) historial.push({ fecha: new Date().toLocaleString(), jugador: j, objeto: o, cambio: c, total: invGlobal[j][o] });
    });
    encolarCambioObjeto(o); guardar(); if(callback) callback();
}

export function transferir(cant, o, jo, jd, callback) {
    if (invGlobal[jo][o] >= cant) {
        invGlobal[jo][o] -= cant;
        if (invGlobal[jo][o] === 0 && eqpGlobal[jo]) eqpGlobal[jo][o] = false; // 🌟 Desequipar Auto
        
        if (!invGlobal[jd]) invGlobal[jd] = {};
        invGlobal[jd][o] = (invGlobal[jd][o] || 0) + cant;
        
        historial.push({ fecha: new Date().toLocaleString(), jugador: `${jo} ➔ ${jd}`, objeto: o, cambio: cant, total: '-' });
        encolarCambioObjeto(o); guardar(); if(callback) callback();
    }
}

export function eliminarObjetoCompletamente(nombreObj, callback) {
    estadoUI.colaCambios[nombreObj] = { objeto: nombreObj, __ELIMINAR_OBJETO__: true };

    delete objGlobal[nombreObj];
    Object.keys(invGlobal).forEach(j => {
        if (invGlobal[j][nombreObj] !== undefined) {
            delete invGlobal[j][nombreObj];
            if (eqpGlobal[j]) delete eqpGlobal[j][nombreObj]; // 🌟 Borrar equipo
        }
    });

    estadoUI.resetCacheOrder = true;
    guardar();
    if(callback) callback();
}

export function editarObjetoCatalogo(nombreViejo, newData, callback) {
    const nuevoNombre = newData.nombre;
    
    if (nombreViejo !== nuevoNombre) {
        if (objGlobal[nuevoNombre]) return alert(`Ya existe un objeto llamado "${nuevoNombre}".`);
        
        estadoUI.colaCambios[nombreViejo] = { objeto: nombreViejo, __ELIMINAR_OBJETO__: true };
        
        objGlobal[nuevoNombre] = { tipo: newData.tipo, mat: newData.mat, eff: newData.eff, rar: newData.rar };
        delete objGlobal[nombreViejo];

        Object.keys(invGlobal).forEach(j => {
            if (invGlobal[j][nombreViejo] !== undefined) {
                if (invGlobal[j][nombreViejo] > 0) {
                    invGlobal[j][nuevoNombre] = invGlobal[j][nombreViejo];
                    
                    // 🌟 Migrar estado de equipo si se renombra
                    if (eqpGlobal[j] && eqpGlobal[j][nombreViejo]) {
                        if (!eqpGlobal[j]) eqpGlobal[j] = {};
                        eqpGlobal[j][nuevoNombre] = true;
                    }
                }
                delete invGlobal[j][nombreViejo];
                if (eqpGlobal[j]) delete eqpGlobal[j][nombreViejo];
            }
        });

        encolarCambioObjeto(nuevoNombre);
        estadoUI.resetCacheOrder = true;
    } else {
        objGlobal[nombreViejo] = { tipo: newData.tipo, mat: newData.mat, eff: newData.eff, rar: newData.rar };
        encolarCambioObjeto(nombreViejo);
    }

    guardar();
    if(callback) callback();
}

// ... Todas las descargas CSV/Excel quedan igual
export function descargarLogExcel() {
    let csvContent = "data:text/csv;charset=utf-8,Fecha,Jugador,Objeto,Cambio,Total\\n";
    historial.forEach(h => { csvContent += `"${h.fecha}","${h.jugador}","${h.objeto}","${h.cambio}","${h.total}"\\n`; });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "hex_log_objetos.csv");
    document.body.appendChild(link);
    link.click();
}

export function descargarEstadoExcel() {
    let csvContent = "data:text/csv;charset=utf-8,Personaje,Objeto,Cantidad,Equipado,Tipo,Rareza,Material,Efecto\\n";
    Object.keys(invGlobal).forEach(pj => {
        Object.keys(invGlobal[pj]).forEach(obj => {
            if(invGlobal[pj][obj] > 0) {
                const oData = objGlobal[obj] || {tipo: '-', rar: '-', mat: '-', eff: '-'};
                const eqpStr = (eqpGlobal[pj] && eqpGlobal[pj][obj]) ? 'Si' : 'No';
                csvContent += `"${pj}","${obj}","${invGlobal[pj][obj]}","${eqpStr}","${oData.tipo}","${oData.rar}","${oData.mat}","${oData.eff}"\\n`;
            }
        });
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "hex_inventarios_actual.csv");
    document.body.appendChild(link);
    link.click();
}

export function agregarObjetoManual(nombreObj, tipo, rareza, mat, eff, callback) {
    if(!nombreObj.trim()) return alert("El nombre no puede estar vacío.");
    if(objGlobal[nombreObj]) return alert("Este objeto ya existe en el catálogo.");
    objGlobal[nombreObj] = { tipo, rar: rareza, mat, eff };
    encolarCambioObjeto(nombreObj); guardar(); if(callback) callback();
}

export function agregarObjetosMulti(objetosArray, callback) {
    let agregados = 0;
    objetosArray.forEach(o => {
        if (o.nombre && !objGlobal[o.nombre]) {
            objGlobal[o.nombre] = { tipo: o.tipo, rar: o.rar, mat: o.mat, eff: o.eff };
            encolarCambioObjeto(o.nombre);
            agregados++;
        }
    });
    if (agregados > 0) { guardar(); if(callback) callback(); }
    else alert("No se agregaron objetos (Quizás ya existían o los nombres estaban vacíos).");
}
