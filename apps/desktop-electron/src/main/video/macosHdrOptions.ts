/**
 * Ce qu'on demande à la couche Metal dépend de l'écran qui la portera.
 *
 * # Le défaut
 *
 * `target-colorspace-hint=yes` est posé sur macOS SANS CONDITION
 * (`mpvRuntime.ts`), et rien ne le rabaisse jamais : `hdrSession` sort
 * immédiatement hors Windows, par choix documenté. L'option est juste — c'est
 * elle qui fait passer la couche en `ITUR_2100_PQ` et allume « HDR active » sur
 * un écran XDR, mesuré — mais elle est posée aussi là où l'écran n'a AUCUNE
 * plage étendue : tous les Mac Intel, et tout moniteur externe SDR.
 *
 * Demander du PQ à un écran qui ne sait pas le rendre ne le fait pas
 * disparaître : macOS le reconvertit. La conversion a lieu quand même, hors de
 * notre contrôle et hors de tout réglage, au lieu d'être faite par libplacebo
 * qui, lui, s'ajuste. Sans l'option, mpv retombe sur `auto` — mesuré sur macOS :
 * « Metal layer colorspace changed: SRGB », c'est-à-dire exactement ce qu'il
 * faut à un écran sans plage étendue, et ce qui se corrigera tout seul le jour
 * où mpv saura détecter l'EDR.
 *
 * ⚠️ Ce module retire l'option, il n'écrit pas `no`. `auto` laisse mpv décider ;
 * `no` le lui interdirait pour toujours.
 *
 * ⚠️ Le GAIN n'est pas mesuré. Ce qui est établi, c'est que la demande est
 * INCORRECTE sur un écran SDR — et qu'une conversion faite par le compositeur
 * échappe à tout réglage. Le bénéfice réel se mesure à `powermetrics`, sur un
 * build de production.
 *
 * # L'écran interrogé est celui de NOTRE fenêtre
 *
 * ⚠️ Pas `mainScreen`. La fenêtre de mpv n'existe pas encore à l'initialisation
 * — `force-window=no` la fait naître au premier `loadfile` — mais la nôtre, si.
 * Sur un poste à deux moniteurs, un XDR et un écran SDR ne rapportent pas la
 * même chose, et c'est celui qui portera la vidéo qui décide.
 */

import type { BrowserWindow } from "electron";
import type { MpvValue } from "./mpvAllowlist";
import { readEdr } from "./macosEdr";
import { fromHandle, msg } from "./objc";
import { trace } from "./native";

/** La `NSWindow` de l'hôte — celle dont l'écran portera la vidéo. */
function hostWindow(host: BrowserWindow): unknown {
  return msg.get(fromHandle(host.getNativeWindowHandle()), "window");
}

/**
 * Retire la demande de transmission PQ quand l'écran n'a pas de plage étendue.
 *
 * Rend les options inchangées partout ailleurs : hors macOS, et sur tout écran
 * qui sait rendre ce qu'on lui demande.
 */
export function adaptToDisplay(
  options: Readonly<Record<string, MpvValue>>,
  host: BrowserWindow,
): Record<string, MpvValue> {
  const output: Record<string, MpvValue> = { ...options };
  if (process.platform !== "darwin") return output;
  if (output["target-colorspace-hint"] === undefined) return output;

  const edr = readEdr(hostWindow(host));
  if (edr.capable) return output;

  delete output["target-colorspace-hint"];
  // Tracé : sans lui, un écran qui rapporterait mal sa capacité retirerait le
  // HDR en silence, et le symptôme — une image plate — ne désigne rien.
  trace(`ecran sans plage etendue (potentiel ${edr.potential}) — transmission PQ non demandee`);
  return output;
}
