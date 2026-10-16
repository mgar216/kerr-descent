// QUARTERS — bunk against the outer wall: platform + drawers, mattress, rumpled blanket, pillow, safety net, headboard shelf + reading light.
// ORPHEUS: made bed (interactable quarters.bunk). EURYDICE: blanket pushed off and frozen, drawer hanging open, net torn, log recorder 2 on the mattress.
import { Frame, clothGrid, canvasTex, texMat } from './crew_util.js';

export default function bunk(kit) {
  const eur = kit.eur, art = kit.crewArt, BL = art.uv.blanket;
  const xc = -3.45, zc = 6.84, F = new Frame(kit, [xc, 0, zc]);        // local x across (+x = aisle side), z along (+z = head end, aft); y = world y
  const TOP = -0.53;                                                      // mattress top (world y)

  // platform: kick plate, body, deck slab, orange stripe
  F.box('trim', [0, -1.165, 0], [0.84, 0.07, 2.0], { bev: 0.004 });
  F.box('white', [0, -0.915, 0], [0.9, 0.43, 2.08], { bev: 0.012 });
  F.box('steel', [0, -0.685, 0], [0.92, 0.03, 2.1], { bev: 0.008 });
  F.box('paintOrange', [0.452, -0.735, 0], [0.008, 0.03, 2.0], { bev: 0 });
  // under-bunk drawers (aisle face); EURYDICE: the aft one hangs open
  const drawer = (z, out) => {
    if (out > 0) {
      F.box('rubber', [0.452, -0.93, z], [0.004, 0.32, 0.95], { bev: 0 });
      const cx = 0.455 + out - 0.3;
      F.box('steel', [cx, -1.07, z], [0.6, 0.012, 0.9], { bev: 0 }); F.box('steel', [cx - 0.3, -0.96, z], [0.012, 0.2, 0.9], { bev: 0 });
      for (const s of [-1, 1]) F.box('steel', [cx, -0.96, z + s * 0.445], [0.6, 0.2, 0.012], { bev: 0 });
    }
    F.box('steel', [0.455 + out, -0.93, z], [0.014, 0.31, 0.95], { bev: 0.004 });
    F.box('trim', [0.47 + out, -0.85, z], [0.022, 0.024, 0.32], { bev: 0.006 });
    F.box('paintCyan', [0.464 + out, -0.99, z - 0.36], [0.008, 0.012, 0.1], { bev: 0 });
  };
  drawer(-0.5, 0); drawer(0.5, eur ? 0.4 : 0);
  if (eur) { F.sph('crewFabO', [0.72, -1.1, 0.46], [0.13, 0.05, 0.1], { seg: 8, rot: 0.4 }); F.box('paintWhite', [0.62, -1.19, 0.2], [0.21, 0.004, 0.297], { bev: 0, rot: 0.5 }); }

  // mattress + pillow
  F.box('crewFabB', [0, -0.615, 0.02], [0.84, 0.17, 2.0], { bev: 0.05 });
  F.box('trim', [0, -0.6, 0.02], [0.846, 0.008, 2.006], { bev: 0.003 });
  if (!eur) F.sph('crewFab', [0.02, -0.47, 0.74], [0.3, 0.075, 0.2], { seg: 14, rot: [0.03, 0.06, -0.03] });
  else { F.sph('crewFab', [0.7, -1.125, -0.3], [0.3, 0.075, 0.2], { seg: 12, rot: [0, 0.9, 0.1] }); }

  // blanket (parametric cloth draped over the aisle edge)
  const drapeAmt = eur ? 0.62 : 0.3;
  const blanket = (z0, z1, amp) => {
    const g = clothGrid(26, 20, (u, v) => {
      const lz = z0 + (z1 - z0) * u, hump = 0.5 - 0.5 * Math.cos(u * Math.PI * 2);
      const rum = amp * (0.02 * Math.sin(lz * 15 + v * 9) + 0.015 * Math.sin(lz * 29 - v * 11 + 1.7) + 0.026 * Math.sin((u * 2.2 + v * 1.3) * Math.PI) * hump);
      if (v <= 0.7) { const s = v / 0.7, x = -0.43 + 0.86 * s; return [x, TOP + 0.014 + hump * 0.02 + rum - (s < 0.07 ? (0.07 - s) * 0.4 : 0), lz]; }
      const s = (v - 0.7) / 0.3, yE = TOP + 0.014 + hump * 0.02, len = drapeAmt * (0.75 + 0.25 * Math.sin(lz * 7.3 + 1));
      return [0.43 + 0.05 * Math.sin(s * 2.6) + 0.03 * s * Math.sin(lz * 12), yE - len * s + rum * 0.5, lz];
    }, BL);
    F.add('crewArt', g); g.dispose();
  };
  if (!eur) {
    blanket(-0.74, 0.4, 1); F.cyl('crewArt', [0, TOP + 0.05, 0.4], 0.036, 0.86, { axis: 'x', seg: 10, uvr: BL });
    F.cyl('crewArt', [0, TOP + 0.028, 0.48], 0.026, 0.84, { axis: 'x', seg: 8, uvr: BL });
  } else {
    blanket(-0.95, -0.15, 2.2);
    F.sph('crewArt', [0.66, -1.1, -0.58], [0.22, 0.1, 0.17], { seg: 10, rot: 0.3, uvr: BL }); F.sph('crewArt', [0.78, -1.14, -0.4], [0.16, 0.06, 0.2], { seg: 9, rot: -0.5, uvr: BL }); F.sph('crewArt', [0.56, -1.12, -0.28], [0.14, 0.07, 0.12], { seg: 8, uvr: BL });
  }

  // safety net along the aisle side (webbing mesh texture) + posts, rail, straps
  const netTex = canvasTex(kit, 64, 64, (g, w, h) => { g.strokeStyle = '#d6dadf'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(-4, -4); g.lineTo(w + 4, h + 4); g.moveTo(w + 4, -4); g.lineTo(-4, h + 4); g.stroke(); }, { repeat: true });
  texMat(kit, 'crewNet', netTex, { transparent: true, opacity: 1, doubleSide: true, rough: 0.9 });
  const nz0 = eur ? 0.1 : -0.92, nz1 = 0.94, nl = nz1 - nz0;
  F.quad('crewNet', [0.452, -0.415, (nz0 + nz1) / 2], nl, 0.42, { uv: [0, 0, nl / 0.07, 6], rot: [0, Math.PI / 2, 0] });
  for (const z of eur ? [nz0, nz1] : [-0.93, 0.93]) F.cyl('steel', [0.45, -0.41, z], 0.013, 0.46, { seg: 8 });
  F.box('steel', [0.45, -0.18, (nz0 + nz1) / 2], [0.026, 0.026, nl], { bev: 0.008 });
  for (const z of eur ? [0.3, 0.8] : [-0.7, 0, 0.7]) { F.box('paintOrange', [0.455, -0.4, z], [0.006, 0.44, 0.03], { bev: 0 }); F.box('steel', [0.46, -0.6, z], [0.014, 0.04, 0.05], { bev: 0.003 }); }
  if (eur) { F.tube('rubber', [[0.45, -0.19, 0.08], [0.47, -0.3, -0.05], [0.5, -0.55, -0.3], [0.52, -0.75, -0.42]], 0.006); F.tube('rubber', [[0.45, -0.19, -0.1], [0.48, -0.4, -0.25], [0.46, -0.62, -0.5]], 0.005); }

  // headboard pad, wall shelf (books, mug), swing-arm reading light
  F.box('leather', [0, -0.36, 1.065], [0.88, 0.5, 0.04], { bev: 0.015 }); F.box('paintOrange', [0, -0.1, 1.05], [0.88, 0.014, 0.02], { bev: 0 });
  F.box('wood', [0, 0.02, 0.965], [0.82, 0.03, 0.24], { bev: 0.006 });
  for (const x of [-0.34, 0.34]) F.beam('trim', [x, 0.0, 0.84], [x, -0.14, 1.08], 0.02, 0.02, { bev: 0.003 });
  if (!eur) {
    [['paintOrange', -0.35, 0.26, 0.045], ['paintCyan', -0.3, 0.22, 0.032], ['leather', -0.26, 0.25, 0.04], ['crewFab', -0.21, 0.2, 0.03]].forEach(([m, x, h, w]) => F.box(m, [x, 0.035 + h / 2, 0.98], [w, h, 0.17], { bev: 0.004, rot: [0, 0, m === 'crewFab' ? -0.2 : 0] }));
    F.cyl('paintWhite', [0.2, 0.082, 0.96], 0.04, 0.095, { seg: 16 }); F.tor('paintWhite', [0.248, 0.082, 0.96], 0.026, 0.008, { axis: 'x', arc: Math.PI, rot: [0, 0, 0], seg: 12 }); F.cyl('rubber', [0.2, 0.125, 0.96], 0.034, 0.004, { seg: 12 });
    F.box('paintOrange', [0.3, 0.1, 0.98], [0.1, 0.012, 0.15], { bev: 0.002, rot: [0, 0.3, 0] });                    // folded flight map
    F.box('trim', [-0.1, 0.34, 1.075], [0.07, 0.07, 0.025], { bev: 0.006 });
    F.tube('metal', [[-0.1, 0.34, 1.06], [-0.1, 0.42, 0.92], [-0.12, 0.45, 0.76]], 0.008);
    F.cyl('trim', [-0.12, 0.43, 0.72], 0.034, 0.06, { seg: 12, rot: [0.35, 0, 0] }); F.cyl('emitWarm', [-0.12, 0.399, 0.703], 0.027, 0.004, { seg: 12, rot: [0.35, 0, 0] });
    F.box(kit.led('Amber'), [-0.1, 0.375, 1.066], [0.01, 0.01, 0.006], { bev: 0 });
  } else {
    F.box('leather', [-0.3, 0.12, 0.98], [0.04, 0.2, 0.15], { bev: 0.004, rot: [0, 0, 0.5] }); F.box('paintCyan', [-0.2, 0.05, 0.96], [0.15, 0.03, 0.12], { bev: 0.004, rot: [0, 0.3, 0] });
    F.cyl('paintWhite', [0.25, 0.082, 0.96], 0.04, 0.095, { seg: 16, rot: [0, 0, Math.PI / 2], sc: 1 });
    F.box('trim', [-0.1, 0.34, 1.075], [0.07, 0.07, 0.025], { bev: 0.006 }); F.tube('metal', [[-0.1, 0.34, 1.06], [-0.1, 0.3, 0.9], [-0.06, 0.1, 0.8]], 0.008);
    kit.recorder(2, [xc + 0.05, TOP + 0.026, zc + 0.52], 0.45);
  }

  // collider + interactable
  kit.colBox([xc, -0.8, zc], [0.92, 0.8, 2.1]);
  if (!eur) kit.interact({ id: 'quarters.bunk', label: 'Bunk', pos: [xc, -0.4, zc], radius: 1.7, hit: { c: [xc, -0.72, zc], s: [0.96, 0.95, 2.14] } });
}
