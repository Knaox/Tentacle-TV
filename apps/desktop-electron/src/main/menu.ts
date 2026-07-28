/**
 * Le menu applicatif — obligatoire sur macOS, retiré partout ailleurs.
 *
 * # Pourquoi macOS ne peut pas s'en passer
 *
 * Sous Windows, les raccourcis d'édition sont traités NATIVEMENT par le moteur
 * de rendu dans les champs de saisie : supprimer le menu n'y coûte rien, et
 * l'interface étant intégralement en HTML, il n'apportait rien. Sur macOS ces
 * mêmes raccourcis passent par le menu — sans lui, Cmd+C, Cmd+V et Cmd+A ne
 * font simplement RIEN, y compris dans le champ de recherche ou de mot de passe.
 * Ce n'est pas un confort : c'est une application cassée.
 *
 * # Pourquoi aucun libellé n'est écrit ici
 *
 * Tous les éléments passent par leur `role`. macOS fournit alors lui-même le
 * libellé, DANS LA LANGUE DU SYSTÈME — « Coller » ou « Paste » selon le poste,
 * sans que nous ayons une seule chaîne à traduire ni à maintenir. Écrire les
 * libellés à la main les figerait dans une langue et les désaccorderait du
 * reste du système.
 */

import { Menu, app } from "electron";
import type { MenuItemConstructorOptions } from "electron";

/**
 * Le strict nécessaire, et rien de plus.
 *
 * Pas de menu « Fichier » ni « Affichage » : l'application n'ouvre pas de
 * document et sa navigation est en HTML. Un menu qui promet des actions
 * inexistantes est pire que pas de menu du tout. Reste donc ce que macOS
 * attend vraiment : l'entrée d'application, l'édition, et les fenêtres.
 */
function modele(): MenuItemConstructorOptions[] {
  return [
    {
      label: app.getName(),
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      role: "editMenu",
    },
    {
      // `windowMenu` porte Réduire, Zoom et le passage en plein écran — ce
      // dernier étant justement le geste que `fullscreen.ts` laisse à macOS.
      role: "windowMenu",
    },
  ];
}

/**
 * Pose le menu applicatif, ou l'enlève.
 *
 * À appeler une seule fois, après `whenReady`.
 */
export function installerMenu(): void {
  if (process.platform !== "darwin") {
    // Electron pose un menu par défaut — Fichier, Édition, Affichage, Fenêtre.
    // Il se voyait en haut de la fenêtre pendant la lecture et abîmait le plein
    // écran, pour une interface qui n'en a aucun usage.
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(modele()));
}
