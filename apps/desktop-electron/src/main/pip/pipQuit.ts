/**
 * Quitter pendant le PiP : le PiP part AVANT la fenêtre principale.
 *
 * # Ce qui se passait (bureau 1.30.0, macOS)
 *
 * Cmd+Q, PiP ouvert : la fenêtre principale se fermait la première, son
 * `closed` fermait le PiP (`window.ts` → `closePip`), et la fermeture du PiP
 * ramenait la vidéo vers… une fenêtre déjà détruite. La surface relisait sa
 * géométrie (`macosSurface.ts`, `videoTarget`) : « Object has been destroyed »,
 * dans un écouteur — la boîte « A JavaScript error occurred in the main
 * process », et une application qui ne se fermait plus proprement.
 *
 * # L'ordre, désormais
 *
 * La fenêtre principale qui se ferme POUR DE BON ferme d'abord le PiP : sa
 * fermeture rend la vidéo à une page encore vivante (le geste du retour au
 * lecteur, celui de tous les jours), puis la fenêtre principale part avec sa
 * fille comme hors PiP. `closed` → `closePip` reste le filet de `destroy()`,
 * qui n'émet pas `close` (séquence de fermeture de Linux), et les surfaces ne
 * touchent plus une fenêtre détruite quoi qu'il arrive.
 *
 * ⚠️ Écouteur posé EN DERNIER sur la fenêtre (`index.ts`) : la garde de sortie
 * (`quitGuard.ts`, une question sur un téléchargement) et la séquence de
 * fermeture de Linux (`closeSequence.ts`) peuvent RETENIR la fermeture, et
 * `defaultPrevented` ne le dit qu'aux écouteurs suivants. Retenue, le PiP reste.
 */

import { closePip } from "./pipWindow";

/** La part de la fenêtre principale dont dépend la règle — pour que ça se teste. */
export interface ClosingHost {
  on(
    event: "close",
    listener: (event: { defaultPrevented: boolean }) => void,
  ): unknown;
}

export function closePipBeforeHost(
  host: ClosingHost,
  close: () => void = closePip,
): void {
  host.on("close", (event) => {
    if (!event.defaultPrevented) close();
  });
}
