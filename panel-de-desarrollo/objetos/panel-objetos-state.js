// ============================================================
// panel-objetos-state.js — Estado local y Cola de Cambios
// ============================================================

export const STORAGE_URL = 'https://gkscqurkpyteusqyspsu.supabase.co/storage/v1/object/public/imagenes-hex';

export const objState = {
    catalogoDB: [], 
    inventariosDB: {}, 
    
    // Estado de la Interfaz
    vistaActiva: 'inventario', // 'inventario', 'forja', 'editar'
    busqueda: "",
    busquedaEdit: "", // Búsqueda separada para la pestaña Editar
    formulariosCreacion: 1, 
    objAEditarSeleccionado: "", 
    
    // 🔥 LAS COLAS DE CAMBIOS (Staging) 🔥
    colaInventario: {},    
    colaNuevosObjetos: {}, 
    colaEdicionObjetos: {} 
};

export const TIPOS_OBJ = ["Arma", "Armadura", "Accesorio", "Consumible", "Material", "Misión", "Otro"];
export const RAREZAS_OBJ = ["Común", "Raro", "Legendario"];
