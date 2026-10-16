#!/usr/bin/env node
/*
 * ORPHEUS voice generator — ElevenLabs text-to-speech batch for every line in src/voice/lines.js.
 *
 *   node tools/voicegen.mjs [flags]
 *
 *   --dry               no TTS calls, nothing written: list new/changed lines, chars per speaker, budget check
 *                       (the budget check is one free GET /v1/user/subscription; it costs no credits)
 *   --only=<prefix>[,…] only line ids starting with a prefix (CMDR lines match with or without @A/@B)
 *   --who=<WHO>[,…]     only these speakers (CMDR = both commander voices)
 *   --limit=N           process at most N pending lines (new / changed / reprocess)
 *   --force             regenerate selected lines even if up to date (spends credits)
 *   --reprocess         re-run ffmpeg on selected lines from the raw cache (free; use after changing post settings)
 *   --lines=<path>      alternative lines module (default src/voice/lines.js); output still goes to voice/
 *   --force-budget      skip the "pending chars must be < remaining credits − 5000" refusal
 *   --no-post           skip ffmpeg (store the API mp3 as-is)
 *   --concurrency=N     parallel requests (default 3)
 *   --list              with --dry: print every pending line instead of the first 30
 *   --prune             delete manifest entries / files / raw cache not referenced by the full line set
 *
 * Output: voice/<safe-id>.mp3 + voice/manifest.json { version, generated, lines: { id: { file, hash, dur, chars, who, … } } }.
 * Every API response is also kept in voice/_raw/<hash>.mp3 (content-addressed) so post-processing can be redone for free.
 *
 * API key: env ELEVENLABS_API_KEY, else `reg query HKCU\Environment /v ELEVENLABS_API_KEY`. The key is never printed.
 * Dev override for testing against a mock server: VOICEGEN_API_BASE=http://127.0.0.1:PORT
 * Exit codes: 0 ok · 1 some lines failed · 2 refused (budget / auth / quota) or bad input.
 * Node 18 built-ins only. ffmpeg + ffprobe on PATH enable trimming + loudness normalisation.
 */
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Node 18 prints an ExperimentalWarning on the first fetch(); drop just that one.
const _emitWarning = process.emitWarning;
process.emitWarning = (w, ...rest) => { const m = typeof w === 'string' ? w : (w && w.message) || ''; if (/experimental/i.test(m) && /fetch/i.test(m)) return; return _emitWarning.call(process, w, ...rest); };

// ─────────────────────────────── config ───────────────────────────────
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VOICE_DIR = join(ROOT, 'voice');
const RAW_DIR = join(VOICE_DIR, '_raw');
const MANIFEST = join(VOICE_DIR, 'manifest.json');
const DEFAULT_LINES = join(ROOT, 'src', 'voice', 'lines.js');
const API = (process.env.VOICEGEN_API_BASE || 'https://api.elevenlabs.io').replace(/\/+$/, '');
const OUTPUT_FORMAT = 'mp3_44100_128';
const SAFETY_CHARS = 5000;           // refuse when pending > remaining − this
const MAX_RETRIES = 6;               // per request, for 429 / 5xx / network
const REQ_TIMEOUT_MS = 180000;
const MAX_HARD_FAILS = 5;            // consecutive non-retryable failures before we assume something systematic is wrong

// Post-processing (ffmpeg). Changing anything here changes POST_ID → lines are re-processed from the raw cache (free).
const POST = {
  // leading silence → reverse → leading silence (= trailing) → fade → reverse; keeps ~60 ms of pad, short fades kill edge clicks
  trim: 'silenceremove=start_periods=1:start_duration=0.015:start_threshold=-48dB:start_silence=0.06:detection=peak,'
      + 'areverse,silenceremove=start_periods=1:start_duration=0.015:start_threshold=-48dB:start_silence=0.06:detection=peak,'
      + 'afade=t=in:d=0.008,areverse,afade=t=in:d=0.006',
  I: -18, TP: -1.5,                  // integrated loudness (LUFS) / true-peak ceiling (dBTP)
  rate: 44100, channels: 1, quality: 3,   // libmp3lame VBR -q:a 3
  v: 2,                              // bump when the algorithm below changes
};
const POST_ID = sha1(JSON.stringify(POST)).slice(0, 8);

// ─────────────────────────────── args ───────────────────────────────
const args = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([\w-]+)(?:=(.*))?$/.exec(a);
  if (!m) { console.error(`Unknown argument: ${a}`); process.exit(2); }
  args[m[1]] = m[2] === undefined ? true : m[2];
}
if (args.help || args.h) { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n/, '').replace(/^\/\*\s?|^ \* ?/gm, '')); process.exit(0); }
const csv = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
const ONLY = csv(args.only), WHO = csv(args.who).map((s) => s.toUpperCase());
const LIMIT = args.limit === undefined ? Infinity : Math.max(0, parseInt(args.limit, 10) || 0);
const CONCURRENCY = Math.max(1, Math.min(5, parseInt(args.concurrency, 10) || 3));
const DRY = !!args.dry, FORCE = !!args.force, REPROCESS = !!args.reprocess, NO_POST = !!args['no-post'], FORCE_BUDGET = !!args['force-budget'];

// ─────────────────────────────── utils ───────────────────────────────
function sha1(s) { return createHash('sha1').update(s).digest('hex'); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (s, n) => String(s).padEnd(n);
const num = (n) => Number(n).toLocaleString('en-US');
const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
let KEY = '';
const redact = (s) => { s = String(s == null ? '' : s); return KEY ? s.split(KEY).join('***') : s; };
function die(msg, code = 2) { console.error('\n' + redact(msg)); process.exit(code); }

function writeFileAtomic(path, data) {
  const tmp = path + '.part';
  writeFileSync(tmp, data);
  for (let i = 0; ; i++) {
    try { renameSync(tmp, path); return; }
    catch (e) { if (i >= 8) { try { unlinkSync(tmp); } catch {} throw e; } Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 40 * (i + 1)); }   // Windows: AV / dev server may hold the target briefly
  }
}

function getKey() {
  let k = (process.env.ELEVENLABS_API_KEY || '').trim();
  if (!k && process.platform === 'win32') {
    try {
      const out = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', 'ELEVENLABS_API_KEY'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const m = /ELEVENLABS_API_KEY\s+REG_(?:EXPAND_)?SZ\s+(.+?)\s*$/m.exec(out);
      if (m) k = m[1].trim();
    } catch { /* not set */ }
  }
  return k;
}

// ─────────────────────────────── ElevenLabs HTTP ───────────────────────────────
class Fatal extends Error {}        // abort the whole run (auth, quota)
class JobError extends Error {}     // this line failed, others may continue

async function readErr(res) {
  let text = '';
  try { text = await res.text(); } catch { /* ignore */ }
  let code = '', message = text.slice(0, 300);
  try {
    const j = JSON.parse(text); const d = j.detail !== undefined ? j.detail : j;
    if (typeof d === 'string') message = d;
    else if (Array.isArray(d)) message = d.map((x) => x.msg || JSON.stringify(x)).join('; ');
    else if (d && typeof d === 'object') { code = String(d.status || d.code || ''); message = d.message || message; }
  } catch { /* not json */ }
  return { status: res.status, code, message: redact(message).slice(0, 300), retryAfter: Number(res.headers.get('retry-after')) || 0 };
}

async function getSubscription() {
  const res = await fetch(`${API}/v1/user/subscription`, { headers: { 'xi-api-key': KEY }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) { const e = await readErr(res); throw new Fatal(`GET /v1/user/subscription → HTTP ${e.status} ${e.code} ${e.message}`.trim()); }
  const j = await res.json();
  return { used: j.character_count, limit: j.character_limit, remaining: j.character_limit - j.character_count, tier: j.tier, resetUnix: j.next_character_count_reset_unix };
}

function looksLikeMp3(b) { return b.length > 800 && ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)); }

let aborted = false;
async function synth(job, tag) {
  const url = `${API}/v1/text-to-speech/${job.voiceId}?output_format=${OUTPUT_FORMAT}`;
  const body = JSON.stringify({ text: job.text, model_id: job.model, voice_settings: { stability: job.settings.stability, similarity_boost: job.settings.similarity_boost } });
  const wait = async (attempt, why, retryAfter = 0) => {
    const base = [1.5, 3, 6, 12, 24, 45][Math.min(attempt, 5)];
    const s = Math.min(120, Math.max(retryAfter, base) * (1 + Math.random() * 0.25));
    console.log(`  retry ${attempt + 1}/${MAX_RETRIES} in ${s.toFixed(1)}s (${why}) ${tag}`);
    await sleep(s * 1000);
  };
  for (let attempt = 0; ; attempt++) {
    if (aborted) throw new JobError('aborted');
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body, signal: AbortSignal.timeout(REQ_TIMEOUT_MS) });
    } catch (e) {
      const why = redact((e.cause && (e.cause.code || e.cause.message)) || e.message);
      if (attempt >= MAX_RETRIES) throw new JobError(`network error: ${why}`);
      await wait(attempt, `network: ${why}`); continue;
    }
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (!looksLikeMp3(buf)) throw new JobError(`response is not an mp3 (${buf.length} bytes)`);
      const cost = Number(res.headers.get('character-cost'));                     // credits actually billed for this request (eleven_v4 ≈ 0.44 per char)
      return { buf, cost: Number.isFinite(cost) ? cost : null };
    }
    const e = await readErr(res);
    if (e.status === 401 || e.status === 402 || /quota|payment|invalid_api_key|needs_authorization/i.test(e.code)) {
      throw new Fatal(/quota/i.test(e.code + e.message) ? `ElevenLabs quota exceeded — ${e.message}` : `ElevenLabs rejected the request (HTTP ${e.status} ${e.code}) — ${e.message}`);
    }
    if (e.status === 429 || e.status >= 500) {
      if (attempt >= MAX_RETRIES) throw new JobError(`HTTP ${e.status} ${e.code} after ${MAX_RETRIES} retries: ${e.message}`);
      await wait(attempt, `HTTP ${e.status} ${e.code}`.trim(), e.retryAfter); continue;
    }
    throw new JobError(`HTTP ${e.status} ${e.code} ${e.message}`.trim());
  }
}

// ─────────────────────────────── ffmpeg ───────────────────────────────
function run(cmd, a, timeoutMs = 120000) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, a, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const to = setTimeout(() => { p.kill('SIGKILL'); rej(new Error(`${cmd} timed out`)); }, timeoutMs);
    p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => { clearTimeout(to); rej(e); });
    p.on('close', (code) => { clearTimeout(to); code === 0 ? res({ out, err }) : rej(new Error(`${cmd} exited ${code}: ${err.trim().split('\n').slice(-4).join(' | ').slice(0, 400)}`)); });
  });
}
function parseLoudnorm(stderr) {
  const m = /\{\s*"input_i"[\s\S]*?\}/.exec(stderr);
  if (!m) throw new Error('loudnorm printed no measurement');
  const j = JSON.parse(m[0]);
  return { i: parseFloat(j.input_i), tp: parseFloat(j.input_tp), lra: parseFloat(j.input_lra), thresh: parseFloat(j.input_thresh), offset: parseFloat(j.target_offset), type: j.normalization_type };
}
const LN = `I=${POST.I}:TP=${POST.TP}:LRA=11`;      // targets are irrelevant for analysis (we only read input_i / input_tp)
const FF = ['-hide_banner', '-nostdin', '-nostats', '-vn'];

async function ffmpegOk() {
  try { await run('ffmpeg', ['-version'], 15000); await run('ffprobe', ['-version'], 15000); return true; } catch { return false; }
}
async function probeDuration(file) {
  const { out } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], 30000);
  const d = parseFloat(out.trim());
  if (!Number.isFinite(d)) throw new Error('ffprobe gave no duration');
  return d;
}
async function measure(file, pre = '') {
  const { err } = await run('ffmpeg', [...FF, '-i', file, '-af', `${pre}loudnorm=${LN}:print_format=json`, '-f', 'null', '-']);
  return parseLoudnorm(err);
}
/**
 * raw API mp3 → trimmed, loudness-normalised mono 44.1 kHz VBR mp3. Returns { dur, lufs, tp } of the encoded file.
 * The gain is computed from a BS.1770 measurement of the trimmed audio (loudnorm's own two-pass linear mode is loose on
 * short clips); a limiter engages only when that gain would break the peak ceiling. The ENCODED file is then measured
 * and corrected (≤ 2 extra encodes): loudness off by > 0.1 LU → gain nudged (the lossy encode alone costs ~0.2 LU);
 * true peak above target after encoding → limiter ceiling lowered. True peak wins over loudness.
 */
async function postProcess(rawPath, outPath) {
  const m = await measure(rawPath, POST.trim + ',');
  if (!Number.isFinite(m.tp) || m.tp < -90) throw new Error('clip is silent after trimming');
  let gain = Number.isFinite(m.i) && m.i > -70 ? POST.I - m.i : -3 - m.tp;     // clip too short for BS.1770 gating → peak-normalise to −3 dBFS
  let ceil = POST.TP - 0.5;                                                    // sample-peak ceiling: room for inter-sample + encoder overshoot
  const encode = async () => {
    const lim = m.tp + gain > ceil ? `,alimiter=limit=${(10 ** (ceil / 20)).toFixed(4)}:attack=2:release=40:level=0` : '';
    const tmp = outPath + '.part';
    await run('ffmpeg', ['-y', ...FF, '-i', rawPath, '-af', `${POST.trim},volume=${gain.toFixed(2)}dB${lim},aresample=${POST.rate}`, '-ac', String(POST.channels), '-ar', String(POST.rate),
      '-c:a', 'libmp3lame', '-q:a', String(POST.quality), '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', '-f', 'mp3', tmp]);
    for (let i = 0; ; i++) { try { renameSync(tmp, outPath); break; } catch (e) { if (i >= 8) throw e; await sleep(50 * (i + 1)); } }
    return measure(outPath).catch(() => null);
  };
  let f = null;
  for (let it = 0; it < 3; it++) {
    f = await encode();
    if (!f || !Number.isFinite(f.i) || !Number.isFinite(f.tp)) break;
    const dI = POST.I - f.i, over = f.tp - POST.TP;
    if (Math.abs(dI) <= 0.1 && over <= 0.05) break;
    if (over > 0.05) ceil = Math.min(ceil, m.tp + gain) - over - 0.15;           // overshoot after the encode → tighter ceiling, keep gain
    else if (Math.abs(dI) < 3) gain += dI;                                       // loudness off, peaks fine → nudge gain
  }
  const dur = await probeDuration(outPath);
  return { dur, lufs: f && Number.isFinite(f.i) ? Math.round(f.i * 10) / 10 : null, tp: f && Number.isFinite(f.tp) ? Math.round(f.tp * 10) / 10 : null };
}
/** No ffmpeg: keep the API mp3 as-is, estimate the duration from the first frame header (CBR 128). */
function rawCopy(rawPath, outPath) {
  const b = readFileSync(rawPath);
  let o = 0; if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) o = 10 + ((b[6] & 0x7f) << 21 | (b[7] & 0x7f) << 14 | (b[8] & 0x7f) << 7 | (b[9] & 0x7f));
  const kbpsTable = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  let kbps = 128; if (b[o] === 0xff && (b[o + 1] & 0xe0) === 0xe0) kbps = kbpsTable[b[o + 2] >> 4] || 128;
  copyFileSync(rawPath, outPath);
  return { dur: Math.round(((b.length - o) * 8 / (kbps * 1000)) * 1000) / 1000, lufs: null, tp: null };
}

// ─────────────────────────────── lines + cast ───────────────────────────────
async function importFile(p) { return import(pathToFileURL(p).href + '?t=' + Date.now()); }
function resolveLinesPath() {
  if (!args.lines || args.lines === true) return DEFAULT_LINES;
  for (const c of [resolve(process.cwd(), args.lines), resolve(ROOT, args.lines)]) if (existsSync(c)) return c;
  die(`--lines file not found: ${args.lines}`);
}
const rel = (p) => p.startsWith(ROOT) ? p.slice(ROOT.length + 1).replace(/\\/g, '/') : p;

function safeName(key) { return key.replace(/@/g, '-').replace(/\./g, '_').replace(/[^A-Za-z0-9_-]/g, '_'); }

function lint(text, id) {
  const w = [];
  if (/<[^>]+>/.test(text)) w.push('contains <…> (SSML is not supported by eleven_v4)');
  const o = (text.match(/\[/g) || []).length, c = (text.match(/\]/g) || []).length;
  if (o !== c) w.push('unbalanced [ ] audio tag');
  if (text.length > 1200) w.push(`long line (${text.length} chars)`);
  return w.map((x) => `${id}: ${x}`);
}

function buildJobs(LINES, CAST, castFor, CMDR_VARIANTS) {
  const jobs = [], errors = [], warnings = [], names = new Map();
  for (const [id, line] of Object.entries(LINES)) {
    if (!line || typeof line !== 'object') { warnings.push(`${id}: entry is not an object — skipped`); continue; }
    const text = typeof line.text === 'string' ? line.text.trim() : '';
    if (!text) { errors.push(`${id}: empty or missing text`); continue; }
    if (typeof line.who !== 'string' || !castFor(line.who)) { errors.push(`${id}: unknown speaker "${line.who}" (cast: ${Object.keys(CAST).join(', ')}, CMDR)`); continue; }
    if (line.who !== 'CMDR' && !CAST[line.who]) warnings.push(`${id}: speaker alias "${line.who}" — prefer the canonical name`);
    warnings.push(...lint(text, id));
    const variants = line.who === 'CMDR' ? CMDR_VARIANTS : [null];
    for (const v of variants) {
      const key = v ? `${id}@${v}` : id;
      const c = castFor(line.who, v || 'A');
      const settings = { stability: c.settings.stability, similarity_boost: c.settings.similarity_boost };
      const hash = sha1(`${text}|${c.voiceId}|${c.model}|${JSON.stringify(settings)}`);
      let file = safeName(key) + '.mp3';
      const low = file.toLowerCase();
      if (names.has(low) && names.get(low) !== key) file = safeName(key) + '-' + hash.slice(0, 6) + '.mp3';
      names.set(file.toLowerCase(), key);
      jobs.push({ key, id, variant: v, who: line.who, text, chars: [...text].length, voiceId: c.voiceId, model: c.model, settings, hash, file, castName: c.name });
    }
  }
  return { jobs, errors, warnings };
}

// ─────────────────────────────── manifest ───────────────────────────────
function loadManifest() {
  if (!existsSync(MANIFEST)) return { version: 1, generated: null, lines: {} };
  try {
    const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    if (!m || typeof m !== 'object' || typeof m.lines !== 'object') throw new Error('missing "lines"');
    return { version: 1, generated: m.generated || null, lines: m.lines };
  } catch (e) { die(`voice/manifest.json is unreadable (${e.message}). Fix or delete it — refusing to overwrite.`); }
}
let manifest, dirty = false, saveTimer = null;
function flushManifest() {
  clearTimeout(saveTimer); saveTimer = null;
  if (!dirty) return;
  dirty = false;
  manifest.generated = new Date().toISOString();
  const rows = Object.keys(manifest.lines).sort().map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(manifest.lines[k])}`);
  writeFileAtomic(MANIFEST, `{\n "version": 1,\n "generated": ${JSON.stringify(manifest.generated)},\n "lines": {\n${rows.join(',\n')}${rows.length ? '\n' : ''} }\n}\n`);
}
function saveSoon() { dirty = true; if (!saveTimer) saveTimer = setTimeout(flushManifest, 400); }

// ─────────────────────────────── main ───────────────────────────────
const rawPath = (job) => join(RAW_DIR, job.hash + '.mp3');
const inScope = (job) => (!ONLY.length || ONLY.some((p) => job.id.startsWith(p) || job.key.startsWith(p))) && (!WHO.length || WHO.includes(job.who.toUpperCase()));

function classify(job, hasFfmpeg) {
  const e = manifest.lines[job.key];
  const finalOk = !!(e && e.hash === job.hash && existsSync(join(VOICE_DIR, e.file)));
  const rawOk = existsSync(rawPath(job));
  const postStale = finalOk && !NO_POST && hasFfmpeg && e.post !== POST_ID;
  if (FORCE) return { status: 'gen', reason: 'forced' };
  if (finalOk && !postStale && !(REPROCESS && rawOk)) return { status: 'ok' };
  if (finalOk && !rawOk) return { status: 'ok', note: 'stale-post-no-raw' };           // older post-process, nothing to redo it from — keep
  if (rawOk) return { status: 'post', reason: finalOk ? (REPROCESS ? 'reprocess' : 'post-process changed') : 'raw cached' };
  return { status: 'gen', reason: !e ? 'new' : e.hash !== job.hash ? 'changed' : 'file missing' };
}

async function main() {
  const t0 = Date.now();
  const linesPath = resolveLinesPath();
  if (!existsSync(linesPath)) die(`Lines file not found: ${rel(linesPath)}\n(WRITER writes src/voice/lines.js — use --lines=<path> for another file.)`);
  const castMod = await importFile(join(ROOT, 'src', 'voice', 'cast.js'));
  const linesMod = await importFile(linesPath);
  const LINES = linesMod.LINES || linesMod.default;
  if (!LINES || typeof LINES !== 'object') die(`${rel(linesPath)} must export LINES = { id: { who, text } }`);

  const { jobs: all, errors, warnings } = buildJobs(LINES, castMod.CAST, castMod.castFor, castMod.CMDR_VARIANTS);
  if (errors.length) die(`${errors.length} invalid line(s) in ${rel(linesPath)} — nothing generated:\n  ` + errors.slice(0, 30).join('\n  ') + (errors.length > 30 ? `\n  … ${errors.length - 30} more` : ''), 2);
  if (!all.length) die(`${rel(linesPath)} contains no lines.`);

  manifest = loadManifest();
  const hasFfmpeg = NO_POST ? false : await ffmpegOk();
  if (!NO_POST && !hasFfmpeg) console.log('! ffmpeg/ffprobe not found on PATH — storing API audio as-is (no trim / loudness normalisation).');

  // ── scope, status, selection
  const scope = all.filter(inScope);
  for (const j of scope) Object.assign(j, classify(j, hasFfmpeg));
  const pending = scope.filter((j) => j.status !== 'ok');
  const work = pending.slice(0, LIMIT);
  const deferred = pending.length - work.length;
  // identical (text, voice, settings) lines share ONE API call: the first is generated, the others re-use its raw audio
  const firstOf = new Map();
  for (const j of work) if (j.status === 'gen') { const f = firstOf.get(j.hash); if (f) { j.status = 'post'; j.reason = `same audio as ${f.key}`; j.dupOf = f; } else firstOf.set(j.hash, j); }
  const gen = work.filter((j) => j.status === 'gen'), post = work.filter((j) => j.status === 'post');
  const pendingChars = gen.reduce((s, j) => s + j.chars, 0);
  const stalePost = scope.filter((j) => j.note === 'stale-post-no-raw').length;

  console.log(`voicegen${DRY ? ' --dry' : ''} · ${rel(linesPath)} · ${Object.keys(LINES).length} lines → ${all.length} voice files${scope.length !== all.length ? ` (${scope.length} in scope)` : ''}`);
  if (warnings.length) console.log(`lint: ${warnings.length} warning(s)\n  ` + warnings.slice(0, 15).join('\n  ') + (warnings.length > 15 ? `\n  … ${warnings.length - 15} more` : ''));

  // ── report
  const byWho = {};
  for (const j of scope) { const w = (byWho[j.who] ||= { lines: 0, chars: 0, pLines: 0, pChars: 0 }); w.lines++; w.chars += j.chars; if (j.status === 'gen' && work.includes(j)) { w.pLines++; w.pChars += j.chars; } }
  const listWork = DRY ? work : [];
  if (DRY && listWork.length) {
    const cap = args.list ? Infinity : listWork.length <= 80 ? Infinity : 30;
    console.log(`\npending (${work.length}):`);
    for (const j of listWork.slice(0, cap)) console.log(`  ${pad(j.status === 'post' ? 'POST' : j.reason === 'new' ? 'NEW' : j.reason === 'forced' ? 'FORCE' : j.reason === 'file missing' ? 'MISS' : 'CHG', 5)} ${pad(j.who, 9)} ${pad(j.key, 40)} ${String(j.chars).padStart(5)} ch  ${j.status === 'post' ? '(' + j.reason + ')' : ''}`);
    if (listWork.length > cap) console.log(`  … ${listWork.length - cap} more (use --list)`);
  }
  console.log(`\n${pad('speaker', 10)} ${'files'.padStart(6)} ${'chars'.padStart(9)}   ${'to gen'.padStart(7)} ${'chars'.padStart(9)}`);
  for (const [w, s] of Object.entries(byWho).sort((a, b) => b[1].chars - a[1].chars)) console.log(`${pad(w, 10)} ${String(s.lines).padStart(6)} ${num(s.chars).padStart(9)}   ${String(s.pLines).padStart(7)} ${num(s.pChars).padStart(9)}`);
  console.log(`${pad('TOTAL', 10)} ${String(scope.length).padStart(6)} ${num(scope.reduce((s, j) => s + j.chars, 0)).padStart(9)}   ${String(gen.length).padStart(7)} ${num(pendingChars).padStart(9)}`);
  console.log(`up to date: ${scope.filter((j) => j.status === 'ok').length} · to generate: ${gen.length} (${num(pendingChars)} chars) · to re-process from raw cache: ${post.length}${deferred ? ` · deferred by --limit: ${deferred}` : ''}${stalePost ? ` · ${stalePost} kept with older post-processing (no raw cache)` : ''}`);

  // ── prune (full runs only)
  if (args.prune) {
    if (ONLY.length || WHO.length || args.limit !== undefined || args.lines) die('--prune only works on a complete run of the default lines file (no --only/--who/--limit/--lines).');
    const keep = new Set(all.map((j) => j.key));
    const orphans = Object.keys(manifest.lines).filter((k) => !keep.has(k));
    const keepHash = new Set([...all.map((j) => j.hash), ...Object.entries(manifest.lines).filter(([k]) => keep.has(k)).map(([, e]) => e.hash)]);
    const rawOrphans = existsSync(RAW_DIR) ? readdirSync(RAW_DIR).filter((f) => f.endsWith('.mp3') && !keepHash.has(f.slice(0, -4))) : [];
    console.log(`\nprune: ${orphans.length} manifest entries, ${rawOrphans.length} raw files not referenced${DRY ? ' (dry — nothing deleted)' : ''}`);
    if (!DRY) {
      for (const k of orphans) { try { unlinkSync(join(VOICE_DIR, manifest.lines[k].file)); } catch {} delete manifest.lines[k]; dirty = true; }
      for (const f of rawOrphans) { try { unlinkSync(join(RAW_DIR, f)); } catch {} }
      flushManifest();
    }
  }

  // ── credits / budget (needs the key only when something will be generated, or for the dry-run report)
  let sub = null;
  if (gen.length || DRY) {
    KEY = getKey();
    if (!KEY) { if (DRY) console.log('\nbudget: no API key found (env ELEVENLABS_API_KEY / HKCU\\Environment) — skipped'); else die('No ElevenLabs API key: set env ELEVENLABS_API_KEY (or the HKCU\\Environment value).'); }
    else {
      try { sub = await getSubscription(); }
      catch (e) { if (DRY) console.log(`\nbudget: could not read subscription (${redact(e.message)})`); else if (!FORCE_BUDGET) die(`Cannot verify credits: ${redact(e.message)}\nRe-run with --force-budget to skip the check.`); }
    }
  }
  if (sub) {
    const limit = sub.remaining - SAFETY_CHARS, ok = pendingChars <= limit;
    let cs = 0, cc = 0; for (const e of Object.values(manifest.lines)) if (e.credits != null && e.chars) { cs += e.chars; cc += e.credits; }
    const rate = cs >= 200 ? cc / cs : null;                                       // observed billed credits per char from earlier runs
    console.log(`\nbudget: ${sub.tier} · ${num(sub.used)} / ${num(sub.limit)} credits used · remaining ${num(sub.remaining)} · pending ${num(pendingChars)} chars${rate ? ` (≈ ${num(Math.round(pendingChars * rate))} credits at the observed ${rate.toFixed(2)}/char)` : ''} · guard (remaining − ${num(SAFETY_CHARS)}, counted per char) = ${num(limit)} → ${ok ? 'OK' : FORCE_BUDGET ? 'OVER (forced)' : 'REFUSED'}`);
    if (!ok && !FORCE_BUDGET && !DRY) die(`Refusing to generate: pending ${num(pendingChars)} chars > remaining ${num(sub.remaining)} − ${num(SAFETY_CHARS)} safety margin.\nTop up credits, narrow the run (--only/--who/--limit), or pass --force-budget.`);
  }
  if (DRY) { console.log('\n(dry run — no TTS calls made, nothing written)'); process.exit(sub && pendingChars > sub.remaining - SAFETY_CHARS && !FORCE_BUDGET ? 2 : 0); }
  if (!work.length) { console.log('\nNothing to do.'); return; }

  // ── execute
  mkdirSync(RAW_DIR, { recursive: true });
  const stats = { gen: 0, post: 0, failed: 0, chars: 0, credits: 0, secs: 0 };
  const failures = [];
  let fatal = null, hardFails = 0, done = 0;
  const badVoices = new Set();
  process.on('SIGINT', () => { if (aborted) process.exit(130); aborted = true; console.log('\n^C — finishing in-flight lines, saving manifest…'); });
  process.on('exit', () => { try { flushManifest(); } catch {} });

  const queue = [...post.filter((j) => !j.dupOf), ...gen, ...post.filter((j) => j.dupOf)];      // dependents last: they wait for their primary's raw audio
  const rawReady = new Map();                                                                  // hash → Promise (raw mp3 written or API error)
  let next = 0;
  const worker = async () => {
    while (!aborted) {
      const idx = next++; if (idx >= queue.length) return;
      const job = queue[idx], tag = `[${job.who} ${job.key}]`;
      try {
        if (job.status === 'gen') {
          if (badVoices.has(job.voiceId)) throw new JobError(`voice ${job.castName} unavailable (see earlier error)`);
          const p = (async () => { const r = await synth(job, tag); writeFileAtomic(rawPath(job), r.buf); job.cost = r.cost; stats.chars += job.chars; if (r.cost != null) stats.credits += r.cost; })();
          rawReady.set(job.hash, p);
          await p;
        } else if (job.dupOf) await rawReady.get(job.hash);
        const out = join(VOICE_DIR, job.file);
        const r = hasFfmpeg && !NO_POST ? await postProcess(rawPath(job), out) : rawCopy(rawPath(job), out);
        manifest.lines[job.key] = { file: job.file, hash: job.hash, dur: Math.round(r.dur * 1000) / 1000, chars: job.chars, who: job.who, post: hasFfmpeg && !NO_POST ? POST_ID : 'none', ...(job.cost != null ? { credits: job.cost } : {}), ...(r.lufs != null ? { lufs: r.lufs, tp: r.tp } : {}) };
        saveSoon();
        stats[job.status === 'gen' ? 'gen' : 'post']++; stats.secs += r.dur; hardFails = 0;
        console.log(`[${String(++done).padStart(String(queue.length).length)}/${queue.length}] ${job.status === 'gen' ? 'gen ' : 'post'} ${pad(job.who, 9)} ${pad(job.key, 38)} ${String(job.chars).padStart(4)}ch ${r.dur.toFixed(1).padStart(5)}s${r.lufs != null ? ` ${r.lufs.toFixed(1)}LUFS` : ''}`);
      } catch (e) {
        if (e instanceof Fatal) { done++; fatal = fatal || e; aborted = true; console.log(`[${done}/${queue.length}] FATAL ${tag}`); continue; }
        if (aborted && e.message === 'aborted') continue;       // in-flight job stopped because the run was aborted — not a failure of this line
        done++;
        stats.failed++; failures.push(`${job.key}: ${redact(e.message)}`);
        console.log(`[${done}/${queue.length}] FAIL ${tag} ${redact(e.message)}`);
        if (/HTTP 404|voice_not_found|voice_not_allowed|HTTP 403/.test(e.message)) badVoices.add(job.voiceId);
        if (!/aborted|network|HTTP 429|HTTP 5\d\d/.test(e.message) && ++hardFails >= MAX_HARD_FAILS) { fatal = fatal || new Fatal(`${hardFails} consecutive failures — stopping (last: ${redact(e.message)})`); aborted = true; }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(CONCURRENCY, queue.length)) }, worker));
  flushManifest();

  // ── summary
  console.log(`\n── summary ${'─'.repeat(50)}`);
  console.log(`generated ${stats.gen} · re-processed ${stats.post} · skipped (up to date) ${scope.filter((j) => j.status === 'ok').length} · failed ${stats.failed}${aborted && !fatal ? ' · interrupted' : ''}`);
  console.log(`chars spent: ${num(stats.chars)}${stats.credits ? ` · credits billed: ${num(stats.credits)}` : ''} · audio produced: ${fmtDur(stats.secs)} · wall ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  if (KEY) {
    try {
      const s = await getSubscription();
      const spent = stats.credits || stats.chars, lag = sub && spent > 0 && s.used < sub.used + spent - 1;          // ElevenLabs updates the usage counter lazily (minutes)
      console.log(`credits: ${num(s.used)} / ${num(s.limit)} used · remaining ${num(s.remaining)}${lag ? ` — API counter not caught up yet; expected remaining ≈ ${num(Math.max(0, sub.remaining - spent))}` : ''}`);
    } catch { /* offline */ }
  }
  if (failures.length) console.log(`failures:\n  ${failures.slice(0, 20).join('\n  ')}${failures.length > 20 ? `\n  … ${failures.length - 20} more` : ''}`);
  if (fatal) { console.error(`\nABORTED: ${redact(fatal.message)}\nProgress is saved in voice/manifest.json — fix the cause and re-run; finished lines are skipped.`); process.exitCode = 2; }
  else if (stats.failed || aborted) process.exitCode = 1;
}

main().catch((e) => { try { flushManifest(); } catch {} console.error('\nvoicegen crashed: ' + redact(e && e.stack || e)); process.exit(1); });
