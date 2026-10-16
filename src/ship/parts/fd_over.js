// Flight deck — overhead panel hung under the canopy roof plate (sloped to match it), side cable trays, roof dressing.
// Panel frame: local +z = down-facing normal, +y = aft along the roof slope, +x = world +x (text reads correctly looking up from the seat).
const PI = Math.PI;
export default function build(kit, U) {
  const { box, cyl, sph, sign, frame, led, tile, toggle, rocker, knob, screws4, tube } = U;
  const eur = kit.eur, phi = Math.atan(0.1414), z0 = -0.08, yRoof = 0.685 + 0.1414 * (z0 + 0.64);
  const OV = frame([0, yRoof - 0.002, z0], 0, PI / 2 - phi), Z = 0.078;
  U.ov = { F: OV, Z, z0 };
  const plate = (x, y, w, h, mat = 'plasticDark') => box(OV, mat, [x, y, Z + 0.002], [w, h, 0.004], { bev: 0.002 });
  // slab + frame
  box(OV, 'fdShell', [0, 0, 0.039], [1.0, 0.78, 0.078], { bev: 0.012 });
  for (const sx of [-1, 1]) { box(OV, 'trim', [sx * 0.505, 0, 0.05], [0.02, 0.8, 0.1], { bev: 0.006 }); box(OV, 'plasticDark', [sx * 0.56, 0, 0.026], [0.07, 0.78, 0.05], { bev: 0.006 }); box(OV, 'paintOrange', [sx * 0.55, 0, 0.056], [0.012, 0.74, 0.012], { bev: 0.002 }); box(OV, 'paintCyan', [sx * 0.575, 0, 0.056], [0.012, 0.74, 0.012], { bev: 0.002 }); }
  box(OV, 'emitStrip', [0, -0.392, Z - 0.004], [0.98, 0.006, 0.012], { bev: 0 }); box(OV, 'trim', [0, -0.397, 0.05], [1.02, 0.014, 0.1], { bev: 0.004 });
  box(OV, 'hazard', [0, 0.392, Z - 0.002], [0.98, 0.018, 0.008], { bev: 0 }); box(OV, 'trim', [0, 0.4, 0.05], [1.02, 0.014, 0.1], { bev: 0.004 });
  screws4(OV, 0, 0, 0.96, 0.74, Z);
  const S = (t, x, y, w = 0.16) => sign(OV, t, [x, y, Z + 0.007], { w, h: 0.032 });
  // A — circuit breakers
  plate(0, 0.315, 0.94, 0.115); S('CIRCUIT BREAKERS', -0.34, 0.365, 0.22);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 15; i++) { const x = -0.4 + i * 0.057, y = 0.29 - r * 0.045; cyl(OV, 'darkMetal', [x, y, Z + 0.006], 0.0105, 0.006, { axis: 'z', seg: 8 }); cyl(OV, (i + r * 3) % 5 === 0 ? 'paintOrange' : (i * 7 + r) % 6 === 1 ? 'fdYellow' : 'plastic', [x, y, Z + 0.015], 0.0072, 0.016, { axis: 'z', seg: 6 }); }
  // B — electrical (left), drive arm (centre), life support (right)
  plate(-0.325, 0.12, 0.33, 0.2); S('ELECTRICAL', -0.325, 0.205, 0.17);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) rocker(OV, [-0.43 + c * 0.07, 0.15 - r * 0.075, Z], { up: (r + c) % 2 === 0, led: (r + c) % 3 === 2 ? 'Amber' : 'Green' });
  plate(0, 0.12, 0.3, 0.2); S('DRIVE ARM', 0, 0.205, 0.14);
  box(OV, 'hazard', [0, 0.1, Z + 0.004], [0.1, 0.1, 0.005], { bev: 0 }); toggle(OV, [0, 0.1, Z + 0.004], { guard: true, tip: 'fdRed' });
  for (const sx of [-1, 1]) { knob(OV, [sx * 0.105, 0.13, Z], 0.022, { a: sx * 0.8, mark: 'paintOrange' }); tile(OV, [sx * 0.105, 0.065, Z], 0.05, 0.026, 'emitAmber'); }
  plate(0.325, 0.12, 0.33, 0.2); S('LIFE SUPPORT', 0.325, 0.205, 0.19);
  for (let i = 0; i < 3; i++) knob(OV, [0.215 + i * 0.07, 0.14, Z], 0.02, { a: i * 0.9 - 0.9 });
  for (let i = 0; i < 4; i++) toggle(OV, [0.2 + i * 0.07, 0.065, Z], { tilt: i % 2 ? 0.3 : -0.3 });
  led(OV, [0.455, 0.1, Z], 'Cyan', 'Blink', 0.012); tile(OV, [0.43, 0.14, Z], 0.04, 0.03, 'emitGreen');
  // C — annunciators
  plate(0, -0.06, 0.94, 0.1);
  ['MASTER', 'FIRE', 'DECOMP', 'PRESS', 'CO2', 'COOLANT', 'BUS A', 'BUS B', 'GEAR', 'HATCH'].forEach((n, i) => {
    const x = -0.405 + i * 0.09; S(n, x, -0.045, 0.078);
    box(OV, eur ? 'screenOff' : ['emitGreen', 'emitRed', 'emitAmber', 'emitGreen', 'emitGreen', 'emitCyan', 'emitGreen', 'emitGreen', 'emitAmber', 'emitGreen'][i], [x, -0.08, Z + 0.005], [0.072, 0.008, 0.003], { bev: 0 });
  });
  // D — reaction mass bar graphs, autopilot display, comms/lights
  plate(-0.31, -0.265, 0.34, 0.2); S('PROPELLANT · MASS', -0.31, -0.33, 0.24);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 12; i++) led(OV, [-0.455 + i * 0.027, -0.2 - r * 0.045, Z], i < 7 ? 'Green' : i < 10 ? 'Amber' : 'Red', '', 0.012);
  knob(OV, [-0.2, -0.265, Z], 0.018, { a: 0.4 });
  plate(0, -0.265, 0.3, 0.2); tile(OV, [0, -0.23, Z], 0.24, 0.08, 'emitCyan'); S('AUTOPILOT', 0, -0.32, 0.15);
  plate(0.31, -0.265, 0.34, 0.2); S('COMMS · LIGHTS', 0.31, -0.33, 0.22);
  for (let i = 0; i < 5; i++) rocker(OV, [0.19 + i * 0.065, -0.2, Z], { up: i % 2, led: i === 2 ? 'Amber' : 'Cyan' });
  for (let i = 0; i < 2; i++) knob(OV, [0.25 + i * 0.12, -0.285, Z], 0.02, { a: i - 0.3, mark: 'paintOrange' });
  // dressing: conduit stubs into the roof, reading lamp on a stalk
  for (const sx of [-1, 1]) { tube(OV, 'plasticDark', [[sx * 0.56, 0.36, 0.0], [sx * 0.56, 0.4, 0.015], [sx * 0.6, 0.45, 0.0]], 0.012, { seg: 8 }); sph(OV, 'emitPanel', [sx * 0.43, -0.385, Z + 0.015], 0.012, { seg: 6 }); }
}
