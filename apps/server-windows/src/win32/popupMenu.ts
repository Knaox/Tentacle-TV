/**
 * Dessine le menu du modèle (`tray/menuModel.ts`) et rend la commande choisie.
 *
 * `TrackPopupMenuEx` est une boucle modale : elle rend la main quand le menu
 * se ferme, avec l'identifiant choisi (`TPM_RETURNCMD`). Les deux gestes
 * autour sont ceux que demande la doc de Windows pour un menu d'icône : la
 * fenêtre passe au premier plan AVANT (sinon le menu ne se ferme pas en
 * cliquant ailleurs), puis un `WM_NULL` APRÈS.
 *
 * ⚠️ Ne se charge que sous Windows.
 */
import koffi from "koffi";
import type { MenuCommand, MenuEntry } from "../tray/menuModel";
import * as w from "./user32";

function fill(menu: unknown, entries: readonly MenuEntry[], commands: MenuCommand[]): void {
  for (const entry of entries) {
    switch (entry.kind) {
      case "separator":
        w.AppendMenuW(menu, w.MF.SEPARATOR, 0, null);
        break;
      case "label":
        w.AppendMenuW(menu, w.MF.STRING | w.MF.GRAYED, 0, entry.text);
        break;
      case "submenu": {
        const sub = w.CreatePopupMenu();
        fill(sub, entry.entries, commands);
        w.AppendMenuW(menu, w.MF.POPUP, koffi.address(sub), entry.text);
        break;
      }
      case "item": {
        commands.push(entry.command);
        const id = commands.length;
        const flags = w.MF.STRING | (entry.enabled ? 0 : w.MF.GRAYED) | (entry.checked ? w.MF.CHECKED : 0);
        w.AppendMenuW(menu, flags, id, entry.text);
        if (entry.isDefault) w.SetMenuDefaultItem(menu, id, 0);
        break;
      }
    }
  }
}

/** Montre le menu au point donné (ou au curseur) ; `null` si rien n'est choisi. */
export function showPopupMenu(owner: unknown, entries: readonly MenuEntry[], x: number, y: number): MenuCommand | null {
  const menu = w.CreatePopupMenu();
  const commands: MenuCommand[] = [];
  try {
    fill(menu, entries, commands);
    let at = { x, y };
    if (x === 0 && y === 0) {
      const cursor = { x: 0, y: 0 };
      if (w.GetCursorPos(cursor)) at = cursor;
    }
    w.SetForegroundWindow(owner);
    const chosen = w.TrackPopupMenuEx(menu, w.TPM.RIGHTBUTTON | w.TPM.RETURNCMD | w.TPM.NONOTIFY, at.x, at.y, owner, null) as number;
    w.PostMessageW(owner, w.WM.NULL, 0, 0);
    return chosen > 0 ? (commands[chosen - 1] ?? null) : null;
  } finally {
    // Détruit aussi les sous-menus rattachés.
    w.DestroyMenu(menu);
  }
}
