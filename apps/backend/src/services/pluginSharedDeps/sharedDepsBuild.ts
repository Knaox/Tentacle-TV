import { execFile } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

/**
 * Là où `build:shared-deps` écrit (`scripts/build-shared-deps.js`) : le
 * `data/shared-deps` du PAQUET, quel que soit `TENTACLE_DATA_DIR`. Depuis
 * `src/services/pluginSharedDeps` comme depuis `dist/services/pluginSharedDeps`,
 * trois crans plus haut est la racine du paquet.
 */
const PACKAGE_ROOT = resolve(__dirname, "../../..");
export const SHARED_DEPS_BUILD_DIR = resolve(PACKAGE_ROOT, "data", "shared-deps");
const BUILD_SCRIPT = resolve(PACKAGE_ROOT, "scripts", "build-shared-deps.js");

/**
 * Hors production seulement, et si le script est là : l'image Docker ne le
 * porte pas (elle recopie sa semence, `docker-entrypoint.sh`), l'app Windows
 * non plus (`server-windows` › `sharedDeps.ts`).
 */
export function mayBuildSharedDeps(): boolean {
  return process.env.NODE_ENV !== "production" && existsSync(BUILD_SCRIPT);
}

/** Lance le script tel que `pnpm build:shared-deps` le lance (2 min au plus : Tailwind vient du réseau). */
export function buildSharedDeps(): Promise<void> {
  return new Promise((done, fail) => {
    execFile(process.execPath, [BUILD_SCRIPT], { cwd: PACKAGE_ROOT, timeout: 120_000 }, (error, _stdout, stderr) => {
      if (error) fail(new Error(`build:shared-deps a échoué : ${stderr.trim().slice(-300) || error.message}`));
      else done();
    });
  });
}
