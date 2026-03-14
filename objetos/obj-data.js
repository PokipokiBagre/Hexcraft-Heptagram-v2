// ============================================================
// obj-data.js — VERSIÓN SUPABASE
// ============================================================

import { invGlobal, objGlobal, statsGlobal, guardar } from './obj-state.js';
import { db } from '../hex-db.js';

export async function cargarTodoDesdeCSV() {
    try {
        // Carga paralela desde Supabase
        const [catalogoArr, inventarioArr, personajesArr] = await Promise.all([
            db.objetos.getCatalogo(),
            db.objetos.getInventarioCompleto(),
            db.personajes.getAll()
        ]);
        
        // 1. PROCESAR OBJETOS (Catálogo)
        for (let k in objGlobal) delete objGlobal[k];
        catalogoArr.forEach(o => {
            if (o.nombre) {
                objGlobal[o.nombre] = { 
                    tipo: o.tipo || '-', 
                    mat:  o.material || '-', 
                    eff:  o.efecto || 'Sin descripción', 
                    rar:  o.rareza || 'Común' 
                };
            }
        });

        // 2. PROCESAR INVENTARIOS
        for (let k in invGlobal) delete invGlobal[k];
        inventarioArr.forEach(inv => {
            const j = inv.personaje_nombre;
            const o = inv.objeto_nombre;
            const c = inv.cantidad;
            
            if (!invGlobal[j]) invGlobal[j] = {};
            if (c > 0) invGlobal[j][o] = c;
        });

        // 3. PROCESAR ESTADÍSTICAS (Para filtros Activo/Jugador)
        for (let k in statsGlobal) delete statsGlobal[k];
        personajesArr.forEach(p => {
            statsGlobal[p.nombre] = {
                isPlayer:      p.is_player, 
                isActive:      p.is_active,
                iconoOverride: p.icono_override || ""
            };
            // Inicializar su inventario en 0 si no tiene objetos
            if (!invGlobal[p.nombre]) invGlobal[p.nombre] = {};
        });

        guardar();
    } catch (e) { console.error("Error cargando desde Supabase:", e); }
}

export async function sincronizarObjetosBD(cola) {
    try {
        const actualizaciones = Object.values(cola);
        if(actualizaciones.length === 0) return true;

        // Transformamos la cola (que tiene formato visual) al formato que espera Supabase
        const cambiosInventario = [];
        const promesasObjetos = [];

        actualizaciones.forEach(act => {
            // 1. Actualizar el catálogo de objetos (si se modificó descripción, rareza, etc)
            promesasObjetos.push(db.objetos.upsertObjeto({
                nombre: act.objeto,
                tipo:   act.tipo,
                material: act.mat,
                efecto: act.eff,
                rareza: act.rar
            }));

            // 2. Extraer cantidades. La cola guarda strings como "Renato, Corvin" y "2, 1"
            const players = act.duenos ? act.duenos.split(',').map(s=>s.trim()).filter(Boolean) : [];
            const cants   = act.cantidades ? act.cantidades.split(',').map(s=>parseInt(s.trim())) : [];
            
            // Para asegurar que si un objeto se quedó en 0 se borre, 
            // iteramos sobre TODOS los personajes que alguna vez tuvieron inventario
            Object.keys(invGlobal).forEach(j => {
                const idx = players.indexOf(j);
                const cantActual = (idx !== -1) ? cants[idx] : 0;
                cambiosInventario.push({
                    personaje_nombre: j,
                    objeto_nombre: act.objeto,
                    cantidad: cantActual
                });
            });
        });

        // Ejecutar upserts de Catálogo
        await Promise.all(promesasObjetos);

        // Ejecutar Sincronización Batch de Inventario
        const exitoInv = await db.objetos.sincronizarBatch(cambiosInventario);

        if(exitoInv) return true;
        alert("Error al sincronizar inventarios en Supabase.");
        return false;

    } catch (e) {
        console.error("Error fatal en sincronización:", e);
        alert("Error de conexión con la base de datos.");
        return false;
    }
}
