/**
 * koffi pour l'hôte, réduit à Windows x64.
 *
 * Le paquet npm porte ses sources C++, les en-têtes de Node-API et, par ses
 * dépendances facultatives, un binaire par système. L'hôte ne charge que
 * `index.cjs` → `src/koffi/index.cjs` → `src/koffi/src/*.cjs`, puis le binaire
 * de `@koromix/koffi-win32-x64` (cherché à côté de `koffi` dans
 * `node_modules`). Le reste ne part pas dans le paquet.
 *
 * L'hôte est regroupé par esbuild avec `--external:koffi` : il le cherche dans
 * `apps/server-windows/node_modules`, là où cette copie le pose.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

/** Les fichiers de koffi que le chargement CommonJS lit, relatifs à son dossier. */
export function koffiFiles(srcDir: string): string[] {
  const runtime = readdirSync(join(srcDir, "src", "koffi", "src")).filter((name) => name.endsWith(".cjs"));
  return [
    "package.json",
    "index.cjs",
    "LICENSE.txt",
    join("src", "koffi", "index.cjs"),
    ...runtime.map((name) => join("src", "koffi", "src", name)),
  ];
}

export const KOFFI_WIN32_X64_FILES = ["package.json", "index.js", join("win32_x64", "koffi.node")];

function copyAll(from: string, to: string, files: readonly string[]): void {
  for (const file of files) {
    const source = join(from, file);
    if (!existsSync(source)) throw new Error(`koffi : ${source} manquant`);
    mkdirSync(dirname(join(to, file)), { recursive: true });
    copyFileSync(source, join(to, file));
  }
}

/** Copie koffi de `rootNodeModules` (le dépôt) vers `targetNodeModules` (le paquet). */
export function copyKoffi(rootNodeModules: string, targetNodeModules: string): void {
  const koffi = join(rootNodeModules, "koffi");
  copyAll(koffi, join(targetNodeModules, "koffi"), koffiFiles(koffi));
  copyAll(
    join(rootNodeModules, "@koromix", "koffi-win32-x64"),
    join(targetNodeModules, "@koromix", "koffi-win32-x64"),
    KOFFI_WIN32_X64_FILES,
  );
}
