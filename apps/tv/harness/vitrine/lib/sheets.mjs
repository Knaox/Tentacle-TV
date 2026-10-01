// Les planches contact des séries : relire toute une série d'un coup d'œil,
// en PNG, sans navigateur (ImageMagick).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { FONTS, SHEETS } from "./paths.mjs";

const FONT = path.join(FONTS, "Inter-SemiBold.ttf");

/** `files` : [{ file, label }] ; rend le chemin de la planche. */
export function contactSheet(files, name, { columns = 2, tile = "960x540" } = {}) {
  fs.mkdirSync(SHEETS, { recursive: true });
  const out = path.join(SHEETS, `${name}.png`);
  const args = ["montage", "-background", "#0b0b12", "-fill", "#ECECF4", "-font", FONT, "-pointsize", "22"];
  // `montage` lit `%` comme un code de format.
  for (const { file, label } of files) args.push("-label", label.replace(/%/g, "%%"), file);
  args.push("-tile", `${columns}x`, "-geometry", `${tile}+16+16`, "-title", name, `PNG24:${out}`);
  execFileSync("magick", args);
  return out;
}
