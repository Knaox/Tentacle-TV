/* ------------------------------------------------------------------ */
/*  Les vidéos AlloCiné d'UN titre — pur                                */
/*                                                                     */
/*  La recherche de Dailymotion est floue (« Rick » rend aussi Rick     */
/*  Grimes) et AlloCiné a des HOMONYMES réels (« Dune Bande-annonce VF »*/
/*  de 2012 ET de 2021, « Malcolm » de 2012 qui n'est pas la série).   */
/*  Une vidéo n'est gardée que si :                                    */
/*  - son nom est EXACTEMENT celui du titre, une fois normalisé (casse,*/
/*    accents, ponctuation, `&` = `et`) — nom français, original, ou un*/
/*    titre alternatif français de TMDB ;                              */
/*  - sa date tombe autour de la sortie : un film ou la série, de      */
/*    18 mois avant la sortie à 18 mois après (la dernière diffusion   */
/*    pour une série) ; une saison, de 12 mois avant sa diffusion à    */
/*    36 mois après ;                                                  */
/*  - elle dure de 15 s à 5 min.                                       */
/*  Dans le doute, rien : un faux négatif laisse la place à TMDB, une  */
/*  mauvaise bande-annonce ne se rattrape pas.                         */
/* ------------------------------------------------------------------ */

import type { TrailerScope } from "../../../trailers/trailerCatalog";
import { decodeEntities, parseAllocineTitle, type AllocineVersion } from "./allocineTitle";

/** Une vidéo de la chaîne, telle que l'API la rend (`id,title,created_time,duration`). */
export interface AllocineVideo {
  id: string;
  title: string;
  /** Secondes depuis l'époque. */
  createdTime: number;
  /** Secondes. */
  duration: number;
}

export interface AllocineSeasonDate {
  season: number;
  /** `AAAA-MM-JJ`, la diffusion du premier épisode. */
  airDate?: string | null;
}

/** Le titre que l'on cherche : ses noms possibles et ses dates, selon TMDB. */
export interface AllocineMatchTitle {
  kind: "movie" | "tv";
  names: readonly string[];
  /** La sortie du film, ou la première diffusion de la série (`AAAA-MM-JJ`). */
  releaseDate?: string | null;
  /** La dernière diffusion d'une série (`AAAA-MM-JJ`). */
  lastAirDate?: string | null;
  seasons?: readonly AllocineSeasonDate[];
}

export interface AllocineMatch {
  videoId: string;
  /** Le titre de la vidéo, entités décodées. */
  name: string;
  scope: TrailerScope;
  version: AllocineVersion;
  kind: "trailer" | "teaser";
  createdTime: number;
}

const DAY_S = 86_400;
const MONTH_S = 30.44 * DAY_S;
const MIN_DURATION_S = 15;
const MAX_DURATION_S = 5 * 60;

/** Le nom ramené à des mots : sans accents, sans ponctuation, `&` = `et`, minuscules. */
export function normalizeShowName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function secondsOf(date: string | null | undefined): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return null;
  const ms = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(ms) ? ms / 1000 : null;
}

/** La fenêtre de dates où la vidéo de cette portée peut avoir été publiée ; `null` : aucune date sûre, rien. */
function windowOf(title: AllocineMatchTitle, season: number | undefined): [number, number] | null {
  if (season === undefined) {
    const release = secondsOf(title.releaseDate);
    if (release === null) return null;
    const end = title.kind === "tv" ? secondsOf(title.lastAirDate) ?? release : release;
    return [release - 18 * MONTH_S, Math.max(release, end) + 18 * MONTH_S];
  }
  const aired = secondsOf(title.seasons?.find((s) => s.season === season)?.airDate);
  return aired === null ? null : [aired - 12 * MONTH_S, aired + 36 * MONTH_S];
}

const VERSION_RANK: Record<AllocineVersion, number> = { vf: 0, vostfr: 1, vo: 2 };

/**
 * Les vidéos du titre, rangées : la version (VF, VOSTFR, VO), la bande-annonce
 * avant le teaser, la plus récente d'abord. Une vidéo vue deux fois (deux
 * pages de recherche) ne compte qu'une fois.
 */
export function matchAllocineVideos(videos: readonly AllocineVideo[], title: AllocineMatchTitle): AllocineMatch[] {
  const names = new Set(title.names.map(normalizeShowName).filter(Boolean));
  if (names.size === 0) return [];
  const seen = new Set<string>();
  const matches: AllocineMatch[] = [];
  for (const video of videos) {
    if (seen.has(video.id)) continue;
    const parsed = parseAllocineTitle(video.title);
    if (!parsed || !names.has(normalizeShowName(parsed.show))) continue;
    if (title.kind === "movie" && parsed.season !== undefined) continue;
    if (!(video.duration >= MIN_DURATION_S && video.duration <= MAX_DURATION_S)) continue;
    const window = windowOf(title, parsed.season);
    if (!window || video.createdTime < window[0] || video.createdTime > window[1]) continue;
    seen.add(video.id);
    const scope: TrailerScope = title.kind === "movie"
      ? { kind: "movie" }
      : parsed.season !== undefined && parsed.season > 0 ? { kind: "season", season: parsed.season } : { kind: "series" };
    matches.push({
      videoId: video.id, name: decodeEntities(video.title).replace(/\s+/g, " ").trim(), scope, version: parsed.version, kind: parsed.kind, createdTime: video.createdTime,
    });
  }
  return matches.sort((a, b) =>
    VERSION_RANK[a.version] - VERSION_RANK[b.version]
    || (a.kind === "trailer" ? 0 : 1) - (b.kind === "trailer" ? 0 : 1)
    || b.createdTime - a.createdTime);
}
