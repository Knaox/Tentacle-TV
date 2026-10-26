/**
 * Octave — les AMBIANCES (détente, concentration, soirée…) d'une extension de musique : points `moods` et `mood`
 * du contrat `music` (pluginMusicContract.ts, docs/octave/CONTRATS.md). C'est l'EXTENSION qui les compose (ses
 * sources, son cache, son budget) ; le cœur ne fait que les montrer et les jouer.
 *
 * Extension d'avant (ni `moods` ni `mood`) : aucune ambiance, nulle part, sans erreur. Les deux vont ensemble :
 * l'un sans l'autre ne vaut rien (`hasMoods`).
 */

import type { MusicTrack } from "./musicTypes";
import type { ExternalMusicPlaylist, PluginMusicManifest } from "./pluginMusicContract";

/** Une ambiance. `id` est une clé STABLE (elle traverse le réseau et les adresses) : elle ne se renomme jamais. */
export interface ExternalMusicMood {
  id: string;
  /** Son nom dans la langue de l'INTERFACE (`?lang=` de la requête, sinon l'en-tête de langue du relais). */
  name: string;
  /** Sa couleur, `#RRGGBB` : la carte et la tête de sa page en tirent leur teinte. */
  color: string;
  /** Une image (https publique ou route relayée de l'extension) ; `null` : la couleur seule. */
  artworkUrl: string | null;
  /**
   * Les mots qui la NOMMENT dans la recherche, toutes langues, en minuscules (« chill », « détente », « relax ») :
   * le client les compare à la frappe, localement, sans requête. Son nom en fait toujours partie.
   */
  keywords: string[];
}

/** `GET <moods>` : les ambiances, dans l'ordre où l'extension veut les montrer. */
export interface ExternalMusicMoods {
  moods: ExternalMusicMood[];
}

/**
 * `GET <mood>/<moodId>` : la playlist de suggestions d'une ambiance — une playlist hors bibliothèque comme une autre
 * (`ExternalMusicPlaylist`, ses `tracks` toujours rendus), plus son ambiance. Les titres que la bibliothèque du compte
 * a sont EN TÊTE ; le client les reconnaît et les joue comme les siens (`POST /api/music/match`).
 */
export interface ExternalMusicMoodMix extends ExternalMusicPlaylist {
  mood: ExternalMusicMood;
  tracks: MusicTrack[];
  /** D'autres playlists de cette ambiance (vue `playlist` de l'extension) ; absent : aucune. */
  playlists?: ExternalMusicPlaylist[];
}

/** L'extension sert-elle les ambiances ? Il faut les DEUX points. */
export function hasMoods(music: PluginMusicManifest | null | undefined): music is PluginMusicManifest & { moods: string; mood: string } {
  return typeof music?.moods === "string" && typeof music.mood === "string";
}

const MOOD_ID = /^[a-z0-9-]{1,40}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;

/** Une ambiance validée ; `null` si elle n'a pas la forme (elle est alors écartée, les autres restent). */
export function readMusicMood(raw: unknown): ExternalMusicMood | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.id !== "string" || !MOOD_ID.test(m.id)) return null;
  if (typeof m.name !== "string" || m.name.trim().length === 0 || m.name.length > 60) return null;
  if (typeof m.color !== "string" || !COLOR.test(m.color)) return null;
  const artworkUrl = typeof m.artworkUrl === "string" && m.artworkUrl.length <= 2_000 ? m.artworkUrl : null;
  const words = Array.isArray(m.keywords) ? m.keywords : [];
  const keywords = [...new Set([m.name, ...words].filter((w): w is string => typeof w === "string" && w.length > 0 && w.length <= 40).map((w) => w.toLowerCase()))].slice(0, 30);
  return { id: m.id, name: m.name.trim(), color: m.color.toLowerCase(), artworkUrl, keywords };
}

/** La réponse de `moods`, validée : au plus 40 ambiances, une clé une fois. */
export function readMusicMoods(raw: unknown): ExternalMusicMood[] {
  const list = raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).moods) ? ((raw as ExternalMusicMoods).moods as unknown[]) : [];
  const out: ExternalMusicMood[] = [];
  for (const item of list) {
    const mood = readMusicMood(item);
    if (mood && !out.some((m) => m.id === mood.id)) out.push(mood);
    if (out.length >= 40) break;
  }
  return out;
}
