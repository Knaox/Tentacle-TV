/**
 * Icône de la fenêtre.
 *
 * # Pourquoi il en faut une explicitement
 *
 * Sous Windows, l'icône de la barre des tâches et d'Alt-Tab est celle de
 * l'EXÉCUTABLE. En développement, l'exécutable est `electron.exe` : sans
 * `icon` passé à la fabrication, l'application porte le logo d'Electron. Une
 * fois empaquetée, l'icône est gravée dans `Tentacle TV.exe` et la question ne
 * se pose plus — on la passe quand même, pour que les deux côtés se comportent
 * de la même façon.
 *
 * # Pourquoi elle n'est pas dupliquée ici
 *
 * C'est le fichier déjà versionné par l'app Tauri, emprunté comme
 * `libmpvPath()` emprunte `libmpv-2.dll`. Le visuel est le MÊME sur les trois
 * bureaux ; deux copies finiraient par diverger, et c'est l'icône d'une marque,
 * pas un détail de plateforme.
 *
 * Les tuiles du Microsoft Store (`apps/desktop/msix/Assets/`) sont un autre
 * jeu, posé par le manifeste MSIX et recopié tel quel par le workflow.
 */

import { app } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";

/** Chemin de l'icône, ou `null` si elle est introuvable. */
export function windowIconPath(): string | null {
  const packaged = path.join(process.resourcesPath, "icon.ico");
  if (app.isPackaged && existsSync(packaged)) return packaged;
  const shared = path.resolve(__dirname, "../../../desktop/src-tauri/icons/icon.ico");
  return existsSync(shared) ? shared : null;
}
