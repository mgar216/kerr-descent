// Flight deck wall fittings: aft bulkhead (plaque, status board, lockers, EVA helmets, extinguisher, first aid, cable tray), pod wall conduits, floor markings.
import * as THREE from 'three';
import { makeDraws } from './fd_screens.js';

const PI = Math.PI;
export default function build(kit, U) {
  const { box, cyl, sph, torus, tube, sign, at, frame, led, vent, aft, diag, beam } = U;
  const eur = kit.eur, FLOOR = kit.L.FLOOR, ZW = 2.325, T = kit.T, D = makeDraws(kit);
  const locker = (F, lx, y0, y1, w, d, label) => {
    const h = y1 - y0, ym = (y0 + y1) / 2;
    box(F, 'fdShell', [lx, ym, d / 2], [w - 0.012, h, d], { bev: 0.008 }); box(F, 'white', [lx, ym, d + 0.007], [w - 0.03, h - 0.03, 0.014], { bev: 0.005 });
    box(F, 'paintOrange', [lx + (w / 2 - 0.05), ym, d + 0.024], [0.018, 0.14, 0.018], { bev: 0.004 }); box(F, 'trim', [lx, y1 - 0.06, d + 0.016], [w - 0.07, 0.01, 0.004], { bev: 0 });
    vent(F, [lx, y1 - 0.12, d + 0.014], w - 0.12, 0.06, 4); sign(F, label, [lx, ym + 0.08, d + 0.016], { w: w - 0.08, h: 0.04 }); led(F, [lx - (w / 2 - 0.045), y0 + 0.05, d + 0.014], 'Green', '', 0.01);
  };
  const helmet = (F, lx, y, d, tilt = 0) => {
    const H = at(F, [lx, y, d], { rot: [tilt, 0, 0] });
    sph(H, 'suitWhite', [0, 0, 0], 0.13, { seg: 16 }); torus(H, 'steel', [0, -0.1, 0], 0.088, 0.013, { axis: 'y', seg: 18, tube: 5 }); torus(H, 'paintOrange', [0, -0.07, 0], 0.115, 0.006, { axis: 'y', seg: 20, tube: 4 });
    sph(H, 'screenOff', [0, 0.005, 0.07], 0.1, { scale: [1.05, 0.74, 0.58], seg: 14 }); sph(H, 'bronze', [0, 0.005, 0.082], 0.092, { scale: [1.04, 0.66, 0.4], seg: 12, phi: PI * 2 });
    cyl(H, 'darkMetal', [0.12, -0.02, -0.02], 0.014, 0.05, { axis: 'x', seg: 8 });
  };
  const A = (xw, y = 0, d = 0) => aft(xw, y, d);      // aft-bulkhead frame at world x (local +x = world −x)

  // ── plaque + status board (starboard flush zone) ──
  {
    const F = A(1.55);
    box(F, 'darkMetal', [0, 0.25, 0.012], [0.72, 0.38, 0.024], { bev: 0.006 });
    for (const [x, y, w, h] of [[0, 0.25 + 0.17, 0.68, 0.028], [0, 0.25 - 0.17, 0.68, 0.028], [0.325, 0.25, 0.028, 0.34], [-0.325, 0.25, 0.028, 0.34]]) box(F, 'brass', [x, y, 0.03], [w, h, 0.016], { bev: 0.004 });
    kit.plane('fdPlaque', [1.55, 0.25, ZW - 0.026], 0.62, 0.31, { rot: [0, PI, 0] });
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) cyl(F, 'brass', [sx * 0.325, 0.25 + sy * 0.17, 0.04], 0.008, 0.01, { axis: 'z', seg: 8 });
    kit.interact({ id: 'flightdeck.plaque', label: 'Mission plaque', pos: [1.55, 0.25, 2.2], radius: 1.7, hit: { c: [1.55, 0.25, ZW - 0.05], s: [0.74, 0.4, 0.1] } });
    box(F, 'trim', [0, -0.34, 0.012], [0.56, 0.34, 0.024], { bev: 0.006 });
    kit.screen({ id: 'fd.status', pos: [1.55, -0.34, ZW - 0.0295], rot: [0, PI, 0], size: [0.5, 0.29], res: [450, 261], draw: D.status, range: 7, interval: 0.25 });
    box(F, 'emitStrip', [0, -0.54, 0.026], [0.5, 0.006, 0.004], { bev: 0 });
  }
  // first aid, emergency O2, door-side fittings (starboard)
  {
    const F = A(1.02);
    box(F, 'white', [0, -0.16, 0.04], [0.26, 0.2, 0.08], { bev: 0.01 }); box(F, 'fdRed', [0, -0.16, 0.083], [0.09, 0.028, 0.004], { bev: 0 }); box(F, 'fdRed', [0, -0.16, 0.083], [0.028, 0.09, 0.004], { bev: 0 }); box(F, 'trim', [0, -0.255, 0.075], [0.06, 0.012, 0.012], { bev: 0.003 });
    box(F, 'fdYellow', [0, 0.14, 0.035], [0.22, 0.15, 0.07], { bev: 0.01 }); sign(F, 'EMERG O2', [0, 0.14, 0.075], { w: 0.17, h: 0.04, style: 'warn' }); cyl(F, 'plasticDark', [0.07, 0.08, 0.08], 0.02, 0.02, { axis: 'z', seg: 12 });
    sign(F, 'FIRST AID', [0, -0.3, 0.076], { w: 0.17, h: 0.036 });
  }
  // ── deep starboard locker bank (x ≥ 2.0 keeps the systems-seat route clear) ──
  {
    const F = A(2.45);
    ['SURVIVAL', 'SPARES', 'REPAIR'].forEach((n, i) => locker(F, (i - 1) * 0.3, -1.2, -0.3, 0.3, 0.4, n));
    box(F, 'steel', [0, -0.28, 0.2], [0.95, 0.03, 0.4], { bev: 0.006 });
    box(F, 'plasticDark', [0, 0.3, 0.025], [0.9, 0.55, 0.05], { bev: 0.008 });
    for (let i = 0; i < 4; i++) box(F, 'fdWebbing', [0, 0.1 + i * 0.12, 0.057], [0.86, 0.012, 0.006], { bev: 0.001 }); for (let i = 0; i < 6; i++) box(F, 'fdWebbing', [-0.37 + i * 0.148, 0.3, 0.059], [0.012, 0.5, 0.006], { bev: 0.001 });
    for (const [x, y, c] of [[-0.25, 0.18, 'paintCyan'], [0.05, 0.22, 'paintOrange'], [0.28, 0.16, 'fdYellow'], [-0.1, 0.38, 'paintOrange']]) box(F, c, [x, y, 0.09], [0.12, 0.08, 0.06], { bev: 0.01 });
    sign(F, 'EMERGENCY STOWAGE', [0, 0.62, 0.052], { w: 0.4, h: 0.04, style: 'warn' });
    kit.colBox([2.45, -0.75, 2.125], [0.95, 0.9, 0.4]);
  }
  // ── port: equipment rack, locker bank with EVA helmet shelf + stowage net, evac plan ──
  {
    const R = A(-2.6); U.rack(R, 0.5, 'EQUIP · AUX'); kit.colBox([-2.6, -0.16, 2.135], [0.5, 2.08, 0.38]);
    const F = A(-1.82);
    ['EVA · 1', 'EVA · 2', 'EVA · 3'].forEach((n, i) => locker(F, (i - 1) * 0.3, -1.2, -0.3, 0.3, 0.4, n));
    box(F, 'steel', [0, -0.28, 0.2], [0.95, 0.03, 0.4], { bev: 0.006 }); box(F, 'paintOrange', [0, -0.28, 0.405], [0.95, 0.03, 0.01], { bev: 0.002 });
    if (eur) { helmet(F, 0.3, -0.13, 0.2, 0.4); } else for (let i = 0; i < 3; i++) helmet(F, (i - 1) * 0.3, -0.135, 0.2);
    box(F, 'plasticDark', [0, 0.38, 0.025], [0.9, 0.5, 0.05], { bev: 0.008 });
    for (let i = 0; i < 4; i++) box(F, 'fdWebbing', [0, 0.2 + i * 0.12, 0.057], [0.86, 0.012, 0.006], { bev: 0.001 }); for (let i = 0; i < 6; i++) box(F, 'fdWebbing', [-0.37 + i * 0.148, 0.38, 0.059], [0.012, 0.46, 0.006], { bev: 0.001 });
    sign(F, 'EVA HELMETS · CHECK SEALS', [0, 0.04, 0.416], { w: 0.5, h: 0.036 });
    kit.colBox([-1.82, -0.55, 2.125], [0.95, 1.3, 0.4]);
    // evacuation plan decal (canvas schematic)
    const W = 1024, H = 576, cv = T.cvs(W, H), g = cv.getContext('2d');
    g.fillStyle = '#0c1620'; g.fillRect(0, 0, W, H); g.strokeStyle = '#86ecff'; g.lineWidth = 6; g.strokeRect(10, 10, W - 20, H - 20);
    g.fillStyle = '#e9fbff'; g.font = '700 40px sans-serif'; g.fillText('DECK 1 · EVACUATION & SYSTEMS PLAN', 40, 70);
    const room = (x, y, w, h, label, col) => { g.fillStyle = col; g.globalAlpha = 0.35; g.fillRect(x, y, w, h); g.globalAlpha = 1; g.strokeStyle = '#86ecff'; g.lineWidth = 3; g.strokeRect(x, y, w, h); g.fillStyle = '#e9fbff'; g.font = '600 22px sans-serif'; g.textAlign = 'center'; g.fillText(label, x + w / 2, y + h / 2 + 8); };
    room(40, 230, 150, 130, 'FLIGHT DECK', '#18b8d8'); room(200, 270, 600, 50, 'SPINE CORRIDOR', '#486072');
    room(220, 150, 130, 110, 'QUARTERS', '#e8742a'); room(360, 150, 150, 110, 'GALLEY', '#e8742a'); room(520, 150, 130, 110, 'AIRLOCK', '#ff5a4a');
    room(220, 330, 150, 110, 'LAB', '#18b8d8'); room(380, 330, 130, 110, 'MEDBAY', '#18b8d8'); room(520, 330, 130, 110, 'LYRA CORE', '#18b8d8');
    room(810, 230, 170, 130, 'CARGO · ENG', '#8a9bb0'); g.textAlign = 'left';
    g.strokeStyle = '#ffb04d'; g.lineWidth = 5; g.setLineDash([14, 10]); g.beginPath(); g.moveTo(120, 300); g.lineTo(240, 295); g.lineTo(560, 295); g.lineTo(585, 262); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#ffb04d'; g.beginPath(); g.moveTo(585, 250); g.lineTo(570, 275); g.lineTo(600, 275); g.fill(); g.font = '600 24px sans-serif'; g.fillText('YOU ARE HERE  ●', 50, 400); g.fillStyle = '#86ecff'; g.fillText('EXTINGUISHER · FIRST AID · EVA HELMETS: FLT DECK AFT WALL', 40, 520);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    kit.decal(tex, [-1.82, 0.7, ZW - 0.002], [0.82, 0.46], { rot: [0, PI, 0], color: eur ? 0x606878 : 0xb8c0c8, name: 'evacplan' });
  }
  // ── fire extinguisher + flashlight cradle (beside the door, port) ──
  {
    const F = A(-1.08);
    box(F, 'darkMetal', [0, -0.58, 0.012], [0.16, 0.5, 0.024], { bev: 0.006 }); cyl(F, 'fdRed', [0, -0.62, 0.085], 0.07, 0.4, { seg: 18 }); sph(F, 'fdRed', [0, -0.42, 0.085], 0.07, { seg: 14, theta: PI / 2 });
    cyl(F, 'darkMetal', [0, -0.395, 0.085], 0.025, 0.04, { seg: 10 }); box(F, 'darkMetal', [0.03, -0.37, 0.085], [0.09, 0.016, 0.02], { bev: 0.004 }); torus(F, 'steel', [0, -0.5, 0.085], 0.072, 0.007, { axis: 'y', seg: 20, tube: 4 }); torus(F, 'steel', [0, -0.74, 0.085], 0.072, 0.007, { axis: 'y', seg: 20, tube: 4 });
    tube(F, 'rubber', [[-0.03, -0.4, 0.1], [-0.12, -0.45, 0.14], [-0.08, -0.62, 0.15], [0.0, -0.7, 0.14]], 0.011, { seg: 12 });
    sign(F, 'FIRE', [0, -0.28, 0.026], { w: 0.12, h: 0.035, style: 'red' });
    const G = A(-1.34); box(G, 'darkMetal', [0, 0.08, 0.025], [0.1, 0.3, 0.05], { bev: 0.008 }); cyl(G, 'plasticDark', [0, 0.08, 0.07], 0.022, 0.24, { seg: 10 }); cyl(G, 'fdYellow', [0, 0.17, 0.07], 0.026, 0.05, { seg: 10 }); cyl(G, 'glassMed', [0, 0.2, 0.07], 0.03, 0.012, { seg: 10 });
    led(G, [0, -0.04, 0.052], 'Green', 'Blink', 0.01); sign(G, 'LIGHT', [0, -0.1, 0.052], { w: 0.1, h: 0.03 });
  }
  // grab handles on the free ends of the two flare-wall racks, cable tray across the bulkhead head
  for (const [W, lx] of [[diag(1), 0.99], [diag(-1), -0.99]]) {
    const C = W.fr(lx, 0, 0);
    cyl(C, 'steel', [0, -0.4, 0.4], 0.016, 1.0, { seg: 10 });
    for (const y of [-0.85, 0.05]) box(C, 'trim', [0, y, 0.37], [0.05, 0.04, 0.06], { bev: 0.006 });
  }
  {
    const F = A(0);
    box(F, 'plasticDark', [0, 1.3, 0.05], [5.8, 0.06, 0.1], { bev: 0.006 }); beam(frame([0, 0, ZW]), 'paintOrange', [-2.9, 1.31, -0.115], [2.9, 1.31, -0.115], 0.016, 0.016, { bev: 0.004 }); beam(frame([0, 0, ZW]), 'paintCyan', [-2.9, 1.285, -0.115], [2.9, 1.285, -0.115], 0.012, 0.012, { bev: 0.003 });
    for (const x of [-2.4, -1.6, 1.6, 2.4]) box(F, 'trim', [x, 1.3, 0.06], [0.05, 0.08, 0.12], { bev: 0.006 });
  }
  // pod side walls: conduits, vents, labels (above the side-console cabinets)
  for (const sx of [-1, 1]) {
    const F = frame([sx * 1.246, 0, 0], -sx * PI / 2);
    tube(frame(), 'paintOrange', [[sx * 1.236, -0.52, -0.82], [sx * 1.236, -0.5, -0.3], [sx * 1.236, -0.42, 0.28]], 0.012, { seg: 12 }); tube(frame(), 'paintCyan', [[sx * 1.236, -0.57, -0.82], [sx * 1.236, -0.56, -0.3], [sx * 1.236, -0.49, 0.28]], 0.01, { seg: 12 });
    for (const z of [-0.7, -0.3, 0.1]) box(frame(), 'trim', [sx * 1.238, -0.52 + (z + 0.7) * 0.1, z], [0.03, 0.12, 0.04], { bev: 0.005 });
    sign(F, sx < 0 ? 'PNL · P' : 'PNL · S', [0.55 * sx, -0.5, 0], { w: 0.14, h: 0.03 });
  }
  // floor: seat hazard borders, rubber mats, cyan guide lines to the pilot seat
  {
    const f = -1.196;
    for (const W of [diag(1), diag(-1)]) box(W.fr(0, 0, 0), 'trim', [0, FLOOR + 0.06, 0.012], [2.2, 0.12, 0.024], { bev: 0.004 });   // skirting along the flare walls
    { const [x, z] = diag(-1).pt(-0.15, 0.07); cyl(frame(), 'fdShellL', [x, -0.85, z], 0.04, 0.7, { seg: 14 }); cyl(frame(), 'paintOrange', [x, -0.5, z], 0.043, 0.03, { seg: 14 }); cyl(frame(), 'paintOrange', [x, -1.185, z], 0.043, 0.03, { seg: 14 }); }   // rolled chart tube
    for (const sx of [-1, 1]) box(frame(), 'hazard', [sx * 0.52, f, 0.33], [0.035, 0.005, 0.9], { bev: 0 }); box(frame(), 'hazard', [0, f, 0.8], [1.07, 0.005, 0.035], { bev: 0 });
    for (const x of [-0.78, 0.78]) box(frame(), 'emitStrip', [x, f, 1.55], [0.016, 0.005, 1.5], { bev: 0 });
    const ring = new THREE.RingGeometry(0.43, 0.48, 40); kit.add('hazard', ring, { pos: [1.35, f, 1.24], rot: [-PI / 2, 0, 0] }); ring.dispose();
    box(frame(), 'rubber', [1.35, -1.197, 1.24], [0.8, 0.006, 0.8], { rot: [0, -0.5, 0], bev: 0.002 });
    for (const [W, lx, d] of [[diag(1), -0.47, 0.35], [diag(-1), 0.47, 0.4]]) { const [x, z] = W.pt(lx, d); box(frame(), 'rubber', [x, -1.197, z], [1.0, 0.006, 0.5], { rot: [0, W.yaw, 0], bev: 0.002 }); }
  }
}
