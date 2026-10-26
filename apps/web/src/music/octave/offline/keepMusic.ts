/**
 * Octave — garder des titres sur cet appareil, et les en retirer (bureau,
 * capacité `offline.music`). Un titre, un album, une playlist : un LOT, mis en
 * file d'un coup dans le moteur des films (refusé en bloc faute de place).
 *
 * - Bibliothèque : le SERVEUR dit d'où et sous quelle forme (`/api/music/offline/plan` :
 *   l'original, ou l'Allégé audio de l'administration) et refuse ce que le compte
 *   ne peut pas garder.
 * - Hors bibliothèque : la route `offline` du contrat `music` de l'extension ; le
 *   cœur n'en sait rien d'autre (elle tient ses droits, et répond 503 tant que le
 *   fichier se prépare : le moteur réessaie seul).
 *
 * Toujours au nom du COMPTE DE L'APPAREIL (son jeton), jamais d'un profil.
 */

import type { KeptMusicTrack, MusicKeepItem } from "@tentacle-tv/offline-core";
import { musicRouteUrl, tentacleApiFetch, type MusicProvider } from "@tentacle-tv/api-client";
import { MUSIC_ROUTES, type MusicOfflinePlanResponse, type MusicOfflineTrackPlan, type MusicTrack } from "@tentacle-tv/shared/music";
import { invoke } from "../../../desktop/bridge";
import { getBackendBase } from "../../../lib/backendBase";
import { readOfflineOwner } from "../../../offline/offlineOwner";
import { refreshKeptMusic } from "./keptMusicStore";

/** Un album ou une playlist gardés en entier : pour les retrouver sans réseau, dans leur ordre. */
export interface KeepCollection {
  key: string;
  kind: "album" | "playlist";
  title: string;
  subtitle: string | null;
  /** TOUS ses titres, dans leur ordre — même quand le lot n'en garde qu'une partie (« les titres qui manquent »). */
  trackKeys: readonly string[];
}

export type KeepOutcome =
  | { kind: "queued"; count: number; refused: number }
  | { kind: "noSpace"; neededBytes: number }
  | { kind: "failed" };

const PLAN_BATCH = 200;

/** Un chemin du serveur Tentacle seulement : la pochette se garde avec le jeton, qui ne sort jamais vers un autre hôte. */
function serverArtwork(url: string | null): string | null {
  return url !== null && url.startsWith("/api/") && !url.includes("//") ? url : null;
}

/**
 * La pochette https d'un titre HORS bibliothèque (un autre hôte) : gardée aussi,
 * demandée par le moteur SANS aucun jeton (`makePublicFetcher`, bureau).
 */
function publicArtwork(url: string | null): string | null {
  return url !== null && url.startsWith("https://") && url.length <= 600 && !/[?&](api_key|apikey|token)=/i.test(url) ? url : null;
}

function baseItem(track: MusicTrack): Omit<MusicKeepItem, "origin" | "sourcePath" | "variant" | "preset" | "containerExt" | "expectedSize" | "estimatedSize"> {
  return {
    trackKey: track.key,
    title: track.title,
    artist: track.artists.map((a) => a.name).join(", ") || null,
    album: track.album?.title ?? null,
    albumKey: track.album ? (track.album.jellyfinId ? `jf:${track.album.jellyfinId}` : track.album.mbid ?? track.album.title) : null,
    discNumber: track.discNumber,
    trackNumber: track.trackNumber,
    durationMs: track.durationMs,
    artworkPath: serverArtwork(track.artworkUrl),
    trackJson: JSON.stringify(track),
  };
}

function libraryItem(track: MusicTrack, plan: MusicOfflineTrackPlan): MusicKeepItem {
  return {
    ...baseItem(track),
    origin: "library",
    sourcePath: plan.path,
    variant: plan.variant,
    preset: plan.preset,
    containerExt: plan.container,
    expectedSize: plan.expectedSize,
    estimatedSize: plan.estimatedSize,
  };
}

/** L'estimation d'un titre d'ailleurs (sa taille n'est connue qu'à la réponse) : ~256 kb/s, 4 min par défaut. */
function externalEstimate(track: MusicTrack): number {
  return Math.ceil(((track.durationMs ?? 240_000) / 1000) * 32_000 * 1.1);
}

function externalItem(track: MusicTrack, provider: MusicProvider): MusicKeepItem | null {
  if (!track.external || !provider.music.offline || track.external.pluginId !== provider.pluginId) return null;
  return {
    ...baseItem(track),
    artworkPath: serverArtwork(track.artworkUrl) ?? publicArtwork(track.artworkUrl),
    origin: "external",
    sourcePath: musicRouteUrl(provider, `${provider.music.offline}/${encodeURIComponent(track.external.id)}`),
    variant: "original",
    preset: null,
    containerExt: "audio",
    expectedSize: null,
    estimatedSize: externalEstimate(track),
  };
}

async function planLibrary(ids: string[]): Promise<Map<string, MusicOfflineTrackPlan>> {
  const plans = new Map<string, MusicOfflineTrackPlan>();
  for (let i = 0; i < ids.length; i += PLAN_BATCH) {
    const body = { ids: ids.slice(i, i + PLAN_BATCH) };
    const res = await tentacleApiFetch<MusicOfflinePlanResponse>(MUSIC_ROUTES.offlinePlan, { method: "POST", body: JSON.stringify(body) });
    for (const plan of res.tracks) plans.set(plan.id, plan);
  }
  return plans;
}

/** Garde ces titres sur l'appareil (et la collection, si c'en est une). */
export async function keepTracks(tracks: readonly MusicTrack[], provider: MusicProvider | null, collection: KeepCollection | null = null): Promise<KeepOutcome> {
  const owner = readOfflineOwner();
  if (!owner?.token) return { kind: "failed" };
  try {
    const library = tracks.filter((t) => t.jellyfinId && t.availability === "library");
    const plans = library.length > 0 ? await planLibrary(library.map((t) => t.jellyfinId!)) : new Map<string, MusicOfflineTrackPlan>();
    const items: MusicKeepItem[] = [];
    for (const track of tracks) {
      const plan = track.jellyfinId && track.availability === "library" ? plans.get(track.jellyfinId.replace(/-/g, "").toLowerCase()) : undefined;
      const item = plan ? libraryItem(track, plan) : track.availability === "library" ? null : provider ? externalItem(track, provider) : null;
      if (item) items.push(item);
    }
    if (items.length === 0) return { kind: "failed" };
    const outcome = await invoke<{ accepted: boolean; neededBytes: number }>("downloads_music_enqueue", {
      userId: owner.userId,
      serverUrl: getBackendBase(),
      token: owner.token,
      items,
      collection: collection && { ...collection, coverItemId: null, trackKeys: [...collection.trackKeys] },
    });
    await refreshKeptMusic();
    if (!outcome.accepted) return { kind: "noSpace", neededBytes: outcome.neededBytes };
    return { kind: "queued", count: items.length, refused: tracks.length - items.length };
  } catch {
    return { kind: "failed" };
  }
}

/** Retire ces titres de l'appareil (et la collection) ; un titre partagé avec un autre compte reste à lui. */
export async function removeKept(kept: readonly KeptMusicTrack[], collectionKey: string | null = null): Promise<boolean> {
  const owner = readOfflineOwner();
  if (!owner) return false;
  try {
    await invoke("downloads_music_remove", { userId: owner.userId, fileIds: kept.map((k) => k.fileId), collectionKey });
    await refreshKeptMusic();
    return true;
  } catch {
    return false;
  }
}
