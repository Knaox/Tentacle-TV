// Les images de l'instantané vitrine, tirées des sources libres : affiche
// 2:3, vignettes 16:9, fond au cadre de sa source — jamais agrandies — et
// leur empreinte BlurHash, d'où la refonte tire la lumière de ses écrans.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { encodeBlurHash } from "./blurhash.mjs";
import { SNAPSHOT, SOURCES } from "./paths.mjs";

const magick = (args) => execFileSync("magick", args, { maxBuffer: 64 * 1024 * 1024 });

/** Le gabarit de chaque type d'image : rapport imposé (ou celui de la
 *  source), largeur maximale. Les vues recadrent en « cover ». */
const KINDS = {
  Primary: { ratio: 2 / 3, width: 1000 },
  Thumb: { ratio: 16 / 9, width: 1280 },
  Still: { ratio: 16 / 9, width: 1280 },
  Backdrop: { ratio: null, width: 3840 },
};

const BLUR_GRID = 32;

function sizeOf(file) {
  const [w, h] = magick(["identify", "-format", "%w %h", `${file}[0]`]).toString().trim().split(" ").map(Number);
  return { w, h };
}

/** Le rectangle au rapport voulu, centré dans `crop` (ou dans toute l'image). */
function frameOf(size, crop, ratio) {
  let [x, y, w, h] = crop ?? [0, 0, size.w, size.h];
  if (ratio && Math.abs(w / h - ratio) > 0.005) {
    if (w / h > ratio) {
      const width = Math.round(h * ratio);
      x += Math.round((w - width) / 2);
      w = width;
    } else {
      const height = Math.round(w / ratio);
      y += Math.round((h - height) / 2);
      h = height;
    }
  }
  return [x, y, w, h];
}

function blurHashOf(file) {
  const raw = magick([file, "-resize", `${BLUR_GRID}x${BLUR_GRID}!`, "-depth", "8", "rgb:-"]);
  return encodeBlurHash(raw, BLUR_GRID, BLUR_GRID);
}

/**
 * Tire une image de l'instantané : `spec` = { src, crop? } (src relatif à
 * `sources/`), `kind` = Primary | Thumb | Still | Backdrop. Rend le chemin
 * relatif au dossier de l'instantané, l'étiquette et l'empreinte. Une image
 * déjà tirée de la même façon n'est pas refaite.
 */
export function deriveImage(spec, kind, slug) {
  const dir = path.join(SNAPSHOT, "img", slug);
  const memo = path.join(dir, `${kind}.json`);
  const key = JSON.stringify({ src: spec.src, crop: spec.crop ?? null, kind, v: 2 });
  if (fs.existsSync(memo)) {
    const cached = JSON.parse(fs.readFileSync(memo, "utf8"));
    if (cached.key === key && fs.existsSync(path.join(SNAPSHOT, cached.result.file))) return cached.result;
  }
  const source = path.join(SOURCES, spec.src);
  if (!fs.existsSync(source)) throw new Error(`image source absente : ${spec.src} — lancer « vitrine.mjs sources »`);
  const { ratio, width } = KINDS[kind];
  const [x, y, w, h] = frameOf(sizeOf(source), spec.crop, ratio);
  fs.mkdirSync(dir, { recursive: true });
  const work = path.join(dir, `${kind}.work.jpg`);
  magick([`${source}[0]`, "-crop", `${w}x${h}+${x}+${y}`, "+repage", "-resize", `${Math.min(width, w)}x`, "-strip", "-quality", "90", work]);
  // Le nom porte l'empreinte du fichier : l'app (et son cache d'images, qui
  // garde une adresse une heure) voit toute nouvelle image comme neuve.
  const tag = crypto.createHash("md5").update(fs.readFileSync(work)).digest("hex");
  for (const old of fs.readdirSync(dir)) if (old.startsWith(`${kind}-`) && old.endsWith(".jpg")) fs.rmSync(path.join(dir, old));
  const relative = `img/${slug}/${kind}-${tag.slice(0, 10)}.jpg`;
  fs.renameSync(work, path.join(SNAPSHOT, relative));
  const out = path.join(SNAPSHOT, relative);
  const size = sizeOf(out);
  const result = { file: relative, tag, blurHash: blurHashOf(out), width: size.w, height: size.h };
  fs.writeFileSync(memo, JSON.stringify({ key, result }));
  return result;
}
