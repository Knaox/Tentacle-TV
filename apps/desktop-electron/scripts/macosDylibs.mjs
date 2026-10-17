/**
 * Contrôle d'un jeu de dylibs macOS : chacune trouve-t-elle TOUTES ses
 * dépendances à côté d'elle, pour chaque architecture qu'elle porte ?
 *
 * # Pourquoi
 *
 * Le build 1.30.0 (1468281) ne lisait plus rien : `libbrotlidec.1.dylib`, tirée
 * par le freetype de Homebrew sur le runner Apple Silicon, désigne sa voisine
 * par `@rpath/libbrotlicommon.1.dylib` — et le collecteur ne suivait pas les
 * chemins en `@`. La dylib manquait au paquet, et rien ne s'en apercevait avant
 * le premier film : « Library not loaded: @rpath/libbrotlicommon.1.dylib ».
 *
 * # La règle
 *
 * Dans un jeu livré, une dépendance est soit du SYSTÈME (`/System/…`,
 * `/usr/lib/…`), soit `@loader_path/<nom>` avec `<nom>` présent dans le dossier
 * ET portant l'architecture de la tranche qui le demande. Tout le reste —
 * `@rpath`, `@executable_path`, un chemin absolu vers Homebrew ou le préfixe de
 * build — échoue : hors de la machine de build, rien ne le résout, et le bac à
 * sable n'atteint de toute façon pas `/opt/homebrew`.
 *
 *   node scripts/macosDylibs.mjs verify <dossier> [--dlopen libmpv.2.dylib]
 *
 * `--dlopen` charge en plus la dylib nommée (koffi, comme `mpvLib.ts`) : dyld
 * suit alors toute la chaîne réelle, pour l'architecture de la machine.
 */

import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Ce que dyld trouve sur toute machine : jamais à embarquer. */
export function isSystemPath(installName) {
  return installName.startsWith("/System/") || installName.startsWith("/usr/lib/");
}

/** Les noms d'installation listés par `otool -L` (une seule architecture). */
export function parseOtoolLibraries(text) {
  return text
    .split("\n")
    .filter((line) => line.startsWith("\t"))
    .map((line) => line.trim().replace(/ \(compatibility version.*\)$/, ""));
}

/**
 * Les problèmes d'UNE tranche d'une dylib. Règle pure : `has(nom, arch)` dit si
 * le dossier contient `nom` avec cette architecture.
 */
export function sliceProblems({ name, arch, id, libraries, has }) {
  const problems = [];
  for (const dep of libraries) {
    if (dep === id || isSystemPath(dep)) continue;
    const where = `${name} (${arch}) → ${dep}`;
    if (!dep.startsWith("@loader_path/")) {
      problems.push(`${where} : seul « @loader_path/<nom> » se résout dans le paquet`);
      continue;
    }
    const target = dep.slice("@loader_path/".length);
    if (!has(target, null)) problems.push(`${where} : ${target} absente du jeu`);
    else if (!has(target, arch)) problems.push(`${where} : ${target} ne porte pas l'architecture ${arch}`);
  }
  return problems;
}

function run(tool, args) {
  return execFileSync(tool, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function archsOf(file) {
  return run("/usr/bin/lipo", ["-archs", file]).trim().split(/\s+/);
}

/** Contrôle tout le dossier ; rend la liste des problèmes (vide = sain). */
export function verifyDylibDir(dir) {
  const names = readdirSync(dir).filter((f) => f.endsWith(".dylib"));
  if (names.length === 0) return [`aucune dylib dans ${dir}`];
  const archs = new Map(names.map((n) => [n, archsOf(path.join(dir, n))]));
  const has = (target, arch) => archs.has(target) && (arch === null || archs.get(target).includes(arch));
  const problems = [];
  for (const name of names) {
    const file = path.join(dir, name);
    for (const arch of archs.get(name)) {
      // `otool -D` : un en-tête (le fichier), puis le nom d'installation.
      const id = run("/usr/bin/otool", ["-arch", arch, "-D", file]).trim().split("\n").slice(-1)[0];
      const libraries = parseOtoolLibraries(run("/usr/bin/otool", ["-arch", arch, "-L", file]));
      problems.push(...sliceProblems({ name, arch, id, libraries, has }));
    }
  }
  return problems;
}

/** Charge réellement la dylib : l'erreur de dyld, telle quelle, ou rien. */
export function dlopenProblem(file) {
  const require = createRequire(import.meta.url);
  const koffi = require("koffi");
  try {
    koffi.load(file);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, dir] = process.argv.slice(2);
  if (command !== "verify" || !dir) {
    console.error("usage : node scripts/macosDylibs.mjs verify <dossier> [--dlopen <dylib>]");
    process.exit(2);
  }
  const problems = verifyDylibDir(path.resolve(dir));
  const dlopenIndex = process.argv.indexOf("--dlopen");
  if (dlopenIndex >= 0) {
    const target = path.join(path.resolve(dir), process.argv[dlopenIndex + 1] ?? "libmpv.2.dylib");
    const failure = dlopenProblem(target);
    if (failure) problems.push(`dlopen ${path.basename(target)} (${process.arch}) : ${failure}`);
    else console.log(`  ✓ dlopen ${path.basename(target)} (${process.arch})`);
  }
  if (problems.length > 0) {
    console.error(`✗ ${problems.length} dépendance(s) non résolue(s) dans ${dir} :`);
    for (const problem of problems) console.error(`    ${problem}`);
    process.exit(1);
  }
  console.log(`  ✓ dépendances des dylibs résolues dans ${dir}`);
}
