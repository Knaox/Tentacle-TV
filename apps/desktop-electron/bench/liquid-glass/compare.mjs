// « Rendu d'avant, au pixel près » : compare les captures d'une passe à celles
// d'une passe de RÉFÉRENCE (la base d'avant le lot), écran par écran.
//   node compare.mjs <dossier référence>:<cellule> <dossier passe>:<cellule> [écran…]
// Ex. : node compare.mjs ~/Pictures/…-reference-base:allume ~/Pictures/…-recette:coupe fiche reglages-apparence
// Rend la part de pixels différents (tolérance 2 %) et une image des écarts.
// ⚠️ L'accueil fait tourner son héros : ne juger au pixel que des écrans fixes.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const [refArg, runArg, ...wanted] = process.argv.slice(2);
if (!refArg || !runArg) {
  console.error("usage : node compare.mjs <réf>:<cellule> <passe>:<cellule> [écran…]");
  process.exit(2);
}
const split = (arg) => {
  const at = arg.lastIndexOf(":");
  return { dir: arg.slice(0, at), cell: arg.slice(at + 1) };
};
const ref = split(refArg);
const run = split(runArg);
const screens = wanted.length > 0 ? wanted : ["fiche", "reglages-apparence", "accueil-defile"];
const outDir = path.join(run.dir, "ecarts");
mkdirSync(outDir, { recursive: true });

let worst = 0;
for (const screen of screens) {
  const a = path.join(ref.dir, `${ref.cell}-${screen}.png`);
  const b = path.join(run.dir, `${run.cell}-${screen}.png`);
  if (!existsSync(a) || !existsSync(b)) {
    console.log(`${screen} : capture absente (${existsSync(a) ? "" : "réf "}${existsSync(b) ? "" : "passe"})`);
    continue;
  }
  const diff = path.join(outDir, `${run.cell}-${screen}-ecart.png`);
  // `compare -metric AE` écrit le nombre de pixels différents sur stderr.
  const r = spawnSync("compare", ["-metric", "AE", "-fuzz", "2%", a, b, diff], { encoding: "utf8" });
  const changed = Number.parseFloat(String(r.stderr).trim().split(" ")[0]);
  const size = spawnSync("magick", ["identify", "-format", "%w %h", a], { encoding: "utf8" }).stdout.split(" ").map(Number);
  const ratio = Number.isFinite(changed) ? changed / (size[0] * size[1]) : NaN;
  worst = Math.max(worst, Number.isFinite(ratio) ? ratio : 1);
  console.log(`${screen} : ${Number.isFinite(ratio) ? (ratio * 100).toFixed(3) : "?"} % de pixels différents → ${diff}`);
}
process.exit(worst > 0.001 ? 1 : 0);
