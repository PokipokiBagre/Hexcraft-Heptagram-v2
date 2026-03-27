// ============================================================
// panel-objetos-state.js — Estado local y Cola de Cambios
// ============================================================

export const STORAGE_URL = 'https://gkscqurkpyteusqyspsu.supabase.co/storage/v1/object/public/imagenes-hex';

export const objState = {
    catalogoDB: [], 
    inventariosDB: {}, 
    
    // Estado de la Interfaz
    vistaActiva: 'inventario', // 'inventario', 'catalogo', 'forja', 'editar'
    busqueda: "",
    busquedaCat: "",
    busquedaEdit: "",
    formulariosCreacion: 1, 
    objAEditarSeleccionado: "", 
    
    // 🔥 LAS COLAS DE CAMBIOS (Staging) 🔥
    colaInventario: {},    
    colaNuevosObjetos: {}, 
    colaEdicionObjetos: {} 
};

// 🌟 LISTAS OFICIALES CORREGIDAS SEGÚN TU SISTEMA 🌟
export const TIPOS_OBJ = ["Consumible", "Herramienta", "Accesorio", "Equipamiento", "-"];
export const MATERIALES_OBJ = ["Cristal", "Metal", "Orgánico", "Sagrado", "-"];
export const RAREZAS_OBJ = ["Común", "Raro", "Legendario", "-"];
