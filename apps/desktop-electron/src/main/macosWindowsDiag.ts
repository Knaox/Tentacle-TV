/**
 * Ce que l'application a réellement à l'écran, en une ligne de journal.
 *
 * # Pourquoi ce fichier existe
 *
 * Une SECONDE barre de fenêtre — feux de circulation compris — apparaît après un
 * aller-retour en plein écran. Deux explications tiennent également debout, et
 * elles se corrigent de façons opposées :
 *
 *  - la fenêtre de MPV. `frameWithoutSeam` lui rend son `styleMask` titré en
 *    sortant du plein écran, et AppKit reconstruit alors la barre de titre que
 *    `title-bar=no` avait masquée, avec ses propres feux et le titre
 *    « Tentacle TV » que mpv pose sur sa fenêtre ;
 *  - la NÔTRE. `titleBarStyle: "hidden"` et `trafficLightPosition` ne survivent
 *    pas toujours à un plein écran natif : les feux reprennent leur position par
 *    défaut, et une zone de barre de titre peut réapparaître.
 *
 * Rien dans une capture d'écran ne les distingue. Cette trace, si : elle dit
 * combien de fenêtres existent, leur classe, leur titre, leur `styleMask` et
 * leur cadre. Le défaut se produisant AUSSI sans lecture — donc sans fenêtre de
 * mpv — la seconde explication part favorite, mais on ne corrige pas sur une
 * intuition.
 *
 * ⚠️ **macOS uniquement, et à importer PARESSEUSEMENT** : remonte à `objc.ts`,
 * qui charge le runtime Objective-C à l'import. Un import statique depuis un
 * module partagé ferait tomber le processus principal sous Windows.
 */

import koffi from "koffi";
import { msg } from "./video/objc";
import { listWindows, classNameOf, windowNumber } from "./video/objcWindows";

/** Le contenu d'une `NSString`, ou une chaîne vide. */
function text(nsstring: unknown): string {
  if (!nsstring) return "";
  const utf8 = msg.get(nsstring, "UTF8String");
  if (!utf8) return "";
  return koffi.decode(utf8, "char", -1) as string;
}

/** Une fenêtre, décrite. */
function describeWindow(window: unknown, className: string): string {
  const frame = msg.rect(window, "frame");
  return (
    `${className}#${windowNumber(window)}` +
    ` titre="${text(msg.get(window, "title"))}"` +
    ` masque=${msg.count(window, "styleMask")}` +
    ` cadre=${Math.round(frame.x)},${Math.round(frame.y)} ` +
    `${Math.round(frame.width)}x${Math.round(frame.height)}` +
    ` visible=${msg.bool(window, "isVisible") ? "oui" : "non"}` +
    ` titreVisible=${msg.count(window, "titleVisibility") === 0 ? "OUI" : "non"}` +
    ` barreTransparente=${msg.bool(window, "titlebarAppearsTransparent") ? "oui" : "NON"}`
  );
}

/**
 * Toutes les fenêtres de l'application, une par ligne.
 *
 * `titleVisibility` vaut 0 pour `NSWindowTitleVisible` — c'est celui-là qui nous
 * intéresse, d'où la majuscule sur le cas qui doit alerter. Idem pour une barre
 * de titre qui ne serait PAS transparente.
 */
export function describeWindows(): string {
  const windows = listWindows();
  if (windows.length === 0) return "aucune fenetre";
  return windows
    .map(([window, className]) => `  ${describeWindow(window, className || classNameOf(window))}`)
    .join("\n");
}
