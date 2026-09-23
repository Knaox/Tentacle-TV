/**
 * Le relevé du catalogue de recherche dans Jellyfin — ce qui se cherche, avec
 * la clé d'administration, pour tout le serveur.
 *
 * Films, séries et collections, avec ce qui les fait trouver : titre, titre
 * original, genres, studios, et le CASTING. C'est ce dernier qui pèse — une
 * trentaine de personnes par film dans la réponse de Jellyfin, qu'on ne peut
 * pas tronquer côté serveur. On n'en garde que ce qu'on cherche vraiment : les
 * dix premiers rôles, la réalisation, les créateurs, trois scénaristes.
 *
 * Paginé par 500 : une bibliothèque de vingt mille films ne tient pas dans une
 * seule réponse raisonnable. Un relevé INCRÉMENTAL (`MinDateLastSaved`) ne
 * rapporte que ce qui a changé depuis — ce que déclenche un `LibraryChanged`.
 */

import type { SearchItemKind } from "../../search/searchTypes";
import { getJellyfinApiKey, getJellyfinUrl } from "../configStore";

export interface CatalogPersonRef {
  id: string;
  name: string;
  role: string;
}

export interface CatalogItem {
  id: string;
  type: SearchItemKind;
  name: string;
  originalTitle: string | null;
  year: number | null;
  endYear: number | null;
  /** Telle que Jellyfin la donne — une série terminée. */
  endDate: string | null;
  rating: number | null;
  officialRating: string | null;
  runTimeTicks: number | null;
  childCount: number | null;
  status: string | null;
  genres: string[];
  studios: string[];
  people: CatalogPersonRef[];
  /** Personne → tag de son portrait, relevé au passage (le casting le porte). */
  personImages: Record<string, string>;
  imageTags: Record<string, string>;
  backdropTag: string | null;
  primaryAspect: number | null;
  dateCreated: string | null;
}

interface RawPerson {
  Id?: string;
  Name?: string;
  Type?: string;
  PrimaryImageTag?: string;
}

interface RawItem {
  Id: string;
  Name?: string;
  Type?: string;
  OriginalTitle?: string;
  ProductionYear?: number;
  EndDate?: string;
  CommunityRating?: number;
  OfficialRating?: string;
  RunTimeTicks?: number;
  ChildCount?: number;
  Status?: string;
  Genres?: string[];
  Studios?: Array<{ Name?: string }>;
  People?: RawPerson[];
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  PrimaryImageAspectRatio?: number;
  DateCreated?: string;
}

const PAGE = 500;
/** Cent mille titres : au-delà, ce n'est plus une bibliothèque domestique. */
const PAGES_MAX = 200;
const TIMEOUT_MS = 60_000;

/** Ce qu'on garde du casting, par rôle : combien, dans l'ordre de Jellyfin. */
const ROLE_LIMITS: Readonly<Record<string, number>> = { Actor: 10, Director: 4, Creator: 4, Writer: 3 };

const FIELDS = [
  "OriginalTitle", "Genres", "Studios", "People", "ProductionYear", "EndDate", "CommunityRating",
  "OfficialRating", "RunTimeTicks", "ChildCount", "Status", "DateCreated", "PrimaryImageAspectRatio",
].join(",");

const KINDS: ReadonlySet<string> = new Set(["Movie", "Series", "BoxSet"]);

function keptPeople(raw: readonly RawPerson[] | undefined): { people: CatalogPersonRef[]; images: Record<string, string> } {
  const counts: Record<string, number> = {};
  const people: CatalogPersonRef[] = [];
  const images: Record<string, string> = {};
  for (const person of raw ?? []) {
    const role = person.Type ?? "";
    const limit = ROLE_LIMITS[role];
    if (limit === undefined || !person.Id || !person.Name) continue;
    const seen = counts[role] ?? 0;
    if (seen >= limit) continue;
    counts[role] = seen + 1;
    people.push({ id: person.Id, name: person.Name, role });
    if (person.PrimaryImageTag) images[person.Id] = person.PrimaryImageTag;
  }
  return { people, images };
}

function toCatalogItem(raw: RawItem): CatalogItem | null {
  if (!raw.Id || !raw.Name || !raw.Type || !KINDS.has(raw.Type)) return null;
  const { people, images } = keptPeople(raw.People);
  const endYear = raw.EndDate ? new Date(raw.EndDate).getUTCFullYear() : null;
  const imageTags: Record<string, string> = {};
  for (const key of ["Primary", "Logo", "Thumb"]) {
    const tag = raw.ImageTags?.[key];
    if (tag) imageTags[key] = tag;
  }
  return {
    id: raw.Id,
    type: raw.Type as SearchItemKind,
    name: raw.Name,
    originalTitle: raw.OriginalTitle && raw.OriginalTitle !== raw.Name ? raw.OriginalTitle : null,
    year: raw.ProductionYear ?? null,
    endYear: endYear !== null && Number.isFinite(endYear) ? endYear : null,
    endDate: raw.EndDate ?? null,
    rating: raw.CommunityRating ?? null,
    officialRating: raw.OfficialRating ?? null,
    runTimeTicks: raw.RunTimeTicks ?? null,
    childCount: raw.ChildCount ?? null,
    status: raw.Status ?? null,
    genres: raw.Genres ?? [],
    studios: (raw.Studios ?? []).map((s) => s.Name ?? "").filter(Boolean),
    people,
    personImages: images,
    imageTags,
    backdropTag: raw.BackdropImageTags?.[0] ?? null,
    primaryAspect: raw.PrimaryImageAspectRatio ?? null,
    dateCreated: raw.DateCreated ?? null,
  };
}

/**
 * Relève le catalogue. `since` : seulement ce que Jellyfin a enregistré depuis
 * (relevé incrémental). Rend `null` si Jellyfin n'est pas configuré ou refuse —
 * l'appelant garde alors ce qu'il avait.
 */
export async function fetchCatalogItems(since: Date | null = null): Promise<CatalogItem[] | null> {
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url || !apiKey) return null;
  const items: CatalogItem[] = [];
  const sinceParam = since ? `&MinDateLastSaved=${encodeURIComponent(since.toISOString())}` : "";
  for (let page = 0; page < PAGES_MAX; page++) {
    const res = await fetch(
      `${url}/Items?Recursive=true&IncludeItemTypes=Movie,Series,BoxSet&Fields=${FIELDS}` +
        `&EnableImageTypes=Primary,Backdrop,Logo,Thumb&ImageTypeLimit=1&EnableUserData=false` +
        `${sinceParam}&StartIndex=${page * PAGE}&Limit=${PAGE}`,
      { headers: { "X-Emby-Token": apiKey }, signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    // Une page refusée invalide TOUT le relevé : un index amputé ferait
    // disparaître des titres jusqu'au suivant — l'ancien vaut mieux.
    if (!res.ok) return null;
    const data = (await res.json()) as { Items?: RawItem[]; TotalRecordCount?: number };
    const batch = data.Items ?? [];
    for (const raw of batch) {
      const item = toCatalogItem(raw);
      if (item !== null) items.push(item);
    }
    if (batch.length < PAGE) break;
    if (data.TotalRecordCount !== undefined && (page + 1) * PAGE >= data.TotalRecordCount) break;
  }
  return items;
}
