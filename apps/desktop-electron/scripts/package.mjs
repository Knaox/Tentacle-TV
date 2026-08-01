/**
 * Empaquetage Windows.
 *
 * # Pourquoi `@electron/packager` et pas electron-builder
 *
 * Le MSIX n'est pas produit par un bundler : `desktop.yml` assemble un dossier
 * à la main et appelle `makeappx pack /d`. Il faut donc simplement un dossier
 * `Tentacle TV.exe` + `resources/`, ce que packager pose sans NSIS ni
 * configuration de signature à combattre.
 *
 * ⚠️ Le nom de l'exécutable est IMPOSÉ par `Package.appxmanifest`
 * (`Executable="Tentacle TV.exe"`). En changer, c'est un paquet qui s'installe
 * et ne se lance pas.
 *
 * # Le dossier de préparation, et pourquoi il existe
 *
 * Le dépôt est en `node-linker=hoisted` : `koffi` et son binaire natif vivent à
 * la RACINE du monorepo, pas sous `apps/desktop-electron/node_modules/`. Un
 * packager laissé à lui-même n'embarquerait donc pas le lecteur, et
 * l'application démarrerait sans jamais pouvoir lire quoi que ce soit. On
 * assemble le dossier nous-mêmes — même geste que l'assemblage MSIX, et pour
 * la même raison : c'est déterministe.
 *
 * # Ce script ne sait produire QUE de la production
 *
 * Il n'existe aucun drapeau de diagnostic, et c'est délibéré : outils de
 * développement, relais de console et journal du protocole sont gardés par
 * `app.isPackaged`, donc absents de tout paquet, sans moyen de les y rallumer.
 * Le diagnostic se fait en `pnpm dev:electron`.
 *
 *   node scripts/package.mjs [--out <dossier>]
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packager } from "@electron/packager";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(ICI, "..");
const RACINE = path.resolve(APP, "../..");

/** Nom du produit, et donc de l'exécutable. Voir l'avertissement en tête. */
const NOM = "Tentacle TV";

/**
 * Modules à embarquer.
 *
 * `koffi` charge son binaire depuis un paquet SÉPARÉ,
 * `@koromix/koffi-win32-x64` : oublier le second donne une erreur au premier
 * `mpv_create`, c'est-à-dire au premier film.
 */
const MODULES = ["koffi", "@koromix/koffi-win32-x64", "zod"];

function argument(nom, defaut) {
  const index = process.argv.indexOf(nom);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : defaut;
}

function copier(source, cible, quoi) {
  if (!existsSync(source)) throw new Error(`${quoi} introuvable : ${source}`);
  mkdirSync(path.dirname(cible), { recursive: true });
  cpSync(source, cible, { recursive: true });
}

/** Assemble ce que packager doit voir comme « l'application ». */
function preparer(stage) {
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });

  copier(path.join(APP, "dist"), path.join(stage, "dist"), "build de la coquille");

  // Un `package.json` réduit : packager y lit `main`, `name` et `version`, et
  // rien d'autre n'a de sens dans un paquet livré (scripts, devDependencies).
  const source = JSON.parse(readFileSync(path.join(APP, "package.json"), "utf8"));
  writeFileSync(
    path.join(stage, "package.json"),
    `${JSON.stringify(
      {
        name: "tentacle-tv",
        productName: NOM,
        version: source.version,
        main: source.main,
        author: "Damien ROUGE",
        license: source.license ?? "UNLICENSED",
      },
      null,
      2,
    )}\n`,
  );

  for (const module of MODULES) {
    copier(path.join(RACINE, "node_modules", module), path.join(stage, "node_modules", module), module);
  }
}

/** Ressources hors application : le build web et libmpv. */
function preparerRessources(stage) {
  const ressources = path.join(stage, "..", "resources");
  rmSync(ressources, { recursive: true, force: true });

  // Les noms de dossier comptent : `extraResource` copie le BASENAME, et
  // `webRoot()` et `libmpvPath()` cherchent `resources/web` et `resources/lib`.
  copier(path.resolve(RACINE, "apps/web/dist"), path.join(ressources, "web"), "build web");
  copier(
    path.resolve(RACINE, "apps/desktop/src-tauri/lib/libmpv-2.dll"),
    path.join(ressources, "lib", "libmpv-2.dll"),
    "libmpv-2.dll",
  );
  // L'icône est gravée dans l'exe par packager, mais `windowIconPath()` la
  // cherche aussi à l'exécution — même visuel des deux côtés.
  copier(
    path.resolve(RACINE, "apps/desktop/src-tauri/icons/icon.ico"),
    path.join(ressources, "icon.ico"),
    "icone",
  );
  return [
    path.join(ressources, "web"),
    path.join(ressources, "lib"),
    path.join(ressources, "icon.ico"),
  ];
}

const sortie = path.resolve(APP, argument("--out", "release"));
const stage = path.join(sortie, "stage", "app");

preparer(stage);
const extraResource = preparerRessources(stage);

const chemins = await packager({
  dir: stage,
  out: sortie,
  name: NOM,
  executableName: NOM,
  platform: "win32",
  arch: "x64",
  overwrite: true,
  // `prune` lancerait `npm prune` dans un workspace pnpm hoisté. Le dossier de
  // préparation ne contient DÉJÀ que ce qu'il faut : il n'y a rien à élaguer.
  prune: false,
  // ⚠️ Les binaires natifs SORTENT de l'archive. Electron sait certes charger
  // un `.node` depuis une asar, mais en le recopiant dans un dossier temporaire
  // à chaque lancement — inutile, et à la merci d'une politique d'antivirus ou
  // d'un `%TEMP%` verrouillé. Ici le premier `.node` en jeu est celui de koffi,
  // chargé au DÉMARRAGE : un échec ne dégraderait pas la lecture, il
  // empêcherait l'application de s'ouvrir.
  asar: { unpack: "**/*.node" },
  icon: path.resolve(RACINE, "apps/desktop/src-tauri/icons/icon.ico"),
  extraResource,
  appCopyright: "Damien ROUGE",
});

console.log(`Paquet assemble : ${chemins.join(", ")}`);
