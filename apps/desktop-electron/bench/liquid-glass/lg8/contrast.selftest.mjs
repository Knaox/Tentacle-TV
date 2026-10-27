// Contrôle hors ligne de `contrast.mjs` : des captures synthétiques dont on connaît
// le contraste. `node lg8/contrast.selftest.mjs` (aucune app, aucune capture).
import assert from "node:assert/strict";
import { elementContrast, luminance, ratio, verdict } from "./contrast.mjs";

function image(width, height, paint) {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(paint(x, y), (y * width + x) * 3);
  }
  return { width, height, data };
}
const box = { x: 10, y: 10, w: 20, h: 10 };
const inGlyph = (x, y) => x >= 14 && x < 26 && y >= 13 && y < 17;

// Blanc sur noir : 21:1.
assert.equal(ratio(luminance(255, 255, 255), luminance(0, 0, 0)), 21);

// Texte blanc sur gris 50 % (#808080) : ≈ 3,95:1 → échec du texte, réussite du glyphe.
const grey = image(40, 30, () => [128, 128, 128]);
const greyText = image(40, 30, (x, y) => (inGlyph(x, y) ? [255, 255, 255] : [128, 128, 128]));
const g = elementContrast(greyText, grey, box);
assert.ok(g.measured && Math.abs(g.contrast - 3.95) < 0.05, JSON.stringify(g));
assert.equal(verdict("texte", g), "ÉCHEC");
assert.equal(verdict("glyphe", g), "OK");

// Blanc sur damier noir/blanc : jugé sur le côté BLANC (pire cas), pas la moyenne.
const checker = (x, y) => (((x >> 1) + (y >> 1)) % 2 ? [255, 255, 255] : [0, 0, 0]);
const noise = image(40, 30, checker);
const noiseText = image(40, 30, (x, y) => (inGlyph(x, y) ? [255, 255, 255] : checker(x, y)));
const n = elementContrast(noiseText, noise, box);
assert.ok(n.measured, JSON.stringify(n));
assert.equal(n.contrast, 1);

// Texte sombre sur blanc : polarité sombre.
const white = image(40, 30, () => [255, 255, 255]);
const darkText = image(40, 30, (x, y) => (inGlyph(x, y) ? [20, 20, 20] : [255, 255, 255]));
const d = elementContrast(darkText, white, box);
assert.equal(d.polarity, "sombre");
assert.ok(d.contrast > 15);

// Rien qui change : non mesuré (élément absent de l'image).
assert.equal(elementContrast(white, white, box).measured, false);
console.log("contrast.selftest : OK");
