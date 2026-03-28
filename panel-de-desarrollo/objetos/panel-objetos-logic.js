// ============================================================
// panel-objetos-logic.js — Lógica de asignación y edición
// ============================================================

import { objState } from './panel-objetos-state.js';

export function initObjetosDev(catalogo, inventarios) {
    objState.catalogoDB = catalogo || [];
    objState.inventariosDB = {};
    objState.equipadosDB = {}; // 🌟 Inicializar
    (inventarios || []).forEach(item => {
        const pj = item.personaje_nombre.toLowerCase();
        if (!objState.inventariosDB[pj]) {
            objState.inventariosDB[pj] = {};
            objState.equipadosDB[pj] = {};
        }
        objState.inventariosDB[pj][item.objeto_nombre] = item.cantidad;
        objState.equipadosDB[pj][item.objeto_nombre] = item.equipado || false; // 🌟 Leer BD
    });
}

export function getCantidadActual(pjNombre, objNombre) {
    if (!pjNombre) return 0;
    const pjKey = pjNombre.toLowerCase();
    if (objState.colaInventario[pjKey] && objState.colaInventario[pjKey][objNombre] !== undefined) {
        return objState.colaInventario[pjKey][objNombre];
    }
    if (objState.inventariosDB[pjKey] && objState.inventariosDB[pjKey][objNombre]) {
        return objState.inventariosDB[pjKey][objNombre];
    }
    return 0;
}

export function modificarCantidad(pjNombre, objNombre, variacion) {
    if (!pjNombre) return alert("Selecciona un personaje primero.");
    const pjKey = pjNombre.toLowerCase();
    const actual = getCantidadActual(pjNombre, objNombre);
    const nuevaCant = Math.max(0, actual + variacion);
    
    if (!objState.colaInventario[pjKey]) objState.colaInventario[pjKey] = {};
    objState.colaInventario[pjKey][objNombre] = nuevaCant;

    // Desequipar automático si se acaba
    if (nuevaCant === 0) {
        if (!objState.colaEquipados[pjKey]) objState.colaEquipados[pjKey] = {};
        objState.colaEquipados[pjKey][objNombre] = false;
    }

    window.dispatchEvent(new Event('devUIUpdate'));
}

// 🌟 LÓGICA DE EQUIPACIÓN 🌟
export function isEquipado(pjNombre, objNombre) {
    if (!pjNombre) return false;
    const pjKey = pjNombre.toLowerCase();
    if (objState.colaEquipados[pjKey] && objState.colaEquipados[pjKey][objNombre] !== undefined) {
        return objState.colaEquipados[pjKey][objNombre];
    }
    if (objState.equipadosDB[pjKey] && objState.equipadosDB[pjKey][objNombre]) {
        return objState.equipadosDB[pjKey][objNombre];
    }
    return false;
}

export function toggleEquipacion(pjNombre, objNombre) {
    if (!pjNombre) return;
    const pjKey = pjNombre.toLowerCase();
    const actual = isEquipado(pjNombre, objNombre);
    
    if (!objState.colaEquipados[pjKey]) objState.colaEquipados[pjKey] = {};
    objState.colaEquipados[pjKey][objNombre] = !actual;
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setBusquedaObjeto(texto, tipo = 'inv') {
    if (tipo === 'edit') objState.busquedaEdit = texto.toLowerCase();
    else if (tipo === 'cat') objState.busquedaCat = texto.toLowerCase();
    else objState.busqueda = texto.toLowerCase();
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function cambiarVistaObjetos(vista) {
    objState.vistaActiva = vista;
    objState.objAEditarSeleccionado = ""; 
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setCantidadFormularios(num) {
    objState.formulariosCreacion = Math.max(1, parseInt(num) || 1);
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function actualizarFormularioNuevo(index, campo, valor, reRender = true) {
    if (!objState.colaNuevosObjetos[index]) {
        objState.colaNuevosObjetos[index] = { nombre: '', cant: 1, tipo: 'Consumible', mat: '-', rar: 'Común', eff: '' };
    }
    objState.colaNuevosObjetos[index][campo] = valor;
    if (reRender) window.dispatchEvent(new Event('devUIUpdate'));
    else window.dispatchEvent(new Event('devDataChanged')); 
}

export function seleccionarObjetoParaEditar(nombreObj) {
    objState.objAEditarSeleccionado = nombreObj;
    if (nombreObj && !objState.colaEdicionObjetos[nombreObj]) {
        const dbObj = objState.catalogoDB.find(o => o.nombre === nombreObj);
        if (dbObj) {
            objState.colaEdicionObjetos[nombreObj] = {
                nombre: dbObj.nombre, tipo: dbObj.tipo || 'Consumible', mat: dbObj.material || '-', rar: dbObj.rareza || 'Común', eff: dbObj.efecto || ''
            };
        }
    }
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function modificarObjetoEdicion(campo, valor, reRender = true) {
    const objBase = objState.objAEditarSeleccionado;
    if (!objBase || !objState.colaEdicionObjetos[objBase]) return;
    objState.colaEdicionObjetos[objBase][campo] = valor;
    if (reRender) window.dispatchEvent(new Event('devUIUpdate'));
    else window.dispatchEvent(new Event('devDataChanged'));
}

// 🔀 LÓGICA DE TRANSFERENCIA 🔀
export function setTransferDestino(nombrePj) {
    objState.transferDestinoNombre = nombrePj || null;
    objState.colaTransferencias = {}; // limpiar cantidades al cambiar destino
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setTransferFiltroRol(rol) {
    objState.transferFiltroRol = rol;
    objState.transferDestinoNombre = null;
    objState.colaTransferencias = {};
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setTransferCantidad(objNombre, cantidad) {
    const cant = Math.max(0, parseInt(cantidad) || 0);
    if (cant === 0) {
        delete objState.colaTransferencias[objNombre];
    } else {
        objState.colaTransferencias[objNombre] = cant;
    }
    window.dispatchEvent(new Event('devUIUpdate')); // re-renderiza panel Y activa btn sync
}

export function ejecutarTransferencia(pjOrigen) {
    if (!pjOrigen || !objState.transferDestinoNombre) return;
    const destino = objState.transferDestinoNombre;

    let hayAlgo = false;
    for (const objNombre in objState.colaTransferencias) {
        const cantTransferir = objState.colaTransferencias[objNombre];
        if (cantTransferir <= 0) continue;

        const cantDisponible = getCantidadActual(pjOrigen, objNombre);
        const cantReal = Math.min(cantTransferir, cantDisponible);
        if (cantReal <= 0) continue;

        hayAlgo = true;
        // Restar al origen
        const origenKey = pjOrigen.toLowerCase();
        if (!objState.colaInventario[origenKey]) objState.colaInventario[origenKey] = {};
        objState.colaInventario[origenKey][objNombre] = Math.max(0, cantDisponible - cantReal);

        // Sumar al destino
        const destinoKey = destino.toLowerCase();
        if (!objState.colaInventario[destinoKey]) objState.colaInventario[destinoKey] = {};
        const cantDestinoActual = getCantidadActual(destino, objNombre);
        objState.colaInventario[destinoKey][objNombre] = cantDestinoActual + cantReal;

        // Si se vacía, desequipar en origen
        if (objState.colaInventario[origenKey][objNombre] === 0) {
            if (!objState.colaEquipados[origenKey]) objState.colaEquipados[origenKey] = {};
            objState.colaEquipados[origenKey][objNombre] = false;
        }
    }

    if (!hayAlgo) return alert('No hay cantidades válidas para transferir.');

    objState.colaTransferencias = {};
    objState.transferDestinoNombre = null;
    window.dispatchEvent(new Event('devUIUpdate'));
}
