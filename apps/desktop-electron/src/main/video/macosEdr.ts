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

import { cls, msg } from "./objc";

export interface EtatEdr {
  /** Facteur accordé en ce moment. 1.0 = aucune plage étendue. */
  courant: number;
  /** Ce que l'écran saurait donner, contenu mis à part. */
  potentiel: number;
  /** La plage étendue est-elle effectivement accordée ? */
  obtenue: boolean;
  /** L'écran en est-il seulement capable ? */
  capable: boolean;
}

const INDISPONIBLE: EtatEdr = { courant: 0, potentiel: 0, obtenue: false, capable: false };

/**
 * L'écran à interroger.
 *
 * Celui de la fenêtre quand on la connaît — sur un poste à plusieurs moniteurs,
 * un XDR et un écran SDR ne rapportent pas la même chose, et c'est celui qui
 * affiche la vidéo qui compte. `mainScreen` sinon.
 */
function ecran(fenetreVideo: unknown): unknown {
  if (fenetreVideo) {
    const e = msg.get(fenetreVideo, "screen");
    if (e) return e;
  }
  const nsScreen = cls("NSScreen");
  if (!nsScreen) return null;
  return msg.get(nsScreen, "mainScreen");
}

/** État de la plage étendue, vu depuis ce processus. */
export function lireEdr(fenetreVideo: unknown): EtatEdr {
  const e = ecran(fenetreVideo);
  if (!e) return INDISPONIBLE;

  const courant = msg.double(e, "maximumExtendedDynamicRangeColorComponentValue");
  const potentiel = msg.double(e, "maximumPotentialExtendedDynamicRangeColorComponentValue");

  // Marge volontaire plutôt qu'une comparaison stricte à 1.0 : la valeur est un
  // flottant calculé par le compositeur, et un `> 1` nu ferait passer pour un
  // succès une valeur de 1.0000001 sans aucune signification visuelle.
  return { courant, potentiel, obtenue: courant > 1.01, capable: potentiel > 1.01 };
}
