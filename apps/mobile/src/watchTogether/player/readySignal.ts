/**
 * Watch Together — quand dire au groupe « je cale » ou « je suis prêt »,
 * d'après l'état du moteur mobile. La même règle que le bureau
 * (`useDesktopTransport`), en module PUR :
 *  - tampon du moteur → « je cale » tout de suite ;
 *  - saut encore en vol après SEEK_STALL_MS (un saut lointain pendant un
 *    transcodage relance ffmpeg) → « je cale » : le groupe m'attend au lieu
 *    de partir pendant que la boucle de dérive re-sauterait en spirale ;
 *  - chargé, hors tampon, stable READY_STABLE_MS → « prêt » : un flux
 *    transcodé joue souvent 200-500 ms puis recale aussitôt ; libérer le
 *    groupe à la première image le ferait repartir pour le regeler.
 * Rien tant que le média n'est pas chargé : c'est l'écran qui a déjà déclaré
 * le tampon (montage, changement de source).
 */

export const READY_STABLE_MS = 400;
export const SEEK_STALL_MS = 1_200;

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
  if (seeking) return { buffering: true, delayMs: SEEK_STALL_MS };
  return { buffering: false, delayMs: READY_STABLE_MS };
}
