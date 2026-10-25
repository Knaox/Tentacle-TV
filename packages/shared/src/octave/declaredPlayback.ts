/**
 * Octave — ce que le lecteur DÉCLARE au serveur (`playback:declare`, capacité
 * `sessions.musicControl`) pour paraître dans les sessions en cours de
 * l'administration, et quand il le redit. Logique pure : le branchement est
 * côté client (`apps/web/src/music/octave/player/octaveSessionRemote.ts`).
 *
 * - Un titre de la BIBLIOTHÈQUE porte son élément Jellyfin : sa session existe
 *   déjà chez Jellyfin, la déclaration y donne la position à la seconde.
 * - Un titre d'EXTENSION n'a pas d'élément : la déclaration EST sa session,
 *   générique (« lecture d'extension »), sans le nom de l'extension.
 * - Rien ne joue (arrêt, fin de file, erreur) : `null`.
 */

import type { MusicTrack } from "../music";
import type { DeclaredPlaybackDto } from "../types/sessionChannelMessages";
import type { PlayerSnapshot, PositionState } from "./playerState";

/** Un battement, même sans changement : la position du tableau de bord se recale. */
export const DECLARE_HEARTBEAT_MS = 15_000;
/** Au-delà de cet écart à la position attendue (saut, pause du son), on redit tout de suite. */
export const DECLARE_DRIFT_MS = 2_000;

/** Une pochette que le tableau de bord peut afficher : un chemin du serveur Tentacle ou du https public. */
function displayableArtwork(url: string | null): string | undefined {
  if (url === null) return undefined;
  if (/^\/api\/\S*$/.test(url) && !url.includes("..")) return url;
  return /^https:\/\/[^\s/]+\/\S*$/i.test(url) ? url : undefined;
}

function nonEmpty(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  return trimmed ? trimmed.slice(0, 300) : undefined;
}

function libraryItemOf(track: MusicTrack): string | undefined {
  return track.availability === "library" && track.jellyfinId ? track.jellyfinId : undefined;
}

/** L'écoute à déclarer pour cet état du lecteur, ou `null` si rien ne joue. */
export function declaredPlaybackOf(snapshot: PlayerSnapshot, position: PositionState): DeclaredPlaybackDto | null {
  const track = snapshot.current;
  if (track === null) return null;
  if (snapshot.phase === "idle" || snapshot.phase === "ended" || snapshot.phase === "error") return null;
  const title = nonEmpty(track.title);
  if (title === undefined) return null;
  const itemId = libraryItemOf(track);
  const durationMs = position.durationMs ?? snapshot.durationMs ?? track.durationMs;
  const artists = nonEmpty(track.artists.map((a) => a.name).join(", "));
  const album = nonEmpty(track.album?.title);
  // La pochette d'un titre de la bibliothèque, le serveur la tient de Jellyfin.
  const imageUrl = itemId === undefined ? displayableArtwork(track.artworkUrl) : undefined;
  return {
    key: track.key.slice(0, 512),
    ...(itemId ? { itemId } : {}),
    title,
    ...(artists ? { artists } : {}),
    ...(album ? { album } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(durationMs !== null && durationMs > 0 ? { durationMs } : {}),
    positionMs: Math.max(0, Math.floor(position.positionMs)),
    // Le son n'avance qu'en lecture : une source qui charge n'est pas « en cours ».
    isPaused: snapshot.phase !== "playing",
  };
}

/** Ce qui a été déclaré en dernier, et quand. */
export interface LastDeclared {
  state: DeclaredPlaybackDto | null;
  at: number;
}

/** Faut-il redire l'écoute maintenant ? Un changement d'état, un saut, ou le battement. */
export function shouldRedeclare(last: LastDeclared | null, next: DeclaredPlaybackDto | null, now: number): boolean {
  if (last === null) return next !== null;
  const prev = last.state;
  if (prev === null || next === null) return prev !== next;
  if (prev.key !== next.key || prev.isPaused !== next.isPaused || prev.durationMs !== next.durationMs) return true;
  if (now - last.at >= DECLARE_HEARTBEAT_MS) return true;
  const expected = prev.isPaused ? prev.positionMs : prev.positionMs + (now - last.at);
  return Math.abs(next.positionMs - expected) > DECLARE_DRIFT_MS;
}
