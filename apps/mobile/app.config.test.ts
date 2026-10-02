/**
 * La version serveur minimale du mobile n'a qu'une source, versions.json :
 * app.config.ts la pose dans `extra`, expo-constants l'écrit dans le binaire au
 * build natif. Ces tests rejouent ce chemin, script d'expo-constants compris.
 *
 * Le premier lit `versions.json → minServer`, une clé que
 * .github/scripts/quality-target.mjs tient pour NEUTRE (un bump du bot hérite du
 * verdict de son parent). Elle le reste : il compare la config embarquée à ce
 * fichier même, son verdict ne dépend pas de la valeur.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import appConfig from "./app.config";

const mobileRoot = dirname(fileURLToPath(import.meta.url));
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

const tempDirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "tentacle-app-config-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("config Expo du mobile", () => {
  it("la config qu'embarque expo-constants porte le minServer de versions.json", () => {
    // Le script même que lancent la phase Xcode du pod EXConstants et la tâche
    // Gradle `createExpoConfig` : le fichier `app.config` qu'il écrit est ce
    // que l'app lit dans `Constants.expoConfig`.
    const constantsDir = dirname(createRequire(import.meta.url).resolve("expo-constants/package.json"));
    const out = tempDir();
    execFileSync(process.execPath, [join(constantsDir, "scripts/getAppConfig.js"), mobileRoot, out], { stdio: "pipe" });

    const embedded = readJson(join(out, "app.config"));
    const { minServer } = readJson(join(mobileRoot, "../../versions.json"));
    const { extra } = readJson(join(mobileRoot, "app.json")).expo;
    expect(embedded.extra).toEqual({ ...extra, minServer });
  }, 30_000);

  it("app.json n'en porte pas de copie — elle finirait par mentir", () => {
    expect(readJson(join(mobileRoot, "app.json")).expo.extra).not.toHaveProperty("minServer");
  });
});

describe("app.config.ts", () => {
  /** Un faux dépôt : versions.json à la racine, le projet deux étages plus bas. */
  const configFor = (versions: unknown) => {
    const root = tempDir();
    writeFileSync(join(root, "versions.json"), JSON.stringify(versions));
    return appConfig({
      projectRoot: join(root, "apps", "mobile"),
      staticConfigPath: null,
      packageJsonPath: null,
      config: { name: "Tentacle TV", slug: "tentacle-mobile", extra: { router: { origin: false } } },
    });
  };

  it("pose minServer sans rien retirer du reste de la config", () => {
    const config = configFor({ server: "9.9.0", minServer: "9.8.7" });
    expect(config.extra).toEqual({ router: { origin: false }, minServer: "9.8.7" });
    expect(config.name).toBe("Tentacle TV");
  });

  it.each([{}, { minServer: "" }, { minServer: "1.22" }, { minServer: "v1.22.1" }, { minServer: 1.22 }])(
    "arrête le build plutôt que de retomber sur « 0.0.0 » : %j",
    (versions) => {
      expect(() => configFor(versions)).toThrow(/minServer illisible/);
    },
  );
});
