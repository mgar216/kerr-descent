// Flight deck seats: pilot couch (eye at the origin, backrest behind the head, harness, side-stick + throttle) and the systems swivel chair.
const PI = Math.PI;
export default function build(kit, U) {
  const { box, cyl, sph, torus, sign, at, frame, led, toggle, rocker } = U;
  const eur = kit.eur;
  // seat-local frame F: origin on the pan top (centre), +y up, +z toward the back
  const seatBody = (F, o = {}) => {
    const w = o.w || 0.5, bz = o.backZ != null ? o.backZ : 0.29, tl = o.tilt != null ? o.tilt : 0.1;
    box(F, 'darkMetal', [0, -0.1, 0.01], [w, 0.04, 0.54], { bev: 0.012 });
    box(F, 'fdSeat', [0, -0.04, 0.01], [w - 0.04, 0.08, 0.52], { bev: 0.02 });
    for (const sx of [-1, 1]) { box(F, 'fdPleather', [sx * (w / 2 - 0.02), -0.012, 0.03], [0.055, 0.065, 0.46], { bev: 0.02 }); box(F, 'fabricOrange', [sx * (w / 2 - 0.055), 0.002, 0.03], [0.005, 0.005, 0.44], { bev: 0.002 }); }
    box(F, 'fdSeat', [0, -0.015, -0.26], [w - 0.06, 0.06, 0.07], { rot: [0.25, 0, 0], bev: 0.02 });
    box(F, 'fabricOrange', [0, 0.002, -0.285], [w - 0.1, 0.005, 0.005], { bev: 0.002 });
    const B = at(F, [0, 0, bz], { rot: [tl, 0, 0] });
    box(B, 'fdShellL', [0, 0.54, 0.085], [w, 1.08, 0.04], { bev: 0.012 });
    box(B, 'fdDash', [0, 0.5, 0.108], [w - 0.1, 0.84, 0.006], { bev: 0.003 });                              // carbon inlay (rear face)
    for (const sx of [-1, 1]) { box(B, 'paintOrange', [sx * (w / 2 - 0.013), 0.54, 0.108], [0.006, 1.02, 0.006], { bev: 0.001 }); box(B, 'emitStrip', [sx * (w / 2 + 0.002), 0.54, 0.085], [0.004, 0.9, 0.012], { bev: 0 }); }
    box(B, 'fdSeat', [0, 0.28, 0.02], [w - 0.04, 0.5, 0.07], { bev: 0.02 });
    box(B, 'fdSeat', [0, 0.69, 0.02], [w - 0.02, 0.32, 0.07], { bev: 0.02 });
    box(B, 'fabricOrange', [0, 0.535, -0.017], [w - 0.06, 0.005, 0.005], { bev: 0.002 });
    for (const sx of [-1, 1]) {
      box(B, 'fdPleather', [sx * (w / 2 - 0.025), 0.42, -0.005], [0.05, 0.72, 0.09], { rot: [0, sx * 0.25, 0], bev: 0.02 });
      box(B, 'trim', [sx * 0.135, 0.76, -0.016], [0.07, 0.012, 0.012], { bev: 0.002 });
    }
    if (o.head !== false) {
      box(B, 'fdPleather', [0, 0.9, 0.005], [0.3, 0.21, 0.085], { bev: 0.025 });
      box(B, 'fabricOrange', [0, 1.0, -0.04], [0.26, 0.005, 0.005], { bev: 0.002 });
      for (const sx of [-1, 1]) { box(B, 'fdPleather', [sx * 0.165, 0.9, -0.05], [0.06, 0.19, 0.07], { rot: [0, -sx * 0.4, 0], bev: 0.02 }); cyl(B, 'steel', [sx * 0.07, 0.8, 0.045], 0.011, 0.12, { seg: 8 }); }
    }
    box(B, 'paintOrange', [0, 0.52, 0.113], [0.02, 0.58, 0.004], { bev: 0.001 });
    box(B, 'fdShell', [0, 1.0, 0.1], [0.32, 0.17, 0.06], { bev: 0.025 });                                // head housing (rear)
    box(B, 'fdShell', [0, 0.4, 0.12], [0.3, 0.2, 0.03], { bev: 0.01 }); for (let i = 0; i < 3; i++) box(B, 'fdWebbing', [0, 0.34 + i * 0.06, 0.137], [0.3, 0.012, 0.004], { bev: 0.001 });   // utility pocket
    sign(B, o.label || 'PILOT', [0, 0.86, 0.113], { w: 0.17, h: 0.042 });
    for (const sx of [-1, 1]) box(B, 'trim', [sx * (w / 2 + 0.02), 0.78, 0.07], [0.03, 0.03, 0.12], { bev: 0.01 });   // side grab lugs
    return B;
  };
  const strap = (F, a, b, y, w = 0.05) => {   // flat webbing lying on the pan between (x,z) a and b
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    box(F, 'fdWebbing', [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2], [w, 0.008, len], { rot: [0, Math.atan2(dx, dz), 0], bev: 0.002 });
  };

  // ═════════ PILOT SEAT ═════════
  {
    const F = frame([0, -0.78, 0.01]);
    // floor rails, carriage, pedestal with bellows
    for (const sx of [-1, 1]) { box(frame(), 'trim', [sx * 0.2, -1.19, 0.2], [0.08, 0.012, 1.0], { bev: 0.003 }); box(frame(), 'steel', [sx * 0.2, -1.17, 0.2], [0.035, 0.03, 1.0], { bev: 0.008 }); for (let z = -0.25; z < 0.7; z += 0.19) box(frame(), 'darkMetal', [sx * 0.2, -1.17, z], [0.06, 0.04, 0.03], { bev: 0.004 }); }
    box(frame(), 'darkMetal', [0, -1.135, 0.1], [0.56, 0.04, 0.46], { bev: 0.01 });
    cyl(frame(), 'darkMetal', [0, -1.0, 0.1], 0.075, 0.2, { seg: 16 });
    for (let i = 0; i < 5; i++) cyl(frame(), 'rubber', [0, -1.08 + i * 0.045, 0.1], 0.1, 0.022, { seg: 16 });
    box(frame(), 'steel', [0, -0.915, 0.08], [0.42, 0.03, 0.4], { bev: 0.008 });
    for (const sx of [-1, 1]) box(frame(), 'darkMetal', [sx * 0.2, -0.9, 0.08], [0.03, 0.12, 0.32], { bev: 0.006 });
    const B = seatBody(F, { label: 'PILOT' });
    box(frame(), 'rubber', [0, -1.195, -0.18], [0.54, 0.008, 0.26], { bev: 0.002 });                 // foot mat
    for (let i = 0; i < 4; i++) box(frame(), 'steel', [0, -1.188, -0.28 + i * 0.07], [0.5, 0.006, 0.014], { bev: 0.002 });
    for (const sx of [-1, 1]) {                                                                          // rudder pedals under the dash toe
      const P = frame([sx * 0.14, -1.11, -0.31], 0, 0.62);
      box(P, 'darkMetal', [0, 0, 0], [0.13, 0.016, 0.19], { bev: 0.004 }); box(P, 'rubber', [0, 0.012, 0.0], [0.115, 0.008, 0.17], { bev: 0.002 });
      for (let k = 0; k < 4; k++) box(P, 'steel', [0, 0.018, -0.06 + k * 0.04], [0.1, 0.004, 0.008], { bev: 0.001 });
      box(frame(), 'trim', [sx * 0.14, -1.17, -0.3], [0.1, 0.05, 0.04], { bev: 0.004 });
    }
    // emergency release handle + grab bar on the seat back (visible from behind)
    box(B, 'fdRed', [0, 0.17, 0.125], [0.11, 0.018, 0.02], { bev: 0.005 }); for (const sx of [-1, 1]) box(B, 'darkMetal', [sx * 0.05, 0.17, 0.11], [0.012, 0.02, 0.03], { bev: 0.002 });
    sign(B, 'RELEASE', [0, 0.115, 0.115], { w: 0.12, h: 0.032, style: 'warn' });
    // armrests
    for (const sx of [-1, 1]) {
      box(F, 'darkMetal', [sx * 0.335, 0.1, 0.17], [0.04, 0.2, 0.07], { bev: 0.008 });
      box(F, 'fdPleather', [sx * 0.335, 0.22, 0.02], [0.085, 0.045, 0.5], { bev: 0.02 }); box(F, 'fabricOrange', [sx * 0.335, 0.2455, 0.02], [0.006, 0.004, 0.46], { bev: 0.001 });
    }
    // right: side-stick controller
    {
      const S = at(F, [0.335, 0.245, -0.1]);
      box(S, 'darkMetal', [0, 0.02, 0], [0.09, 0.04, 0.16], { bev: 0.01 }); box(S, 'steel', [0, 0.042, 0.02], [0.07, 0.006, 0.1], { bev: 0.002 });
      cyl(S, 'rubber', [0, 0.06, -0.01], 0.028, 0.03, { rb: 0.03, rt: 0.02, seg: 14 });
      const G = at(S, [0, 0.09, -0.01], { rot: [-0.2, 0, 0] });
      cyl(G, 'darkMetal', [0, 0.02, 0], 0.013, 0.07, { seg: 10 }); cyl(G, 'plasticDark', [0, 0.095, 0], 0.024, 0.09, { rb: 0.026, rt: 0.022, seg: 14 });
      sph(G, 'plasticDark', [0, 0.14, 0], 0.022, { seg: 12, theta: PI / 2 }); sph(G, 'paintOrange', [0.006, 0.146, -0.006], 0.009, { seg: 8 });
      box(G, 'plastic', [0, 0.11, -0.027], [0.016, 0.03, 0.012], { bev: 0.004 }); box(G, 'fdRed', [-0.02, 0.145, 0.0], [0.012, 0.012, 0.012], { bev: 0.003 });
      led(S, [0.03, 0.043, 0.08], 'Green', 'Blink', 0.006);
    }
    // left: throttle quadrant (two levers) with detents + LED strip + boost guard
    {
      const S = at(F, [-0.335, 0.245, -0.07]);
      box(S, 'darkMetal', [0, 0.018, 0], [0.1, 0.036, 0.3], { bev: 0.01 }); box(S, 'plasticDark', [0, 0.037, 0], [0.07, 0.004, 0.26], { bev: 0.001 });
      for (const [lx, lz] of [[-0.018, 0.0], [0.022, -0.04]]) {
        const G = at(S, [lx, 0.04, lz], { rot: [-0.45, 0, 0] });
        cyl(G, 'steel', [0, 0.05, 0], 0.01, 0.1, { seg: 8 }); cyl(G, 'plasticDark', [0, 0.11, 0], 0.017, 0.055, { seg: 12 }); sph(G, 'paintOrange', [0, 0.14, 0], 0.017, { seg: 10 });
      }
      for (let i = 0; i < 8; i++) led(S, [0.0, 0.04, -0.11 + i * 0.03], i < 5 ? 'Green' : 'Amber', '', 0.007);
      toggle(at(S, [0.0, 0.037, 0.115], { rot: [-PI / 2, 0, 0] }), [0.0, 0.0, 0], { guard: true });
      rocker(at(S, [0.0, 0.037, 0.145], { rot: [-PI / 2, 0, 0] }), [0.0, 0.0, 0], { led: 'Cyan' });
    }
    // harness: shoulder straps hang over the back; lap belts + rotary buckle on the pan
    const hubZ = -0.12;
    cyl(F, 'steel', [0, 0.006, hubZ], 0.04, 0.012, { seg: 18 }); cyl(F, 'paintOrange', [0, 0.014, hubZ], 0.03, 0.006, { seg: 18 });
    for (const sx of [-1, 1]) {
      strap(F, [sx * 0.27, 0.2], [sx * (eur ? 0.04 : 0.09), hubZ + (eur ? 0 : -0.01)], 0.006);
      box(F, 'steel', [sx * (eur ? 0.052 : 0.1), 0.01, hubZ], [0.06, 0.008, 0.045], { bev: 0.002 });
      box(B, 'darkMetal', [sx * 0.225, 0.47, 0.13], [0.07, 0.11, 0.04], { bev: 0.008 }); box(B, 'paintOrange', [sx * 0.225, 0.47, 0.152], [0.05, 0.012, 0.004], { bev: 0.001 });   // inertia reels (rear)
      if (!eur) {
        box(B, 'fdWebbing', [sx * 0.225, 0.78, 0.118], [0.05, 0.62, 0.006], { bev: 0.001 });          // rear run up the shell
        box(B, 'fdWebbing', [sx * 0.225, 1.088, 0.09], [0.05, 0.006, 0.065], { bev: 0.001 });         // over the top edge
        box(B, 'fdWebbing', [sx * 0.225, 0.972, 0.071], [0.05, 0.23, 0.006], { bev: 0.001 });         // down the front of the shell
        box(B, 'fdWebbing', [sx * 0.225, 0.855, 0.02], [0.05, 0.006, 0.1], { bev: 0.001 });           // across the shoulder-cushion top
        box(B, 'fdWebbing', [sx * 0.225, 0.828, -0.03], [0.05, 0.06, 0.006], { bev: 0.001 }); box(B, 'steel', [sx * 0.225, 0.785, -0.03], [0.05, 0.065, 0.01], { bev: 0.003 });   // tongue
      }
    }
    kit.colBox([0, -0.4, 0.1], [0.6, 1.6, 0.8]);
    kit.interact({ id: 'seat.pilot', label: 'Pilot seat', pos: [0, -0.55, 0.15], radius: 1.5, hit: { c: [0, -0.3, 0.11], s: [0.62, 1.2, 0.78] } });
  }

  // ═════════ SYSTEMS SEAT (swivel chair, turned toward the console on the starboard flare wall) ═════════
  {
    const SY = -0.5, SX = 1.35, SZ = 1.24, B0 = frame([SX, -1.2, SZ], SY), F = frame([SX, -0.78, SZ], SY);
    for (let k = 0; k < 5; k++) {
      const a = k * PI * 2 / 5 + 0.3, s = Math.sin(a), c = Math.cos(a);
      box(B0, 'darkMetal', [s * 0.14, 0.06, c * 0.14], [0.05, 0.032, 0.3], { rot: [0, a, 0], bev: 0.008 });
      sph(B0, 'rubber', [s * 0.27, 0.027, c * 0.27], 0.027, { seg: 8 });
    }
    cyl(B0, 'darkMetal', [0, 0.11, 0], 0.058, 0.14, { seg: 14 }); cyl(B0, 'steel', [0, 0.23, 0], 0.036, 0.14, { seg: 12 });
    torus(B0, 'steel', [0, 0.2, 0], 0.26, 0.011, { axis: 'y', seg: 28, tube: 5 });
    for (let k = 0; k < 3; k++) { const a = k * PI * 2 / 3 + 0.9; box(B0, 'steel', [Math.sin(a) * 0.14, 0.2, Math.cos(a) * 0.14], [0.018, 0.014, 0.25], { rot: [0, a, 0], bev: 0.003 }); }
    box(F, 'darkMetal', [0, -0.15, 0.0], [0.34, 0.06, 0.34], { bev: 0.01 });
    seatBody(F, { tilt: 0.08, label: 'SYSTEMS' });
    for (const sx of [-1, 1]) {
      box(F, 'darkMetal', [sx * 0.31, 0.1, 0.1], [0.035, 0.2, 0.06], { bev: 0.008 });
      box(F, 'fdPleather', [sx * 0.31, 0.215, 0.0], [0.08, 0.04, 0.4], { bev: 0.018 }); box(F, 'fabricOrange', [sx * 0.31, 0.237, 0.0], [0.006, 0.004, 0.36], { bev: 0.001 });
      strap(F, [sx * 0.265, 0.2], [sx * (eur ? 0.04 : 0.1), -0.1], 0.006); box(F, 'steel', [sx * (eur ? 0.05 : 0.115), 0.01, -0.1], [0.055, 0.008, 0.04], { bev: 0.002 });
    }
    cyl(F, 'steel', [0, 0.006, -0.1], 0.036, 0.012, { seg: 16 }); cyl(F, 'paintOrange', [0, 0.014, -0.1], 0.026, 0.006, { seg: 16 });
    { const P = at(F, [0.31, 0.24, -0.1]); sph(P, 'darkMetal', [0, 0.012, 0], 0.022, { seg: 10 }); cyl(P, 'steel', [0, 0.004, 0], 0.03, 0.008, { seg: 14 }); box(P, 'plasticDark', [0.0, 0.01, 0.05], [0.05, 0.012, 0.025], { bev: 0.004 }); }
    { const P = at(F, [-0.31, 0.24, -0.08]); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) box(P, 'plasticDark', [-0.02 + c * 0.022, 0.006, -0.03 + r * 0.022], [0.018, 0.012, 0.018], { bev: 0.003 }); led(at(P, [0.03, 0.012, 0.0], { rot: [-PI / 2, 0, 0] }), [0, 0, 0], 'Green', 'Blink', 0.006); }
    kit.colCyl([SX, -0.6, SZ], 0.36, 1.2);
    kit.interact({ id: 'seat.systems', label: 'Systems seat', pos: [1.38, -0.5, 1.2], radius: 1.5, hit: { c: [1.38, -0.3, 1.28], s: [0.62, 1.2, 0.74], yaw: SY } });
  }
}
