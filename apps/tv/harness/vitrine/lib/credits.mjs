// Les crédits des visuels : chaque image libre réellement utilisée, avec son
// titre, son auteur, sa licence et sa page Commons. Écrits à côté de chaque
// série (App Store, site) — la licence CC BY exige l'attribution.
import fs from "node:fs";
import path from "node:path";
import { CATALOG } from "./paths.mjs";
import { readSources } from "./sources.mjs";

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(CATALOG, name), "utf8"));

/** Les fichiers sources désignés par le catalogue (titres, série, épisodes). */
function usedFiles() {
  const used = new Set();
  const collect = (entry) => Object.values(entry.images ?? {}).forEach((spec) => used.add(spec.src));
  readJson("titles.json").titles.forEach(collect);
  for (const series of readJson("series.json").series) {
    collect(series);
    series.seasons.forEach((season) => season.episodes.forEach(collect));
  }
  return used;
}

export function creditsMarkdown() {
  const used = usedFiles();
  const sources = readSources().filter((source) => used.has(source.file));
  const byFilm = new Map();
  for (const source of sources) byFilm.set(source.film, [...(byFilm.get(source.film) ?? []), source]);
  const lines = [
    "# Crédits des visuels — contenu libre",
    "",
    "Les films montrés sont des œuvres LIBRES de la Blender Foundation (Blender Studio),",
    "publiées sous licence Creative Commons Attribution. Les images viennent de Wikimedia",
    "Commons ; chacune garde sa licence, citée ci-dessous. Elles ont été recadrées et",
    "redimensionnées pour l'interface (affiche 2:3, vignettes 16:9) ; les titres incrustés",
    "(logos, exclus de la licence par Blender Studio) ont été écartés ou recadrés.",
    "",
    "Interface : Tentacle TV. Les synopsis sont rédigés pour la démonstration.",
    "",
  ];
  for (const [film, list] of byFilm) {
    lines.push(`## ${film}`, "");
    for (const source of list) {
      lines.push(`- « ${source.title} » — ${source.author || "Blender Foundation"} — ${source.license} (${source.licenseUrl}) — ${source.page}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function writeCredits(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "CREDITS.md");
  fs.writeFileSync(file, creditsMarkdown());
  return file;
}
