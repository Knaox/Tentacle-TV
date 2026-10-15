import { jellyfinAdminFetch, type JellyfinResult } from "../jellyfinAdminFetch";
import { adminUserParam } from "../jellyfinLibrary";
import { UNRATED_ITEM_TYPES, type UserRightsOptions } from "../../userRights/userRightsContract";
import { normalizeJellyfinId } from "../../userRights/userRightsPatch";
import { UserRightsFailure } from "./userRightsFailure";

/**
 * Ce que Jellyfin propose pour régler un compte : bibliothèques, canaux, table
 * des notes (dans SA langue de métadonnées), types non classés, étiquettes déjà
 * posées. UNE lecture sert l'administration (`/api/admin/users/rights/options`)
 * et le contrôle parental de la Famille (`/api/family/parental/options`, qui
 * n'en garde que les notes, les types et les étiquettes). Gardée 30 s.
 */

const TTL_MS = 30_000;
const TAGS_MAX = 500;

let cache: { options: UserRightsOptions; expiresAt: number } | null = null;
let pending: Promise<UserRightsOptions> | null = null;

interface VirtualFolder {
  Name?: string;
  ItemId?: string;
  CollectionType?: string | null;
}

interface ParentalRating {
  Name?: string;
  Value?: number | null;
  RatingScore?: { score?: number; subScore?: number | null } | null;
}

function required<T>(result: JellyfinResult<T>): T {
  if (result.ok) return result.data;
  throw new UserRightsFailure(result.failure === "unreachable" || result.failure === "not-configured" ? "jellyfin_unreachable" : "jellyfin_refused");
}

/** La table des notes, réduite à des entrées exploitables (un score entier). Règle pure. */
export function ratingsFromJellyfin(raw: unknown): UserRightsOptions["parentalRatings"] {
  if (!Array.isArray(raw)) return [];
  return (raw as ParentalRating[]).flatMap((entry) => {
    const score = entry.RatingScore?.score ?? entry.Value;
    if (typeof entry.Name !== "string" || typeof score !== "number" || !Number.isInteger(score)) return [];
    const subScore = entry.RatingScore?.subScore;
    return [{ name: entry.Name, score, subScore: typeof subScore === "number" && Number.isInteger(subScore) ? subScore : null }];
  });
}

async function readOptions(): Promise<UserRightsOptions> {
  const [folders, channels, ratings, filters] = await Promise.all([
    jellyfinAdminFetch<VirtualFolder[]>("/Library/VirtualFolders"),
    jellyfinAdminFetch<{ Items?: { Id?: string; Name?: string }[] }>("/Channels"),
    jellyfinAdminFetch<ParentalRating[]>("/Localization/ParentalRatings"),
    adminUserParam().then((user) => jellyfinAdminFetch<{ Tags?: string[] }>(`/Items/Filters?Recursive=true${user}`, { timeoutMs: 10_000 })),
  ]);
  const libraries = required(folders).flatMap((folder) =>
    folder.ItemId && folder.Name
      ? [{ id: normalizeJellyfinId(folder.ItemId), name: folder.Name, collectionType: folder.CollectionType ?? null }]
      : [],
  );
  // Les canaux et les étiquettes sont un plus : leur absence ne bloque pas le réglage.
  const channelList = channels.ok ? (channels.data?.Items ?? []) : [];
  const tags = filters.ok && Array.isArray(filters.data?.Tags) ? filters.data.Tags.filter((tag) => typeof tag === "string") : [];
  return {
    libraries,
    channels: channelList.flatMap((channel) => (channel.Id && channel.Name ? [{ id: normalizeJellyfinId(channel.Id), name: channel.Name }] : [])),
    parentalRatings: ratingsFromJellyfin(required(ratings)),
    unratedItemTypes: [...UNRATED_ITEM_TYPES],
    knownTags: [...new Set(tags)].sort((a, b) => a.localeCompare(b)).slice(0, TAGS_MAX),
  };
}

/** Les options de réglage — lève `UserRightsFailure` si Jellyfin ne répond pas. */
export async function getUserRightsOptions(): Promise<UserRightsOptions> {
  if (cache && Date.now() < cache.expiresAt) return cache.options;
  if (!pending) {
    pending = readOptions()
      .then((options) => {
        cache = { options, expiresAt: Date.now() + TTL_MS };
        return options;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

/** Vide le cache (tests, et après un changement de bibliothèques). */
export function clearUserRightsOptions(): void {
  cache = null;
}
