/**
 * Empaquetage Linux : un dossier, puis quatre formats.
 *
 * # Deux outils, et pourquoi pas un seul
 *
 * `@electron/packager` assemble le dossier applicatif — exactement comme pour
 * Windows, et pour la même raison : le dépôt est en `node-linker=hoisted`, koffi
 * vit à la RACINE du monorepo, et un empaqueteur laissé à lui-même n'embarquerait
 * pas le lecteur.
 *
 * `electron-builder` n'intervient qu'ENSUITE, en mode `prepackaged` : il ne
 * reconstruit rien, il enveloppe le dossier dans un `.deb`, un `.rpm`, une
 * AppImage et un `.pkg.tar.zst`. C'est la seule chose qu'on lui demande, et la
 * seule qu'il fasse mieux que nous — produire ces quatre formats à la main, ce
 * serait réécrire quatre outils de paquetage.
 *
 * ⚠️ Il ne touche NI Windows NI macOS : ces deux-là gardent leurs scripts, leurs
 * signatures et leurs contraintes de store. Une seule porte d'entrée pour lui.
 *
 * # Ce que le paquet emporte
 *
 * Le build web, l'icône, et **notre libmpv** — pas celle de la distribution.
 * Mesuré : la `mpv-libs` de Fedora 44 n'a pas de décodeur HEVC (voir
 * `docs/LINUX-FENETRE-VIDEO.md`), et un client Jellyfin sans HEVC ne lit pas la
 * moitié d'une médiathèque.
 *
 *   node scripts/package-linux.mjs [--out <dossier>] [--lib <dossier libmpv>]
 *                                  [--arch x64|arm64] [--targets deb,rpm,...]
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packager } from "@electron/packager";
import { prepareLegacyCompat } from "./linux/legacyCompat.mjs";
import { Arch, build, Platform } from "electron-builder";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(HERE, "..");
const ROOT = path.resolve(APP_DIR, "../..");

/** Nom affiché. L'exécutable, lui, garde la forme courte des binaires Unix. */
const PRODUCT_NAME = "Tentacle TV";
/**
 * Nom de l'exécutable — et, par ricochet, celui que le bureau associe à la
 * fenêtre. `StartupWMClass` doit lui correspondre, sinon la fenêtre ouverte
 * n'est pas reconnue comme étant celle du lanceur : deux icônes dans la barre
 * des tâches, et un « épingler » qui épingle la mauvaise.
 */
const EXECUTABLE_NAME = "tentacle-tv";
const IDENTIFIER = "com.tentacle.media";

function argFlag(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

/**
 * ⚠️ `verbatimSymlinks: true`, et ce n'est pas un détail de style.
 *
 * Par défaut, `cpSync` RÉSOUT les liens symboliques : un `libmpv.so.2` ->
 * libmpv.so.2.5.0` relatif, parfaitement valable, est recopié en chemin
 * ABSOLU vers le dossier de compilation. Sur la machine de l'utilisateur ce
 * lien pointe dans le vide.
 *
 * Ce que ça a coûté, mesuré sur la 1.20.9 publiée : l'AppImage contenait bien
 * les 28 Mo de `libmpv.so.2.5.0`, mais `libmpv.so.2` — le nom que cherche
 * `mpvLib.ts` — pointait vers `/home/runner/.cache/...`. `existsSync` répondait
 * NON, l'application se rabattait en silence sur la libmpv de la distribution,
 * et le HEVC comme le HDR n'étaient plus garantis. Toute la raison d'embarquer
 * mpv était perdue, sans qu'aucune erreur ne le dise.
 */
function copyInto(source, target, what) {
  if (!existsSync(source)) throw new Error(`${what} introuvable : ${source}`);
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true, verbatimSymlinks: true });
}

const arch = argFlag("--arch", "x64");
const output = path.resolve(APP_DIR, argFlag("--out", "release-linux"));
const stage = path.join(output, "stage", "app");
const libSource = path.resolve(argFlag("--lib", path.join(ROOT, "apps/desktop-electron/lib/mpv-linux")));

/** Assemble ce que packager doit voir comme « l'application ». */
function prepare() {
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  copyInto(path.join(APP_DIR, "dist"), path.join(stage, "dist"), "build de la coquille");

  const source = JSON.parse(readFileSync(path.join(APP_DIR, "package.json"), "utf8"));
  writeFileSync(
    path.join(stage, "package.json"),
    `${JSON.stringify(
      // `desktopName` : c'est CE package.json (embarqué dans l'asar) qu'Electron
      // lit à l'exécution pour poser l'app_id Wayland / WM_CLASS. Sans lui,
      // l'app_id ne tenait que par la dérivation de productName — « Tentacle
      // TV » → tentacle-tv.desktop, une coïncidence qu'un renommage briserait
      // en silence (icône de barre des tâches perdue).
      { name: EXECUTABLE_NAME, productName: PRODUCT_NAME, version: source.version, main: source.main,
        desktopName: `${EXECUTABLE_NAME}.desktop`,
        author: "Damien ROUGE", license: source.license ?? "UNLICENSED" },
      null, 2,
    )}\n`,
  );

  // `koffi` charge son binaire depuis un paquet SÉPARÉ : l'oublier donne une
  // erreur au premier `mpv_create`, c'est-à-dire au premier film.
  for (const module of ["koffi", `@koromix/koffi-linux-${arch}`, "zod"]) {
    copyInto(path.join(ROOT, "node_modules", module), path.join(stage, "node_modules", module), module);
  }
}

/**
 * Le jeu d'icônes attendu par electron-builder : un dossier, un fichier par
 * taille. Donné un seul PNG, il n'en installe qu'une — et l'application paraît
 * floue partout où le bureau demande autre chose que du 512.
 */
function prepareIcons() {
  const source = path.resolve(ROOT, "apps/desktop-electron/icons");
  const target = path.join(output, "icones");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const [from, to] of [
    ["32x32.png", "32x32.png"],
    ["64x64.png", "64x64.png"],
    ["128x128.png", "128x128.png"],
    ["128x128@2x.png", "256x256.png"],
    ["icon.png", "512x512.png"],
  ]) {
    copyInto(path.join(source, from), path.join(target, to), `icône ${to}`);
  }
  return target;
}

/** Ressources hors application : le build web, libmpv, l'icône. */
function prepareResources() {
  const resources = path.join(output, "resources-linux");
  rmSync(resources, { recursive: true, force: true });
  copyInto(path.resolve(ROOT, "apps/web/dist"), path.join(resources, "web"), "build web");
  copyInto(path.resolve(ROOT, "apps/desktop-electron/icons/icon.png"), path.join(resources, "icon.png"), "icone");

  // La chaîne mpv est facultative au moment de l'empaquetage — un paquet sans
  // elle se rabat sur celle du système, en le disant (`mpvLib.ts`). Le taire
  // ferait livrer un lecteur sans HEVC sans que personne ne s'en aperçoive.
  const lib = path.join(libSource, "libmpv.so.2");
  if (existsSync(lib)) {
    copyInto(libSource, path.join(resources, "lib"), "chaîne mpv");
    // La VÉRIFICATION, et pas seulement la copie : `existsSync` suit les liens,
    // donc elle échoue exactement là où l'application échouerait. C'est ce qui
    // manquait quand la 1.20.9 est partie avec un lien mort vers le dossier du
    // runner — le paquet pesait ses 28 Mo de libmpv et ne s'en servait pas.
    const livree = path.join(resources, "lib", "libmpv.so.2");
    if (!existsSync(livree)) {
      throw new Error(
        `chaîne mpv copiée mais ${livree} ne se résout pas — lien symbolique cassé.\n` +
          "    L'application se rabattrait en silence sur la libmpv de la distribution.",
      );
    }
  } else {
    console.warn(
      `⚠️  libmpv.so.2 absente de ${libSource} : le paquet se rabattra sur celle de\n` +
        "    la distribution, qui n'a pas forcément de décodeur HEVC.\n" +
        "    → bash apps/desktop-electron/scripts/build-mpv-linux.sh",
    );
  }
  return [path.join(resources, "web"), path.join(resources, "icon.png"),
    ...(existsSync(lib) ? [path.join(resources, "lib")] : [])];
}

prepare();
const extraResource = prepareResources();
const iconsFolder = prepareIcons();
const legacyCompat = prepareLegacyCompat(output, PRODUCT_NAME, EXECUTABLE_NAME);

const [bundleFolder] = await packager({
  dir: stage, out: output, name: EXECUTABLE_NAME, executableName: EXECUTABLE_NAME,
  platform: "linux", arch, overwrite: true,
  // `prune` lancerait `npm prune` dans un workspace pnpm hoisté : le dossier de
  // préparation ne contient DÉJÀ que ce qu'il faut.
  prune: false,
  // Les binaires natifs sortent de l'archive : koffi est chargé au DÉMARRAGE,
  // et un `.node` recopié dans un dossier temporaire à chaque lancement est une
  // dépendance de plus à un `/tmp` qu'on ne maîtrise pas.
  asar: { unpack: "**/*.node" },
  extraResource,
  appCopyright: "Damien ROUGE",
});
console.log(`Dossier assemblé : ${bundleFolder}`);

/**
 * La version d'Electron, lue dans le module INSTALLÉ.
 *
 * electron-builder refuse une plage (`^43.2.0`) : il télécharge des binaires
 * d'une version précise. La lire ici plutôt que d'épingler la dépendance évite
 * de figer ce que `pnpm` gère très bien, et garantit que le paquet est bâti sur
 * l'Electron avec lequel on vient de tester.
 */
const electronVersion = JSON.parse(
  readFileSync(path.join(ROOT, "node_modules/electron/package.json"), "utf8"),
).version;

const formats = argFlag("--targets", "deb,rpm,AppImage,pacman").split(",").filter(Boolean);
const results = await build({
  targets: Platform.LINUX.createTarget(formats, arch === "arm64" ? Arch.arm64 : Arch.x64),
  prepackaged: bundleFolder,
  config: {
    electronVersion,
    appId: IDENTIFIER,
    // ⚠️ La forme COURTE, et pas le nom affiché. `productName` sert ici de nom
    // de PAQUET et de dossier d'installation : « Tentacle TV » y mettrait une
    // espace, ce que rpm refuse dans un nom de paquet et que personne ne veut
    // dans un chemin. Le nom affiché, lui, est posé sur l'entrée de bureau et
    // dans le `package.json` de l'application — l'utilisateur ne voit que celui-là.
    productName: EXECUTABLE_NAME,
    copyright: "Damien ROUGE",
    directories: { output: path.join(output, "paquets") },
    // ⚠️ Sans cette ligne, le fichier s'appelle « @tentacle-tv/desktop-electron_… » :
    // electron-builder nomme d'après le `name` du package.json, qui est ici un
    // nom d'espace pnpm. Le manifeste d'auto-update et le script d'installation
    // repèrent les assets par leur extension, mais un nom pareil se retrouverait
    // tel quel sur la page de release.
    artifactName: "tentacle-tv_${version}_${arch}.${ext}",
    linux: {
      executableName: EXECUTABLE_NAME,
      // Fait poser à Electron le même `app_id` Wayland / `WM_CLASS` X11 que le
      // nom du fichier `.desktop`. Sans elle, le bureau ne rattache pas la
      // fenêtre au lanceur — et electron-builder le dit lui-même à chaque build.
      syncDesktopName: true,
      icon: iconsFolder,
      category: "AudioVideo;Video;Player;",
      // `description` devient le `Comment=` du fichier `.desktop` : une ligne,
      // pas un paragraphe — c'est l'infobulle du menu des applications.
      synopsis: "Client Jellyfin premium",
      description: "Client Jellyfin premium — lecteur mpv natif, HDR, hors ligne",
      maintainer: "Damien ROUGE <damienrouge@hotmail.com>",
      desktop: {
        entry: {
          Name: PRODUCT_NAME,
          Keywords: "jellyfin;media;video;film;serie;streaming;",
          // ⚠️ Sans cette ligne, la fenêtre ouverte n'est pas rattachée au
          // lanceur : deux entrées dans la barre des tâches, et « épingler »
          // épingle celle qui ne relance rien.
          StartupWMClass: EXECUTABLE_NAME,
        },
      },
    },
    // Ce que le paquet ne peut pas emporter : le chargeur Vulkan, qui doit être
    // celui du système pour trouver les pilotes installés, et les bibliothèques
    // du bureau dont Electron dépend.
    //
    // `fpm: legacyCompat` ajoute les deux fichiers hérités de l'app Tauri — pas
    // l'AppImage, qui n'installe rien dans le système (voir `prepareLegacyCompat`).
    deb: { fpm: legacyCompat, depends: ["libgtk-3-0 | libgtk-3-0t64", "libnotify4", "libnss3", "libxtst6",
      "xdg-utils", "libatspi2.0-0 | libatspi2.0-0t64", "libsecret-1-0", "libvulkan1",
      "libasound2 | libasound2t64"] },
    rpm: { fpm: legacyCompat, depends: ["gtk3", "libnotify", "nss", "libXtst", "xdg-utils", "at-spi2-core",
      "libsecret", "vulkan-loader", "alsa-lib"] },
    pacman: { fpm: legacyCompat, depends: ["gtk3", "libnotify", "nss", "libxtst", "xdg-utils", "at-spi2-core",
      "libsecret", "vulkan-icd-loader", "alsa-lib"] },
    // Rien à publier depuis ici : la CI attache les fichiers à la release.
    publish: null,
  },
});
console.log(`Paquets produits :\n  ${results.join("\n  ")}`);
