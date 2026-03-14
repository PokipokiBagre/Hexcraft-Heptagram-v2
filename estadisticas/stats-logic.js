import { statsGlobal, listaEstados } from './stats-state.js';

export function getMayorAfinidad(p) {
    const calcFisT = (p.afinidadesBase?.fisica||0) + (p.hechizos?.fisica||0) + (p.hechizosEfecto?.fisica||0) + (p.buffs?.fisica||0);
    const calcEneT = (p.afinidadesBase?.energetica||0) + (p.hechizos?.energetica||0) + (p.hechizosEfecto?.energetica||0) + (p.buffs?.energetica||0);
    const calcEspT = (p.afinidadesBase?.espiritual||0) + (p.hechizos?.espiritual||0) + (p.hechizosEfecto?.espiritual||0) + (p.buffs?.espiritual||0);
    const calcManT = (p.afinidadesBase?.mando||0) + (p.hechizos?.mando||0) + (p.hechizosEfecto?.mando||0) + (p.buffs?.mando||0);
    const calcPsiT = (p.afinidadesBase?.psiquica||0) + (p.hechizos?.psiquica||0) + (p.hechizosEfecto?.psiquica||0) + (p.buffs?.psiquica||0);
    const calcOscT = (p.afinidadesBase?.oscura||0) + (p.hechizos?.oscura||0) + (p.hechizosEfecto?.oscura||0) + (p.buffs?.oscura||0);

    const afis = { 'Física': calcFisT, 'Energética': calcEneT, 'Espiritual': calcEspT, 'Mando': calcManT, 'Psíquica': calcPsiT, 'Oscura': calcOscT };
    let max = -1; let mayor = "Ninguna";
    for(let key in afis) { if(afis[key] > max && afis[key] > 0) { max = afis[key]; mayor = key; } }
    return mayor;
}

export function calcularVidaRojaMax(p) {
    if (!p) return 0;
    const base = p.baseVidaRojaMax || 10;
    const hechizos = p.hechizos?.vidaRojaMaxExtra || 0;
    const efectos = p.hechizosEfecto?.vidaRojaMaxExtra || 0;
    const buffs = p.buffs?.vidaRojaMaxExtra || 0;
    
    // Cálculo Dinámico (Física Total / 2 - Física Base / 2)
    const fisBase = p.afinidadesBase?.fisica || 0;
    const fisTotal = fisBase + (p.hechizos?.fisica || 0) + (p.hechizosEfecto?.fisica || 0) + (p.buffs?.fisica || 0);
    const bonusFisica = Math.floor(fisTotal / 2) - Math.floor(fisBase / 2);

    return base + hechizos + efectos + buffs + bonusFisica;
}

export function calcularVexMax(p) {
    if (!p) return 0;
    if (p.isPlayer) {
        const oscTotal = (p.afinidadesBase?.oscura||0) + (p.hechizos?.oscura||0) + (p.hechizosEfecto?.oscura||0) + (p.buffs?.oscura||0);
        return Math.round((oscTotal * 300) / 4 / 50) * 50;
    }
    return p.vex || 0;
}

export function getMysticBonus(p) {
    if (!p) return 0;
    const ene = p.afinidadesBase?.energetica || 0;
    const esp = p.afinidadesBase?.espiritual || 0;
    const man = p.afinidadesBase?.mando || 0;
    const psi = p.afinidadesBase?.psiquica || 0;
    return Math.floor((ene + esp + man + psi) / 4);
}

export function generarCSVExportacion() {
    let csv = "Personaje,Hex,Vex,Fisica,Energetica,Espiritual,Mando,Psiquica,Oscura,Corazones Rojo,Corazones Rojos Max,Corazones Azules,Guarda Dorada,Daño Rojo,Daño Azul,Eliminacion Dorada,Estado,Jugador_Activo,Copia\n";

    const fStr = (b, s, se, bf) => {
        const bSafe = b || 0; const sSafe = s || 0; const seSafe = se || 0; const bfSafe = bf || 0;
        const tot = bSafe + sSafe + seSafe + bfSafe;
        return `${tot}_${bSafe}_${sSafe}_${seSafe}_${bfSafe}`;
    };

    Object.keys(statsGlobal).sort().forEach(nombre => {
        const p = statsGlobal[nombre];
        const afB = p.afinidadesBase || {};
        const hz = p.hechizos || {};
        const he = p.hechizosEfecto || {};
        const bf = p.buffs || {};
        const est = p.estados || {};

        const estadoStr = listaEstados.map(e => {
            let v = est[e.id];
            if (e.tipo === 'booleano') return v ? '1' : '0';
            return v || '0';
        }).join('-');

        const hexCompound = `${p.hex || 0}_${p.asistencia || 1}`;
        const identityStr = `${p.isPlayer ? 1 : 0}_${p.isActive ? 1 : 0}`;
        const vexExport = p.isPlayer ? 0 : (p.vex || 0);

        const row = [
            nombre,
            hexCompound, 
            vexExport, 
            fStr(afB.fisica, hz.fisica, he.fisica, bf.fisica), 
            fStr(afB.energetica, hz.energetica, he.energetica, bf.energetica), 
            fStr(afB.espiritual, hz.espiritual, he.espiritual, bf.espiritual), 
            fStr(afB.mando, hz.mando, he.mando, bf.mando), 
            fStr(afB.psiquica, hz.psiquica, he.psiquica, bf.psiquica), 
            fStr(afB.oscura, hz.oscura, he.oscura, bf.oscura), 
            p.vidaRojaActual !== undefined ? p.vidaRojaActual : 0, 
            fStr(p.baseVidaRojaMax, hz.vidaRojaMaxExtra, he.vidaRojaMaxExtra, bf.vidaRojaMaxExtra), 
            fStr(p.baseVidaAzul, hz.vidaAzulExtra, he.vidaAzulExtra, bf.vidaAzulExtra), 
            fStr(p.baseGuardaDorada, hz.guardaDoradaExtra, he.guardaDoradaExtra, bf.guardaDoradaExtra), 
            fStr(p.baseDanoRojo, hz.danoRojo, he.danoRojo, bf.danoRojo), 
            fStr(p.baseDanoAzul, hz.danoAzul, he.danoAzul, bf.danoAzul), 
            fStr(p.baseElimDorada, hz.elimDorada, he.elimDorada, bf.elimDorada), 
            estadoStr, 
            identityStr, 
            p.iconoOverride || "" 
        ];

        const rowStr = row.map((v, i) => {
            if (i === 0 || i === 1 || i === 2 || i === 9) return String(v); 
            return `"${v}"`;
        }).join(",");

        csv += rowStr + "\n";
    });

    return csv;
}

export function descargarArchivoCSV(contenido, nombreArchivo) {
    const link = document.createElement('a');
    const blob = new Blob(["\uFEFF" + contenido], { type: 'text/csv;charset=utf-8;' });
    link.href = URL.createObjectURL(blob);
    link.download = nombreArchivo;
    link.click();
}
