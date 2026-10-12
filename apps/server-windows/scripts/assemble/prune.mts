/**
 * L'élagage des dépendances de production, pour le paquet Windows.
 *
 * Jumeau de `apps/backend/docker/prune-node-modules.sh` (l'image Docker), aux
 * MÊMES règles — en Node, parce que le runner Windows n'a pas de `find` sûr
 * (celui de System32 n'est pas celui de POSIX). Toute règle changée là se
 * reporte ici ; `prune.test.ts` tient les cas qui comptent, dont le moteur
 * Prisma de Windows (`query_engine-windows.dll.node`, SANS « lib »).
 */
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/** Ce que le client Prisma généré garde à son premier niveau. */
export function keepsPrismaClientFile(name: string): boolean {
  return (
    name === "index.js" ||
    name === "default.js" ||
    name === "package.json" ||
    name === "schema.prisma" ||
    name.startsWith("libquery_engine-") ||
    /^query_engine-.*\.dll\.node$/.test(name)
  );
}

/** Licences et avis : MIT, ISC, BSD et BlueOak exigent leur texte avec chaque copie. */
function isNotice(name: string): boolean {
  return /^(licen[cs]e|copying|notice)/i.test(name);
}

/** Un fichier qui ne s'exécute pas : carte, type, source TS, doc, configuration. */
export function isDeadFile(name: string): boolean {
  if (isNotice(name)) return false;
  return (
    /\.(map|ts|mts|cts|md|markdown|tsbuildinfo)$/.test(name) ||
    /^(changelog|history)/i.test(name) ||
    name === ".npmignore" ||
    name === ".editorconfig" ||
    name.startsWith(".eslintrc") ||
    name.startsWith(".prettierrc") ||
    /^tsconfig.*\.json$/.test(name)
  );
}

const DEAD_DIRS = new Set(["test", "tests", "__tests__", "docs", "example", "examples", ".github", "benchmarks"]);

export function isDeadDir(name: string): boolean {
  return DEAD_DIRS.has(name);
}

function entries(dir: string): { name: string; isDir: boolean }[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).map((entry) => ({ name: entry.name, isDir: entry.isDirectory() }));
  } catch {
    return [];
  }
}

/** Le runtime de `@prisma/client` : tout sauf `library.js`, à toute profondeur. */
function prunePrismaRuntime(dir: string): void {
  for (const entry of entries(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDir) prunePrismaRuntime(path);
    else if (entry.name !== "library.js") rmSync(path, { force: true });
  }
}

function pruneTree(dir: string): number {
  let removed = 0;
  for (const entry of entries(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDir && isDeadDir(entry.name)) {
      rmSync(path, { recursive: true, force: true });
      removed++;
    } else if (entry.isDir) {
      removed += pruneTree(path);
    } else if (isDeadFile(entry.name)) {
      rmSync(path, { force: true });
      removed++;
    }
  }
  return removed;
}

/** Élague `nodeModules` en place ; rend le nombre d'entrées retirées par l'arbre. */
export function pruneNodeModules(nodeModules: string): number {
  prunePrismaRuntime(join(nodeModules, "@prisma", "client", "runtime"));
  for (const gone of [["@prisma", "client", "generator-build"], ["@prisma", "client", "scripts"], ["@prisma", "engines"], ["prisma"]]) {
    rmSync(join(nodeModules, ...gone), { recursive: true, force: true });
  }
  const generated = join(nodeModules, ".prisma", "client");
  for (const entry of entries(generated)) {
    if (!entry.isDir && !keepsPrismaClientFile(entry.name)) rmSync(join(generated, entry.name), { force: true });
  }
  return pruneTree(nodeModules);
}
