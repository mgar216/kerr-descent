// AIRLOCK — EVA hard-suit (white HUT torso, joint rings, gold-visor helmet, PLSS backpack, chest control box, hoses, gloves, orange stripes) + loose helmet.
// suit(kit, F): F = Frame at the soles, suit faces local −Z, backpack toward +Z. helmet(kit, F, o): helmet alone (F at its centre).
import { canvasTex, texMat } from './crew_util.js';

export function suitMats(kit) {
  const vt = canvasTex(kit, 128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f6d77a'); gr.addColorStop(0.45, '#c8932d'); gr.addColorStop(0.55, '#7a4f12'); gr.addColorStop(1, '#d9a949');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.moveTo(18, 0); g.lineTo(44, 0); g.lineTo(22, h * 0.7); g.lineTo(0, h * 0.7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(58, 0); g.lineTo(68, 0); g.lineTo(34, h * 0.8); g.lineTo(26, h * 0.8); g.fill();
  });
  texMat(kit, 'crewVisor', vt, { rough: 0.12, metal: 0.35 });
}

export function helmet(kit, H, o = {}) {
  const PI = Math.PI;
  H.sph('suitWhite', [0, 0, 0.005], 0.155, { seg: 20 }); H.tor('metal', [0, -0.135, 0], 0.1, 0.014, { seg: 18 });
  H.sph('crewVisor', [0, 0.0, -0.014], [0.148, 0.132, 0.145], { seg: 20, ps: 3 * PI / 2 - 1.25, pl: 2.5, ts: 0.62, tl: 1.7 });
  H.tor('paintOrange', [0, 0, 0.0], 0.158, 0.009, { seg: 20, axis: 'x', arc: PI * 1.0, rot: [0.97, 0, 0] });
  for (const s of [-1, 1]) { H.box('emitPanel', [s * 0.128, 0.09, -0.05], [0.03, 0.02, 0.03], { bev: 0.004, rot: [0, s * 0.6, 0] }); H.cyl('trim', [s * 0.157, -0.01, 0.01], 0.03, 0.03, { axis: 'x', seg: 10 }); }
  H.box('paintCyan', [0, 0.155, -0.02], [0.05, 0.012, 0.08], { bev: 0.004 }); H.box('trim', [0.0, 0.158, -0.07], [0.04, 0.025, 0.03], { bev: 0.006 });
  if (o.lamp) H.box('emitPanel', [0, 0.158, -0.086], [0.03, 0.012, 0.004], { bev: 0 });
}

export default function suit(kit, F) {
  const PI = Math.PI;
  suitMats(kit);
  // boots, ankle bellows, shins, knees, thighs
  for (const s of [-1, 1]) {
    const x = s * 0.115;
    F.box('suitWhite', [x, 0.085, -0.03], [0.125, 0.11, 0.3], { bev: 0.03 }); F.box('rubber', [x, 0.015, -0.03], [0.135, 0.03, 0.32], { bev: 0.008 });
    F.sph('plasticDark', [x, 0.065, -0.165], [0.065, 0.05, 0.05], { seg: 10 }); F.box('paintOrange', [x, 0.1, -0.1], [0.128, 0.012, 0.03], { bev: 0.002 });
    F.cyl('suitWhite', [x, 0.2, 0.0], 0.062, 0.1, { seg: 16 }); F.tor('metal', [x, 0.145, 0.0], 0.065, 0.012, { seg: 16 });
    F.cyl('suitWhite', [x, 0.395, 0.0], 0.07, 0.35, { rt: 0.078, rb: 0.064, seg: 18 }); F.cyl('paintOrange', [x, 0.34, 0.0], 0.074, 0.03, { seg: 18 });
    F.tor('metal', [x, 0.575, 0.0], 0.078, 0.013, { seg: 16 }); F.box('trim', [x, 0.56, -0.075], [0.08, 0.07, 0.025], { bev: 0.012 });
    F.cyl('suitWhite', [x, 0.78, 0.0], 0.09, 0.38, { rt: 0.098, rb: 0.082, seg: 18 }); F.cyl('paintOrange', [x, 0.8, 0.0], 0.1, 0.035, { seg: 18 });
    F.tor('metal', [x, 0.985, 0.0], 0.1, 0.014, { seg: 16 });
  }
  F.box('plasticDark', [0.205, 0.8, -0.04], [0.04, 0.14, 0.12], { bev: 0.012 }); F.box('paintOrange', [0.226, 0.84, -0.04], [0.004, 0.03, 0.1], { bev: 0 });          // thigh tool pouch
  // pelvis, belt, hard upper torso, neck ring
  F.box('suitWhite', [0, 1.04, 0], [0.34, 0.14, 0.2], { bev: 0.05 }); F.cyl('trim', [0, 1.11, 0], 0.17, 0.05, { seg: 20, sc: [1.0, 1, 0.74] }); F.box('metal', [0.16, 1.11, -0.11], [0.04, 0.045, 0.025], { bev: 0.006 });
  F.box('suitWhite', [0, 1.34, 0.0], [0.44, 0.46, 0.26], { bev: 0.075 }); F.box('suitWhite', [0, 1.52, 0.0], [0.47, 0.12, 0.24], { bev: 0.05 });
  F.box('paintOrange', [0, 1.19, -0.135], [0.44, 0.03, 0.01], { bev: 0.003 }); F.box('paintCyan', [-0.13, 1.45, -0.14], [0.09, 0.03, 0.006], { bev: 0.002 });
  F.tor('metal', [0, 1.585, 0], 0.1, 0.017, { seg: 18 });
  // chest control box: screen, LEDs, buttons, hose connectors
  F.box('plasticDark', [0, 1.33, -0.142], [0.22, 0.14, 0.04], { bev: 0.01 }); F.box('screenOff', [-0.045, 1.35, -0.164], [0.09, 0.06, 0.003], { bev: 0 }); F.box('ledCyan', [-0.045, 1.36, -0.166], [0.07, 0.006, 0.002], { bev: 0 });
  F.box(kit.led('Green'), [0.06, 1.37, -0.164], [0.014, 0.014, 0.004], { bev: 0 }); F.box(kit.led('Amber', 'Blink'), [0.085, 1.37, -0.164], [0.014, 0.014, 0.004], { bev: 0 });
  for (let k = 0; k < 3; k++) F.cyl(k === 1 ? 'paintOrange' : 'metal', [-0.07 + k * 0.05, 1.3, -0.166], 0.014, 0.012, { axis: 'z', seg: 10 });
  for (const s of [-1, 1]) {
    F.cyl('metal', [s * 0.13, 1.22, -0.14], 0.022, 0.04, { axis: 'z', seg: 12 });
    F.tube('rubber', [[s * 0.13, 1.22, -0.155], [s * 0.22, 1.2, -0.17], [s * 0.3, 1.25, -0.06], [s * 0.26, 1.34, 0.12], [s * 0.18, 1.3, 0.2]], 0.011, { rseg: 6 });
  }
  // arms: shoulder ball + ring, upper arm, elbow, forearm, wrist ring, glove; right arm slightly forward
  for (const s of [-1, 1]) {
    const Ar = F.sub([s * 0.285, 1.47, 0.0], [s > 0 ? -0.16 : -0.1, 0, -s * 0.2]);
    Ar.sph('suitWhite', [0, 0, 0], 0.088, { seg: 14 }); Ar.tor('metal', [0, -0.05, 0], 0.074, 0.013, { seg: 16 });
    Ar.cyl('suitWhite', [0, -0.2, 0], 0.062, 0.3, { rt: 0.066, rb: 0.056, seg: 16 }); Ar.cyl('paintOrange', [0, -0.15, 0], 0.07, 0.035, { seg: 16 });
    Ar.tor('metal', [0, -0.355, 0], 0.056, 0.012, { seg: 14 });
    const E = Ar.sub([0, -0.37, 0], [-0.38, 0, 0]);
    E.sph('suitWhite', [0, 0, 0], 0.06, { seg: 12 }); E.cyl('suitWhite', [0, -0.16, 0], 0.052, 0.27, { rt: 0.056, rb: 0.046, seg: 16 }); E.tor('metal', [0, -0.3, 0], 0.05, 0.013, { seg: 14 });
    E.box('plasticDark', [0, -0.09, 0.0], [0.092, 0.1, 0.05], { bev: 0.015 }); E.box('plasticDark', [0, -0.46, 0.0], [0.09, 0.1, 0.062], { bev: 0.028 });
    for (let k = 0; k < 4; k++) E.box('plasticDark', [-0.03 + k * 0.02, -0.53, 0.0], [0.016, 0.05, 0.03], { bev: 0.006 });
    E.box('plasticDark', [s * 0.06, -0.44, -0.01], [0.03, 0.07, 0.03], { bev: 0.008, rot: [0, 0, s * 0.5] }); E.box('paintOrange', [0, -0.52, -0.03], [0.07, 0.012, 0.004], { bev: 0 });
    if (s < 0) { E.box('plasticDark', [0, -0.12, -0.04], [0.07, 0.11, 0.02], { bev: 0.004 }); E.box('screenOff', [0, -0.12, -0.052], [0.05, 0.07, 0.002], { bev: 0 }); E.box('ledCyan', [0, -0.1, -0.053], [0.04, 0.008, 0.002], { bev: 0 }); }
    else E.tor('metal', [0, -0.2, 0], 0.056, 0.006, { seg: 12 });
  }
  // helmet (gold visor)
  helmet(kit, F.sub([0, 1.735, 0.0]), { lamp: true });
  // PLSS backpack + dock hoses + antenna
  F.box('suitWhite', [0, 1.3, 0.2], [0.38, 0.52, 0.17], { bev: 0.03 }); F.box('metal', [0, 1.02, 0.2], [0.3, 0.06, 0.14], { bev: 0.01 });
  F.box('paintOrange', [0, 1.38, 0.287], [0.3, 0.22, 0.008], { bev: 0.003 }); for (let k = 0; k < 4; k++) F.box('trim', [0, 1.15 + k * 0.022, 0.287], [0.24, 0.01, 0.006], { bev: 0 });
  F.cyl('metal', [0.16, 1.66, 0.22], 0.004, 0.15, { seg: 6 }); F.sph('metal', [0.16, 1.74, 0.22], 0.008, { seg: 6 }); F.box(kit.led('Green'), [0.2, 1.2, 0.2], [0.004, 0.014, 0.014], { bev: 0 });
  for (const s of [-1, 1]) { F.cyl('metal', [s * 0.09, 1.02, 0.28], 0.02, 0.04, { axis: 'z', seg: 10 }); F.tube('rubber', [[s * 0.09, 1.02, 0.3], [s * 0.1, 1.0, 0.36], [s * 0.16, 1.2, 0.4]], 0.012, { rseg: 6 }); }
  // wrist tether line + belt tether clip
  F.tube('paintOrange', [[-0.17, 1.1, -0.12], [-0.22, 0.95, -0.1], [-0.2, 0.8, -0.04]], 0.006, { rseg: 5 }); F.tor('metal', [-0.2, 0.78, -0.04], 0.018, 0.004, { seg: 10, axis: 'z' });
}
