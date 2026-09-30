/**
 * Les couleurs d'une œuvre, tirées de son BlurHash — l'empreinte floue que
 * Jellyfin joint à chaque image (`ImageBlurHashes`). Aucun module natif,
 * aucune image à décoder : quelques dizaines de caractères suffisent pour
 * teinter les halos et le fond de la couleur de ce qu'on regarde.
 *
 * Pur calcul, sans React : l'app le branchera telle quelle, le banc aussi.
 */

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";

function decode83(str: string): number {
  let value = 0;
  for (const char of str) value = value * 83 + DIGITS.indexOf(char);
  return value;
}

const srgbToLinear = (v: number) => {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};

const linearToSrgb = (v: number) => {
  const x = Math.max(0, Math.min(1, v));
  return Math.round((x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055) * 255);
};

const signPow = (v: number, e: number) => Math.sign(v) * Math.abs(v) ** e;

type Rgb = [number, number, number];

/** Les composantes cosinus d'un BlurHash, ou null s'il est illisible. */
function components(hash: string): { nx: number; ny: number; colors: Rgb[] } | null {
  if (!hash || hash.length < 6) return null;
  const size = decode83(hash[0]);
  const ny = Math.floor(size / 9) + 1;
  const nx = (size % 9) + 1;
  if (hash.length !== 4 + 2 * nx * ny) return null;
  const maxAc = (decode83(hash[1]) + 1) / 166;
  const dc = decode83(hash.slice(2, 6));
  const colors: Rgb[] = [[srgbToLinear(dc >> 16), srgbToLinear((dc >> 8) & 255), srgbToLinear(dc & 255)]];
  for (let i = 1; i < nx * ny; i++) {
    const v = decode83(hash.slice(4 + i * 2, 6 + i * 2));
    const q = [Math.floor(v / (19 * 19)), Math.floor(v / 19) % 19, v % 19];
    colors.push(q.map((c) => signPow((c - 9) / 9, 2) * maxAc) as Rgb);
  }
  return { nx, ny, colors };
}

/** La couleur de l'image au point (u, v), dans [0, 1]². */
function sample(c: { nx: number; ny: number; colors: Rgb[] }, u: number, v: number): Rgb {
  const out: Rgb = [0, 0, 0];
  for (let j = 0; j < c.ny; j++) {
    for (let i = 0; i < c.nx; i++) {
      const basis = Math.cos(Math.PI * u * i) * Math.cos(Math.PI * v * j);
      const color = c.colors[i + j * c.nx];
      out[0] += color[0] * basis;
      out[1] += color[1] * basis;
      out[2] += color[2] * basis;
    }
  }
  return [linearToSrgb(out[0]), linearToSrgb(out[1]), linearToSrgb(out[2])];
}

function toHsl([r, g, b]: Rgb): [number, number, number] {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rr ? (gg - bb) / d + (gg < bb ? 6 : 0) : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  return [h / 6, s, l];
}

function toHex([h, s, l]: [number, number, number]): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Une couleur de lumière : assez saturée pour teinter, jamais criarde, jamais
 *  assez claire pour lutter avec le texte blanc. */
function glow(rgb: Rgb): string {
  const [h, s, l] = toHsl(rgb);
  const sat = s < 0.08 ? s : Math.min(0.82, Math.max(0.38, s * 1.3));
  return toHex([h, sat, Math.min(0.5, Math.max(0.28, l))]);
}

export interface ArtworkPalette {
  /** Trois lumières, de gauche à droite de l'image. */
  glows: [string, string, string];
  /** La teinte moyenne, assombrie : le fond d'une page consacrée à l'œuvre. */
  deep: string;
}

/** La palette d'une œuvre depuis son BlurHash ; null s'il manque ou est illisible. */
export function paletteFromBlurHash(hash: string | null | undefined): ArtworkPalette | null {
  const c = hash ? components(hash) : null;
  if (!c) return null;
  const left = sample(c, 0.12, 0.45);
  const middle = sample(c, 0.5, 0.35);
  const right = sample(c, 0.88, 0.55);
  const [h, s] = toHsl(sample(c, 0.5, 0.5));
  return {
    glows: [glow(left), glow(middle), glow(right)],
    deep: toHex([h, Math.min(0.5, s), 0.07]),
  };
}

/** Les trois lumières de la MARQUE, de gauche à droite : violet, entre-deux,
 *  rose (`brand.base` → `brand.accent`), tenues dans la clarté des halos. */
const BRAND_LIGHTS: [Rgb, Rgb, Rgb] = [
  [124, 82, 222],
  [170, 74, 196],
  [214, 64, 138],
];

function parseHex(hex: string): Rgb {
  const v = parseInt(hex.slice(1, 7), 16);
  return [v >> 16, (v >> 8) & 255, v & 255];
}

function mixHex(hex: string, toward: Rgb, weight: number): string {
  const from = parseHex(hex);
  const channel = (i: number) => Math.round(from[i] + (toward[i] - from[i]) * weight);
  return `#${[0, 1, 2].map((i) => channel(i).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * La lumière de la scène aux couleurs de la MARQUE, violet → rose, nuancée
 * par l'œuvre : `weight` (0 à 1) dit la part de la marque. Le retour de
 * l'utilisateur (2026-09-30) : un halo souvent orange ne dit pas l'app ; la
 * marque doit se voir, sans que tout vire au violet.
 */
export function brandLight(palette: ArtworkPalette, weight: number): ArtworkPalette {
  const [a, b, c] = palette.glows;
  return {
    glows: [mixHex(a, BRAND_LIGHTS[0], weight), mixHex(b, BRAND_LIGHTS[1], weight), mixHex(c, BRAND_LIGHTS[2], weight)],
    deep: palette.deep,
  };
}

/**
 * Un logo se lit-il sur la scène sombre ? Son BlurHash ne le dit sûrement que
 * dans un cas : NOIR de part en part — un logo noir sur une transparence
 * noire, aucune lumière nulle part (« Comme des frères »). Tout autre logo
 * passe : la couleur d'une transparence varie d'un fichier à l'autre, et un
 * logo rouge sombre reste lisible. Illisible, le titre s'écrit en texte.
 */
export function isLogoLegibleOnDark(hash: string | null | undefined): boolean {
  const c = hash ? components(hash) : null;
  if (!c) return true;
  let brightest = 0;
  for (const u of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    for (const v of [0.2, 0.5, 0.8]) {
      const [r, g, b] = sample(c, u, v);
      brightest = Math.max(brightest, (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255);
    }
  }
  return brightest >= 0.04;
}

/** Quand l'œuvre n'a pas d'empreinte : une lumière neutre et chaude. */
export const NEUTRAL_PALETTE: ArtworkPalette = {
  glows: ["#6b4a3a", "#3a3f5c", "#5c4a2e"],
  deep: "#0d0b0f",
};
