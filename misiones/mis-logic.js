import { misGlobal, estadoUI } from './mis-state.js';
import { dibujarTablero, actualizarBotonSync } from './mis-ui.js';

export function encolarCambioMision(idMision) {
    const m = misGlobal.find(mis => mis.id === idMision);
    if (!m) return;
    
    if(!estadoUI.colaCambios.misiones[idMision]) estadoUI.colaCambios.misiones[idMision] = {};
    const sync = estadoUI.colaCambios.misiones[idMision];
    
    sync['Misiones'] = m.titulo;
    sync['Tipo'] = m.tipo;
    sync['Necesarios'] = m.cupos;
    sync['Activa'] = m.estado;
    sync['Clase'] = 'Clase ' + m.clase;
    sync['Recompensa'] = m.desc;
    sync['Nota OP'] = m.notaOP;
    sync['Jugadores'] = m.jugadores.join(', ');
    sync['Autor'] = m.autor;
    
    actualizarBotonSync();
}

export function verificarLimites() {
    const activasGrandes = misGlobal.filter(m => m.tipo === 'Grande' && (m.estado === 1 || m.estado === 2));
    const activasNormales = misGlobal.filter(m => m.tipo === 'Normal' && (m.estado === 1 || m.estado === 2));

    if (activasGrandes.length > 7) {
        activasGrandes.sort((a,b) => b.orden - a.orden);
        const aDesactivar = activasGrandes.slice(7); 
        aDesactivar.forEach(m => { m.estado = 0; encolarCambioMision(m.id); });
    }

    if (activasNormales.length > 14) {
        activasNormales.sort((a,b) => b.orden - a.orden);
        const aDesactivar = activasNormales.slice(14);
        aDesactivar.forEach(m => { m.estado = 0; encolarCambioMision(m.id); });
    }
}

export function asignarJugador(idMision, nombreJugador) {
    const m = misGlobal.find(mis => mis.id === idMision);
    if(!m) return;
    
    if (!estadoUI.esAdmin && (m.tipo === 'Grande' || m.tipo === 'Normal')) {
        return alert("Solo el OP puede modificar misiones Grandes o Normales.");
    }

    if (!m.jugadores.includes(nombreJugador)) {
        m.jugadores.push(nombreJugador);
        
        // EL DETONADOR: Activa la misión si llega al umbral requerido
        if (m.estado === 0 && m.cupos > 0 && m.jugadores.length >= m.cupos) {
            m.estado = 1;
        }
        
        encolarCambioMision(idMision);
        dibujarTablero();
    }
}

export function removerJugador(idMision, nombreJugador) {
    const m = misGlobal.find(mis => mis.id === idMision);
    if(!m) return;

    if (!estadoUI.esAdmin && (m.tipo === 'Grande' || m.tipo === 'Normal')) {
        return alert("Solo el OP puede modificar misiones Grandes o Normales.");
    }

    m.jugadores = m.jugadores.filter(j => j !== nombreJugador);
    
    // EL APAGADOR: Si estaba Pendiente y baja del umbral, regresa a Inactiva
    if (m.estado === 1 && m.cupos > 0 && m.jugadores.length < m.cupos) {
        m.estado = 0;
    }
    
    encolarCambioMision(idMision);
    dibujarTablero();
}

export function guardarMision(datos) {
    let m = misGlobal.find(mis => mis.id === datos.id);
    if (!m) {
        m = { ...datos, jugadores: [], orden: misGlobal.length };
        misGlobal.push(m);
    } else {
        Object.assign(m, datos);
    }
    
    verificarLimites();
    encolarCambioMision(m.id);
    dibujarTablero();
}

export function eliminarPersonalizada(id) {
    const idx = misGlobal.findIndex(m => m.id === id);
    if (idx > -1) {
        const m = misGlobal[idx];
        if (m.tipo !== 'Personalizada' && !estadoUI.esAdmin) return alert("Solo puedes borrar personalizadas.");
        misGlobal.splice(idx, 1);
        
        // Marcador de borrado — sincronizarBD llama a db.misiones.eliminar
        estadoUI.colaCambios.misiones[id] = { __ELIMINAR__: true, titulo: id };

        actualizarBotonSync();
        dibujarTablero();
    }
}
