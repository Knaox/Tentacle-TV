import { existsSync } from "fs";
import { resolve } from "path";
import { DATA_ROOT } from "../dataDir";
import { buildSharedDeps, mayBuildSharedDeps, SHARED_DEPS_BUILD_DIR } from "./sharedDepsBuild";

/**
 * Où trouver les dépendances partagées des pages d'extension (`shared-deps.js`,
 * `tailwind.js`) — sans elles, AUCUNE page d'extension ne s'ouvre.
 *
 * Avant, la route ne les cherchait que dans le dossier de données
 * (`DATA_ROOT/shared-deps`), où seules l'image Docker et l'app Windows les
 * recopient. Un serveur lancé depuis les sources avec `TENTACLE_DATA_DIR`
 * (un banc), ou un dépôt où `build:shared-deps` n'avait jamais tourné,
 * répondait 404 — que la page lisait « serveur trop ancien » (vécu : la page
 * d'administration de Sillon, 24/10).
 *
 * Désormais : le dossier de données d'abord (la semence de l'image y est
 * fraîche), puis la sortie du build du paquet ; hors production, rien de tout
 * cela → le build se lance UNE fois, et la demande l'attend.
 */

export type SharedDepName = "shared-deps.js" | "tailwind.js";

export interface SharedDepsSources {
  dirs: readonly string[];
  mayBuild: () => boolean;
  build: () => Promise<void>;
}

/** Les dossiers à lire, dans l'ordre, sans doublon (sans `TENTACLE_DATA_DIR`, ils se confondent). */
export function sharedDepsDirs(dataRoot: string, buildDir: string): string[] {
  return [...new Set([resolve(dataRoot, "shared-deps"), resolve(buildDir)])];
}

export function findSharedDep(name: SharedDepName, dirs: readonly string[]): string | null {
  for (const dir of dirs) {
    const path = resolve(dir, name);
    if (existsSync(path)) return path;
  }
  return null;
}

/** Un localisateur : un seul build à la fois, retenté à la demande suivante s'il a échoué. */
export function createSharedDepsLocator(sources: SharedDepsSources) {
  let building: Promise<void> | null = null;
  return async function locate(name: SharedDepName): Promise<string | null> {
    const found = findSharedDep(name, sources.dirs);
    if (found || !sources.mayBuild()) return found;
    building ??= sources.build().finally(() => { building = null; });
    try {
      await building;
    } catch (error) {
      console.warn(`[plugins] ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
    return findSharedDep(name, sources.dirs);
  };
}

export const locateSharedDep = createSharedDepsLocator({
  dirs: sharedDepsDirs(DATA_ROOT, SHARED_DEPS_BUILD_DIR),
  mayBuild: mayBuildSharedDeps,
  build: buildSharedDeps,
});
