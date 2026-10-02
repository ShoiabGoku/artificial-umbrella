#!/usr/bin/env node
// ZERO-L force model: the same first-order model the interactive page (index.html) runs.
//
// Quasi-steady normal-force model for a low-aspect-ratio circular plate:
//   C_N = C_La * sin(ae) * cos(ae) + C_Dc * sin(ae) * |sin(ae)|     (attached-flow + crossflow terms)
//   C_L = C_N * cos(ae)        C_D = C_D0 + C_N * sin(ae)
// Conventional dome: zero-lift angle from thin-aerofoil theory, aL0 = -2 f/c with f/c = 0.18.
// ZERO-L: symmetric section (aL0 = 0); one-way gust valves cut upward normal force above the
// 15 Pa opening load to 30 % (assumed 70 % vent effectiveness).
//
// Usage:
//   node model/zerol-model.js                 summary table at 0-30 m/s, level hold, +/-10 deg gusts
//   node model/zerol-model.js 15 0 10         one case: wind m/s, tilt into wind deg, gust +/- deg

const RHO = 1.225;                 // kg/m^3
const DIA = 1.05;                  // canopy diameter, m
const S = Math.PI * DIA * DIA / 4; // planform area, 0.866 m^2
const AR = 4 / Math.PI;            // aspect ratio of a circle
const CLA = 2 * Math.PI * AR / (2 + Math.sqrt(AR * AR + 4)); // Helmbold, 1.83 /rad
const DEG = Math.PI / 180;
const INVERT_N = 60;               // assumed uplift that inverts a typical stick umbrella, N

const CONV = { aL0: -2 * 0.18, cdcConcave: 1.35, cdcConvex: 0.8, cd0: 0.12, cnMax: 1.45 };
const ZL = { cdc: 1.0, cd0: 0.05, cnMax: 1.3, crackPa: 15, residual: 0.3 };

const q = U => 0.5 * RHO * U * U;

function cn(ae, cdc, cnMax) {
  const s = Math.sin(ae), c = Math.cos(ae);
  const raw = CLA * s * c + cdc * s * Math.abs(s);
  return Math.max(-cnMax, Math.min(cnMax, raw));
}

// alpha: angle of attack in rad, positive = windward edge up
function conventional(U, alpha) {
  const ae = alpha - CONV.aL0;
  const N = cn(ae, ae > 0 ? CONV.cdcConcave : CONV.cdcConvex, CONV.cnMax) * q(U) * S;
  return { L: N * Math.cos(ae), D: CONV.cd0 * q(U) * S + N * Math.sin(ae) };
}

function zeroL(U, alpha) {
  let N = cn(alpha, ZL.cdc, ZL.cnMax) * q(U) * S;
  const Nc = ZL.crackPa * S;
  if (N > Nc) N = Nc + ZL.residual * (N - Nc);
  return { L: N * Math.cos(alpha), D: ZL.cd0 * q(U) * S + N * Math.sin(alpha) };
}

// tilt: degrees into the wind (windward edge down); gust: +/- degrees of flow angle
function evaluate(f, U, tilt, gust) {
  const a = -tilt * DEG, g = gust * DEG, m = f(U, a);
  let lo = m.L, hi = m.L;
  for (let i = 0; i <= 24; i++) {
    const L = f(U, a - g + 2 * g * i / 24).L;
    if (L < lo) lo = L;
    if (L > hi) hi = L;
  }
  return { L: m.L, D: m.D, lo, hi };
}

module.exports = { conventional, zeroL, evaluate, q, S, CLA, INVERT_N };

if (require.main === module) {
  const n = v => Math.round(v).toString().padStart(5);
  const args = process.argv.slice(2).map(Number);
  if (args.length) {
    const [U = 15, tilt = 0, gust = 10] = args;
    const c = evaluate(conventional, U, tilt, gust), z = evaluate(zeroL, U, tilt, gust);
    console.log(`U = ${U} m/s, tilt ${tilt} deg into wind, gusts +/-${gust} deg (N, up positive)`);
    console.log(`conventional  mean lift ${n(c.L)}  gust range ${n(c.lo)} to ${n(c.hi)}  drag ${n(c.D)}${c.L > INVERT_N ? '  INVERTED' : c.hi > INVERT_N ? '  inverts in gusts' : ''}`);
    console.log(`ZERO-L        mean lift ${n(z.L)}  gust range ${n(z.lo)} to ${n(z.hi)}  drag ${n(z.D)}`);
  } else {
    console.log(`S = ${S.toFixed(3)} m^2, C_La = ${CLA.toFixed(2)} /rad, conventional zero-lift angle = ${(CONV.aL0 / DEG).toFixed(1)} deg`);
    console.log('level hold, +/-10 deg gusts; forces in N, up positive');
    console.log('  U m/s |  conv mean  conv gust-hi  conv drag |  ZL mean  ZL gust-lo  ZL gust-hi  ZL drag');
    for (let U = 0; U <= 30; U += 5) {
      const c = evaluate(conventional, U, 0, 10), z = evaluate(zeroL, U, 0, 10);
      console.log(`  ${String(U).padStart(5)} |  ${n(c.L)}      ${n(c.hi)}      ${n(c.D)} |  ${n(z.L)}     ${n(z.lo)}      ${n(z.hi)}    ${n(z.D)}`);
    }
  }
}
