// ============================================================
// panel-objetos-logic.js — Lógica de asignación y creación
// ============================================================

import { objState } from './panel-objetos-state.js';

// Inicializa los datos al cargar la página
export function initObjetosDev(catalogo, inventarios) {
    objState.catalogoDB = catalogo || [];
    
    // Convertimos el inventario de la DB a un formato fácil: { "pj": { "obj": cant } }
    objState.inventariosDB = {};
    (inventarios || []).forEach(item => {
        const pj = item.personaje_nombre.toLowerCase();
        if (!objState.inventariosDB[pj]) objState.inventariosDB[pj] = {};
        objState.inventariosDB[pj][item.objeto_nombre] = item.cantidad;
    });
}

// Obtiene la cantidad actual en VIVO (BD + Cambios sin guardar)
export function getCantidadActual(pjNombre, objNombre) {
    if (!pjNombre) return 0;
    const pjKey = pjNombre.toLowerCase();
    
    // Si ya lo modificaste en esta sesión, prioriza ese valor
    if (objState.colaInventario[pjKey] && objState.colaInventario[pjKey][objNombre] !== undefined) {
        return objState.colaInventario[pjKey][objNombre];
    }
    
    // Si no, devuelve lo que dice la base de datos
    if (objState.inventariosDB[pjKey] && objState.inventariosDB[pjKey][objNombre]) {
        return objState.inventariosDB[pjKey][objNombre];
    }
    return 0;
}

// Modifica la cantidad de un objeto (+1, -5, etc) y lo pone en la cola
export function modificarCantidad(pjNombre, objNombre, variacion) {
    if (!pjNombre) return alert("Selecciona un personaje primero.");
    const pjKey = pjNombre.toLowerCase();
    
    const actual = getCantidadActual(pjNombre, objNombre);
    const nuevaCant = Math.max(0, actual + variacion); // Nunca menor a 0
    
    if (!objState.colaInventario[pjKey]) objState.colaInventario[pjKey] = {};
    objState.colaInventario[pjKey][objNombre] = nuevaCant;
    
    // Dispara un evento para que la UI se refresque
    window.dispatchEvent(new Event('devUIUpdate'));
}

// Actualiza los datos de un formulario de "Creación de Objeto Nuevo"
export function actualizarFormularioNuevo(index, campo, valor) {
    if (!objState.colaNuevosObjetos[index]) {
        objState.colaNuevosObjetos[index] = { nombre: '', cant: 1, tipo: 'Arma', mat: '-', rar: 'Común', eff: '' };
    }
    objState.colaNuevosObjetos[index][campo] = valor;
}

export function setCantidadFormularios(num) {
    objState.formulariosCreacion = Math.max(1, parseInt(num) || 1);
    window.dispatchEvent(new Event('devUIUpdate'));
}

export function setBusquedaObjeto(texto) {
    objState.busqueda = texto.toLowerCase();
    window.dispatchEvent(new Event('devUIUpdate'));
}
