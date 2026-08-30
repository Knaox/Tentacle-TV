/**
 * Sonde EDR : la plage étendue est-elle OBTENUE, ou seulement demandée ?
 *
 * # Ce que mesure cette valeur
 *
 * `maximumExtendedDynamicRangeColorComponentValue` est le facteur au-delà du
 * blanc SDR que le compositeur accorde EN CE MOMENT à l'écran. Elle vaut 1.0
 * tant qu'aucun contenu en plage étendue n'est affiché, et monte dès qu'il y en
 * a. C'est donc exactement la différence entre demander et obtenir : mpv peut
 * poser tous les drapeaux du monde sur sa couche Metal, si cette valeur reste à
 * 1.0, rien n'a été accordé.
 *
 * `maximumPotential…` est la capacité de l'écran, indépendante du contenu :
 * 16.0 sur un Liquid Retina XDR. Elle sert de témoin — si le potentiel vaut 1.0,
 * l'écran ne sait pas faire de HDR et le reste du diagnostic n'a pas d'objet.
 *
 * # Pourquoi la sonde vit dans le processus principal
 *
 * ⚠️ La valeur est rapportée PAR PROCESSUS. Lue depuis un autre processus, mpv
 * jouant du PQ à côté, elle reste obstinément à 1.0. Aucun utilitaire externe
 * ne peut donc rien prouver ici : la sonde doit s'exécuter là où vit la fenêtre.
 *
 * Établi en phase 1, et mesuré à 16.00 sur cette machine pendant une lecture
 * HDR10 — la même mesure retombant à 1.00 dès que la page reste opaque.
 *
 * ⚠️ **macOS uniquement** : remonte à `objc.ts`, qui charge le runtime
 * Objective-C à l'import.
 */

import { app } from "electron";
import { trace } from "./native";
import { cls, msg } from "./objc";

export interface EdrState {
  /** Facteur accordé en ce moment. 1.0 = aucune plage étendue. */
  current: number;
  /** Ce que l'écran saurait donner, contenu mis à part. */
  potential: number;
  /** La plage étendue est-elle effectivement accordée ? */
  granted: boolean;
  /** L'écran en est-il seulement capable ? */
  capable: boolean;
}

const UNAVAILABLE: EdrState = { current: 0, potential: 0, granted: false, capable: false };

/**
 * L'écran à interroger.
 *
 * Celui de la fenêtre quand on la connaît — sur un poste à plusieurs moniteurs,
 * un XDR et un écran SDR ne rapportent pas la même chose, et c'est celui qui
 * affiche la vidéo qui compte. `mainScreen` sinon.
 */
function display(videoWindow: unknown): unknown {
  if (videoWindow) {
    const e = msg.get(videoWindow, "screen");
    if (e) return e;
  }
  const nsScreen = cls("NSScreen");
  if (!nsScreen) return null;
  return msg.get(nsScreen, "mainScreen");
}

/** État de la plage étendue, vu depuis ce processus. */
export function readEdr(videoWindow: unknown): EdrState {
  const e = display(videoWindow);
  if (!e) return UNAVAILABLE;

  const current = msg.double(e, "maximumExtendedDynamicRangeColorComponentValue");
  const potential = msg.double(e, "maximumPotentialExtendedDynamicRangeColorComponentValue");

  // Marge volontaire plutôt qu'une comparaison stricte à 1.0 : la valeur est un
  // flottant calculé par le compositeur, et un `> 1` nu ferait passer pour un
  // succès une valeur de 1.0000001 sans aucune signification visuelle.
  return { current, potential, granted: current > 1.01, capable: potential > 1.01 };
}

/** Dernier headroom tracé, pour n'écrire que les CHANGEMENTS. */
let lastSeen = -1;

/**
 * Trace le headroom quand il change, avec ce qui vient de se passer.
 *
 * ⚠️ C'est la seule façon de DATER la décision du compositeur, et c'est tout
 * l'enjeu : le headroom n'est pas une capacité, c'est un arbitrage rendu à un
 * instant précis. Signalé par l'utilisateur, et personne ne l'avait vu : au
 * lancement d'une vidéo il n'y a pas de HDR, et une transition de fenêtre — dans
 * un sens comme dans l'autre — le fait apparaître. Une valeur relevée après coup
 * ne dit rien de cela ; seule la chronologie le montre.
 *
 * Appelée depuis la veille de `macosSurface.ts`, donc dix fois par seconde :
 * elle sort AVANT le moindre appel ObjC dans un paquet livré.
 */
export function watchEdr(videoWindow: unknown, when: string): void {
  if (app.isPackaged) return;
  const { current } = readEdr(videoWindow);
  // Au centième : le compositeur fait varier la valeur de quelques millièmes
  // sans que cela signifie quoi que ce soit, et le journal serait illisible.
  const rounded = Math.round(current * 100) / 100;
  if (rounded === lastSeen) return;
  const before = lastSeen;
  lastSeen = rounded;
  if (before >= 0) trace(`headroom EDR ${before.toFixed(2)} → ${rounded.toFixed(2)} (${when})`);
  else trace(`headroom EDR ${rounded.toFixed(2)} (${when})`);
}

/** Oublie le dernier headroom vu — entre deux lectures, tout est à refaire. */
export function forgetEdr(): void {
  lastSeen = -1;
}
