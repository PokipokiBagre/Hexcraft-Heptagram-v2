// ============================================================
// panel-objetos-logic.js — Lógica de asignación, creación y edición
// ============================================================

import { objState } from './panel-objetos-state.js';

export function initObjetosDev(catalogo, inventarios) {
    objState.catalogoDB = catalogo || [];
    objState.inventariosDB = {};
    (inventarios || []).forEach(item => {
        const pj = item.personaje_nombre.toLowerCase();
        if (!objState.inventariosDB[pj]) objState.inventariosDB[pj] = {};
        objState.inventariosDB[pj][item.objeto_nombre] = item.cantidad;
    });
}

// ── LÓGICA DE INVENTARIO ──
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
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setBusquedaObjeto(texto) {
    objState.busqueda = texto.toLowerCase();
    window.dispatchEvent(new Event('devUIUpdate'));
}

// ── LÓGICA DE INTERFAZ Y FORJA ──
export function cambiarVistaObjetos(vista) {
    objState.vistaActiva = vista;
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setCantidadFormularios(num) {
    objState.formulariosCreacion = Math.max(1, parseInt(num) || 1);
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function actualizarFormularioNuevo(index, campo, valor) {
    if (!objState.colaNuevosObjetos[index]) {
        objState.colaNuevosObjetos[index] = { nombre: '', cant: 1, tipo: 'Arma', mat: '-', rar: 'Común', eff: '' };
    }
    objState.colaNuevosObjetos[index][campo] = valor;
    window.dispatchEvent(new Event('devUIUpdate')); // Disparamos evento para mostrar el botón Guardar
}

// ── LÓGICA DE EDICIÓN ──
export function seleccionarObjetoParaEditar(nombreObj) {
    objState.objAEditarSeleccionado = nombreObj;
    
    // Si elegimos un objeto y aún no está en la cola de edición, le precargamos los datos originales de la BD
    if (nombreObj && !objState.colaEdicionObjetos[nombreObj]) {
        const dbObj = objState.catalogoDB.find(o => o.nombre === nombreObj);
        if (dbObj) {
            objState.colaEdicionObjetos[nombreObj] = {
                nombre: dbObj.nombre,
                tipo: dbObj.tipo || 'Otro',
                mat: dbObj.material || '-',
                rar: dbObj.rareza || 'Común',
                eff: dbObj.efecto || ''
            };
        }
    }
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function modificarObjetoEdicion(campo, valor) {
    const objBase = objState.objAEditarSeleccionado;
    if (!objBase || !objState.colaEdicionObjetos[objBase]) return;
    
    objState.colaEdicionObjetos[objBase][campo] = valor;
    window.dispatchEvent(new Event('devUIUpdate')); // Disparamos evento para mostrar el botón Guardar
}
