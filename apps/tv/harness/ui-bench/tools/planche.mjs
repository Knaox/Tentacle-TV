// Les planches : les captures d'une série assemblées en images de 2 colonnes,
// légendées, lisibles telles quelles dans le panneau de fichiers — aucun
// navigateur. ImageMagick (`magick montage`).
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FONT = path.resolve(HERE, "../../../assets/fonts/Inter-SemiBold.ttf");
const PER_SHEET = 8;

// `montage` lit `%` comme un code de format et `@` en tête comme un fichier.
const safe = (label) => label.replace(/%/g, "%%").replace(/^@/, " @");

export function buildPlanches(shots, dir, title) {
  const sheets = [];
  const total = Math.ceil(shots.length / PER_SHEET);
  for (let i = 0; i < shots.length; i += PER_SHEET) {
    const out = path.join(dir, `planche-${String(sheets.length + 1).padStart(2, "0")}.png`);
    const args = ["montage", "-background", "#0b0b12", "-fill", "#ECECF4", "-font", FONT, "-pointsize", "24"];
    for (const shot of shots.slice(i, i + PER_SHEET)) args.push("-label", safe(shot.label), shot.file);
    // PNG24 : sans lui, montage réduit la palette et les dégradés sombres
    // prennent des paliers qui n'existent pas à l'écran.
    args.push("-tile", "2x", "-geometry", "960x540+20+20", "-title", safe(`${title} — ${sheets.length + 1}/${total}`), `PNG24:${out}`);
    execFileSync("magick", args);
    sheets.push(out);
  }
  return sheets;
}
