/**
 * Octave — la lecture FERMÉE du corps de `POST /api/music/match` : des champs
 * connus, bornés ; tout le reste est ignoré. `null` : corps refusé (400).
 */

import type { MusicMatchAlbumQuery, MusicMatchRequest, MusicMatchTrackQuery } from "../contract/musicCoreApi";
import { normalizeMbid } from "../contract/musicKeys";

export const MATCH_LIMITS = { tracks: 200, albums: 50, albumTracks: 300, text: 300, artists: 12 } as const;

const text = (value: unknown): string | null => (typeof value === "string" && value.trim().length > 0 ? value.slice(0, MATCH_LIMITS.text) : null);
const count = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null);
const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null);

function artistsOf(value: unknown): { name: string; mbid: string | null }[] {
  if (!Array.isArray(value)) return [];
  const out: { name: string; mbid: string | null }[] = [];
  for (const raw of value.slice(0, MATCH_LIMITS.artists)) {
    const name = text(record(raw)?.name);
    if (name) out.push({ name, mbid: normalizeMbid(record(raw)?.mbid) });
  }
  return out;
}

function trackOf(value: unknown): MusicMatchTrackQuery | null {
  const raw = record(value);
  const ref = text(raw?.ref);
  const title = text(raw?.title);
  if (!raw || !ref || !title) return null;
  return {
    ref,
    title,
    artists: artistsOf(raw.artists),
    albumTitle: text(raw.albumTitle),
    durationMs: count(raw.durationMs),
    recording: normalizeMbid(raw.recording),
    discNumber: count(raw.discNumber),
    trackNumber: count(raw.trackNumber),
  };
}

function albumOf(value: unknown, budget: { left: number }): MusicMatchAlbumQuery | null {
  const raw = record(value);
  const ref = text(raw?.ref);
  const title = text(raw?.title);
  if (!raw || !ref || !title) return null;
  const tracks = Array.isArray(raw.tracks) ? raw.tracks.map(trackOf).filter((t): t is MusicMatchTrackQuery => t !== null) : undefined;
  if (tracks) budget.left -= tracks.length;
  return {
    ref,
    title,
    artists: artistsOf(raw.artists),
    release: normalizeMbid(raw.release),
    releaseGroup: normalizeMbid(raw.releaseGroup),
    compilation: raw.compilation === true,
    trackCount: count(raw.trackCount),
    ...(tracks ? { tracks } : {}),
  };
}

export function parseMatchRequest(body: unknown): Required<MusicMatchRequest> | null {
  const raw = record(body);
  if (!raw) return null;
  const tracks = raw.tracks ?? [];
  const albums = raw.albums ?? [];
  if (!Array.isArray(tracks) || !Array.isArray(albums) || tracks.length > MATCH_LIMITS.tracks || albums.length > MATCH_LIMITS.albums) return null;
  const budget = { left: MATCH_LIMITS.albumTracks };
  const parsedAlbums = albums.map((a) => albumOf(a, budget)).filter((a): a is MusicMatchAlbumQuery => a !== null);
  if (budget.left < 0) return null;
  return { tracks: tracks.map(trackOf).filter((t): t is MusicMatchTrackQuery => t !== null), albums: parsedAlbums };
}
