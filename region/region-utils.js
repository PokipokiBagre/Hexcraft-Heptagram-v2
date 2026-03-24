// ============================================================
// region-utils.js — Matemática Isométrica y Hexagonal
// ============================================================

import { HEX_SIZE, camara } from './region-state.js';

const SQRT3 = Math.sqrt(3);

// Proyección de una coordenada (q,r,elevation) a píxeles isométricos.
export function hexToPixel3D(q, r, elevation = 0) {
    // Coordenada hex flat-top base (un-elevated)
    const x2d = q * 1.5 * HEX_SIZE;
    const y2d = (q * 0.5 + r) * SQRT3 * HEX_SIZE;
    
    // Proyección isométrica (squash vertical)
    const px = (x2d - y2d) * camara.zoom;
    // La elevación es un desplazamiento vertical negativo (arriba)
    const py = (x2d + y2d) * camara.zoom * camara.PITCH_SCALE - elevation * camara.elevationScale * camara.zoom;
    
    return { x: px + camara.x, y: py + camara.y };
}

// Convierte píxeles de pantalla a coordenadas hex (q,r) considerando la base.
// Es complejo por la elevación, así que calculamos la base proyectada.
export function pixelToHex3D(screenX, screenY) {
    // Coordenadas relativas a cámara y zoom (sin elevación)
    const sx = (screenX - camara.x) / camara.zoom;
    const sy = (screenY - camara.y) / camara.zoom;
    
    // Inversión de la proyección isométrica:
    const sy_pitch = sy / camara.PITCH_SCALE;
    const x2d = 0.5 * (sx + sy_pitch);
    const y2d = 0.5 * (sy_pitch - sx);
    
    // Coordenadas hex originales (flat-top) desde coordenadas cartesianas 2D:
    const q = x2d / (1.5 * HEX_SIZE);
    const r = (y2d / (SQRT3 * HEX_SIZE)) - (q * 0.5);
    
    // Redondear q y r a los enteros correctos
    const sq = Math.round(q);
    const sr = Math.round(r);
    const ss = -sq - sr; // Para hexes, q+r+s=0
    
    const q_diff = Math.abs(sq - q);
    const r_diff = Math.abs(sr - r);
    const s_diff = Math.abs(ss - (-q-r));
    
    let fq = sq, fr = sr;
    if (q_diff > r_diff && q_diff > s_diff) fq = -sr - ss;
    else if (r_diff > s_diff) fr = -sq - ss;
    
    return { q: fq, r: fr };
}

export function hexKey(q, r) { return `${q},${r}`; }

export function hexesEnRadio(q, r, radio) {
    const result = [];
    for (let dq = -radio; dq <= radio; dq++)
        for (let dr = Math.max(-radio,-dq-radio); dr <= Math.min(radio,-dq+radio); dr++)
            result.push({ q: q+dq, r: r+dr });
    return result;
}

// Retorna los 6 vértices de un hexágono isométrico (arriba o base)
export function isometricHexVertices(cx, cy, elevation = 0) {
    const size = HEX_SIZE * camara.zoom;
    const squash = camara.PITCH_SCALE;
    
    return Array.from({length: 6}, (_, i) => {
        const angle = (Math.PI / 180) * (60 * i);
        // Coordenada base un-squashed
        const vx_2d = size * Math.cos(angle);
        const vy_2d = size * Math.sin(angle);
        
        // Aplicar transformación isométrica y elevación
        const px = (vx_2d - vy_2d); 
        const py = (vx_2d + vy_2d) * squash;
        return { x: cx + px, y: cy + py };
    });
}

// Comprime una clave q,r para usarla como ID válido en base de datos.
export function normKey(s) {
    return s ? s.toString().trim().toLowerCase()
        .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e')
        .replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o')
        .replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
        .replace(/\s+/g,'_').replace(/[^a-z0-9_\-]/g,'') : '';
}
