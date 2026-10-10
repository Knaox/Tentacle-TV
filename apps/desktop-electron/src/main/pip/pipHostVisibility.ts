/**
 * Sous Windows, le PiP revient avec l'application qu'on a réduite.
 *
 * Retour de Damien : réduire la fenêtre de Tentacle puis la rouvrir faisait
 * disparaître le PiP, ancré comme détaché. Ancré, il est une fenêtre POSSÉDÉE
 * (`pipDocking.ts`), que Windows cache avec sa propriétaire et ne remontre pas
 * toujours au retour ; détaché, rien ne garantit que la fenêtre ouverte par
 * `window.open` ne soit pas restée possédée par celle qui l'a ouverte. La
 * coquille ne s'en remet donc pas au système : à la restauration de
 * l'application, elle remontre le PiP — tant qu'il existe, il est à l'écran —
 * et lui rend son mode (`reapply`) ; la fenêtre de mpv, sa fille, revient avec
 * lui.
 *
 * macOS : rien ici — le mode ancré y cache et remontre le PiP lui-même
 * (`pipDocking.ts`), et le flottant n'y dépend pas de la fenêtre principale.
 */

import type { BrowserWindow } from "electron";

export function followHostVisibility(pip: BrowserWindow, host: BrowserWindow, reapply: () => void): () => void {
  if (process.platform !== "win32") return () => undefined;
  const back = (): void => {
    if (pip.isDestroyed() || host.isDestroyed() || host.isMinimized()) return;
    if (!pip.isVisible()) pip.showInactive();
    reapply();
  };
  host.on("restore", back);
  host.on("show", back);
  return () => {
    if (host.isDestroyed()) return;
    host.off("restore", back);
    host.off("show", back);
  };
}
