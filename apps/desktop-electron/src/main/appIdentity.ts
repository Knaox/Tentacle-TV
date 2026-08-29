/**
 * L'identité de l'application vue par le SYSTÈME — barre de menus, Dock,
 * panneau « À propos ».
 *
 * # Le nom, et les DEUX endroits où il se décide
 *
 * Electron lit `productName` dans le `package.json` de l'application, puis `name`
 * à défaut. Faute de `productName`, c'était `name` qui servait — soit
 * `@tentacle-tv/desktop-electron`. Le champ est désormais posé, et
 * `app.getName()` répond « Tentacle TV » : le libellé du menu applicatif
 * (`menu.ts`), le panneau « À propos », et le nom que l'application donne d'elle
 * même.
 *
 * ⚠️ Mais le TITRE du menu applicatif — celui juste à droite de la pomme — n'en
 * dépend pas. AppKit le lit dans le `CFBundleName` du paquet en cours
 * d'exécution, avant que le moindre JavaScript ne tourne. En développement, ce
 * paquet est `Electron.app` : la barre affichait donc « Electron », et aucune API
 * n'y pouvait rien. C'est le paquet local qu'il faut renommer, ce que fait
 * `scripts/dev-name-macos.mjs` — rejoué à chaque `pnpm dev`, donc insensible à une
 * réinstallation. Vérifié à l'écran.
 *
 * # L'icône du Dock — EN DÉVELOPPEMENT SEULEMENT
 *
 * Elle vient du paquet elle aussi, et c'est très bien ainsi : depuis macOS 26,
 * le système MASQUE l'icône du paquet en squircle et lui ajoute son liseré, le
 * traitement que reçoivent toutes les autres icônes du Dock.
 *
 * ⚠️ Une icône posée à l'exécution ÉCHAPPE à ce traitement : `applicationIconImage`
 * est affichée telle quelle, sans masque et sans liseré, donc elle remplit toute
 * la tuile et paraît plus grosse que ses voisines. C'est le « moins Apple »
 * constaté depuis la 1.17 — belle icône application fermée, autre icône
 * application ouverte. Le paquet livré porte déjà le bon `electron.icns`, jeu de
 * tailles complet : il n'y a rien à corriger, seulement à ne pas l'écraser.
 *
 * En développement le paquet est `Electron.app`, dont l'icône est l'atome bleu.
 * Là, et là seulement, la remplacer vaut mieux que la subir.
 *
 * # Ce qui reste celui d'Electron en développement
 *
 * Le nom du PROCESSUS, tel que le montrent le Moniteur d'activité et
 * « Forcer à quitter » : il suit `CFBundleExecutable`, donc le nom du binaire.
 * Le renommer demanderait de déplacer l'exécutable dans le paquet et de tout
 * re-signer, pour un nom qui n'apparaît nulle part pendant qu'on travaille. Le
 * paquet de production, lui, porte le bon partout.
 */

import { app, nativeImage } from "electron";
import { appImagePath } from "./appIcon";

/**
 * Applique ce qui peut l'être à l'exécution. À appeler après `whenReady`.
 *
 * Sans effet hors macOS : Windows tient son nom et son icône de l'exécutable,
 * et `app.dock` n'y existe pas.
 */
export function applySystemIdentity(): void {
  const icon = appImagePath();

  // Panneau « À propos » du menu applicatif. Sans ces options, macOS le
  // remplit depuis l'`Info.plist` du paquet — donc « Electron » et sa version en
  // développement, ce qui est exactement l'information qu'on ne veut pas voir.
  app.setAboutPanelOptions({
    applicationName: app.getName(),
    applicationVersion: app.getVersion(),
    // Vidé volontairement : macOS affiche sinon DEUX numéros, la version et le
    // numéro de build, et le second n'a de sens que pour les stores.
    version: "",
    ...(icon === null ? {} : { iconPath: icon }),
  });

  if (process.platform !== "darwin" || icon === null) return;

  // ⚠️ Le paquet garde l'icône de son bundle, et c'est TOUT L'INTÉRÊT : macOS 26
  // la masque en squircle et lui pose son liseré, comme aux autres. La poser ici
  // court-circuiterait ce traitement — voir l'en-tête. Le panneau « À propos »,
  // lui, garde son `iconPath` : il affiche une image, pas une tuile de Dock.
  if (app.isPackaged) return;

  const image = nativeImage.createFromPath(icon);
  // Une image vide voudrait dire que le fichier a bougé ou changé de format :
  // la poser effacerait l'icône du Dock au lieu de la corriger.
  if (image.isEmpty()) {
    console.warn(`[identite] icone du Dock illisible : ${icon}`);
    return;
  }
  app.dock?.setIcon(image);
}
