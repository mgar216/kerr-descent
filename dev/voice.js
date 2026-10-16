// Voice runtime test bench: a minimal fake `ctx` (real AudioContext, buses that mimic core's AudioEngine) around src/voice/voice.js.
//   /dev/voice.html                              → manifest + src/voice/lines.js
//   /dev/voice.html?lines=/voice/_test/lines.js  → also merges an extra LINES module (e.g. the generator's test file)
import { createVoice, buildFx } from '../src/voice/voice.js';
import { CAST, captionOf } from '../src/voice/cast.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

// ───────────────────────── fake AudioEngine (same bus topology as core.js) ─────────────────────────
function impulse(c, dur, decay) {
  const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < n; i++) { const t = i / n; lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = lp * Math.pow(1 - t, decay) * (i < 90 ? i / 90 : 1); } }
  return b;
}
function whiteBuf(c, sec) { const n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; } return b; }
/** opts.measure: master → destination directly (no compressor / reverb) so offline renders read the signal level at the master input. */
function makeAudio(c, opts = {}) {
  const A = { ctx: c, ready: true };
  const G = (v, dst) => { const g = c.createGain(); g.gain.value = v; if (dst) g.connect(dst); return g; };
  A.master = G(0.85);
  if (opts.measure) A.master.connect(c.destination);
  else { A.comp = c.createDynamicsCompressor(); A.comp.threshold.value = -14; A.comp.knee.value = 10; A.comp.ratio.value = 3.5; A.comp.attack.value = 0.004; A.comp.release.value = 0.25; A.master.connect(A.comp); A.comp.connect(c.destination); }
  A.sfx = G(1, A.master); A.radio = G(0.9, A.master);
  A.verb = c.createConvolver(); A.verb.buffer = impulse(c, opts.measure ? 0.1 : 3.2, 2.4);
  A.verbIn = G(1); A.verbIn.connect(A.verb); A.verb.connect(G(0.42, A.master));
  A.analyser = c.createAnalyser(); A.analyser.fftSize = 2048; A.radio.connect(A.analyser);
  A.white = whiteBuf(c, 4);
  A.bq = (type, f, q = 0.7) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  A.env = (node, t, a, peak, d, hold = 0) => { node.gain.cancelScheduledValues(t); node.gain.setValueAtTime(0.0001, t); node.gain.linearRampToValueAtTime(peak, t + a); node.gain.setValueAtTime(peak, t + a + hold); node.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d); };
  A.oneShotNoise = (filterType, f, q, peak, a, d, pan = 0, verb = 0.3, buf = A.white, rate = 1) => {
    const t = c.currentTime, s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const fl = A.bq(filterType, f, q), g = c.createGain(), p = c.createStereoPanner(); p.pan.value = pan;
    s.connect(fl); fl.connect(g); g.connect(p); p.connect(A.sfx); if (verb) { const vs = c.createGain(); vs.gain.value = verb; p.connect(vs); vs.connect(A.verbIn); }
    A.env(g, t, a, peak, d); s.start(t, Math.random() * 2); s.stop(t + a + d + 0.1);
  };
  A.tone = (f, dur, type = 'sine', peak = 0.08, bus = A.sfx, delay = 0, f2 = null) => {
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    o.connect(g); g.connect(bus); A.env(g, t, 0.006, peak, dur); o.start(t); o.stop(t + dur + 0.05);
  };
  A.quindar = (intro) => A.tone(intro ? 2525 : 2475, 0.25, 'sine', 0.085, A.radio);
  A.squelch = () => A.oneShotNoise('bandpass', 1900, 0.7, 0.22, 0.002, 0.16, 0, 0);
  A.rstatic = G(0, A.radio);
  { const s = c.createBufferSource(); s.buffer = A.white; s.loop = true; const bp = A.bq('bandpass', 1750, 0.8); s.connect(bp); bp.connect(A.rstatic); s.start(0, Math.random() * 2); }
  A.radioStatic = (on, level = 1) => A.rstatic.gain.setTargetAtTime(on ? 0.035 * level : 0, c.currentTime, on ? 0.05 : 0.15);
  A.crackle = () => A.oneShotNoise('highpass', 3000, 0.5, 0.08 + Math.random() * 0.1, 0.001, 0.03, Math.random() - 0.5, 0);
  A.resume = () => { if (c.state !== 'running' && c.resume) return c.resume(); };
  return A;
}

// ───────────────────────── fake ctx ─────────────────────────
const logEl = $('log'), typers = [];
const outEl = $('out');
const out = (s) => { outEl.textContent += s + '\n'; outEl.scrollTop = outEl.scrollHeight; };
const evlog = [];
const ctx = {
  audio: { ready: false, ctx: null },                              // replaced by START AUDIO
  settings: { voice: true, mute: false, cmdrVoice: 'A' },
  obs: { gRx: 1 },
  modes: { current: () => $('mode').value },
  bus: { emit: (e, p) => { evlog.push([e, p]); out(`bus ${e} ${JSON.stringify(p)}`); } },
  ui: {
    log(cls, who, text, meta, o) {
      const el = document.createElement('div'); el.className = 'msg ' + cls;
      el.innerHTML = `<span class="who"></span><span class="tx"></span>${meta ? '<span class="meta"></span>' : ''}`;
      el.querySelector('.who').textContent = who; if (meta) el.querySelector('.meta').textContent = meta;
      logEl.appendChild(el); typers.push({ el: el.querySelector('.tx'), text, i: 0, cps: (o && o.cps) || 40 });
      while (logEl.children.length > 7) logEl.removeChild(logEl.firstChild);
      ctx.ui.logged.push({ cls, who, text, meta, cps: o && o.cps });
    },
    logged: [],
    subtitle(who, text, ms) { const s = $('subtitle'); s.innerHTML = '<b></b><span></span>'; s.querySelector('b').textContent = who; s.querySelector('span').textContent = text; s.classList.add('show'); clearTimeout(s._t); s._t = setTimeout(() => s.classList.remove('show'), ms); ctx.ui.subs.push({ who, text, ms }); },
    subs: [],
  },
};

let A = null, voice = null;
async function startAudio() {
  if (A) { await A.resume(); return A; }
  const c = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  A = makeAudio(c); ctx.audio = A; await A.resume();
  $('start').textContent = 'AUDIO ' + c.state.toUpperCase(); $('start').classList.add('on');
  return A;
}

// ───────────────────────── list + controls ─────────────────────────
function opts(extra = {}) { const o = { priority: $('prio').value, onEnd: (i) => out('end ' + JSON.stringify(i)), ...extra }; if (!$('dop').checked) o.doppler = false; return o; }
const play = (id, extra) => { out('say ' + id); return voice.say(id, opts(extra)); };
let rowsData = [];
function buildRows() {
  const ids = new Set(Object.keys(voice.lines));
  for (const k of Object.keys(voice.manifest.lines)) ids.add(k.replace(/@[AB]$/, ''));
  rowsData = [...ids].sort().map((id) => { const i = voice.info(id); return { id, who: i.who || '?', fx: i.profile ? i.profile.fx : '?', dur: i.entry ? i.entry.dur : null, text: i.line ? captionOf(i.line.text) : '(no text — manifest only)' }; });
  const sel = $('whoSel'); const whos = [...new Set(rowsData.map((r) => r.who))].sort(); sel.innerHTML = '<option value="">all</option>' + whos.map((w) => `<option>${w}</option>`).join('');
  renderRows();
}
function renderRows() {
  const f = $('filter').value.toLowerCase(), w = $('whoSel').value, tb = $('rows'); tb.innerHTML = '';
  for (const r of rowsData) {
    if (w && r.who !== w) continue;
    if (f && !(`${r.id} ${r.who} ${r.text}`.toLowerCase().includes(f))) continue;
    const tr = document.createElement('tr'), has = voice.hasAudio(r.id);
    tr.innerHTML = `<td class="id"></td><td></td><td><span class="tag fx-${r.fx}"></span></td><td class="${has ? '' : 'na'}"></td><td><button>▶</button></td><td class="tx"></td>`;
    tr.children[0].textContent = r.id; tr.children[1].textContent = r.who; tr.querySelector('.tag').textContent = r.fx;
    tr.children[3].textContent = has ? r.dur.toFixed(1) + 's' : 'no audio'; tr.querySelector('button').onclick = async () => { await startAudio(); play(r.id); }; tr.children[5].textContent = r.text;
    tb.appendChild(tr);
  }
}
const withAudio = () => rowsData.filter((r) => voice.hasAudio(r.id)).map((r) => r.id);

function wire() {
  $('start').onclick = startAudio;
  $('stop').onclick = () => voice.stop();
  $('dump').onclick = () => out(JSON.stringify(voice.state));
  $('grx').oninput = (e) => { ctx.obs.gRx = +e.target.value; $('gv').textContent = (+e.target.value).toFixed(2); };
  $('cmdr').onchange = (e) => { ctx.settings.cmdrVoice = e.target.value; renderRows(); };
  $('mute').onchange = (e) => { ctx.settings.mute = e.target.checked; };
  $('voiceOn').onchange = (e) => { ctx.settings.voice = e.target.checked; };
  $('filter').oninput = renderRows; $('whoSel').onchange = renderRows;
  $('mode').onchange = () => { $('logmode').textContent = '· mode ' + $('mode').value; };
  $('q3').onclick = async () => { await startAudio(); withAudio().slice(0, 3).forEach((id) => play(id)); };
  $('qlow').onclick = async () => { await startAudio(); const ids = withAudio(); play(ids[0]); play(ids[1 % ids.length]); play(ids[2 % ids.length], { priority: 'low' }); };
  $('qhigh').onclick = async () => { await startAudio(); const ids = withAudio(); play(ids[0]); setTimeout(() => play(ids[1 % ids.length], { priority: 'high' }), 1500); };
  $('preload').onclick = async () => { await startAudio(); const t = performance.now(); const n = await voice.preload(['*']); out(`preload: ${n} buffers in ${(performance.now() - t).toFixed(0)} ms (cache ${voice.state.cached})`); };
  $('calib').onclick = async () => { await startAudio(); out(await calibrate()); };
  $('speech').onclick = () => { voice.sayText('LYRA', '[calm] Commander, this is the Web Speech fallback. No audio file exists for this sentence.', opts()); voice.sayText('CAPCOM', 'Orpheus, Halcyon. Fallback voice check, radio style.', opts()); };
  $('logmode').textContent = '· mode ' + $('mode').value;
}

// ───────────────────────── scope + status ─────────────────────────
const wave = $('wave'), wg = wave.getContext('2d');
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (voice) voice.update(dt);
  for (let i = typers.length - 1; i >= 0; i--) { const t = typers[i]; t.i = Math.min(t.text.length, t.i + t.cps * dt); t.el.textContent = t.text.slice(0, Math.floor(t.i)); if (t.i >= t.text.length) typers.splice(i, 1); }
  wg.clearRect(0, 0, wave.width, wave.height);
  if (A && A.analyser) {
    const d = new Float32Array(A.analyser.fftSize); A.analyser.getFloatTimeDomainData(d);
    let s = 0; for (const x of d) s += x * x; const rms = Math.sqrt(s / d.length);
    wg.strokeStyle = '#86ecff'; wg.lineWidth = 2; wg.beginPath();
    for (let i = 0; i < d.length; i += 2) { const x = (i / d.length) * wave.width, y = wave.height / 2 - d[i] * wave.height * 1.6; i ? wg.lineTo(x, y) : wg.moveTo(x, y); } wg.stroke();
    $('rms').textContent = 'RMS ' + (rms > 1e-5 ? (20 * Math.log10(rms)).toFixed(1) + ' dBFS' : '—'); $('clk').textContent = A.ctx.state + ' · t ' + A.ctx.currentTime.toFixed(1);
  }
  if (voice) { const st = voice.state; $('status').innerHTML = `busy <b>${voice.busy}</b>  curWho <b>${voice.curWho}</b>\nnow <b>${st.cur ? `${st.cur.id} [${st.cur.state}/${st.cur.mode}/${st.cur.fx}] rate ${st.cur.rate.toFixed(2)} ${st.cur.t.toFixed(1)}/${st.cur.playDur.toFixed(1)}s` : '—'}</b>\nqueue <b>${st.queue.map((q) => q.id + ':' + q.priority[0]).join(', ') || '—'}</b>\ncache <b>${st.cached}</b> buffers  failed <b>${st.failed.length}</b>`; }
  requestAnimationFrame(frame);
}

// ───────────────────────── offline calibration (K-weighted level of each fx vs the dry file) ─────────────────────────
function kWeight(x, fs) {
  const bq = (b0, b1, b2, a1, a2) => { let z1 = 0, z2 = 0; for (let i = 0; i < x.length; i++) { const v = x[i], y = b0 * v + z1; z1 = b1 * v - a1 * y + z2; z2 = b2 * v - a2 * y; x[i] = y; } };
  { const f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196, K = Math.tan(Math.PI * f0 / fs), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416), a0 = 1 + K / Q + K * K;
    bq((Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0); }
  { const f0 = 38.13547087602444, Q = 0.5003270373238773, K = Math.tan(Math.PI * f0 / fs), a0 = 1 + K / Q + K * K; bq(1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0); }
  return x;
}
const lufsOf = (x, fs) => { const k = kWeight(Float32Array.from(x), fs); let s = 0; for (const v of k) s += v * v; return -0.691 + 10 * Math.log10(s / k.length + 1e-12); };
async function renderFx(buf, fx) {
  const off = new OfflineAudioContext(2, Math.ceil((buf.duration + 0.6) * 44100), 44100), a = makeAudio(off, { measure: true });
  const src = off.createBufferSource(); src.buffer = buf;
  if (fx === 'dry') { const g = off.createGain(); g.gain.value = 0.85; src.connect(g); g.connect(off.destination); }      // = sfx(1) × master(0.85)
  else { const ch = buildFx(fx, off, a, { gain: 1 }); src.connect(ch.input); if (ch.attach) ch.attach(src); }
  src.start(0);
  const r = await off.startRendering(), l = r.getChannelData(0), rr = r.getChannelData(1), m = new Float32Array(l.length);
  let peak = 0; for (let i = 0; i < l.length; i++) { m[i] = (l[i] + rr[i]) * 0.5; peak = Math.max(peak, Math.abs(l[i]), Math.abs(rr[i])); }
  return { lufs: lufsOf(m, 44100), peak: 20 * Math.log10(peak + 1e-9) };
}
async function calibrate() {
  const ids = withAudio().slice(0, 40), bufs = [];
  const seen = new Set();
  for (const id of ids) { const i = voice.info(id); if (!i.entry || seen.has(i.who)) continue; seen.add(i.who); await voice.preload([id]); const r = await fetch(new URL('../voice/' + i.entry.file, import.meta.url)); bufs.push([id, i.who, await A.ctx.decodeAudioData(await r.arrayBuffer())]); if (bufs.length >= 5) break; }
  if (!bufs.length) return 'calibrate: no audio lines available';
  const fxs = ['radio', 'cabin', 'log', 'person', 'suit', 'pa'], lines = ['K-weighted level of each fx chain vs dry (×0.85 master), mean over ' + bufs.map((b) => b[0]).join(', ')];
  const dry = []; for (const [, , b] of bufs) dry.push(await renderFx(b, 'dry'));
  lines.push(`dry   : ${(dry.reduce((s, d) => s + d.lufs, 0) / dry.length).toFixed(2)} LUFS  peak ${Math.max(...dry.map((d) => d.peak)).toFixed(1)} dBFS`);
  const sug = {};
  for (const fx of fxs) {
    const rs = []; for (const [, , b] of bufs) rs.push(await renderFx(b, fx));
    const dl = rs.map((r, i) => r.lufs - dry[i].lufs), mean = dl.reduce((s, v) => s + v, 0) / dl.length, pk = Math.max(...rs.map((r) => r.peak));
    sug[fx] = Math.pow(10, -mean / 20);
    lines.push(`${fx.padEnd(6)}: ${mean >= 0 ? '+' : ''}${mean.toFixed(2)} LU vs dry (per line ${dl.map((v) => v.toFixed(1)).join(' ')})  peak ${pk.toFixed(1)} dBFS  → makeup ×${sug[fx].toFixed(3)}`);
  }
  window.__calib = sug;
  return lines.join('\n');
}

// ───────────────────────── boot ─────────────────────────
(async () => {
  const extra = params.get('lines');
  const o = {};
  if (extra) { try { const m = await import(/* @vite-ignore */ new URL(extra, location.href).href); o.lines = m.LINES || m.default || {}; out(`extra lines: ${extra} (${Object.keys(o.lines).length})`); } catch (e) { out('extra lines FAILED: ' + e.message); } }
  voice = createVoice(ctx, o);
  await voice.ready;
  out(`manifest: ${Object.keys(voice.manifest.lines).length} files · lines: ${Object.keys(voice.lines).length} · cast: ${Object.keys(CAST).length}`);
  wire(); buildRows();
  window.__vh = { voice, ctx, play, startAudio, calibrate, get audio() { return A; }, evlog, buildRows, renderFx };
  requestAnimationFrame(frame);
})();
