/**
 * Watch Together — quand dire au groupe « je cale » ou « je suis prêt »,
 * d'après l'état du moteur mobile. La même règle que le bureau
 * (`useDesktopTransport`), en module PUR :
 *  - tampon du moteur → « je cale » tout de suite ;
 *  - saut encore en vol → RIEN (ni « je cale », ni « prêt ») : le mobile n'a
 *    pas la propriété `seeking` de mpv du bureau, un saut s'y voit atterrir par
 *    la position ; dire « je cale » sur ce seul indice gelait la salle à tort
 *    (défauts M1 et M3 du banc). Un vrai rechargement passe par le tampon du
 *    moteur, que les deux moteurs annoncent ;
 *  - chargé, hors tampon, stable READY_STABLE_MS → « prêt » : un flux
 *    transcodé joue souvent 200-500 ms puis recale aussitôt ; libérer le
 *    groupe à la première image le ferait repartir pour le regeler.
 * Rien tant que le média n'est pas chargé : c'est l'écran qui a déjà déclaré
 * le tampon (montage, changement de source).
 */

export const READY_STABLE_MS = 400;

export interface ReadySignalInput {
  ready: boolean;
  buffering: boolean;
  seeking: boolean;
}

export interface ReadySignalPlan {
  /** Ce qu'on dira au groupe : vrai = « je cale ». */
  buffering: boolean;
  /** Après ce délai, si l'état n'a pas changé entre-temps. */
  delayMs: number;
}

export function planReadySignal({ ready, buffering, seeking }: ReadySignalInput): ReadySignalPlan | null {
  if (!ready) return null;
  if (buffering) return { buffering: true, delayMs: 0 };
  if (seeking) return null;
  return { buffering: false, delayMs: READY_STABLE_MS };
}
