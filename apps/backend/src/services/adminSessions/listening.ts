import type { AdminSessionDto } from "./dto";

/**
 * Une ÉCOUTE (musique de la bibliothèque, livre audio, lecture d'extension) n'a
 * pas d'écran où afficher un message : le serveur le refuse (409), la carte ne
 * le propose pas. Le jumeau côté clients est `packages/shared/src/adminSessions/
 * listening.ts` (le backend n'importe pas shared à l'exécution) : mêmes types.
 */

/** Le son seul — un clip (`MusicVideo`) a une image, donc un écran. */
const LISTENING_TYPES: ReadonlySet<string> = new Set(["Audio", "AudioBook"]);

export function isListeningSession(session: Pick<AdminSessionDto, "nowPlaying"> | undefined): boolean {
  const item = session?.nowPlaying;
  return item != null && (item.fromExtension === true || LISTENING_TYPES.has(item.type));
}

export function refusesMessage(session: Pick<AdminSessionDto, "nowPlaying"> | undefined): boolean {
  return isListeningSession(session);
}

/**
 * Une écoute « en lecture » sans nouvelle position depuis ce délai n'est plus
 * montrée en lecture. Octave redit sa position toutes les 15 s (Jellyfin et la
 * déclaration) : 60 s, ce sont quatre rendez-vous manqués — une page partie sans
 * pouvoir le dire (plantage, onglet gelé), jamais une écoute vivante.
 */
export const LISTENING_STALE_MS = 60_000;

/** Écoute en lecture dont la dernière position date de plus de `LISTENING_STALE_MS`. */
export function isStaleListening(session: Pick<AdminSessionDto, "nowPlaying" | "isPaused" | "positionAt">, now: number): boolean {
  return isListeningSession(session) && !session.isPaused && now - session.positionAt > LISTENING_STALE_MS;
}

/**
 * Retire de la lecture les écoutes sans nouvelles : une session de Jellyfin
 * passe « au repos » (l'appareil reste connecté), une lecture d'extension,
 * qui n'existe que par sa déclaration, disparaît.
 */
export function settleStaleListening(sessions: AdminSessionDto[], now: number): AdminSessionDto[] {
  return sessions.flatMap((session) => {
    if (!isStaleListening(session, now)) return [session];
    if (session.nowPlaying?.fromExtension) return [];
    return [{ ...session, nowPlaying: null, playMethod: null, source: null, transcoding: null }];
  });
}
