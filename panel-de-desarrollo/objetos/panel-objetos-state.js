// ============================================================
// panel-objetos-state.js — Estado local y Cola de Cambios
// ============================================================

export const STORAGE_URL = 'https://gkscqurkpyteusqyspsu.supabase.co/storage/v1/object/public/imagenes-hex';

export const objState = {
    // Datos originales descargados de la BD
    catalogoDB: [], 
    inventariosDB: {}, 
    
    // Estado de la Interfaz
    vistaActiva: 'inventario', // Opciones: 'inventario', 'forja', 'editar'
    busqueda: "",
    formulariosCreacion: 1, 
    objAEditarSeleccionado: "", // Guarda el nombre del objeto que estamos editando
    
    // 🔥 LAS COLAS DE CAMBIOS (Staging) 🔥
    colaInventario: {},    // { "NombrePJ": { "NombreObjeto": NuevaCantidadFinal } }
    colaNuevosObjetos: {}, // { "0": { nombre, cant, tipo, mat, rar, eff } }
    colaEdicionObjetos: {} // { "NombreOriginal": { nombreNuevo, tipo, mat, rar, eff } }
};

export const TIPOS_OBJ = ["Arma", "Armadura", "Accesorio", "Consumible", "Material", "Misión", "Otro"];
export const RAREZAS_OBJ = ["Común", "Raro", "Legendario"];
