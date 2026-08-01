/**
 * Diffusion d'un évènement vers la page.
 *
 * Le préfixe `tentacle:` et la garde « la fenêtre existe-t-elle encore » sont
 * les deux choses qu'on oublie une fois sur deux. Un envoi sur une fenêtre
 * détruite lève, et une exception dans un rappel du processus principal ferme
 * l'application entière — en pleine lecture.
 */

import { getMainWindow } from "./window";
import type { EventName } from "./channels";

export function sendToPage(event: EventName, payload: unknown): void {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) win.webContents.send(`tentacle:${event}`, payload);
}
