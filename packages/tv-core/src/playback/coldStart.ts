/**
 * Après une TERMINAISON en pleine lecture, où rouvrir l'app — Apple TV et
 * Android TV, une seule règle.
 *
 * Le lecteur tient un marqueur PERSISTANT (`PLAYBACK_MARKER_KEY`) : posé à son
 * ouverture (`playing`), passé à `background` quand l'app est quittée, rendu à
 * `playing` à son retour, rafraîchi tant qu'il vit, retiré quand on quitte le
 * lecteur. Au démarrage suivant, sa présence dit comment l'app est morte :
 *
 * - `background` : tuée pendant son absence (le système récupère la mémoire
 *   d'une app suspendue — le cas courant). La lecture allait bien : on rouvre
 *   le LECTEUR, en pause, à la position — un OK et ça repart ;
 * - `playing` : morte À L'ÉCRAN, lecteur ouvert (plantage, terminaison forcée).
 *   On rouvre la FICHE, « Reprendre » focalisé — jamais le lecteur, qui
 *   pourrait replanter en boucle ;
 * - au-delà de `COLD_START_FRESH_MS`, pour un autre compte ou un autre
 *   appareil, ou sans marqueur (on avait quitté le lecteur) : l'accueil.
 *
 * Le marqueur est une donnée du COMPTE : le déjumelage le purge.
 */

/** Clé de stockage — un nom traversé par une chaîne : ne jamais la renommer. */
export const PLAYBACK_MARKER_KEY = "tentacle_playback_marker";
/** Au-delà, rouvrir une lecture surprendrait plus qu'elle n'aiderait. */
export const COLD_START_FRESH_MS = 3 * 3_600_000;
/** Une marque venue du futur (horloge reculée) ne prouve rien. */
const CLOCK_SLACK_MS = 60_000;

export interface PlaybackOwner {
  userId: string;
  deviceId: string;
}

export interface PlaybackMarker {
  itemId: string;
  owner: PlaybackOwner;
  phase: "playing" | "background";
  /** Dernière nouvelle du lecteur (ms). */
  at: number;
  /** L'instance de lecteur qui l'a écrit : un lecteur ne retire que le sien
   *  (l'épisode suivant monte avant que le précédent ne parte). */
  playerId: string;
}

export type ColdStartLanding =
  | { kind: "home" }
  | { kind: "player"; itemId: string }
  | { kind: "detail"; itemId: string };

/** Le stockage synchrone de l'appareil. */
export interface MarkerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const HOME: ColdStartLanding = { kind: "home" };

export function coldStartLanding(
  marker: PlaybackMarker | null,
  ctx: { now: number; owner: PlaybackOwner | null },
): ColdStartLanding {
  const { now, owner } = ctx;
  if (!marker || !owner) return HOME;
  if (marker.owner.userId !== owner.userId || marker.owner.deviceId !== owner.deviceId) return HOME;
  if (now - marker.at > COLD_START_FRESH_MS || marker.at - now > CLOCK_SLACK_MS) return HOME;
  return marker.phase === "background"
    ? { kind: "player", itemId: marker.itemId }
    : { kind: "detail", itemId: marker.itemId };
}

function isMarker(value: unknown): value is PlaybackMarker {
  if (!value || typeof value !== "object") return false;
  const m = value as Partial<PlaybackMarker>;
  return typeof m.itemId === "string" && typeof m.at === "number" && typeof m.playerId === "string"
    && (m.phase === "playing" || m.phase === "background")
    && typeof m.owner?.userId === "string" && typeof m.owner?.deviceId === "string";
}

export function readPlaybackMarker(storage: MarkerStorage): PlaybackMarker | null {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(PLAYBACK_MARKER_KEY) ?? "null");
    return isMarker(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writePlaybackMarker(storage: MarkerStorage, marker: PlaybackMarker): void {
  storage.setItem(PLAYBACK_MARKER_KEY, JSON.stringify(marker));
}

/** Retire le marqueur — seulement le sien quand `playerId` est donné. */
export function clearPlaybackMarker(storage: MarkerStorage, playerId?: string): void {
  if (playerId !== undefined && readPlaybackMarker(storage)?.playerId !== playerId) return;
  storage.removeItem(PLAYBACK_MARKER_KEY);
}
