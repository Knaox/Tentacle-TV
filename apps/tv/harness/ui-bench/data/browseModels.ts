import { initials, personMeta, type MediaItem } from "@tentacle-tv/shared";
import type { TFunction } from "i18next";
import type { BenchData } from "./benchData";
import { libraryOf, type LibraryKind } from "./libraryModels";

/**
 * Parcourir au banc : une vraie filmographie (`credits` de l'instantané, du
 * plus récent au plus ancien, comme `/api/search/person`), un genre et un
 * studio tirés du vrai catalogue (les mieux notés d'abord, comme
 * `/api/search/genre|studio`). Tout y est mis en mots comme le ferait
 * l'écran (`personMeta`, `search:countTitles`).
 */

export interface BrowseModel {
  kind: "person" | "genre" | "studio";
  kicker: string;
  name: string;
  meta: string;
  portraitUri?: string;
  initials?: string;
  items: MediaItem[];
}

const byYear = (a: MediaItem, b: MediaItem) => (b.ProductionYear ?? 0) - (a.ProductionYear ?? 0);
const byRating = (a: MediaItem, b: MediaItem) => (b.CommunityRating ?? 0) - (a.CommunityRating ?? 0);

export function personBrowse(data: BenchData, t: TFunction, personName: string): BrowseModel {
  const id = data.snapshot.lists.people.find((pid) => data.item(pid)?.Name === personName);
  const person = id ? data.item(id) : undefined;
  const items = data.items(id ? data.snapshot.credits[id] : undefined).sort(byYear);
  const role = (person as { PersonType?: string } | undefined)?.PersonType ?? "Actor";
  const hit = { id: id ?? "", name: personName, imageTag: null, roles: [role], count: items.length, score: 0 };
  return {
    kind: "person",
    kicker: t("search:filmographyTitle"),
    name: personName,
    meta: `${personMeta(t, hit)} · ${t("search:sortedByYear")}`,
    portraitUri: id ? data.image(id, "Primary") : undefined,
    initials: initials(personName),
    items,
  };
}

function catalogOf(data: BenchData, kind: LibraryKind): MediaItem[] {
  const lib = libraryOf(data, kind);
  return data.items(lib ? data.snapshot.catalog?.[lib.id] : undefined);
}

export function genreBrowse(data: BenchData, t: TFunction, kind: LibraryKind, genre: string): BrowseModel {
  const items = catalogOf(data, kind).filter((item) => (item.Genres ?? []).includes(genre)).sort(byRating);
  return {
    kind: "genre",
    kicker: t("search:genre"),
    name: genre,
    meta: `${t("search:countTitles", { count: items.length })} · ${t("search:sortedByRating")}`,
    items,
  };
}

export function studioBrowse(data: BenchData, t: TFunction, kind: LibraryKind, studio: string): BrowseModel {
  const items = catalogOf(data, kind)
    .filter((item) => (item.Studios ?? []).some((s) => s.Name === studio))
    .sort(byRating);
  return {
    kind: "studio",
    kicker: t("search:studio"),
    name: studio,
    meta: `${t("search:countTitles", { count: items.length })} · ${t("search:sortedByRating")}`,
    items,
  };
}
