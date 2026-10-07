// Les licences DANS le paquet macOS. packager pose `LICENSE` (Electron) et
// `LICENSES.chromium.html` à CÔTÉ du `.app`, et `flat()` n'emballe que le
// `.app` : le Mac App Store les perdait. Elles vont, avec celles de Tentacle
// TV (AGPL et ses permissions) et l'inventaire des tiers, dans
// `Contents/Resources/licenses`, avant la signature qui les scelle. Rien
// d'exécutable : aucun droit à poser.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/** Le dossier `dist` du paquet npm d'Electron : il porte LICENSE et les avis de Chromium. */
export function electronDist() {
  return path.join(path.dirname(createRequire(import.meta.url).resolve("electron/package.json")), "dist");
}

/** Le fichier tel que packager l'a posé, sinon celui du paquet d'Electron (fusion universelle). */
function electronFile(packagedDir, name, dist) {
  const posed = path.join(packagedDir, name);
  return existsSync(posed) ? posed : path.join(dist, name);
}

/** Les fichiers posés : source (relative à son dossier) → nom dans le paquet. */
export function licenseFiles(packagedDir, { root, appDir, dist = electronDist() }) {
  return [
    [electronFile(packagedDir, "LICENSE", dist), "LICENSE.electron.txt"],
    [electronFile(packagedDir, "LICENSES.chromium.html", dist), "LICENSES.chromium.html"],
    [path.join(root, "LICENSE"), "LICENSE.tentacle-tv.txt"],
    [path.join(root, "LICENSE-EXCEPTIONS"), "LICENSE-EXCEPTIONS.txt"],
    [path.join(appDir, "THIRD-PARTY-LICENSES.md"), "THIRD-PARTY-LICENSES.md"],
  ];
}

export function placeLicenses(appPath, packagedDir, dirs) {
  const target = path.join(appPath, "Contents", "Resources", "licenses");
  mkdirSync(target, { recursive: true });
  for (const [source, name] of licenseFiles(packagedDir, dirs)) {
    if (!existsSync(source)) throw new Error(`licence introuvable : ${source}`);
    cpSync(source, path.join(target, name));
  }
  console.log("[macos] licences posées dans Contents/Resources/licenses");
  return target;
}
