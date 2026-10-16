// ORPHEUS — voice cast (ElevenLabs eleven_v4).
// Pure data + tiny text helpers. Imported by the browser runtime (voice.js) AND by the Node generator
// (tools/voicegen.mjs), so it must stay free of DOM / Node APIs.
//
// eleven_v4 only honours `stability` + `similarity_boost` (no style/speed/SSML); emotion and pacing come from
// [audio tags] in the line text and from punctuation. Lower stability = more expressive, higher = steadier.

export const MODEL = 'eleven_v4';

const voice = (voiceId, name, stability, similarity_boost = 0.75) => ({ voiceId, name, model: MODEL, settings: { stability, similarity_boost } });

/**
 * who → { voiceId, name, model, settings, fx, label, cls, gain, role, halcyon? }
 *  fx     'radio' | 'cabin' | 'log' | 'person' | 'suit' (+ 'pa', only reachable through LINE_RULES below)
 *  label  HUD tag shown in the comms log / subtitle
 *  cls    comms-log css class: 'mc' (amber) | 'ai' (cyan) | 'me' (green) | 'sys' (grey)
 *  gain   playback trim (1 = file as generated, normalised to -18 LUFS)
 *  halcyon  voice is received from the station → gravitational Doppler + squelch/static when fx === 'radio'
 */
export const CAST = {
  LYRA:     { ...voice('pFZP5JQG7iQjIQuC4Bku', 'Lily',    0.55),       role: 'ORPHEUS ship AI',                fx: 'cabin',  label: 'LYRA',               cls: 'ai',  gain: 1.0 },
  CAPCOM:   { ...voice('nPczCjzI2devNBz1zQrb', 'Brian',   0.55),       role: 'Jonah Reyes, CAPCOM',            fx: 'radio',  label: 'HALCYON',            cls: 'mc',  gain: 1.0, halcyon: true },
  FD:       { ...voice('pqHfZKP75CvOlQylNhV4', 'Bill',    0.60),       role: 'Director Arthur Bell, FD',       fx: 'radio',  label: 'HALCYON \u00b7 BELL',  cls: 'mc',  gain: 1.0, halcyon: true },
  SCI:      { ...voice('XrExE9yKIg1WjnnlVkGX', 'Matilda', 0.50),       role: 'Dr. Ilse Varga, science lead',   fx: 'radio',  label: 'HALCYON \u00b7 VARGA', cls: 'mc',  gain: 1.0, halcyon: true },
  MIRA:     { ...voice('cgSgspJ2msm6clMCkdW9', 'Jessica', 0.40),       role: 'Mira, the Commander\u2019s daughter', fx: 'radio', label: 'MIRA',        cls: 'mc',  gain: 1.0, halcyon: true },
  ELENA:    { ...voice('EXAVITQu4vr4xnSDxMaL', 'Sarah',   0.42),       role: 'Cmdr Elena Varis, EURYDICE',     fx: 'log',    label: 'EURYDICE \u00b7 ELENA', cls: 'sys', gain: 1.0 },
  TOMAS:    { ...voice('bIHbv24MWmeRgasZH58o', 'Will',    0.42),       role: 'Tomas Oyelaran, EURYDICE',       fx: 'log',    label: 'EURYDICE \u00b7 TOMAS', cls: 'sys', gain: 1.0 },
  SURVEY_A: { ...voice('CwhRBWXzGAHq8TQ4Fs17', 'Roger',   0.50),       role: 'Survey lead Okafor',             fx: 'log',    label: 'FIELD LOG \u00b7 OKAFOR', cls: 'sys', gain: 1.0 },
  SURVEY_B: { ...voice('FGY2WhTYpPnrIDTdsKH5', 'Laura',   0.48),       role: 'Geologist Petra Lind',           fx: 'log',    label: 'FIELD LOG \u00b7 LIND', cls: 'sys', gain: 1.0 },
  SURVEY_C: { ...voice('IKne3meq5aSn9XLyUdCD', 'Charlie', 0.48),       role: 'Volcanologist Sam Ward',         fx: 'log',    label: 'FIELD LOG \u00b7 WARD', cls: 'sys', gain: 1.0 },
  PA:       { ...voice('SAz9YHcvj6GT2YYXdXww', 'River',   0.80, 0.60), role: 'Halcyon PA / suit & ship computers', fx: 'suit', label: 'SYSTEM',            cls: 'sys', gain: 1.0 },
  CMDR_A:   { ...voice('cjVigY5qzO86Huf0OWal', 'Eric',    0.50),       role: 'Commander (voice A)',            fx: 'radio',  label: 'ORPHEUS',            cls: 'me',  gain: 1.0 },
  CMDR_B:   { ...voice('hpp4J3VqNfWAUOO0d1Us', 'Bella',   0.50),       role: 'Commander (voice B)',            fx: 'radio',  label: 'ORPHEUS',            cls: 'me',  gain: 1.0 },
};

/** `who: 'CMDR'` lines are generated once per variant (`<id>@A`, `<id>@B`); the runtime picks by settings.cmdrVoice. */
export const CMDR_VARIANTS = ['A', 'B'];

/** Legacy / loose names accepted by sayText() and castFor(). */
export const WHO_ALIAS = { MC: 'CAPCOM', AI: 'LYRA', HALCYON: 'CAPCOM', ME: 'CMDR', ORPHEUS: 'CMDR', COMMANDER: 'CMDR' };

/** Resolve `who` (+ commander variant) to its CAST entry. Returns null for unknown speakers. */
export function castFor(who, variant = 'A') {
  const w = WHO_ALIAS[who] || who;
  if (w === 'CMDR') return CAST['CMDR_' + (variant === 'B' ? 'B' : 'A')];
  return CAST[w] || null;
}

/** Normalised speaker key ('MC' → 'CAPCOM', …); 'CMDR' stays 'CMDR'. */
export function whoKey(who) { return WHO_ALIAS[who] || who; }

/**
 * Per-line delivery overrides, matched on the line id (first hit wins). They sit between the cast defaults and any
 * explicit `fx` / `label` / `cls` / `gain` on the LINES entry or in say() opts.
 * In-person conversations on Halcyon are dry (no radio); recorded messages and logs get the tape treatment;
 * station announcements get the PA chime + tannoy colour; computers get the clipped synthetic voice.
 */
export const LINE_RULES = [
  { re: /^halcyon\.(jonah|fd|sci|mira)\./, fx: 'person' },
  { re: /^halcyon\.pa\./,                  fx: 'pa',   label: 'HALCYON PA',   cls: 'sys' },
  { re: /^eurydice\.sys\./,                fx: 'suit', label: 'EURYDICE SYS', cls: 'sys' },
  { re: /^eva\.suit/,                      fx: 'suit', label: 'SUIT',         cls: 'sys' },
  { re: /^(log\.|eur\.log\.|msg\.)/,       fx: 'log' },
  { re: /^cmdr\.camp\./,                   fx: 'log' },
];

export function ruleFor(id) {
  for (const r of LINE_RULES) if (r.re.test(id)) return r;
  return null;
}

/**
 * Effective delivery profile for a line: cast defaults ← LINE_RULES ← line overrides ← opts overrides.
 * → { who, castKey, voiceId, name, model, settings, fx, label, cls, gain, halcyon }
 */
export function profileFor(id, who, variant = 'A', line = null, opts = null) {
  const c = castFor(who, variant);
  if (!c) return null;
  const r = ruleFor(id) || {};
  const pick = (k) => (opts && opts[k] != null ? opts[k] : line && line[k] != null ? line[k] : r[k] != null ? r[k] : c[k]);
  const w = whoKey(who);
  return {
    who: w, castKey: w === 'CMDR' ? 'CMDR_' + (variant === 'B' ? 'B' : 'A') : w,
    voiceId: c.voiceId, name: c.name, model: c.model, settings: c.settings,
    fx: pick('fx'), label: pick('label'), cls: pick('cls'), gain: pick('gain'), halcyon: !!c.halcyon,
  };
}

// ───────────────────────────── text helpers ─────────────────────────────
// Plain spellings for the IPA islands WRITER may embed ("plain spelling first; IPA in slashes only if needed").
export const IPA_PLAIN = {
  'ˈɔːrfiəs': 'Orpheus', 'jʊˈrɪdɪsiː': 'Eurydice', 'ˈflɛɡəθɒn': 'Phlegethon', 'koʊˈsaɪtəs': 'Cocytus',
  'ˈliːθiː': 'Lethe', 'ˈkɛərən': 'Charon', 'ˈɛrəbəs': 'Erebus',
};
// /…/ island that contains at least one IPA-only letter (so "and/or", "km/s" are never touched)
const IPA_RE = /[("\u201c]?\/([^\/\n]*[ˈˌːəɪʊɛɔæðθŋʃʒɑɒʌɜɡɐɹɾ][^\/\n]*)\/[)"\u201d]?/g;
const TAG_RE = /\[[^\]\n]*\]/g;

/** Text without [audio tags]; IPA islands replaced by the plain spelling (or dropped); whitespace collapsed. */
export function captionOf(text) {
  let s = String(text == null ? '' : text);
  s = s.replace(IPA_RE, (m, ipa, off, all) => {
    const plain = IPA_PLAIN[ipa.trim()];
    if (!plain) return '';
    const prev = /([A-Za-z]+)[\s("\u201c]*$/.exec(all.slice(0, off));
    return prev && prev[1].toLowerCase() === plain.toLowerCase() ? '' : plain;
  });
  return s.replace(TAG_RE, ' ').replace(/\s+/g, ' ').replace(/\s+([,.;:!?\u2026])/g, '$1').replace(/\(\s*\)/g, '').trim();
}

/** Caption prepared for a speech engine (symbols spelled out). Used by the Web Speech fallback only. */
export function spokenOf(text) {
  return captionOf(text)
    .replace(/r\u208a/g, 'r plus').replace(/r\u208b/g, 'r minus').replace(/\u03c4/g, 'tau').replace(/M\u2609/g, 'solar masses')
    .replace(/\u00d7/g, ' times ').replace(/\u00b0/g, ' degrees').replace(/\u2248/g, ' about ').replace(/\s*[\u2014\u2013]\s*/g, ', ')
    .replace(/\s+/g, ' ').replace(/\s+([,.;:!?\u2026])/g, '$1').trim();
}

/** Billable characters of a line (ElevenLabs bills the text as sent, tags included). */
export function billedChars(text) { return [...String(text == null ? '' : text)].length; }
