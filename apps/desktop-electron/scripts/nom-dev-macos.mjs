/**
 * Renomme le paquet Electron de DÉVELOPPEMENT, sur macOS.
 *
 * # Pourquoi un script, et pas une ligne de code
 *
 * Le titre du menu applicatif de macOS — celui juste à droite de la pomme — ne
 * vient PAS de l'application. AppKit le lit dans le `CFBundleName` du paquet en
 * cours d'exécution, avant que le moindre JavaScript ne tourne. `productName`,
 * `app.setName()` et le libellé du premier menu n'y changent donc rien : en
 * développement, le paquet est `Electron.app`, et la barre affiche « Electron ».
 *
 * Le seul levier est le paquet lui-même. Ce script y pose le nom du produit,
 * dans la copie LOCALE d'Electron et nulle part ailleurs.
 *
 * # Ce qu'il ne touche pas
 *
 * Rien de ce qui est livré. Le paquet macOS de production porte son nom depuis
 * son propre `Info.plist`, produit à l'empaquetage. Ce script ne concerne que
 * `node_modules`, donc la machine du développeur — et il est rejoué à chaque
 * `pnpm dev`, ce qui le rend insensible à une réinstallation qui remettrait le
 * fichier d'origine.
 *
 * # Pourquoi il faut re-signer
 *
 * ⚠️ Le paquet d'Electron est signé « ad hoc », et macOS refuse de lancer un
 * paquet dont l'`Info.plist` ne correspond plus au sceau — sur Apple Silicon,
 * c'est une erreur de signature au démarrage, pas un avertissement. On re-signe
 * donc le paquet extérieur après l'édition. Les cadres et les processus d'aide
 * gardent la leur : seul le sceau du dessus a été rompu.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const NOM = "Tentacle TV";
const ICI = path.dirname(fileURLToPath(import.meta.url));
const PAQUET = path.resolve(ICI, "../../../node_modules/electron/dist/Electron.app");
const PLIST = path.join(PAQUET, "Contents/Info.plist");

/** Rien à faire ailleurs : le nom vient de l'exécutable sous Windows. */
if (process.platform !== "darwin") process.exit(0);

if (!existsSync(PLIST)) {
  console.warn(`[nom-dev] paquet Electron introuvable : ${PAQUET}`);
  process.exit(0);
}

const lire = (cle) => {
  try {
    return execFileSync("/usr/libexec/PlistBuddy", ["-c", `Print :${cle}`, PLIST], {
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
};

// Déjà posé : on ne re-signe pas pour rien, ça coûte quelques secondes.
if (lire("CFBundleName") === NOM) process.exit(0);

const poser = (cle, valeur) => {
  try {
    execFileSync("/usr/libexec/PlistBuddy", ["-c", `Set :${cle} ${valeur}`, PLIST]);
  } catch {
    execFileSync("/usr/libexec/PlistBuddy", ["-c", `Add :${cle} string ${valeur}`, PLIST]);
  }
};

// `CFBundleName` porte le menu applicatif ; `CFBundleDisplayName` porte le nom
// affiché au survol de l'icône du Dock et dans « Forcer à quitter ».
poser("CFBundleName", NOM);
poser("CFBundleDisplayName", NOM);

try {
  execFileSync("/usr/bin/codesign", ["--force", "--sign", "-", PAQUET], { stdio: "pipe" });
  execFileSync("/usr/bin/codesign", ["--verify", "--verbose=1", PAQUET], { stdio: "pipe" });
  console.log(`[nom-dev] paquet Electron renommé « ${NOM} » et re-signé`);
} catch (e) {
  // Sans signature valide, le paquet ne se lance plus : on le dit fort, et on
  // laisse le développeur relancer `pnpm install` pour retrouver l'original.
  console.error(
    `[nom-dev] re-signature échouée — relancez « pnpm install --force » pour restaurer Electron.\n${String(e)}`,
  );
  process.exit(1);
}
