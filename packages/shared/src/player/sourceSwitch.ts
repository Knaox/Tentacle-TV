/**
 * Un changement de source demandé par l'utilisateur — une qualité, une piste
 * audio, un sous-titre à incruster : l'indicateur de chargement s'allume DÈS
 * le geste, pas quand le serveur a commencé à travailler.
 *
 * Entre le clic et la nouvelle URL, un lecteur attend d'abord que l'ancien
 * encodage soit arrêté, puis que Jellyfin renégocie (PlaybackInfo) : une ou
 * deux secondes d'image figée, sans rien pour le dire (retour de Damien, 06/10).
 * La règle : l'indicateur tient tant que la source posée est encore celle du
 * geste ; le lecteur prend ensuite le relais avec son propre chargement (fichier
 * qui s'ouvre, premiers segments). Jamais éternel : au-delà du délai, il
 * s'efface — un changement qui n'aboutit pas a son propre écran d'erreur.
 */

export const SOURCE_SWITCH_TIMEOUT_MS = 20_000;

export interface SourceSwitch {
  /** La source jouée au moment du geste (`null` : aucune encore). */
  fromSrc: string | null;
  /** Quand le geste a eu lieu. */
  at: number;
}

export function beginSourceSwitch(currentSrc: string | null, now: number): SourceSwitch {
  return { fromSrc: currentSrc, at: now };
}

/** L'indicateur du geste est-il encore à montrer ? */
export function sourceSwitchPending(sw: SourceSwitch | null, currentSrc: string | null, now: number): boolean {
  if (!sw) return false;
  if (now - sw.at > SOURCE_SWITCH_TIMEOUT_MS) return false;
  return currentSrc === sw.fromSrc || currentSrc === null;
}
