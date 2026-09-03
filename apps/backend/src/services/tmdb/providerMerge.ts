import type { ProviderRef } from "./metaCache";

/** Une plateforme telle que TMDB la liste dans /watch/providers/{movie,tv}. */
export interface RawWatchProvider {
  provider_id: number;
  provider_name?: string;
  logo_path?: string | null;
  display_priority?: number;
  /** Priorité PAR région — celle de la région demandée prime. */
  display_priorities?: Record<string, number>;
}

/**
 * Fusion films ∪ séries par provider_id (le premier logo non vide gagne),
 * triée par priorité d'affichage de la région puis par nom — l'ordre de
 * TMDB, celui que l'utilisateur connaît de ses autres applications.
 */
export function mergeProviders(raw: readonly RawWatchProvider[], region: string): ProviderRef[] {
  const byId = new Map<number, { ref: ProviderRef; priority: number }>();
  for (const p of raw) {
    const priority = p.display_priorities?.[region] ?? p.display_priority ?? Number.MAX_SAFE_INTEGER;
    const existing = byId.get(p.provider_id);
    if (existing) {
      if (!existing.ref.logoPath && p.logo_path) existing.ref.logoPath = p.logo_path;
      existing.priority = Math.min(existing.priority, priority);
      continue;
    }
    byId.set(p.provider_id, {
      ref: { id: p.provider_id, name: p.provider_name ?? "", logoPath: p.logo_path ?? null },
      priority,
    });
  }
  return [...byId.values()]
    .sort((a, b) => a.priority - b.priority || a.ref.name.localeCompare(b.ref.name))
    .map((e) => e.ref);
}
