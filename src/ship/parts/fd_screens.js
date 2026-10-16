// Flight deck self-drawn screens (cyan-on-black cockpit UI via screens.js). Factory takes kit to read kit.state (thrust, mode, landed).
import * as S from './screens.js';

const C = S.C;
export function makeDraws(kit) {
  const st = kit.state;
  const alert = (g, W, H, t) => { if (st.mode === 'alert' && Math.sin(t * 6.4) > 0) { g.fillStyle = 'rgba(255,60,60,0.9)'; g.fillRect(0, H - H * 0.13, W, H * 0.13); S.mono(g, 'CONDITION RED', W / 2, H - H * 0.035, H * 0.09, '#fff', 'center', 700); } };
  const sz = (H) => Math.max(10, Math.round(H * 0.058));
  return {
    sys: (g, W, H, t) => {
      const r = S.base(g, W, H, t, { title: 'SYSTEMS', sub: 'HX-02' });
      S.table(g, r.x + 2, r.y + sz(H), [['HULL INTEGRITY', '100 %', C.green], ['LIFE SUPPORT', 'NOMINAL', C.green], ['THERMAL', `${(31 + st.thrust * 44 + Math.sin(t * 0.5)).toFixed(1)} °C`], ['COOLANT A/B', 'LOOPS OK', C.green], ['GRAV PLATING', '9.81 m/s²'], ['AIRLOCK', st.landed ? 'SEALED · GND' : 'SEALED', C.cy], ['LYRA', 'ONLINE', C.green]], { size: sz(H), gap: Math.round(H * 0.026), colW: W * 0.5 });
      S.bars(g, r.x, r.y + r.h - H * 0.2, r.w, H * 0.19, Array.from({ length: 18 }, (_, i) => 0.4 + 0.25 * Math.sin(t * 0.8 + i * 1.3) * Math.sin(t * 0.37 + i) + 0.15));
      alert(g, W, H, t);
    },
    power: (g, W, H, t) => {
      const r = S.base(g, W, H, t, { title: 'POWER', sub: 'REACTOR A' }), out = 0.58 + 0.34 * st.thrust + 0.02 * Math.sin(t);
      S.ring(g, r.x + r.w * 0.2, r.y + r.h * 0.4, Math.min(r.w, r.h) * 0.27, out, C.cy, Math.max(4, H * 0.03));
      S.mono(g, `${Math.round(out * 100)}%`, r.x + r.w * 0.2, r.y + r.h * 0.4 + H * 0.03, H * 0.1, C.ink, 'center', 700);
      S.table(g, r.x + r.w * 0.45, r.y + sz(H) * 1.2, [['BUS A', `${(41.2 + st.thrust * 22).toFixed(1)} kW`], ['BUS B', `${(38.7 + st.thrust * 18).toFixed(1)} kW`], ['CAPACITOR', '98 %', C.green], ['DRIVE', st.thrust > 0.02 ? 'ACTIVE' : 'IDLE', st.thrust > 0.02 ? C.amber : C.cy]], { size: sz(H), gap: Math.round(H * 0.03), colW: r.w * 0.28 });
      S.line(g, r.x, r.y + r.h * 0.72, r.w, r.h * 0.26, (u) => 0.45 + 0.2 * Math.sin(u * 9 + t * 1.3) + 0.15 * Math.sin(u * 23 - t) + 0.2 * st.thrust);
      alert(g, W, H, t);
    },
    comms: (g, W, H, t) => {
      const r = S.base(g, W, H, t, { title: 'COMMS', sub: 'HALCYON LINK' });
      S.table(g, r.x + 2, r.y + sz(H), [['HALCYON', 'LOCKED', C.green], ['LIGHT LAG', '16.0 s'], ['BEACON', 'ACTIVE', C.cy], ['CAPCOM', 'STANDBY', C.amber], ['CIPHER', 'ON']], { size: sz(H), gap: Math.round(H * 0.03), colW: W * 0.42 });
      S.wave(g, r.x, r.y + r.h * 0.64, r.w, r.h * 0.34, t, C.cy, 4);
      S.bars(g, r.x + r.w * 0.74, r.y + 4, r.w * 0.24, r.h * 0.28, [0.9, 0.75, 0.6, 0.45, 0.3].map((v, i) => v * (0.85 + 0.15 * Math.sin(t * 3 + i))));
    },
    nav: (g, W, H, t) => {
      const r = S.base(g, W, H, t, { title: 'NAV · EREBUS', sub: 'LIVE', scan: true });
      S.blackHole(g, r.x, r.y, r.w, r.h - sz(H) * 1.5, t);
      S.mono(g, 'BRG 000.0  ·  HORIZON TRACK', r.x + 2, r.y + r.h - 4, sz(H), C.cyd);
    },
    traj: (g, W, H, t) => {
      const r = S.base(g, W, H, t, { title: 'TRAJECTORY', sub: 'SAS STAB' });
      S.radar(g, r.x + r.w * 0.3, r.y + r.h * 0.5, Math.min(r.w, r.h) * 0.46, t, 6, 3);
      S.table(g, r.x + r.w * 0.64, r.y + sz(H) * 1.2, [['THRUST', `${Math.round(st.thrust * 100)} %`], ['ATT', 'HOLD'], ['ORBIT', 'STABLE', C.green], ['EGRESS', st.landed ? 'GROUND' : 'NONE']], { size: sz(H), gap: Math.round(H * 0.05), colW: r.w * 0.17 });
    },
    descent: (g, W, H, t) => {
      const r = S.base(g, W, H, t, { title: 'DESCENT PLAN', sub: 'PROFILE 3' });
      const ph = (t * 0.05) % 1;
      S.line(g, r.x, r.y + 6, r.w, r.h * 0.5, (u) => 0.9 - 0.8 * u ** 1.6 + 0.04 * Math.sin(u * 30), C.amber);
      g.fillStyle = C.cy; g.fillRect(r.x + ph * r.w - 2, r.y + 6, 4, r.h * 0.5);
      S.table(g, r.x + 2, r.y + r.h * 0.62, [['WAYPOINT', 'ISCO'], ['ERGOSPHERE', 'T-' + String(Math.floor(900 - ph * 600)).padStart(4, '0') + ' s'], ['CAUCHY MARGIN', '0.31', C.amber]], { size: sz(H), gap: Math.round(H * 0.03), colW: r.w * 0.5 });
    },
    status: (g, W, H, t) => {
      const r = S.base(g, W, H, t, { title: 'FLIGHT DECK', sub: 'HX-02 ORPHEUS' }), s = Math.floor(t) % 60, m = Math.floor(t / 60) % 60;
      S.table(g, r.x + 2, r.y + sz(H), [['CREW', 'ABOARD', C.green], ['DOCK', st.landed ? 'GROUND' : 'FREE FLIGHT', C.cy], ['DECK', 'PRESSURISED', C.green], ['MET', `00:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`]], { size: sz(H), gap: Math.round(H * 0.045), colW: W * 0.4 });
      S.mono(g, 'ALL SYSTEMS NOMINAL', r.x + r.w / 2, r.y + r.h - 6, sz(H) * 1.1, C.green, 'center', 700);
    },
  };
}
