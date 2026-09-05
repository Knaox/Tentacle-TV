import type { ProviderRef } from "./providerNormalize";

/** Une plateforme telle que TMDB la liste dans /watch/providers/{movie,tv}. */
export interface RawWatchProvider {
  provider_id: number;
  provider_name?: string;
  logo_path?: string | null;
  display_priority?: number;
  /** Priorité PAR région — une plateforme est DANS une région ssi elle y a
   *  une priorité. Mesuré : les 102 providers de l'appel régional FR portent
   *  tous une priorité FR dans la liste mondiale, qui en compte 4 de plus
   *  (nouveaux venus sans famille connue — sans effet sur le menu). */
  display_priorities?: Record<string, number>;
}

/** Une plateforme de la liste MONDIALE (appel sans `watch_region`). */
export interface WorldProvider {
  id: number;
  name: string;
  logoPath: string | null;
  priorities: Record<string, number>;
}

export interface WatchProviderDirectory {
  region: string;
  /** Les plateformes de la région, dans l'ordre d'affichage de TMDB. */
  providers: ProviderRef[];
  /** id → logo : la région ET les ids des familles connues (hors région
   *  comprises) — un logo pour toute famille affichée. */
  logos: Record<number, string>;
}

/**
 * Fusion films ∪ séries par provider_id : le premier logo non vide gagne, les
 * priorités régionales se cumulent (la plus petite l'emporte).
 */
export function mergeWorldProviders(raw: readonly RawWatchProvider[]): WorldProvider[] {
  const byId = new Map<number, WorldProvider>();
  for (const p of raw) {
    const existing = byId.get(p.provider_id);
    if (existing) {
      if (!existing.logoPath && p.logo_path) existing.logoPath = p.logo_path;
      if (!existing.name && p.provider_name) existing.name = p.provider_name;
      for (const [region, priority] of Object.entries(p.display_priorities ?? {})) {
        const current = existing.priorities[region];
        existing.priorities[region] = current === undefined ? priority : Math.min(current, priority);
      }
      continue;
    }
    byId.set(p.provider_id, {
      id: p.provider_id,
      name: p.provider_name ?? "",
      logoPath: p.logo_path ?? null,
      priorities: { ...(p.display_priorities ?? {}) },
    });
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/**
 * L'annuaire d'UNE région dérivé de la liste mondiale — sans appel TMDB :
 * les plateformes qui y ont une priorité, triées par priorité puis par nom
 * (l'ordre que l'utilisateur connaît de ses autres applications), et la carte
 * des logos (région ∪ `keepIds`, les familles connues).
 */
export function deriveRegionDirectory(
  world: readonly WorldProvider[],
  region: string,
  keepIds: ReadonlySet<number>
): WatchProviderDirectory {
  const regional = world
    .filter((p) => p.priorities[region] !== undefined)
    .sort((a, b) => a.priorities[region] - b.priorities[region] || a.name.localeCompare(b.name));
  const logos: Record<number, string> = {};
  for (const p of regional) if (p.logoPath) logos[p.id] = p.logoPath;
  for (const p of world) if (keepIds.has(p.id) && p.logoPath) logos[p.id] = p.logoPath;
  return {
    region,
    providers: regional.map((p) => ({ id: p.id, name: p.name, logoPath: p.logoPath })),
    logos,
  };
}
