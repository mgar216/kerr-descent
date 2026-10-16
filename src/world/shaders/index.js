// Body id → shader module { id, defines, params(look), glsl }. Each module is imported dynamically so a broken or
// missing file falls back to `generic` (with a console warning) instead of taking the whole far pass down.
import generic from './generic.js';

const IDS = ['asphodel', 'phlegethon', 'lethe', 'charon', 'cocytus', 'elysium'];
const loaded = await Promise.all(IDS.map(async (id) => {
  try { return [id, (await import(`./${id}.js`)).default]; } catch (e) { console.warn(`[worlds] shader module "${id}" failed to load — using generic`, e); return [id, generic]; }
}));

export const SHADERS = { generic, ...Object.fromEntries(loaded) };
export default SHADERS;
