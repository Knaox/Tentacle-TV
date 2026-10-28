/**
 * Octave — une vue d'album ou d'artiste hors bibliothèque demandée AVANT le clic, dans le MÊME cache que la vue
 * (`externalEntityKey`, même réponse) : la vue s'ouvre ensuite d'emblée. Deux entrées, web et mobile :
 *
 * - `prefetchExternalEntity` : une INTENTION sur une carte (survol tenu ou focus au bureau, appui commencé au
 *   doigt) — le clic va venir. Plafond `INTENT_PER_MINUTE` (fenêtre glissante) ; une page déjà là ne repart pas.
 * - `warmVisibleAlbums` : les albums VUS DÉFILER, à l'arrêt du défilement (règle `albumWarmup` du partagé) — par le
 *   signal de fond de l'extension quand elle sait préparer des albums, sinon, au compte-gouttes, par la vue.
 *
 * Rien ne s'affiche, une erreur ne se voit jamais (la vue redemandera).
 */

import type { QueryClient } from "@tanstack/react-query";
import { createWarmBook, pickAlbumsToWarm, warmCandidates, type WarmMode } from "@tentacle-tv/shared/octave";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { isFromMusicProvider, type MusicProvider } from "../../pluginMusic/musicProvider";
import { fetchExternalAlbum, fetchExternalArtist, prefetchMusic } from "../../pluginMusic/musicRequests";
import { externalEntityKey, externalEntityRef } from "./useMusicEntities";

export const INTENT_PER_MINUTE = 20;
/** Celle de la vue (`useMusicEntities`) : une page demandée d'avance reste fraîche jusqu'au clic. */
const STALE_MS = 60_000;

const intents: number[] = [];

/** Une demande d'avance de plus est-elle permise maintenant ? (fenêtre glissante d'une minute) */
export function takeIntentSlot(now = Date.now()): boolean {
  while (intents.length > 0 && now - intents[0]! >= 60_000) intents.shift();
  if (intents.length >= INTENT_PER_MINUTE) return false;
  intents.push(now);
  return true;
}

/** Pour les tests. */
export function resetEntityWarmupForTests(): void {
  intents.length = 0;
  book = createWarmBook();
}

function fresh(qc: QueryClient, kind: "album" | "artist", idOrKey: string, now: number): boolean {
  const state = qc.getQueryState(externalEntityKey(kind, idOrKey));
  return state?.fetchStatus === "fetching" || (state?.data !== undefined && now - state.dataUpdatedAt < STALE_MS);
}

function prefetchView(qc: QueryClient, provider: MusicProvider, kind: "album" | "artist", idOrKey: string, id: string): void {
  const queryFn = ({ signal }: { signal: AbortSignal }): Promise<unknown> =>
    kind === "album" ? fetchExternalAlbum(provider, id, signal) : fetchExternalArtist(provider, id, signal);
  void qc.prefetchQuery({ queryKey: externalEntityKey(kind, idOrKey), queryFn, staleTime: STALE_MS, retry: false });
}

/** Une intention sur une carte : sa vue part d'avance (`false` : rien n'est parti — bibliothèque, déjà là, plafond). */
export function prefetchExternalEntity(qc: QueryClient, provider: MusicProvider | null, kind: "album" | "artist", idOrKey: string | null, now = Date.now()): boolean {
  const ref = externalEntityRef(idOrKey);
  if (!ref || !idOrKey || !provider || !isFromMusicProvider(provider, ref.pluginId)) return false;
  if (fresh(qc, kind, idOrKey, now) || !takeIntentSlot(now)) return false;
  prefetchView(qc, provider, kind, idOrKey, ref.id);
  return true;
}

let book = createWarmBook();

/**
 * Le régime de l'extension : `signal` si son point d'anticipation sait préparer des albums, sinon `fetch`
 * (repli borné). `null` : rien à faire (pas d'extension, pas de vue d'album).
 */
export function warmModeOf(provider: MusicProvider | null): WarmMode | null {
  if (!provider?.music.album) return null;
  return provider.music.prefetch && provider.music.prefetchAlbums === true ? "signal" : "fetch";
}

/** Les albums visibles à l'arrêt du défilement : ceux à préparer partent (rien si la vue est déjà là). */
export function warmVisibleAlbums(qc: QueryClient, provider: MusicProvider | null, albums: readonly MusicAlbum[], now = Date.now()): string[] {
  const mode = warmModeOf(provider);
  if (!mode || !provider) return [];
  const picked = pickAlbumsToWarm(book, warmCandidates(albums, provider.pluginId), mode, now, (key) => fresh(qc, "album", key, now));
  if (picked.length === 0) return [];
  // Le signal de fond : l'extension prépare ces albums sous son budget (204, jamais une erreur pour l'appelant).
  if (mode === "signal") prefetchMusic(provider, picked.map((c) => c.id), "albums", now);
  else for (const c of picked) prefetchView(qc, provider, "album", c.key, c.id);
  return picked.map((c) => c.key);
}
