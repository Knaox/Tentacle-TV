import type { PlaybackEventDto, PlaybackStateDto, PlayMethodDto } from "@tentacle-tv/shared";
import { channelProgress, channelStop, isChannelReporting } from "../socket/sessionChannel";
import { safePositionTicks, sessionPost, type JfClient } from "./playbackTransport";

/**
 * Le report de lecture PAR LE CANAL de session, quand le backend le porte
 * (`socket/sessionChannel.ts`) — et le repli HTTP quand il ne le porte pas.
 * Extrait de `usePlayback` (limite de 300 lignes).
 *
 * Par le canal, un report est un message sur le socket déjà ouvert : rien ne
 * part vers Jellyfin, c'est le backend qui décide. Sans canal (serveur
 * d'avant, mobile, TV, socket tombé), rien ne change : HTTP, comme avant.
 */

interface Ref<T> {
  current: T;
}

/** Les refs du rapporteur dont on tire l'état courant. */
export interface PlaybackStateRefs {
  itemId: Ref<string | undefined>;
  mediaSourceId: Ref<string | undefined>;
  playSessionId: Ref<string | undefined>;
  playMethod: Ref<string>;
  audioStreamIndex: Ref<number>;
  subtitleStreamIndex: Ref<number | null>;
  position: Ref<number>;
  paused: Ref<boolean>;
}

/** Au-delà de cet écart avec la position attendue, un report de position est un saut. */
export const SEEK_JUMP_SECONDS = 2.5;

export function stateFromRefs(refs: PlaybackStateRefs): PlaybackStateDto | null {
  const itemId = refs.itemId.current;
  if (!itemId) return null;
  return {
    itemId,
    mediaSourceId: refs.mediaSourceId.current ?? itemId,
    playSessionId: refs.playSessionId.current,
    playMethod: refs.playMethod.current as PlayMethodDto,
    positionTicks: safePositionTicks(refs.position.current),
    isPaused: refs.paused.current,
    audioStreamIndex: refs.audioStreamIndex.current,
    subtitleStreamIndex: refs.subtitleStreamIndex.current ?? -1,
    canSeek: true,
  };
}

/** Un bord par le canal ; faux si le canal ne porte pas la télémétrie. */
export function channelEdge(refs: PlaybackStateRefs, event: PlaybackEventDto): boolean {
  const state = stateFromRefs(refs);
  return state !== null && channelProgress(event, state);
}

/**
 * Fin de lecture : par le canal (le backend répond une fois Jellyfin servi),
 * sinon — ou sans confirmation — par le `/Sessions/Playing/Stopped` HTTP.
 * `state` est figé par l'appelant AVANT qu'il ne remette ses refs à zéro.
 */
export async function reportStopped(client: JfClient, state: PlaybackStateDto, label: string): Promise<void> {
  if (await channelStop(state)) return;
  await sessionPost(client, "/Sessions/Playing/Stopped", {
    ItemId: state.itemId,
    MediaSourceId: state.mediaSourceId ?? state.itemId,
    PlaySessionId: state.playSessionId,
    PositionTicks: state.positionTicks,
  }, label);
}

/**
 * Un saut se lit dans l'écart entre la position reçue et celle attendue : le
 * lecteur de bureau n'appelle pas `reportSeek`, il ne donne que sa position.
 */
export function isSeekJump(previousSeconds: number, previousAt: number, wasPaused: boolean, seconds: number, now: number): boolean {
  const expected = wasPaused ? previousSeconds : previousSeconds + (now - previousAt) / 1000;
  return Math.abs(seconds - expected) > SEEK_JUMP_SECONDS;
}

/**
 * Nouvelle position du lecteur. Par le canal, pause, reprise et saut sont des
 * BORDS : le backend les relaie aussitôt à Jellyfin. Sans canal, le prochain
 * battement les porte, comme avant.
 */
export function applyPosition(
  refs: PlaybackStateRefs,
  lastUpdateAt: Ref<number>,
  started: boolean,
  seconds: number,
  isPaused: boolean,
): void {
  const wasPaused = refs.paused.current;
  const previousSeconds = refs.position.current;
  const previousAt = lastUpdateAt.current;
  const now = Date.now();
  refs.position.current = seconds;
  refs.paused.current = isPaused;
  lastUpdateAt.current = now;
  if (!started || !isChannelReporting()) return;
  if (isPaused !== wasPaused) channelEdge(refs, isPaused ? "pause" : "unpause");
  else if (previousAt > 0 && isSeekJump(previousSeconds, previousAt, wasPaused, seconds, now)) channelEdge(refs, "seek");
}
