// ============================================================
// panel-objetos-state.js — Estado local y Cola de Cambios
// ============================================================

export const STORAGE_URL = 'https://gkscqurkpyteusqyspsu.supabase.co/storage/v1/object/public/imagenes-hex';

export const objState = {
    // Datos originales descargados de la BD
    catalogoDB: [], 
    inventariosDB: {}, 
    
    // Estado de la Interfaz
    busqueda: "",
    formulariosCreacion: 1, // Cuántos objetos nuevos estás creando a la vez
    
    // 🔥 LA COLA DE CAMBIOS (Staging) 🔥
    // Aquí se guardan las modificaciones antes de presionar "Guardar Todo"
    colaInventario: {}, // Formato: { "NombrePJ": { "NombreObjeto": NuevaCantidadFinal } }
    colaNuevosObjetos: {} // Formato: { "0": { nombre, cant, tipo, mat, rar, eff } }
};

export const TIPOS_OBJ = ["Arma", "Armadura", "Accesorio", "Consumible", "Material", "Misión", "Otro"];
export const RAREZAS_OBJ = ["Común", "Raro", "Legendario"];
