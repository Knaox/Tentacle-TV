// Encodeur BlurHash (algorithme de référence de Wolt, réécrit ici). La
// refonte tire la lumière de ses écrans (halo, fond vivant) de l'empreinte
// des images : sans elle, tout retombe sur la palette neutre.

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";

function encode83(value, length) {
  let out = "";
  for (let i = 1; i <= length; i++) out += DIGITS[Math.floor(value / 83 ** (length - i)) % 83];
  return out;
}

const toLinear = (value) => {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const toSrgb = (value) => {
  const v = Math.max(0, Math.min(1, value));
  return v <= 0.0031308 ? Math.round(v * 12.92 * 255 + 0.5) : Math.round((1.055 * v ** (1 / 2.4) - 0.055) * 255 + 0.5);
};

const signPow = (value, exp) => Math.sign(value) * Math.abs(value) ** exp;

/** `pixels` : RVB 8 bits, ligne par ligne (`width` × `height` × 3). */
export function encodeBlurHash(pixels, width, height, cx = 4, cy = 3) {
  const factors = [];
  for (let y = 0; y < cy; y++) {
    for (let x = 0; x < cx; x++) {
      const norm = x === 0 && y === 0 ? 1 : 2;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let j = 0; j < height; j++) {
        const basisY = Math.cos((Math.PI * y * j) / height);
        for (let i = 0; i < width; i++) {
          const basis = norm * Math.cos((Math.PI * x * i) / width) * basisY;
          const at = 3 * (i + j * width);
          r += basis * toLinear(pixels[at]);
          g += basis * toLinear(pixels[at + 1]);
          b += basis * toLinear(pixels[at + 2]);
        }
      }
      const scale = 1 / (width * height);
      factors.push([r * scale, g * scale, b * scale]);
    }
  }
  const [dc, ...ac] = factors;
  let hash = encode83(cx - 1 + (cy - 1) * 9, 1);
  let maximum = 1;
  if (ac.length > 0) {
    const actual = Math.max(...ac.flat().map(Math.abs));
    const quantised = Math.max(0, Math.min(82, Math.floor(actual * 166 - 0.5)));
    maximum = (quantised + 1) / 166;
    hash += encode83(quantised, 1);
  } else {
    hash += encode83(0, 1);
  }
  hash += encode83((toSrgb(dc[0]) << 16) + (toSrgb(dc[1]) << 8) + toSrgb(dc[2]), 4);
  const quant = (v) => Math.max(0, Math.min(18, Math.floor(signPow(v / maximum, 0.5) * 9 + 9.5)));
  for (const [r, g, b] of ac) hash += encode83(quant(r) * 19 * 19 + quant(g) * 19 + quant(b), 2);
  return hash;
}
