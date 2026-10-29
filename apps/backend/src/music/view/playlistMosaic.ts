/**
 * Octave — la jaquette composée de chaque playlist (`musicMosaic.ts`, règle partagée avec les clients), sans
 * requête de plus AU REPOS : les albums candidats d'une playlist se gardent en mémoire, avec le TAMPON de la
 * playlist (`Etag` de Jellyfin — il suit `DateLastSaved`, que tout ajout, retrait ou déplacement refait — et son
 * nombre de titres, sa durée). Tant que le tampon ne bouge pas, la liste des playlists ne relit rien ; un tampon
 * changé relit les entrées de CETTE playlist (identifiants seuls) et l'index du cœur. La vue d'une playlist, qui
 * lit déjà tout, renouvelle sa place d'office.
 *
 * Au premier passage (démarrage du serveur), les playlists se lisent quatre à la fois, dans un budget : ce qui
 * n'est pas prêt garde l'image de Jellyfin cette fois-ci et finit en fond, pour la liste suivante.
 *
 * Une image POSÉE À LA MAIN (`playlistHasHandPlacedImage`, chemin relu une fois par tampon — l'envoi d'une image
 * change l'`Etag`) reste celle de la playlist : aucune jaquette composée.
 *
 * Seul le choix du jour se calcule à chaque réponse (une note par album) : il tourne à minuit UTC, partout pareil.
 */

import { mosaicCandidates, pickMosaic, type MosaicCandidate, type MusicPlaylistCover } from "../contract/musicMosaic";
import type { MusicPlaylist, MusicTrack } from "../contract/musicTypes";
import { normalizeId } from "../jellyfin/musicJellyfin";
import { playlistEntries, playlistHasHandPlacedImage, type JfPlaylist } from "../playlists/playlistJellyfin";
import { readerOf } from "../playlistMembers/playlistAccess";
import { tracksOf, visibleInOrder, type UserView } from "./viewContext";

interface Kept {
  stamp: string;
  candidates: MosaicCandidate[];
  /** L'image de Jellyfin a été posée à la main : elle reste. */
  handPlaced: boolean;
  at: number;
}

/** Ce que la vue d'une playlist pose sur sa réponse (`MusicPlaylistDetail.cover`). */
export type MosaicPlace = MusicPlaylistCover;

/** Au-delà, la place se relit quand même (une pochette d'album arrivée après le titre). */
const MAX_AGE_MS = 6 * 3_600_000;
const MAX_KEPT = 1_000;
const CONCURRENCY = 4;
/** Ce que la liste attend au plus les playlists jamais lues ; le reste finit en fond. */
export const MOSAIC_WAIT_MS = 1_500;

const kept = new Map<string, Kept>();
const reading = new Map<string, Promise<Kept | null>>();

const keyOf = (view: UserView, playlistId: string) => `${normalizeId(view.userId)}:${normalizeId(playlistId)}`;

/** Ce qui change quand la playlist change. */
export function playlistStamp(item: JfPlaylist): string {
  return [item.Etag ?? "", item.ChildCount ?? "", item.CumulativeRunTimeTicks ?? item.RunTimeTicks ?? ""].join("|");
}

function remember(key: string, value: Kept): Kept {
  kept.delete(key);
  kept.set(key, value);
  // La plus ancienne place part la première (ordre d'insertion de la Map).
  while (kept.size > MAX_KEPT) kept.delete(kept.keys().next().value!);
  return value;
}

/**
 * La vue d'une playlist a ses titres : sa place se renouvelle sans relire les entrées. Le verdict « posée à la
 * main » se garde tant que le tampon tient ; sinon il se relit (une requête, l'image de la playlist).
 */
export async function rememberMosaic(view: UserView, item: JfPlaylist, tracks: readonly MusicTrack[], now = Date.now()): Promise<MosaicPlace> {
  const key = keyOf(view, item.Id);
  const before = kept.get(key);
  const handPlaced = before && before.stamp === playlistStamp(item) ? before.handPlaced : await handPlacedOf(item, before);
  const entry = remember(key, { stamp: playlistStamp(item), candidates: mosaicCandidates(tracks), handPlaced, at: now });
  return { candidates: entry.candidates, handPlaced: entry.handPlaced };
}

/** Jellyfin muet : le verdict d'avant, sinon « non » (la jaquette composée, jamais une case vide). */
async function handPlacedOf(item: JfPlaylist, before: Kept | undefined): Promise<boolean> {
  return (await playlistHasHandPlacedImage(item).catch(() => null)) ?? before?.handPlaced ?? false;
}

function fresh(entry: Kept | undefined, item: JfPlaylist, now: number): entry is Kept {
  return !!entry && entry.stamp === playlistStamp(item) && now - entry.at < MAX_AGE_MS;
}

async function readCandidates(view: UserView, item: JfPlaylist, now: number): Promise<Kept | null> {
  const key = keyOf(view, item.Id);
  const [entries, handPlaced] = await Promise.all([playlistEntries(readerOf(view.userId, item), item.Id), handPlacedOf(item, kept.get(key))]);
  if (!entries) return null;
  const rows = await visibleInOrder(view, entries.map((e) => e.itemId));
  return remember(key, { stamp: playlistStamp(item), candidates: mosaicCandidates(await tracksOf(view, rows)), handPlaced, at: now });
}

/** Une seule lecture à la fois par playlist et par compte. */
function readOnce(view: UserView, item: JfPlaylist, now: number): Promise<Kept | null> {
  const key = keyOf(view, item.Id);
  const running = reading.get(key);
  if (running) return running;
  const task = readCandidates(view, item, now)
    .catch(() => null)
    .finally(() => reading.delete(key));
  reading.set(key, task);
  return task;
}

async function readAll(view: UserView, items: readonly JfPlaylist[], now: number): Promise<void> {
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) await readOnce(view, item, now);
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
}

/** La place de chaque playlist (identifiant normalisé) ; une playlist pas encore lue n'y est pas. */
export async function mosaicCandidatesFor(view: UserView, items: readonly JfPlaylist[], options: { waitMs?: number; now?: number } = {}): Promise<Map<string, MosaicPlace>> {
  const now = options.now ?? Date.now();
  const stale = items.filter((item) => !fresh(kept.get(keyOf(view, item.Id)), item, now));
  if (stale.length > 0) {
    const all = readAll(view, stale, now);
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([all, new Promise<void>((resolve) => (timer = setTimeout(resolve, options.waitMs ?? MOSAIC_WAIT_MS)))]);
    clearTimeout(timer);
  }
  const out = new Map<string, MosaicPlace>();
  for (const item of items) {
    const entry = kept.get(keyOf(view, item.Id));
    // Une place d'avant le changement sert encore si la relecture a échoué : mieux que rien, jamais faux longtemps.
    if (entry) out.set(normalizeId(item.Id), { candidates: entry.candidates, handPlaced: entry.handPlaced });
  }
  return out;
}

/** La jaquette du jour, posée sur la playlist ; rien si l'image a été posée à la main, ou sans pochette d'album. */
export function withMosaic(playlist: MusicPlaylist, place: MosaicPlace | undefined, now = Date.now()): MusicPlaylist {
  const mosaic = place && !place.handPlaced ? pickMosaic(place.candidates, playlist.jellyfinId, now) : [];
  return mosaic.length > 0 ? { ...playlist, mosaic } : playlist;
}

export function forgetMosaics(): void {
  kept.clear();
}
