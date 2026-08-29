/**
 * Les options mpv du montage Render API, dérivées de celles de la page.
 *
 * # Pourquoi le natif les réécrit
 *
 * La page décrit ce qu'elle veut voir — du HDR, du décodage matériel — sans
 * savoir COMMENT la coquille l'obtient. Le choix du montage
 * (`TENTACLE_VIDEO_MONTAGE`) vit dans le processus principal, et lui seul sait
 * qu'il faut alors une sortie `libmpv` plutôt qu'une fenêtre Metal. Faire
 * remonter ce détail jusqu'au navigateur pour qu'il le renvoie aussitôt
 * n'apprendrait rien à personne, et donnerait deux endroits à tenir d'accord.
 *
 * # Ce que la Render API change
 *
 * Toutes les options qui parlent d'une FENÊTRE n'ont plus d'objet : il n'y en a
 * plus. Et le passthrough PQ non plus — `target-colorspace-hint` s'adresse au
 * backend Metal, qui négocie l'espace de sa couche avec le compositeur. Une
 * `NSOpenGLView` n'est pas gérée en couleur : on lui envoie des valeurs, elle
 * les affiche. C'est donc à mpv de produire directement ce que l'écran attend.
 */

import { readEdr } from "./macosEdr";
import type { MpvValue } from "./mpvAllowlist";

/** Options qui n'ont de sens qu'avec une fenêtre à mpv. */
const NOT_APPLICABLE: ReadonlySet<string> = new Set([
  "gpu-api",
  "gpu-context",
  "border",
  "auto-window-resize",
  "force-window",
  // Le passthrough s'adresse au backend Metal ; sans lui, mpv attendrait une
  // négociation qui n'aura jamais lieu et retomberait en sRGB.
  "target-colorspace-hint",
  // La fenêtre n'existant pas, ces réglages d'entrée ne s'appliquent à rien.
  "input-cursor",
  "cursor-autohide",
]);

/**
 * Le pic lumineux à viser, en nits.
 *
 * ⚠️ Laisser `target-peak` à `auto` ferait deviner à mpv un pic qu'il ne peut
 * pas connaître : une `NSOpenGLView` ne lui dit rien de l'écran. Le headroom
 * EDR, lui, est mesurable — c'est le facteur au-delà du blanc SDR que le
 * compositeur accorde. Sur un Liquid Retina XDR il vaut 16, soit 1600 nits pour
 * un blanc de référence à 100.
 *
 * Borné à la plage acceptée par mpv (10 à 10000). Sur un écran sans plage
 * étendue, le potentiel vaut 1 et l'on retombe sur 100 nits — la bonne réponse,
 * qui fait tone-mapper mpv vers du SDR.
 */
const SDR_WHITE_NITS = 100;

export function edrPeak(): number {
  const potential = readEdr(null).potentiel;
  const nits = Math.round((potential > 1 ? potential : 1) * SDR_WHITE_NITS);
  return Math.min(10000, Math.max(10, nits));
}

/**
 * Réécrit les options d'init pour le rendu par la Render API.
 *
 * `vo=libmpv` est imposé : c'est la sortie qui délègue le dessin à l'hôte.
 * `target-trc=pq` et `target-prim=display-p3` sont le couple qui déclenche
 * l'EDR — `bt.2020` est déprécié depuis macOS 11, et c'est aussi le choix
 * d'IINA pour la même raison.
 */
export function adaptForRenderApi(
  options: Readonly<Record<string, MpvValue>>,
): Record<string, MpvValue> {
  const output: Record<string, MpvValue> = {};
  for (const [name, value] of Object.entries(options)) {
    if (!NOT_APPLICABLE.has(name)) output[name] = value;
  }
  output["vo"] = "libmpv";
  output["target-trc"] = "pq";
  output["target-prim"] = "display-p3";
  output["target-peak"] = edrPeak();
  return output;
}
