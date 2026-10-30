/**
 * Octave — ce qu'un geste « Garder hors ligne » met en file, règle PURE commune
 * au bureau et au mobile (`keepItems.test.ts`) : un titre de la bibliothèque est
 * tiré du chemin que donne le SERVEUR (`/api/music/offline/plan` : l'original, ou
 * l'Allégé audio de l'administration) ; un titre hors bibliothèque, de la route
 * `offline` du contrat `music` de l'extension (Sillon : sa logique reste chez
 * elle — elle tient ses droits, et répond 503 tant que le fichier se prépare : le
 * moteur réessaie seul). Le cœur ne connaît aucune extension : la plateforme lui
 * donne le chemin (`externalPath`).
 */

import type { MusicOfflinePlanResponse, MusicOfflineTrackPlan, MusicTrack } from "@tentacle-tv/shared/music";
import { isTrackUnavailable } from "@tentacle-tv/shared/octave";
import type { KeptCollectionKind } from "../core/musicLibrary";
import type { MusicKeepItem } from "../core/musicKeep";

/**
 * Un album ou une playlist gardés en entier, pour les retrouver sans réseau dans leur ordre — ou `track`, un titre
 * gardé seul (menu « … ») : ce qui le RETIENT quand sa playlist le perd (`syncPlan.ts`).
 */
export interface KeepCollection {
  key: string;
  kind: KeptCollectionKind;
  title: string;
  subtitle: string | null;
  /** TOUS ses titres, dans leur ordre — même quand le lot n'en garde qu'une partie (« les titres qui manquent »). */
  trackKeys: readonly string[];
}

export type KeepOutcome =
  | { kind: "queued"; count: number; refused: number }
  | { kind: "noSpace"; neededBytes: number }
  | { kind: "failed" };

/** Le chemin d'où tirer un titre HORS bibliothèque (la route `offline` de l'extension) ; `null` : il ne se garde pas. */
export type ExternalKeepPath = (track: MusicTrack) => string | null;

/** Ce que la garde sait d'une extension de musique (le `MusicProvider` d'api-client, réduit). */
export interface KeepProvider {
  pluginId: string;
  music: { offline?: string };
}

/**
 * Le chemin d'un titre de CETTE extension, par la route `offline` de son contrat (`routeUrl` : `musicRouteUrl`
 * d'api-client) ; `null` sans extension ou sans route : rien d'ailleurs ne se garde.
 */
export function externalKeepPath<P extends KeepProvider>(provider: P | null, routeUrl: (provider: P, path: string) => string): ExternalKeepPath | null {
  const route = provider?.music.offline;
  if (!provider || !route) return null;
  return (track) =>
    track.external && track.external.pluginId === provider.pluginId ? routeUrl(provider, `${route}/${encodeURIComponent(track.external.id)}`) : null;
}

export const PLAN_BATCH = 200;

/** Un chemin du serveur Tentacle seulement : la pochette se garde avec le jeton, qui ne sort jamais vers un autre hôte. */
function serverArtwork(url: string | null): string | null {
  return url !== null && url.startsWith("/api/") && !url.includes("//") ? url : null;
}

/**
 * La pochette https d'un titre HORS bibliothèque (un autre hôte) : gardée aussi,
 * demandée par le moteur SANS aucun jeton (`makePublicFetcher`).
 */
function publicArtwork(url: string | null): string | null {
  return url !== null && url.startsWith("https://") && url.length <= 600 && !/[?&](api_key|apikey|token)=/i.test(url) ? url : null;
}

type BaseItem = Omit<MusicKeepItem, "origin" | "sourcePath" | "variant" | "preset" | "containerExt" | "expectedSize" | "estimatedSize">;

function baseItem(track: MusicTrack): BaseItem {
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

function externalItem(track: MusicTrack, sourcePath: string): MusicKeepItem {
  return {
    ...baseItem(track),
    artworkPath: serverArtwork(track.artworkUrl) ?? publicArtwork(track.artworkUrl),
    origin: "external",
    sourcePath,
    variant: "original",
    preset: null,
    containerExt: "audio",
    expectedSize: null,
    estimatedSize: externalEstimate(track),
  };
}

const isLibrary = (track: MusicTrack): boolean => !!track.jellyfinId && track.availability === "library";

/** L'identifiant tel que le plan le rend (sans tirets, en minuscules). */
const planId = (jellyfinId: string): string => jellyfinId.replace(/-/g, "").toLowerCase();

/** Les identifiants Jellyfin à demander au plan du serveur. */
export function libraryIdsOf(tracks: readonly MusicTrack[]): string[] {
  return tracks.filter(isLibrary).map((t) => t.jellyfinId!);
}

/** Le plan du serveur, par lots (`fetchPlan` : `POST /api/music/offline/plan`). */
export async function planLibrary(
  ids: readonly string[],
  fetchPlan: (body: { ids: string[] }) => Promise<MusicOfflinePlanResponse>,
): Promise<Map<string, MusicOfflineTrackPlan>> {
  const plans = new Map<string, MusicOfflineTrackPlan>();
  for (let i = 0; i < ids.length; i += PLAN_BATCH) {
    const res = await fetchPlan({ ids: ids.slice(i, i + PLAN_BATCH) });
    for (const plan of res.tracks) plans.set(plan.id, plan);
  }
  return plans;
}

/** Le lot à mettre en file : un titre de la bibliothèque sans plan (refusé par le serveur) ne part pas. */
export function keepItemsFor(
  tracks: readonly MusicTrack[],
  plans: ReadonlyMap<string, MusicOfflineTrackPlan>,
  externalPath: ExternalKeepPath | null,
): MusicKeepItem[] {
  const items: MusicKeepItem[] = [];
  for (const track of tracks) {
    // Un titre indisponible ne part jamais (`keepRules.ts`) : aucune erreur de transfert à cause de lui.
    if (isTrackUnavailable(track)) continue;
    if (track.availability === "library") {
      const plan = track.jellyfinId ? plans.get(planId(track.jellyfinId)) : undefined;
      if (plan) items.push(libraryItem(track, plan));
      continue;
    }
    const path = externalPath ? externalPath(track) : null;
    if (path) items.push(externalItem(track, path));
  }
  return items;
}
