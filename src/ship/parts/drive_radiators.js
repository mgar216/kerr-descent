// Radiator wings: two pairs — large forward wings on the flanks, smaller aft wings on the shoulders of the boat-tail — and the
// heat glow of the coolant channels (shared `radiator` material emissive, driven by the drive heat state). Returns { update(t, s, h) }.
// c0 / c1 = root / tip chord (panels taper like dragonfly wings), len = panel length along the boom. Reach stays within |x| ≤ 7.5, y ≤ 4.2.
import { buildWing } from './drive_wing.js';

const D = Math.PI / 180;

export default function buildRadiators(kit) {
  const eur = kit.eur;
  const wings = [
    { id: 'fp', s: -1, p: [-4.03, 0.42, 33.0], phi: 34 * D, psi: 15 * D, n: 4, len: 0.83, c0: 3.2, c1: 1.7, mount: 'flank' },
    { id: 'fs', s: 1,  p: [4.03, 0.42, 33.0],  phi: 34 * D, psi: 15 * D, n: 4, len: 0.83, c0: 3.2, c1: 1.7, mount: 'flank' },
    { id: 'ap', s: -1, p: [-2.25, 1.66, 38.1], phi: 44 * D, psi: 16 * D, n: 3, len: 0.9, c0: 2.4, c1: 1.2, mount: 'roof' },
    { id: 'as', s: 1,  p: [2.25, 1.66, 38.1],  phi: 44 * D, psi: 16 * D, n: 3, len: 0.9, c0: 2.4, c1: 1.2, mount: 'roof' },
  ];
  for (const w of wings) buildWing(kit, { ...w, dmg: eur && w.id === 'fp' });   // EURYDICE: the port forward wing is bent and torn

  const rad = kit.mat('radiator');
  const update = (t, s, h) => {
    if (eur) { rad.emissiveIntensity = 0; return; }                              // cold: no coolant flow
    rad.emissiveIntensity = 0.2 * h.idle + 0.78 * Math.pow(h.th, 0.9) + 0.22 * h.bo;
    rad.emissive.setRGB(1, 0.62 + 0.5 * h.th, 0.34 + 0.8 * h.th);                // deep orange at idle → warm orange when hot
  };
  return { update };
}
