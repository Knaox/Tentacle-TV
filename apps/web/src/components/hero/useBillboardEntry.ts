import { useState } from "react";
import { isImageReady } from "../../lib/seenImages";

/**
 * L'ENTRÉE d'une bannière (accueil, « Pour vous », bibliothèque hors ligne) :
 * sa première image, celle qu'on voit en arrivant sur la page.
 *
 * Le fondu de 1,2 s des fonds est un fondu ENCHAÎNÉ — l'image sortante
 * s'efface pendant que la suivante paraît. Joué aussi au montage, il faisait
 * repartir la bannière du noir à chaque arrivée sur la page : un clignotement à
 * chaque clic sur « Accueil » ou « Pour vous » (25/10, mesuré : 21 % d'opacité
 * quand la page avait fini d'entrer, pleine à ≈ 1 s).
 *
 * Désormais :
 *   • image disponible à l'arrivée (déjà montrée, ou dans le cache mémoire) :
 *     posée d'emblée, la page entre avec elle (`AnimatePresence initial`) ;
 *   • sinon, la première image paraît en `ENTRY_FADE_S`, le temps d'une
 *     affiche — jamais une seconde de noir ;
 *   • les diapositives suivantes gardent leur fondu enchaîné, inchangé.
 */
export const ENTRY_FADE_S = 0.24;
/** `easeOut` explicite, quantifié comme le fondu enchaîné (cf. `cadence`). */
export const ENTRY_FADE = { duration: ENTRY_FADE_S, ease: "easeOut" as const };

/**
 * Le FONDU ENCHAÎNÉ d'une diapositive à la suivante — bannière de l'accueil, celle de « Pour
 * vous », et leur halo.
 *
 * UNE seule rampe, continue (11/11, Damien : « un scintillement léger, pendant et à la fin de
 * l'animation ») :
 *  - la NOUVELLE image fond par-dessus l'ancienne, sur la courbe native du navigateur — donc sur
 *    le compositeur, à la fréquence de l'écran. Elle passait par `cadence` : trente-six marches
 *    d'opacité, calculées en JavaScript ;
 *  - l'ANCIENNE reste pleine dessous le temps du fondu, puis s'en va d'un coup, cachée par la
 *    nouvelle devenue opaque. Elle fondait en même temps (1 → 0) : deux rampes à marches, qui ne
 *    tombaient pas ensemble — la somme des deux images oscillait d'une image d'écran à l'autre —
 *    et, au milieu, un creux où le fond transparaissait.
 * Le zoom, lui, reste à trente paliers par seconde (`theme/heroMotion.css`) : il dure huit
 * secondes, c'est là que le bridage compte.
 */
export const CROSSFADE_S = 1.2;
export const CROSSFADE = { duration: CROSSFADE_S, ease: "easeOut" as const };
/** La sortie de l'image quittée : pleine pendant le fondu de la suivante, retirée juste après. */
export const CROSSFADE_EXIT = { opacity: 0, transition: { opacity: { delay: CROSSFADE_S + 0.05, duration: 0.01 } } };

export interface BillboardEntry {
  /** À passer à `AnimatePresence initial` : faux, l'image du montage est posée d'emblée. */
  presenceInitial: boolean;
  /** Cette image est la première de la bannière : son apparition est courte. */
  isEntry: boolean;
}

/**
 * @param imageKey La clé de la diapositive montrée (`null` : aucune encore).
 * @param url      Son adresse, lue au montage seulement.
 */
export function useBillboardEntry(imageKey: string | null, url: string | null): BillboardEntry {
  const [ready] = useState(() => isImageReady(url));
  // `undefined` : aucune image encore ; une clé : la première, à l'écran ;
  // `null` : l'entrée est finie (une autre diapositive est passée).
  const [entry, setEntry] = useState<string | null | undefined>(imageKey ?? undefined);
  let current = entry;
  if (current === undefined && imageKey !== null) current = imageKey;
  else if (typeof current === "string" && imageKey !== null && imageKey !== current) current = null;
  if (current !== entry) setEntry(current);
  return { presenceInitial: !ready, isEntry: imageKey !== null && imageKey === current };
}
