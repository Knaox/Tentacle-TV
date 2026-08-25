/**
 * Icônes de l'application, par plateforme.
 *
 * # Pourquoi il en faut explicitement
 *
 * Sous **Windows**, l'icône de la barre des tâches et d'Alt-Tab est celle de
 * l'EXÉCUTABLE. En développement, l'exécutable est `electron.exe` : sans `icon`
 * passé à la fabrication de la fenêtre, l'application porte le logo d'Electron.
 * Une fois empaquetée, l'icône est gravée dans `Tentacle TV.exe` et la question
 * ne se pose plus — on la passe quand même, pour que les deux côtés se
 * comportent de la même façon.
 *
 * Sur **macOS**, une fenêtre n'a pas d'icône du tout : c'est le DOCK qui en porte
 * une, et elle vient du paquet. En développement le paquet est `Electron.app`,
 * donc le Dock affiche le logo d'Electron — on la remplace à l'exécution (voir
 * `appIdentity.ts`).
 *
 * # Pourquoi le format compte
 *
 * `icon.ico` est un format Windows. Le passer à `nativeImage` sur macOS ne lève
 * aucune erreur : il rend une image VIDE, et l'icône du Dock reste celle
 * d'Electron sans que rien ne le signale. D'où la sélection par plateforme.
 *
 * # Pourquoi elles ne sont pas dupliquées ici
 *
 * Ce sont les fichiers déjà versionnés par l'app Tauri, empruntés comme
 * `libmpvPath()` emprunte `libmpv-2.dll`. Le visuel est le MÊME sur les trois
 * bureaux ; deux copies finiraient par diverger, et c'est l'icône d'une marque,
 * pas un détail de plateforme.
 *
 * Les tuiles du Microsoft Store (`apps/desktop/msix/Assets/`) sont un autre jeu,
 * posé par le manifeste MSIX et recopié tel quel par le workflow.
 */

import { app } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";

/** Icône empaquetée si elle existe, icône partagée de l'app Tauri sinon. */
function resoudre(fichier: string): string | null {
  const empaquetee = path.join(process.resourcesPath, fichier);
  if (app.isPackaged && existsSync(empaquetee)) return empaquetee;
  const partagee = path.resolve(__dirname, `../../icons/${fichier}`);
  return existsSync(partagee) ? partagee : null;
}

/**
 * Icône de la FENÊTRE. `null` sur macOS : il n'en pose pas sur ses fenêtres, et
 * lui donner un `.ico` n'y introduirait qu'une image vide.
 */
export function windowIconPath(): string | null {
  if (process.platform === "darwin") return null;
  return resoudre("icon.ico");
}

/**
 * Icône matricielle de l'application — Dock de macOS, panneau « À propos ».
 *
 * Un PNG, et non `icon.icns` : `nativeImage` ne lit pas l'ICNS, et son échec est
 * silencieux. 512 px suffisent, macOS met à l'échelle.
 */
export function appImagePath(): string | null {
  return resoudre("icon.png");
}
