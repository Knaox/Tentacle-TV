/**
 * Octave — la LISIBILITÉ des titres affichés (lot « ol », contrat d'ol3), le même code pour le web, le bureau et le
 * mobile :
 * - `useTrackPlayability(track)` : l'état d'UNE rangée, l'appris compris ; seule la rangée dont l'état change se
 *   redessine (`onPlayabilityOf`), jamais toute la liste ;
 * - `usePlayabilityProbe(provider, tracks)` : à l'AFFICHAGE d'une liste, les titres `unknown` de tête (20 au plus) sont
 *   demandés au sondage de l'extension (`music.playability`, `waitMs` 2 s), sans rien retarder ; `retryAfterMs` : les
 *   seuls `unknown` redemandés après ce délai, 3 tours au plus. Une liste qui change annule la sienne. Sans
 *   `music.playability` (extension ou serveur d'avant) : aucun appel, rien ne change.
 */

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { MusicPlayable, MusicPlayableReason, MusicTrack, PlayabilityRequest, PlayabilityResponse } from "@tentacle-tv/shared/music";
import { PLAYABILITY_BATCH_MAX } from "@tentacle-tv/shared/music";
import {
  announcePlayability, isKeptForPlayback, learnedPlayability, onPlayabilityOf, trackPlayability, withPlayability, type PlayabilityPatch, type TrackPlayability,
} from "@tentacle-tv/shared/octave";
import { tentacleApiFetch } from "../../hooks/usePreferences";
import { isFromMusicProvider, musicRouteUrl, type MusicProvider } from "../../pluginMusic/musicProvider";

/** Les titres de tête d'une liste demandés au sondage (ce que l'œil voit d'abord). */
export const PROBE_HEAD = 20;
export const PROBE_WAIT_MS = 2_000;
export const PROBE_ROUNDS = 3;
/** Un « réessaie dans » de l'extension, borné (jamais une attente sans fin). */
const RETRY_CAP_MS = 10_000;

const PLAYABLE: ReadonlySet<string> = new Set<MusicPlayable>(["yes", "no", "unknown"]);
const REASONS: ReadonlySet<string> = new Set<MusicPlayableReason>(["unavailable", "region", "premium", "members", "age", "noStream", "preview"]);

const NOT_A_TRACK: TrackPlayability = { state: "playable", reason: null, greyed: false };

/** L'état d'une rangée : celui du titre, l'appris par-dessus (`null` : pas un titre — une carte d'album, d'artiste). */
export function useTrackPlayability(track: MusicTrack | null): TrackPlayability {
  const key = track?.key ?? "";
  const patch = useSyncExternalStore(
    (listener) => onPlayabilityOf(key, listener),
    () => learnedPlayability(key),
    () => learnedPlayability(key),
  );
  // `patch` change d'objet quand l'état de CETTE clé change : le calcul suit.
  return useMemo(() => {
    // Gardé sur l'appareil : il se lit depuis son fichier (`isKeptForPlayback`).
    if (!track || isKeptForPlayback(track.key)) return NOT_A_TRACK;
    return trackPlayability(patch && !track.jellyfinId ? withPlayability(track, { playable: patch.playable, reason: patch.reason ?? null }) : track);
  }, [track, patch]);
}

/** La réponse lue prudemment : des valeurs inconnues de ce client sont ignorées (l'état reste « pas su »). */
export function readPlayability(raw: PlayabilityResponse | null | undefined, keyOf: (externalId: string) => string): { states: Map<string, PlayabilityPatch>; retryAfterMs: number | null } {
  const states = new Map<string, PlayabilityPatch>();
  for (const [id, state] of Object.entries(raw?.states ?? {})) {
    if (!state || !PLAYABLE.has(state.playable)) continue;
    const reason = state.playable === "no" ? (state.reason && REASONS.has(state.reason) ? state.reason : "noStream") : null;
    states.set(keyOf(id), { playable: state.playable, reason });
  }
  const retry = raw?.retryAfterMs;
  return { states, retryAfterMs: typeof retry === "number" && Number.isFinite(retry) && retry >= 0 ? Math.min(retry, RETRY_CAP_MS) : null };
}

/** Les clés en cours de sondage, toutes listes confondues : deux listes d'une même page ne demandent pas deux fois. */
const probing = new Set<string>();

/**
 * Les titres de cette extension qu'il reste à sonder, dans l'ordre de la liste, `PROBE_HEAD` au plus. `inFlight` :
 * ceux qu'un autre sondage demande déjà sont écartés (jamais pour la SIGNATURE d'une liste : sinon le sondage en
 * cours la changerait, et s'annulerait lui-même — vu au banc).
 */
export function probeCandidates(provider: MusicProvider, tracks: readonly MusicTrack[], inFlight = true): MusicTrack[] {
  const out: MusicTrack[] = [];
  for (const track of tracks) {
    if (out.length >= Math.min(PROBE_HEAD, PLAYABILITY_BATCH_MAX)) break;
    if (track.jellyfinId || !track.external || !isFromMusicProvider(provider, track.external.pluginId)) continue;
    // Absent = « unknown » (règle du contrat) ; déjà su (par la liste ou appris) : rien à demander.
    if (track.playable === "yes" || track.playable === "no") continue;
    const known = learnedPlayability(track.key);
    if ((known && known.playable !== "unknown") || (inFlight && probing.has(track.key))) continue;
    out.push(track);
  }
  return out;
}

async function askOnce(provider: MusicProvider, path: string, tracks: readonly MusicTrack[], signal: AbortSignal) {
  const byId = new Map(tracks.map((t) => [t.external?.id ?? "", t.key]));
  const body: PlayabilityRequest = { ids: [...byId.keys()], waitMs: PROBE_WAIT_MS };
  const raw = await tentacleApiFetch<PlayabilityResponse>(musicRouteUrl(provider, path), { method: "POST", body: JSON.stringify(body), signal });
  return readPlayability(raw, (id) => byId.get(id) ?? `ext:${provider.pluginId}:${id}`);
}

/** Le sondage d'une liste, tours compris ; s'arrête dès que `signal` est annulé. */
export async function probePlayability(provider: MusicProvider, tracks: readonly MusicTrack[], signal: AbortSignal, wait = (ms: number) => new Promise((r) => setTimeout(r, ms))): Promise<void> {
  const path = provider.music.playability;
  if (!path) return;
  let pending = probeCandidates(provider, tracks);
  const mine = pending.map((t) => t.key);
  for (const key of mine) probing.add(key);
  try {
    for (let round = 0; round < PROBE_ROUNDS && pending.length > 0 && !signal.aborted; round += 1) {
      const { states, retryAfterMs } = await askOnce(provider, path, pending, signal);
      // Une réponse arrivée est un FAIT : posée même si la liste a changé entre-temps ; seuls les tours suivants s'arrêtent.
      announcePlayability(states);
      if (signal.aborted) return;
      if (retryAfterMs === null) return;
      await wait(retryAfterMs);
      pending = pending.filter((t) => (learnedPlayability(t.key)?.playable ?? "unknown") === "unknown");
    }
  } finally {
    for (const key of mine) probing.delete(key);
  }
}

/** À l'affichage d'une liste : ses titres `unknown` de tête sont sondés ; une autre liste annule celle-ci. */
export function usePlayabilityProbe(provider: MusicProvider | null, tracks: readonly MusicTrack[] | null | undefined): void {
  const path = provider?.music.playability ?? null;
  // La demande ne dépend que des CLÉS à sonder : une révision de la liste qui n'en change rien ne relance rien.
  const signature = useMemo(() => (provider && path && tracks ? probeCandidates(provider, tracks, false).map((t) => t.key).join("|") : ""), [provider, path, tracks]);
  // `tracks` est lu au moment où la signature change, pas à chaque révision.
  const latest = useRef(tracks);
  latest.current = tracks;
  useEffect(() => {
    const list = latest.current;
    if (!provider || !path || !list || signature === "") return;
    const controller = new AbortController();
    void probePlayability(provider, list, controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [provider, path, signature]);
}
