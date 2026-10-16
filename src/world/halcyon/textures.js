// HALCYON interior — procedural canvas textures: tiling surfaces, sign/banner/screen atlases, the ORPHEUS mural,
// the EURYDICE memorial, and the live (animated) wall displays.
const TAU = Math.PI * 2;
export const FONT = {
  disp: "Orbitron, 'Eurostile', 'Bank Gothic', 'Segoe UI', sans-serif",
  ui: "Rajdhani, 'Segoe UI', 'Arial Narrow', sans-serif",
  mono: "'Share Tech Mono', Consolas, 'Courier New', monospace",
};

export function makeTextures(G) {
  const T = {};

  // ───────────────────────── tiling surfaces ─────────────────────────
  const seamsH = (g, N, step, rgba, w = 2) => { g.fillStyle = rgba; for (let y = 0; y <= N; y += step) g.fillRect(0, y - w / 2, N, w); };

  function techPanel(base, seed) {
    const N = 512, cv = G.cv(N, N), bm = G.cv(N, N), g = cv.g, b = bm.g, R = G.rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, N, N);
    b.fillStyle = '#808080'; b.fillRect(0, 0, N, N);
    for (let r = 0; r < 4; r++) {
      const off = (r % 2) * 128;
      for (let c = -1; c < 3; c++) {
        const x = c * 256 + off, y = r * 128, t = 0.93 + R() * 0.09;
        g.fillStyle = `rgba(${Math.round(255 * t)},${Math.round(255 * t)},${Math.round(255 * Math.min(1, t + 0.01))},0.12)`; g.fillRect(x, y, 256, 128);
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 3, y + 3, 250, 2);
        g.fillStyle = 'rgba(30,36,44,0.30)'; g.fillRect(x + 3, y + 123, 250, 2);
        for (const [fx, fy] of [[10, 10], [246, 10], [10, 118], [246, 118]]) { g.fillStyle = 'rgba(60,66,74,0.55)'; g.beginPath(); g.arc(x + fx, y + fy, 2.4, 0, TAU); g.fill(); b.fillStyle = '#b0b0b0'; b.beginPath(); b.arc(x + fx, y + fy, 2.4, 0, TAU); b.fill(); }
        if (R() < 0.12) for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(40,46,54,0.55)'; g.fillRect(x + 60, y + 30 + k * 11, 136, 4); b.fillStyle = '#404040'; b.fillRect(x + 60, y + 30 + k * 11, 136, 5); }
      }
    }
    g.fillStyle = 'rgba(52,58,66,0.75)'; b.fillStyle = '#2a2a2a';
    for (let r = 0; r <= 4; r++) { g.fillRect(0, r * 128 - 1, N, 2); b.fillRect(0, r * 128 - 2, N, 4); }
    for (let r = 0; r < 4; r++) { const off = (r % 2) * 128; for (let c = -1; c < 3; c++) { g.fillRect(c * 256 + off - 1, r * 128, 2, 128); b.fillRect(c * 256 + off - 2, r * 128, 4, 128); } }
    return { map: G.tex(cv), bump: G.tex(bm, { linear: true }) };
  }

  function softPanel() {
    const N = 512, cv = G.cv(N, N), g = cv.g, R = G.rng(11);
    g.fillStyle = '#7f8794'; g.fillRect(0, 0, N, N);
    for (let y = 0; y < N; y += 6) for (let x = (y / 6 % 2) * 3; x < N; x += 6) { g.fillStyle = 'rgba(20,26,36,0.32)'; g.fillRect(x, y, 2, 2); }
    for (let k = 0; k < 4; k++) { const x = k * 128; const gr = g.createLinearGradient(x, 0, x + 128, 0); gr.addColorStop(0, 'rgba(255,255,255,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)'); g.fillStyle = gr; g.fillRect(x, 0, 128, N); }
    g.fillStyle = 'rgba(18,22,30,0.85)'; for (let k = 0; k <= 4; k++) g.fillRect(k * 128 - 1.5, 0, 3, N);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(10,14,22,${0.03 + R() * 0.05})`; g.fillRect(R() * N, R() * N, 30 + R() * 80, 3 + R() * 8); }
    return G.tex(cv);
  }

  function woodSlats() {
    const N = 512, cv = G.cv(N, N), g = cv.g, R = G.rng(17);
    const w = 16;
    for (let x = 0; x < N; x += w) {
      const t = 0.8 + R() * 0.32, r = 172 * t, gg = 112 * t, bb = 66 * t;
      g.fillStyle = `rgb(${r | 0},${gg | 0},${bb | 0})`; g.fillRect(x, 0, w, N);
      for (let k = 0; k < 7; k++) { g.fillStyle = `rgba(70,40,14,${0.05 + R() * 0.1})`; g.fillRect(x + R() * w, 0, 1, N); }
      g.fillStyle = 'rgba(20,10,4,0.75)'; g.fillRect(x + w - 2, 0, 2, N);
      g.fillStyle = 'rgba(255,230,190,0.12)'; g.fillRect(x, 0, 2, N);
    }
    return G.tex(cv);
  }

  function deckPlate() {
    const N = 512, cv = G.cv(N, N), bm = G.cv(N, N), g = cv.g, b = bm.g, R = G.rng(19);
    g.fillStyle = '#3a4048'; g.fillRect(0, 0, N, N); b.fillStyle = '#808080'; b.fillRect(0, 0, N, N);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const x = c * 128, y = r * 128, t = 0.9 + R() * 0.2;
      g.fillStyle = `rgba(${(255 * t) | 0},${(255 * t) | 0},${(255 * t) | 0},0.08)`; g.fillRect(x, y, 128, 128);
      g.fillStyle = 'rgba(190,200,215,0.14)'; g.fillRect(x + 2, y + 2, 124, 2); g.fillRect(x + 2, y + 2, 2, 124);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 2, y + 124, 124, 2); g.fillRect(x + 124, y + 2, 2, 124);
      for (const [fx, fy] of [[12, 12], [116, 12], [12, 116], [116, 116]]) { g.fillStyle = 'rgba(150,160,175,0.45)'; g.beginPath(); g.arc(x + fx, y + fy, 3, 0, TAU); g.fill(); b.fillStyle = '#c0c0c0'; b.beginPath(); b.arc(x + fx, y + fy, 3, 0, TAU); b.fill(); }
      for (let k = 0; k < 18; k++) { g.fillStyle = 'rgba(200,210,225,0.05)'; g.fillRect(x + 20 + k * 5, y + 28, 2, 72); b.fillStyle = '#9a9a9a'; b.fillRect(x + 20 + k * 5, y + 28, 2, 72); }
    }
    g.fillStyle = 'rgba(8,10,14,0.9)'; b.fillStyle = '#202020';
    for (let k = 0; k <= 4; k++) { g.fillRect(k * 128 - 1.5, 0, 3, N); g.fillRect(0, k * 128 - 1.5, N, 3); b.fillRect(k * 128 - 2, 0, 4, N); b.fillRect(0, k * 128 - 2, N, 4); }
    for (let k = 0; k < 24; k++) { g.fillStyle = `rgba(0,0,0,${0.04 + R() * 0.06})`; g.fillRect(R() * N, R() * N, 20 + R() * 90, 4 + R() * 12); }
    return { map: G.tex(cv), bump: G.tex(bm, { linear: true }) };
  }

  function woodPlanks() {
    const N = 512, cv = G.cv(N, N), g = cv.g, R = G.rng(23);
    const pw = 26;
    for (let x = 0; x < N; x += pw) {
      let y = -R() * 200;
      while (y < N) {
        const len = 140 + R() * 230, t = 0.78 + R() * 0.36;
        g.fillStyle = `rgb(${(142 * t) | 0},${(92 * t) | 0},${(54 * t) | 0})`; g.fillRect(x, y, pw, len);
        for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(60,32,12,${0.06 + R() * 0.12})`; g.fillRect(x + 2 + R() * (pw - 4), y, 1, len); }
        g.fillStyle = 'rgba(18,8,2,0.7)'; g.fillRect(x, y + len - 1.5, pw, 1.5); g.fillRect(x + pw - 1.2, y, 1.2, len);
        y += len;
      }
    }
    return G.tex(cv);
  }

  function ceilTile() {
    const N = 512, cv = G.cv(N, N), bm = G.cv(N, N), g = cv.g, b = bm.g, R = G.rng(29);
    g.fillStyle = '#d9dbd6'; g.fillRect(0, 0, N, N); b.fillStyle = '#808080'; b.fillRect(0, 0, N, N);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const x = c * 128, y = r * 128, t = 0.95 + R() * 0.06;
      g.fillStyle = `rgba(${(230 * t) | 0},${(232 * t) | 0},${(226 * t) | 0},0.7)`; g.fillRect(x + 2, y + 2, 124, 124);
      for (let k = 0; k < 90; k++) { g.fillStyle = 'rgba(70,72,66,0.35)'; g.fillRect(x + 8 + R() * 112, y + 8 + R() * 112, 1.5, 1.5); }
    }
    g.fillStyle = 'rgba(56,60,64,0.85)'; b.fillStyle = '#222';
    for (let k = 0; k <= 4; k++) { g.fillRect(k * 128 - 2, 0, 4, N); g.fillRect(0, k * 128 - 2, N, 4); b.fillRect(k * 128 - 2, 0, 4, N); b.fillRect(0, k * 128 - 2, N, 4); }
    return { map: G.tex(cv), bump: G.tex(bm, { linear: true }) };
  }

  T.panel = techPanel('#cfd2d5', 3);
  T.soft = softPanel();
  T.wood = woodSlats();
  T.deck = deckPlate();
  T.planks = woodPlanks();
  T.ceil = ceilTile();

  // ───────────────────────── sign atlas (2 cols × 8 rows of 512×64) ─────────────────────────
  T.signCells = {};
  {
    const SIGNS = [
      ['dock', 'DOCKING · ORPHEUS BERTH 01', '#2fd0ff', '<'], ['ops', 'OPERATIONS CENTER', '#ffb02e', '>'],
      ['lounge', 'OBSERVATION LOUNGE', '#ff8a3a', '>'], ['lab', 'SCIENCE · LABORATORY', '#7cf2c8', '>'],
      ['quarters', 'CREW QUARTERS', '#9ec4ff', 'v'], ['welcome', 'WELCOME TO HALCYON STATION', '#2fd0ff', ''],
      ['memorial', 'MEMORIAL · HX-01 EURYDICE', '#ffcf7a', ''], ['restricted', 'AUTHORIZED PERSONNEL', '#ff5a4a', ''],
      ['mc', 'MISSION CONTROL', '#ffb02e', ''], ['director', 'FLIGHT DIRECTOR', '#9ec4ff', ''],
      ['capcom', 'CAPCOM', '#2fd0ff', ''], ['sentinel', 'SENTINEL FEED · CHARON', '#ff6a5a', ''],
      ['cold', 'SAMPLE STORAGE  −80 °C', '#9ee8ff', ''], ['exit', 'EXIT  ORPHEUS', '#2fd0ff', '<'],
      ['berth', 'BERTH 01  ·  ORPHEUS  ·  DOCKED', '#5dff9a', ''], ['quarters2', 'DECK 4 · QUARTERS 11–20', '#9ec4ff', ''],
    ];
    const cv = G.cv(1024, 512), g = cv.g;
    const tex = G.tex(cv, { clamp: true });
    const draw = () => {
      g.clearRect(0, 0, 1024, 512);
      SIGNS.forEach(([id, text, col, arrow], i) => {
        const cx = (i % 2) * 512, cy = Math.floor(i / 2) * 64;
        g.fillStyle = '#0b1117'; g.fillRect(cx, cy, 512, 64);
        g.fillStyle = col; g.fillRect(cx, cy, 512, 3); g.fillRect(cx, cy + 61, 512, 3);
        g.fillStyle = col; g.fillRect(cx + 8, cy + 10, 6, 44);
        g.font = `700 25px ${FONT.disp}`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#eaf6ff';
        let tx = cx + 28;
        if (arrow === '<') { g.fillStyle = col; g.beginPath(); g.moveTo(cx + 22, cy + 32); g.lineTo(cx + 44, cy + 16); g.lineTo(cx + 44, cy + 48); g.closePath(); g.fill(); tx = cx + 54; }
        g.fillStyle = '#eaf6ff';
        let fs = 25; g.font = `700 ${fs}px ${FONT.disp}`;
        while (g.measureText(text).width > 512 - (tx - cx) - 40 - (arrow === '>' ? 44 : 0) && fs > 12) { fs -= 1; g.font = `700 ${fs}px ${FONT.disp}`; }
        G.spaced(g, text, tx, cy + 33, 1.5);
        if (arrow === '>') { g.fillStyle = col; g.beginPath(); g.moveTo(cx + 490, cy + 32); g.lineTo(cx + 468, cy + 16); g.lineTo(cx + 468, cy + 48); g.closePath(); g.fill(); }
        if (arrow === 'v') { g.fillStyle = col; g.beginPath(); g.moveTo(cx + 480, cy + 46); g.lineTo(cx + 464, cy + 20); g.lineTo(cx + 496, cy + 20); g.closePath(); g.fill(); }
        T.signCells[id] = [cx / 1024, 1 - (cy + 64) / 512, (cx + 512) / 1024, 1 - cy / 512];
      });
      tex.needsUpdate = true;
    };
    G.fontsThen(draw);
    T.signs = tex;
  }

  // ───────────────────────── banner atlas (6 × 256×768) ─────────────────────────
  T.bannerCells = [];
  {
    const cv = G.cv(1536, 768), g = cv.g, tex = G.tex(cv, { clamp: true });
    const star = (x, y, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
    const cloth = (x, col1, col2) => {
      const gr = g.createLinearGradient(x, 0, x + 256, 0); gr.addColorStop(0, col1); gr.addColorStop(1, col2);
      g.fillStyle = gr; g.beginPath(); g.moveTo(x + 4, 0); g.lineTo(x + 252, 0); g.lineTo(x + 252, 700); g.lineTo(x + 128, 760); g.lineTo(x + 4, 700); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 14, 10); g.lineTo(x + 242, 10); g.lineTo(x + 242, 692); g.lineTo(x + 128, 744); g.lineTo(x + 14, 692); g.closePath(); g.stroke();
    };
    const label = (x, str, y, size, col = '#fff', font = FONT.disp, spacing = 3) => { g.font = `700 ${size}px ${font}`; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; G.spaced(g, str, x + 128, y, spacing, 'center'); };
    const draw = () => {
      g.clearRect(0, 0, 1536, 768);
      // 0 ORPHEUS (navy + gold lyre)
      cloth(0, '#10224d', '#0a1330');
      g.strokeStyle = '#e8b13c'; g.lineWidth = 12; g.lineCap = 'round';
      g.beginPath(); g.moveTo(88, 350); g.bezierCurveTo(60, 270, 62, 170, 96, 120); g.stroke();
      g.beginPath(); g.moveTo(168, 350); g.bezierCurveTo(196, 270, 194, 170, 160, 120); g.stroke();
      g.beginPath(); g.moveTo(96, 120); g.quadraticCurveTo(128, 104, 160, 120); g.stroke();
      g.lineWidth = 3; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(104 + k * 10, 118); g.lineTo(112 + k * 6.4, 340); g.stroke(); }
      g.fillStyle = '#000'; g.beginPath(); g.arc(128, 400, 38, 0, TAU); g.fill(); g.strokeStyle = '#ffd9a0'; g.lineWidth = 5; g.beginPath(); g.arc(128, 400, 40, 0, TAU); g.stroke();
      g.strokeStyle = '#ff9a3c'; g.lineWidth = 3; g.beginPath(); g.ellipse(128, 400, 74, 14, 0, 0, TAU); g.stroke();
      label(0, 'ORPHEUS', 520, 30); label(0, 'HX-02', 566, 24, '#e8b13c'); label(0, 'DESCENT', 640, 20, '#9ec4ff', FONT.ui, 6);
      // 1 HALCYON (orange/white)
      cloth(256, '#e8681c', '#a8420c');
      g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(384, 250, 82, 0, TAU); g.stroke(); g.lineWidth = 5; g.beginPath(); g.ellipse(384, 250, 82, 22, -0.3, 0, TAU); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(384, 250, 12, 0, TAU); g.fill();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; g.fillRect(384 + Math.cos(a) * 82 - 4, 250 + Math.sin(a) * 82 - 4, 8, 8); }
      label(256, 'HALCYON', 460, 30); label(256, 'STATION', 498, 20, '#ffe2c2', FONT.ui, 8); label(256, '14 YEARS', 600, 22, '#fff', FONT.disp, 2); label(256, 'IN ORBIT', 632, 18, '#ffe2c2', FONT.ui, 6);
      // 2 EURYDICE (black, warm light)
      cloth(512, '#15110f', '#050404');
      const gl = g.createRadialGradient(640, 280, 8, 640, 280, 150); gl.addColorStop(0, 'rgba(255,196,110,0.95)'); gl.addColorStop(0.3, 'rgba(255,150,60,0.4)'); gl.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gl; g.fillRect(512, 120, 256, 320);
      g.fillStyle = '#ffe3a8'; g.beginPath(); g.arc(640, 280, 15, 0, TAU); g.fill(); g.strokeStyle = '#ffcf7a'; g.lineWidth = 3; g.strokeRect(624, 296, 32, 46); g.beginPath(); g.moveTo(626, 296); g.lineTo(640, 250); g.lineTo(654, 296); g.stroke();
      label(512, 'EURYDICE', 440, 25, '#ffdca0'); label(512, 'HX-01', 480, 22, '#c9a36a', FONT.disp, 6); label(512, 'WE LEAVE', 590, 20, '#ffdca0', FONT.ui, 6); label(512, 'THE LIGHT ON', 622, 20, '#ffdca0', FONT.ui, 6);
      // 3 SENTINEL (teal)
      cloth(768, '#0f4a52', '#082c33');
      g.strokeStyle = '#7cf2e0'; g.lineWidth = 7; g.beginPath(); g.arc(896, 280, 60, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(896, 340); g.lineTo(896, 420); g.moveTo(870, 420); g.lineTo(922, 420); g.stroke();
      g.fillStyle = '#7cf2e0'; g.beginPath(); g.arc(896, 280, 12, 0, TAU); g.fill();
      label(768, 'SENTINEL', 500, 24, '#dffcf6'); label(768, 'OBSERVATORY', 534, 18, '#7cf2e0', FONT.ui, 6); label(768, 'CHARON', 626, 22, '#dffcf6', FONT.disp, 4);
      // 4 ASPHODEL (green / silver)
      cloth(1024, '#2f6a3c', '#173a21');
      g.strokeStyle = '#d6e2d3'; g.lineWidth = 6; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(1152, 420); g.quadraticCurveTo(1152 + (k - 3) * 18, 330, 1152 + (k - 3) * 36, 230 + Math.abs(k - 3) * 10); g.stroke(); }
      g.fillStyle = '#d6e2d3'; g.fillRect(1100, 420, 104, 8);
      label(1024, 'ASPHODEL', 520, 24, '#f2fff2'); label(1024, 'SURVEY · MEADOW', 560, 15, '#b9d8b5', FONT.ui, 4);
      // 5 COCYTUS (ice blue)
      cloth(1280, '#cfe4f2', '#7aa6c4');
      g.strokeStyle = '#17394f'; g.lineWidth = 5; for (let k = 0; k < 3; k++) { g.save(); g.translate(1408, 280); g.rotate((k * Math.PI) / 3); g.beginPath(); g.moveTo(0, -90); g.lineTo(0, 90); g.stroke(); for (const s of [-1, 1]) for (const d of [48, 72]) { g.beginPath(); g.moveTo(0, s * d); g.lineTo(16, s * (d + 16)); g.moveTo(0, s * d); g.lineTo(-16, s * (d + 16)); g.stroke(); } g.restore(); }
      label(1280, 'COCYTUS', 500, 26, '#0f2a3b'); label(1280, 'THE FROZEN LAKE', 540, 14, '#17394f', FONT.ui, 3);
      g.fillStyle = '#17394f'; g.font = `600 14px ${FONT.ui}`; star(1408, 640, 14);
      tex.needsUpdate = true;
      for (let i = 0; i < 6; i++) T.bannerCells[i] = [(i * 256) / 1536, 0, ((i + 1) * 256) / 1536, 1];
    };
    G.fontsThen(draw);
    T.banners = tex;
  }

  // ───────────────────────── screen atlas (4 × 4 of 512×256) ─────────────────────────
  T.screenCells = [];
  {
    const cv = G.cv(2048, 1024), g = cv.g, tex = G.tex(cv, { clamp: true }), R = G.rng(41);
    const KINDS = ['wave', 'plot', 'log', 'bars', 'orbit', 'schem', 'spec', 'fall', 'grid', 'tree', 'map', 'sample', 'vitals', 'standby', 'alert', 'blue'];
    const cell = (i, fn) => { const x = (i % 4) * 512, y = Math.floor(i / 4) * 256; g.save(); g.beginPath(); g.rect(x, y, 512, 256); g.clip(); g.translate(x, y); fn(); g.restore(); };
    const frame = (c = '#2fd0ff', title = '') => {
      g.fillStyle = '#04090f'; g.fillRect(0, 0, 512, 256);
      g.strokeStyle = c; g.globalAlpha = 0.18; g.lineWidth = 1; for (let k = 32; k < 512; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.stroke(); } for (let k = 32; k < 256; k += 32) { g.beginPath(); g.moveTo(0, k); g.lineTo(512, k); g.stroke(); } g.globalAlpha = 1;
      g.strokeStyle = c; g.lineWidth = 3; g.strokeRect(3, 3, 506, 250);
      g.fillStyle = c; g.globalAlpha = 0.18; g.fillRect(3, 3, 506, 26); g.globalAlpha = 1;
      g.font = `700 15px ${FONT.disp}`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = c; G.spaced(g, title, 14, 17, 2);
    };
    const draw = () => {
      g.clearRect(0, 0, 2048, 1024);
      KINDS.forEach((k, i) => cell(i, () => {
        const C1 = { wave: '#4dffb8', plot: '#2fd0ff', log: '#7dff7d', bars: '#ffb02e', orbit: '#2fd0ff', schem: '#2fd0ff', spec: '#ff8a3a', fall: '#9ec4ff', grid: '#7cf2c8', tree: '#2fd0ff', map: '#6ab8ff', sample: '#c8a3ff', vitals: '#ff8a8a', standby: '#4a6a7a', alert: '#ff4a3a', blue: '#2fd0ff' }[k];
        frame(C1, { wave: 'TELEMETRY', plot: 'TRAJECTORY', log: 'EVENT LOG', bars: 'POWER', orbit: 'ORBIT 46 M', schem: 'ORPHEUS HX-02', spec: 'SPECTRUM', fall: 'COMMS WATERFALL', grid: 'SYSTEMS', tree: 'NETWORK', map: 'SURVEY', sample: 'SAMPLE FIT', vitals: 'CREW VITALS', standby: 'STANDBY', alert: 'ALERT', blue: 'HALCYON' }[k]);
        g.lineWidth = 2;
        if (k === 'wave') for (let tr = 0; tr < 3; tr++) { g.strokeStyle = ['#4dffb8', '#2fd0ff', '#ffd36a'][tr]; g.beginPath(); for (let x = 8; x < 504; x += 3) { const y = 70 + tr * 62 + Math.sin(x * 0.04 * (tr + 1) + tr * 2) * 16 + Math.sin(x * 0.13) * 5 * R(); g.lineTo(x, y); } g.stroke(); }
        if (k === 'plot') { g.fillStyle = '#9ec4ff'; for (let n = 0; n < 90; n++) g.fillRect(8 + R() * 496, 36 + R() * 210, 2, 2); g.strokeStyle = '#ff9a3c'; g.beginPath(); g.moveTo(24, 220); g.bezierCurveTo(180, 220, 220, 60, 470, 90); g.stroke(); g.fillStyle = '#ff9a3c'; for (const [x, y] of [[24, 220], [150, 205], [250, 130], [370, 78], [470, 90]]) g.fillRect(x - 4, y - 4, 8, 8); }
        if (k === 'log') { for (let r = 0; r < 14; r++) { g.fillStyle = r % 5 === 0 ? '#ffcf7a' : '#7dff7d'; g.globalAlpha = 0.5 + R() * 0.5; g.fillRect(14, 40 + r * 15, 24, 7); g.fillRect(48, 40 + r * 15, 40 + R() * 340, 7); } g.globalAlpha = 1; }
        if (k === 'bars') for (let b = 0; b < 14; b++) { const h = 30 + R() * 150; g.fillStyle = b % 5 === 4 ? '#ff6a3a' : '#ffb02e'; g.fillRect(22 + b * 34, 236 - h, 24, h); }
        if (k === 'orbit') { g.strokeStyle = '#2fd0ff'; for (const r of [30, 62, 98, 124]) { g.beginPath(); g.ellipse(256, 140, r * 1.7, r * 0.9, 0, 0, TAU); g.stroke(); } g.fillStyle = '#ffb02e'; g.beginPath(); g.arc(256, 140, 10, 0, TAU); g.fill(); for (const [a, r] of [[0.8, 62], [2.2, 124], [4.6, 98]]) { g.fillStyle = '#fff'; g.beginPath(); g.arc(256 + Math.cos(a) * r * 1.7, 140 + Math.sin(a) * r * 0.9, 5, 0, TAU); g.fill(); } }
        if (k === 'schem') { g.strokeStyle = '#2fd0ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(60, 140); g.lineTo(150, 118); g.lineTo(380, 118); g.lineTo(440, 100); g.lineTo(450, 180); g.lineTo(380, 162); g.lineTo(150, 162); g.closePath(); g.stroke(); g.beginPath(); g.arc(250, 118, 22, Math.PI, TAU); g.stroke(); for (const x of [170, 230, 290, 350]) { g.beginPath(); g.moveTo(x, 118); g.lineTo(x, 162); g.stroke(); } g.fillStyle = '#ff9a3c'; g.fillRect(430, 120, 18, 44); }
        if (k === 'spec') for (let x = 6; x < 506; x += 5) for (let y = 34; y < 250; y += 5) { const v = Math.max(0, Math.sin(x * 0.03 + y * 0.05) * 0.5 + 0.5 - (y - 34) / 300 + R() * 0.25); g.fillStyle = `rgba(255,${(90 + 160 * v) | 0},${(30 + 60 * v) | 0},${0.15 + v * 0.85})`; g.fillRect(x, y, 5, 5); }
        if (k === 'fall') for (let y = 34; y < 250; y += 3) { for (let n = 0; n < 6; n++) { g.fillStyle = `rgba(158,196,255,${0.1 + R() * 0.7})`; g.fillRect(10 + R() * 490, y, 2 + R() * 14, 2); } }
        if (k === 'grid') for (let r = 0; r < 6; r++) for (let c = 0; c < 14; c++) { const v = R(); g.fillStyle = v > 0.93 ? '#ff4a3a' : v > 0.8 ? '#ffb02e' : '#38d19a'; g.fillRect(14 + c * 35, 42 + r * 34, 28, 22); }
        if (k === 'tree') { g.strokeStyle = '#2fd0ff'; const nodes = [[256, 56]]; for (let d = 1; d < 4; d++) for (let n = 0; n < 2 ** d; n++) { const x = 40 + ((n + 0.5) * 430) / 2 ** d, y = 56 + d * 62; g.beginPath(); g.moveTo(nodes[Math.max(0, Math.floor((nodes.length - 1) / 2))][0] * 0 + 256 + (((n >> 1) + 0.5) * 430) / 2 ** (d - 1) - 215, 56 + (d - 1) * 62); g.lineTo(x, y); g.stroke(); g.fillStyle = '#04090f'; g.fillRect(x - 12, y - 8, 24, 16); g.strokeRect(x - 12, y - 8, 24, 16); } }
        if (k === 'map') { g.strokeStyle = '#6ab8ff'; g.beginPath(); g.arc(256, 142, 92, 0, TAU); g.stroke(); for (let l = -60; l <= 60; l += 30) { g.beginPath(); g.ellipse(256, 142, 92, 92 * Math.abs(Math.cos((l * Math.PI) / 180)) * 0.2 + 1, 0, 0, TAU); g.stroke(); } for (let m = 0; m < 6; m++) { g.beginPath(); g.ellipse(256, 142, 92 * Math.abs(Math.cos(m * 0.5)), 92, 0, 0, TAU); g.stroke(); } g.fillStyle = '#ffb02e'; g.fillRect(300, 112, 8, 8); }
        if (k === 'sample') { g.fillStyle = '#c8a3ff'; for (let n = 0; n < 60; n++) { const x = 20 + R() * 470; g.fillRect(x, 220 - x * 0.35 + (R() - 0.5) * 50 - 20, 4, 4); } g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(20, 200); g.lineTo(490, 36 + 40); g.stroke(); }
        if (k === 'vitals') for (let n = 0; n < 4; n++) { g.strokeStyle = '#ff8a8a'; g.beginPath(); g.arc(70 + n * 120, 150, 42, 0.8 * Math.PI, 2.2 * Math.PI); g.stroke(); g.strokeStyle = '#fff'; const a = 0.8 * Math.PI + R() * 1.4 * Math.PI; g.beginPath(); g.moveTo(70 + n * 120, 150); g.lineTo(70 + n * 120 + Math.cos(a) * 36, 150 + Math.sin(a) * 36); g.stroke(); }
        if (k === 'standby') { g.font = `700 34px ${FONT.disp}`; g.fillStyle = '#4a6a7a'; g.textAlign = 'center'; G.spaced(g, 'STANDBY', 256, 140, 8, 'center'); }
        if (k === 'alert') { g.fillStyle = 'rgba(255,60,40,0.22)'; g.fillRect(8, 34, 496, 214); g.font = `700 40px ${FONT.disp}`; g.fillStyle = '#ff5a4a'; G.spaced(g, 'NO SIGNAL', 256, 140, 8, 'center'); }
        if (k === 'blue') { const gr = g.createRadialGradient(256, 140, 6, 256, 140, 190); gr.addColorStop(0, 'rgba(47,208,255,0.7)'); gr.addColorStop(1, 'rgba(47,208,255,0)'); g.fillStyle = gr; g.fillRect(8, 34, 496, 214); g.font = `700 38px ${FONT.disp}`; g.fillStyle = '#d6f6ff'; G.spaced(g, 'HALCYON', 256, 140, 10, 'center'); }
        T.screenCells[i] = [(i % 4) / 4, 1 - (Math.floor(i / 4) + 1) / 4, (i % 4 + 1) / 4, 1 - Math.floor(i / 4) / 4];
      }));
      tex.needsUpdate = true;
    };
    G.fontsThen(draw);
    T.screens = tex;
  }

  // ───────────────────────── ORPHEUS mission patch mural ─────────────────────────
  {
    const S = 2048, cv = G.cv(S, S), g = cv.g, tex = G.tex(cv, { clamp: true }), R = G.rng(53);
    const arcText = (str, cx, cy, radius, center, size, bottom = false, spacing = 0.05) => {
      g.font = `700 ${size}px ${FONT.disp}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const chars = [...str], adv = chars.map((c) => g.measureText(c).width + size * spacing);
      const total = adv.reduce((a, b) => a + b, 0) / radius;
      let a = center - (bottom ? -total / 2 : total / 2);
      chars.forEach((ch, i) => {
        const step = adv[i] / radius;
        a += bottom ? -step / 2 : step / 2;
        g.save(); g.translate(cx, cy); g.rotate(a); g.translate(0, bottom ? radius : -radius); if (bottom) g.rotate(Math.PI); g.fillText(ch, 0, 0); g.restore();
        a += bottom ? -step / 2 : step / 2;
      });
    };
    const draw = () => {
      g.clearRect(0, 0, S, S);
      const cx = S / 2, cy = S / 2, Rr = S / 2 - 8;
      g.save(); g.beginPath(); g.arc(cx, cy, Rr, 0, TAU); g.clip();
      const bg = g.createRadialGradient(cx, cy * 1.1, 60, cx, cy, Rr); bg.addColorStop(0, '#13265a'); bg.addColorStop(0.55, '#0a1334'); bg.addColorStop(1, '#03050d');
      g.fillStyle = bg; g.fillRect(0, 0, S, S);
      for (const [x, y, r, c] of [[620, 640, 520, 'rgba(120,70,200,0.18)'], [1500, 1460, 560, 'rgba(40,170,200,0.14)'], [1480, 560, 380, 'rgba(255,110,60,0.10)']]) { const gr = g.createRadialGradient(x, y, 10, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); }
      for (let i = 0; i < 700; i++) { const a = R() * TAU, r = Math.sqrt(R()) * Rr * 0.95; g.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.8})`; const s = R() < 0.04 ? 5 : 2.4; g.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, s, s); }
      // black hole with lensed disk
      const bx = cx, by = cy + 170;
      let gr = g.createRadialGradient(bx, by, 150, bx, by, 520); gr.addColorStop(0, 'rgba(255,170,70,0.55)'); gr.addColorStop(0.35, 'rgba(255,120,40,0.18)'); gr.addColorStop(1, 'rgba(255,100,30,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
      g.save(); g.translate(bx, by);
      for (let k = 0; k < 24; k++) { const f = k / 23; g.strokeStyle = `rgba(255,${(150 + 100 * (1 - f)) | 0},${(60 + 150 * (1 - f)) | 0},${0.1 + 0.16 * (1 - f)})`; g.lineWidth = 16 - f * 6; g.beginPath(); g.arc(0, 0, 232 + f * 70, 0, TAU); g.stroke(); }  // lensed halo
      g.restore();
      const disk = (frontOnly) => { g.save(); g.translate(bx, by); for (let k = 0; k < 30; k++) { const f = k / 29; g.strokeStyle = `rgba(255,${(140 + 110 * (1 - f)) | 0},${(50 + 170 * (1 - f)) | 0},${0.12 + 0.2 * (1 - f)})`; g.lineWidth = 12 - f * 4; g.beginPath(); g.ellipse(0, 0, 250 + f * 330, 38 + f * 66, 0, frontOnly ? 0 : Math.PI, frontOnly ? Math.PI : TAU); g.stroke(); } g.restore(); };
      disk(false);
      g.fillStyle = '#000'; g.beginPath(); g.arc(bx, by, 196, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,238,205,0.95)'; g.lineWidth = 9; g.beginPath(); g.arc(bx, by, 199, 0, TAU); g.stroke();
      disk(true);
      // golden lyre — strings fall into the hole
      const gold = g.createLinearGradient(cx - 400, cy - 600, cx + 400, cy + 700); gold.addColorStop(0, '#fff2b8'); gold.addColorStop(0.45, '#e3a936'); gold.addColorStop(1, '#8a5812');
      g.strokeStyle = gold; g.lineCap = 'round';
      for (const s of [-1, 1]) { g.lineWidth = 46; g.beginPath(); g.moveTo(cx + s * 170, cy + 590); g.bezierCurveTo(cx + s * 520, cy + 360, cx + s * 520, cy - 220, cx + s * 280, cy - 560); g.stroke(); g.fillStyle = gold; g.beginPath(); g.arc(cx + s * 270, cy - 590, 36, 0, TAU); g.fill(); }
      g.lineWidth = 40; g.beginPath(); g.moveTo(cx - 280, cy - 570); g.quadraticCurveTo(cx, cy - 640, cx + 280, cy - 570); g.stroke();
      g.lineWidth = 4;
      for (let k = 0; k < 9; k++) { const x = cx - 232 + k * 58; g.strokeStyle = 'rgba(255,236,170,0.92)'; g.shadowColor = '#ffd37a'; g.shadowBlur = 14; g.beginPath(); g.moveTo(x, cy - 566 + Math.abs(k - 4) * 4); g.quadraticCurveTo(x * 0.5 + cx * 0.5, cy - 150, cx + (x - cx) * 0.34, by - 195); g.stroke(); g.shadowBlur = 0; }
      g.fillStyle = gold; g.beginPath(); g.moveTo(cx - 240, cy + 560); g.lineTo(cx + 240, cy + 560); g.lineTo(cx + 190, cy + 690); g.lineTo(cx - 190, cy + 690); g.closePath(); g.fill();
      g.fillStyle = '#0a1334'; g.fillRect(cx - 170, cy + 590, 340, 16);
      g.restore();
      // ring
      const rg = g.createLinearGradient(0, 0, S, S); rg.addColorStop(0, '#ffe9a4'); rg.addColorStop(0.5, '#d89a2c'); rg.addColorStop(1, '#8a5812');
      g.strokeStyle = rg; g.lineWidth = 78; g.beginPath(); g.arc(cx, cy, Rr - 39, 0, TAU); g.stroke();
      g.strokeStyle = '#0a1334'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, Rr - 78, 0, TAU); g.stroke(); g.beginPath(); g.arc(cx, cy, Rr - 2, 0, TAU); g.stroke();
      g.fillStyle = '#0a1334'; arcText('ORPHEUS  ·  HX-02', cx, cy, Rr - 40, 0, 52, false, 0.12); arcText('DESCENT INTO EREBUS', cx, cy, Rr - 40, Math.PI, 52, true, 0.1);
      for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * (Rr - 40), cy, 10, 0, TAU); g.fill(); }
      tex.needsUpdate = true;
    };
    G.fontsThen(draw);
    T.mural = tex;
  }

  // ───────────────────────── EURYDICE memorial wall ─────────────────────────
  {
    const W = 2048, H = 1024, cv = G.cv(W, H), g = cv.g, tex = G.tex(cv, { clamp: true }), R = G.rng(61);
    const portrait = (cx, cy, warm) => {
      const ow = 250, oh = 330;
      const glow = g.createRadialGradient(cx, cy, 20, cx, cy, 340); glow.addColorStop(0, `rgba(${warm},0.55)`); glow.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = glow; g.fillRect(cx - 360, cy - 360, 720, 720);
      g.save(); g.beginPath(); g.ellipse(cx, cy, ow, oh, 0, 0, TAU); g.clip();
      const bgr = g.createLinearGradient(cx, cy - oh, cx, cy + oh); bgr.addColorStop(0, '#3a2414'); bgr.addColorStop(0.6, '#b8742e'); bgr.addColorStop(1, '#f0b060'); g.fillStyle = bgr; g.fillRect(cx - ow, cy - oh, ow * 2, oh * 2);
      g.fillStyle = 'rgba(30,16,8,0.92)'; g.beginPath(); g.ellipse(cx, cy - 36, 86, 108, 0, 0, TAU); g.fill();                                  // head
      g.beginPath(); g.moveTo(cx - 62, cy + 60); g.quadraticCurveTo(cx - 40, cy + 94, cx - 230, cy + 190); g.lineTo(cx - 240, cy + oh); g.lineTo(cx + 240, cy + oh); g.lineTo(cx + 230, cy + 190); g.quadraticCurveTo(cx + 40, cy + 94, cx + 62, cy + 60); g.closePath(); g.fill();  // shoulders
      const hl = g.createRadialGradient(cx - 40, cy - 90, 4, cx - 40, cy - 90, 160); hl.addColorStop(0, 'rgba(255,214,150,0.38)'); hl.addColorStop(1, 'rgba(255,214,150,0)'); g.fillStyle = hl; g.fillRect(cx - ow, cy - oh, ow * 2, oh * 2);
      g.restore();
      const fr = g.createLinearGradient(cx - ow, cy - oh, cx + ow, cy + oh); fr.addColorStop(0, '#f6dca0'); fr.addColorStop(0.5, '#b88530'); fr.addColorStop(1, '#6a4410');
      g.strokeStyle = fr; g.lineWidth = 16; g.beginPath(); g.ellipse(cx, cy, ow + 10, oh + 10, 0, 0, TAU); g.stroke();
    };
    const draw = () => {
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#15171c'; g.fillRect(0, 0, W, H);
      for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(255,255,255,${R() * 0.018})`; g.fillRect(R() * W, R() * H, 40 + R() * 200, 2 + R() * 6); }
      g.strokeStyle = 'rgba(255,208,130,0.35)'; g.lineWidth = 3; g.strokeRect(24, 24, W - 48, H - 48); g.strokeStyle = 'rgba(255,208,130,0.18)'; g.strokeRect(40, 40, W - 80, H - 80);
      portrait(540, 380, '255,170,80'); portrait(1508, 380, '255,190,100');
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillStyle = '#f2d9a8'; g.font = `700 70px ${FONT.disp}`; G.spaced(g, 'ELENA VARIS', 540, 815, 8, 'center'); G.spaced(g, 'TOMAS OYELARAN', 1508, 815, 8, 'center');
      g.fillStyle = '#b9a07a'; g.font = `600 40px ${FONT.ui}`; G.spaced(g, 'COMMANDER  ·  HX-01 EURYDICE', 540, 870, 7, 'center'); G.spaced(g, 'FLIGHT ENGINEER  ·  HX-01 EURYDICE', 1508, 870, 7, 'center');
      // centre: patch + dedication
      const cx = 1024, cy = 400;
      g.strokeStyle = '#d9a74a'; g.lineWidth = 10; g.beginPath(); g.arc(cx, cy, 170, 0, TAU); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 152, 0, TAU); g.stroke();
      g.fillStyle = '#05060a'; g.beginPath(); g.arc(cx, cy, 148, 0, TAU); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy + 14, 52, 0, TAU); g.fill(); g.strokeStyle = '#ffd9a0'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy + 14, 54, 0, TAU); g.stroke();
      g.strokeStyle = '#ff9a3c'; g.lineWidth = 4; g.beginPath(); g.ellipse(cx, cy + 14, 112, 20, 0, 0, TAU); g.stroke();
      g.strokeStyle = '#d9a74a'; g.lineWidth = 8; g.beginPath(); g.moveTo(cx - 62, cy + 100); g.bezierCurveTo(cx - 100, cy + 40, cx - 100, cy - 60, cx - 62, cy - 100); g.stroke(); g.beginPath(); g.moveTo(cx + 62, cy + 100); g.bezierCurveTo(cx + 100, cy + 40, cx + 100, cy - 60, cx + 62, cy - 100); g.stroke();
      g.fillStyle = '#e8cf9c'; g.font = `700 54px ${FONT.disp}`; G.spaced(g, 'HX-01', cx, cy + 250, 12, 'center');
      g.font = `700 64px ${FONT.disp}`; G.spaced(g, 'EURYDICE', cx, 690, 14, 'center');
      g.fillStyle = '#c8b690'; g.font = `600 44px ${FONT.ui}`; G.spaced(g, 'THROUGH THE HORIZON', cx, 745, 9, 'center');
      g.fillStyle = '#ffd9a0'; g.font = `600 56px ${FONT.ui}`; G.spaced(g, 'WE LEAVE THE LIGHT ON.', cx, 950, 12, 'center');
      tex.needsUpdate = true;
    };
    G.fontsThen(draw);
    T.memorial = tex;
  }

  // ───────────────────────── Dr. Varga's whiteboard ─────────────────────────
  {
    const W = 1024, H = 512, cv = G.cv(W, H), g = cv.g, tex = G.tex(cv, { clamp: true }), R = G.rng(71);
    const draw = () => {
      g.fillStyle = '#eceff0'; g.fillRect(0, 0, W, H);
      const gl = g.createLinearGradient(0, 0, W, H); gl.addColorStop(0, 'rgba(255,255,255,0.5)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,0.08)'); g.fillStyle = gl; g.fillRect(0, 0, W, H);
      for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(150,160,170,${0.04 + R() * 0.06})`; g.fillRect(R() * W, R() * H, 40 + R() * 160, 4 + R() * 10); }   // old marker ghosts
      g.lineCap = 'round'; g.lineJoin = 'round';
      const ink = (c, w) => { g.strokeStyle = c; g.fillStyle = c; g.lineWidth = w; };
      const hand = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', 'Share Tech Mono', cursive";
      const line = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => { const px = x + (R() - 0.5) * 1.4, py = y + (R() - 0.5) * 1.4; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); };
      ink('#1c3f78', 3.2); g.font = `600 31px ${hand}`;
      g.fillText('Δ = r² − 2Mr + a²', 40, 66); g.fillText('r± = M ± √(M² − a²)', 40, 114); g.fillText('r_E(θ) = M + √(M² − a²cos²θ)', 40, 162);
      ink('#1c3f78', 2.6); line([[40, 178], [470, 178]]);
      g.font = `600 24px ${hand}`; g.fillText('a* = 0.95  →  r₊ ≈ 1.31 M,  r₋ ≈ 0.69 M', 40, 214);
      // ergosphere sketch
      ink('#1c3f78', 2.8); g.beginPath(); g.ellipse(250, 330, 150, 112, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(250, 330, 78, 0, Math.PI * 2); g.stroke();
      ink('#b3261e', 2.6); line([[110, 330], [390, 330]]); g.font = `600 22px ${hand}`; g.fillStyle = '#b3261e'; g.fillText('ergosphere', 296, 262); g.fillText('horizon r₊', 214, 336);
      // Penrose diagram
      ink('#14663c', 3); for (const ox of [0, 190]) { line([[640 + ox, 120], [740 + ox, 40], [840 + ox, 120], [740 + ox, 200], [640 + ox, 120]]); }
      ink('#14663c', 2.2); line([[740, 40], [740, 200]]); line([[640, 120], [840, 120]]); line([[930, 40], [930, 200]]);
      g.font = `600 20px ${hand}`; g.fillText('I', 706, 126); g.fillText('II', 770, 100); g.fillText('III', 890, 126); g.fillText('ring', 950, 126);
      ink('#14663c', 2.4); line([[780, 260], [900, 260]]); line([[890, 250], [900, 260], [890, 270]]);
      // the circled note
      ink('#b3261e', 3.4); g.beginPath(); g.ellipse(790, 386, 210, 62, -0.04, 0, Math.PI * 2); g.stroke();
      g.font = `700 30px ${hand}`; g.fillText('Eurydice:  z → ∞', 640, 380); g.font = `600 22px ${hand}`; g.fillText('still tracking.  11 y 3 m.', 650, 414);
      ink('#1c3f78', 2.2); g.font = `600 22px ${hand}`; g.fillText('t_obs ∝ ln(1/(r − r₊))', 40, 470); g.fillText('She is not gone — she is slow.', 420, 490);
      tex.needsUpdate = true;
    };
    G.fontsThen(draw);
    T.board = tex;
  }
  // ───────────────────────── hologram accretion-disk sprite ─────────────────────────
  {
    const S = 256, cv = G.cv(S, S), g = cv.g, R = G.rng(83);
    const gr = g.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,230,170,0)'); gr.addColorStop(0.08, 'rgba(255,240,200,0.95)'); gr.addColorStop(0.3, 'rgba(255,170,70,0.75)'); gr.addColorStop(0.65, 'rgba(255,100,30,0.35)'); gr.addColorStop(1, 'rgba(255,80,20,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 90; k++) { const a = R() * Math.PI * 2, r = S * (0.22 + R() * 0.26); g.strokeStyle = `rgba(255,${(180 + R() * 75) | 0},120,${0.06 + R() * 0.16})`; g.lineWidth = 1 + R() * 2; g.beginPath(); g.arc(S / 2, S / 2, r, a, a + 0.4 + R() * 1.6); g.stroke(); }
    T.holoDisk = G.tex(cv, { clamp: true });
  }

  // ───────────────────────── live displays ─────────────────────────
  function live(w, h, drawFn) {
    const cv = G.cv(w, h), tex = G.tex(cv, { clamp: true });
    const L = { cv, tex, w, h, t: -1, redraw(t, info) { drawFn(cv.g, w, h, t, info || {}); tex.needsUpdate = true; L.t = t; } };
    G.fontsThen(() => L.redraw(L.t < 0 ? 0 : L.t));
    return L;
  }
  const hdr = (g, w, c, title, right = '') => {
    g.fillStyle = '#03070c'; g.fillRect(0, 0, w, 54); g.fillStyle = c; g.globalAlpha = 0.22; g.fillRect(0, 0, w, 54); g.globalAlpha = 1;
    g.fillStyle = c; g.fillRect(0, 51, w, 3); g.font = `700 26px ${FONT.disp}`; g.textAlign = 'left'; g.textBaseline = 'middle'; G.spaced(g, title, 22, 28, 4);
    g.textAlign = 'right'; g.font = `600 22px ${FONT.mono}`; g.fillText(right, w - 22, 28); g.textAlign = 'left';
  };

  // Erebus — the picture on the left screen (static, drawn once; tiny shimmer)
  T.liveErebus = live(1024, 576, (g, w, h, t) => {
    g.fillStyle = '#010204'; g.fillRect(0, 0, w, h);
    const R = G.rng(7);
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + R() * 0.7})`; g.fillRect(R() * w, 64 + R() * (h - 64), 2, 2); }
    const cx = w / 2, cy = h / 2 + 22;
    let gr = g.createRadialGradient(cx, cy, 40, cx, cy, 300); gr.addColorStop(0, 'rgba(255,170,70,0.5)'); gr.addColorStop(0.4, 'rgba(255,120,40,0.16)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = gr; g.fillRect(0, 54, w, h - 54);
    const disk = (front) => { for (let k = 0; k < 28; k++) { const f = k / 27; g.strokeStyle = `rgba(255,${(150 + 100 * (1 - f)) | 0},${(60 + 160 * (1 - f)) | 0},${0.1 + 0.2 * (1 - f)})`; g.lineWidth = 9 - f * 3; g.beginPath(); g.ellipse(cx, cy, 120 + f * 250, 18 + f * 34, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); g.stroke(); } };
    for (let k = 0; k < 20; k++) { const f = k / 19; g.strokeStyle = `rgba(255,${(170 + 70 * (1 - f)) | 0},${(80 + 130 * (1 - f)) | 0},${0.12 + 0.16 * (1 - f)})`; g.lineWidth = 8 - f * 3; g.beginPath(); g.arc(cx, cy, 106 + f * 36, 0, TAU); g.stroke(); }
    disk(false);
    g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, 96, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,240,215,0.95)'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, 98, 0, TAU); g.stroke();
    disk(true);
    hdr(g, w, '#ffb02e', 'EREBUS', 'XRB-J1840');
    g.fillStyle = '#ffd9a0'; g.font = `600 22px ${FONT.mono}`; g.textAlign = 'left';
    ['KERR BLACK HOLE  a* 0.95', 'MASS 2.03e5 Msun', 'HALCYON ORBIT 46 M', 'DISK  RIN 1.94 M'].forEach((s, i) => g.fillText(s, 24, h - 94 + i * 24));
  });

  // ORPHEUS telemetry — animated
  T.liveTelemetry = live(1024, 576, (g, w, h, t, info) => {
    g.fillStyle = '#02080d'; g.fillRect(0, 0, w, h);
    hdr(g, w, '#2fd0ff', 'ORPHEUS  HX-02', info.docked === false ? 'FREE FLIGHT' : 'DOCKED · BERTH 01');
    g.strokeStyle = 'rgba(47,208,255,0.16)'; g.lineWidth = 1; for (let x = 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, 60); g.lineTo(x, h); g.stroke(); } for (let y = 60; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    // ship schematic
    g.strokeStyle = '#2fd0ff'; g.lineWidth = 3; g.beginPath(); g.moveTo(90, 190); g.lineTo(220, 160); g.lineTo(560, 160); g.lineTo(640, 130); g.lineTo(660, 250); g.lineTo(560, 220); g.lineTo(220, 220); g.closePath(); g.stroke();
    g.beginPath(); g.arc(390, 160, 32, Math.PI, TAU); g.stroke(); for (const x of [250, 330, 410, 490]) { g.beginPath(); g.moveTo(x, 160); g.lineTo(x, 220); g.stroke(); }
    g.fillStyle = '#ff9a3c'; g.fillRect(632, 150, 26, 80); g.fillStyle = '#5dff9a'; g.fillRect(364, 214, 52, 8);
    g.font = `600 20px ${FONT.mono}`; g.fillStyle = '#9ee8ff'; g.textAlign = 'left';
    const rows = [['HULL', 'NOMINAL'], ['REACTOR', '100 %'], ['DRIVE', 'SAFE'], ['LYRA', 'ONLINE'], ['AIRLOCK', 'MATED']];
    rows.forEach(([a, b], i) => { g.fillStyle = '#6aa7bd'; g.fillText(a, 700, 120 + i * 34); g.fillStyle = i === 4 ? '#5dff9a' : '#d6f6ff'; g.fillText(b, 830, 120 + i * 34); });
    // traces
    for (let tr = 0; tr < 3; tr++) { g.strokeStyle = ['#4dffb8', '#2fd0ff', '#ffd36a'][tr]; g.lineWidth = 2.4; g.beginPath(); for (let x = 24; x < w - 24; x += 4) { const y = 340 + tr * 64 + Math.sin(x * 0.02 + t * (1.4 + tr * 0.5)) * 15 + Math.sin(x * 0.07 - t * 2.1) * 6; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = '#d6f6ff'; g.font = `700 30px ${FONT.mono}`; const tau = info.tau || 0; const hh = Math.floor(tau / 3600), mm = Math.floor((tau % 3600) / 60), ss = Math.floor(tau % 60);
    g.fillText(`MET ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, 24, h - 24);
    g.textAlign = 'right'; g.fillStyle = '#5dff9a'; g.fillText('ALL SYSTEMS GO', w - 24, h - 24); g.textAlign = 'left';
  });

  // GHOST — Eurydice's frozen image at the horizon (red)
  T.liveGhost = live(1024, 576, (g, w, h, t) => {
    g.fillStyle = '#0a0204'; g.fillRect(0, 0, w, h);
    hdr(g, w, '#ff4a3a', 'GHOST', 'HX-01 · EURYDICE');
    const cx = w * 0.34, cy = h * 0.57, pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    g.strokeStyle = 'rgba(255,70,50,0.18)'; g.lineWidth = 1; for (let r = 40; r < 330; r += 38) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); } g.beginPath(); g.moveTo(cx - 340, cy); g.lineTo(cx + 340, cy); g.moveTo(cx, cy - 340); g.lineTo(cx, cy + 340); g.stroke();
    g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, 110, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,150,90,0.9)'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, 111, 0, TAU); g.stroke();
    // the frozen image on the horizon
    const gx = cx + Math.cos(-0.6) * 112, gy = cy + Math.sin(-0.6) * 112;
    const gl = g.createRadialGradient(gx, gy, 2, gx, gy, 40 + pulse * 12); gl.addColorStop(0, `rgba(255,60,40,${0.8 + pulse * 0.2})`); gl.addColorStop(1, 'rgba(255,40,20,0)'); g.fillStyle = gl; g.fillRect(gx - 60, gy - 60, 120, 120);
    g.strokeStyle = '#ff4a3a'; g.lineWidth = 2; g.strokeRect(gx - 22, gy - 22, 44, 44); g.beginPath(); g.moveTo(gx - 34, gy); g.lineTo(gx - 22, gy); g.moveTo(gx + 22, gy); g.lineTo(gx + 34, gy); g.moveTo(gx, gy - 34); g.lineTo(gx, gy - 22); g.moveTo(gx, gy + 22); g.lineTo(gx, gy + 34); g.stroke();
    g.fillStyle = '#ff7a6a'; g.font = `600 22px ${FONT.mono}`; g.textAlign = 'left';
    const rx = w * 0.64;
    [['TRACK', 'LOCKED'], ['REDSHIFT z', '> 10^9'], ['BRIGHTNESS', '−0.0003 / yr'], ['FROZEN FOR', '11 y 03 m'], ['STATUS', 'NOT LOST']].forEach(([a, b], i) => { g.fillStyle = '#b8493d'; g.fillText(a, rx, 120 + i * 40); g.fillStyle = i === 4 ? '#ffd08a' : '#ffb0a0'; g.fillText(b, rx + 170, 120 + i * 40); });
    // decay curve
    g.strokeStyle = '#ff4a3a'; g.lineWidth = 2.4; g.beginPath(); for (let x = 0; x <= 360; x += 4) { const y = h - 70 - 90 * Math.exp(-x / 120); g.lineTo(rx + x * 0.9 - 10, y); } g.stroke();
    g.fillStyle = 'rgba(255,74,58,0.9)'; g.font = `700 24px ${FONT.disp}`; if (((t * 1.6) | 0) % 2 === 0) g.fillText('● TRACKING', 24, h - 26);
  });

  // lab: Sentinel (Charon) feed of the frozen image + lab data
  T.liveSentinel = live(1024, 576, (g, w, h, t) => {
    g.fillStyle = '#04070b'; g.fillRect(0, 0, w, h); hdr(g, w, '#7cf2c8', 'SENTINEL · CHARON', 'LIVE FEED');
    const R = G.rng(3); for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(255,255,255,${0.1 + R() * 0.6})`; g.fillRect(R() * w, 64 + R() * (h - 64), 2, 2); }
    const cx = w / 2, cy = h * 0.62; let gr = g.createRadialGradient(cx, cy, 20, cx, cy, 260); gr.addColorStop(0, 'rgba(255,150,60,0.32)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.fillRect(0, 54, w, h);
    g.strokeStyle = 'rgba(255,190,120,0.85)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 120, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    const gx = cx + 40, gy = cy - 119 + 8; const p = 0.6 + 0.4 * Math.sin(t * 1.7);
    g.fillStyle = `rgba(255,70,50,${0.55 + p * 0.4})`; g.beginPath(); g.arc(gx, gy, 5, 0, TAU); g.fill(); g.strokeStyle = '#ff6a5a'; g.lineWidth = 1.5; g.strokeRect(gx - 16, gy - 16, 32, 32);
    g.fillStyle = '#7cf2c8'; g.font = `600 20px ${FONT.mono}`; g.textAlign = 'left'; ['EXPOSURE 11 Y  03 M', 'IMAGE: EURYDICE (HX-01)', 'PHASE-LOCKED  ·  Δt → ∞'].forEach((s, i) => g.fillText(s, 24, h - 82 + i * 26));
  });

  T.live = [T.liveErebus, T.liveTelemetry, T.liveGhost, T.liveSentinel];
  return T;
}
