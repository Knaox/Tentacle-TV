import type { WatchProviderDirectory } from "@tentacle-tv/api-client";
import { resolvePlatformFamilies } from "@tentacle-tv/shared";
import type { PlatformFamily } from "@tentacle-tv/shared";

export interface PlatformCatalogEntry {
  key: string;
  label: string;
  /** L'id PRINCIPAL de la famille — la valeur sélectionnée et envoyée au serveur. */
  id: number;
  ids: number[];
  logoPath: string | null;
}

function familyLogo(family: PlatformFamily, logos: Readonly<Record<number, string>>): string | null {
  for (const id of family.ids) {
    const logo = logos[id];
    if (logo) return logo;
  }
  return null;
}

/**
 * Le catalogue du menu : les familles PRÉSENTES dans la région (au moins un
 * id dans l'annuaire), avec leur logo (carte des logos, sinon le provider
 * régional). Sans annuaire — chargement, serveur sans clé TMDB — toutes les
 * familles sont montrées, le logo de la carte s'il est déjà là.
 */
export function buildPlatformCatalog(
  families: readonly PlatformFamily[],
  directory: WatchProviderDirectory | undefined
): PlatformCatalogEntry[] {
  const logos = directory?.logos ?? {};
  if (!directory || directory.providers.length === 0) {
    return families.map((f) => ({
      key: f.key,
      label: f.label,
      id: f.ids[0],
      ids: [...f.ids],
      logoPath: familyLogo(f, logos),
    }));
  }
  const present = new Map(resolvePlatformFamilies(directory.providers, logos).map((p) => [p.family.key, p]));
  return families.flatMap((f) => {
    const found = present.get(f.key);
    return found ? [{ key: f.key, label: f.label, id: f.ids[0], ids: [...f.ids], logoPath: found.logoPath }] : [];
  });
}

export function isFamilyActive(entry: PlatformCatalogEntry, selected: readonly number[]): boolean {
  return selected.includes(entry.id);
}

/** Ajoute ou retire l'id principal de la famille. */
export function toggleFamily(selected: readonly number[], entry: PlatformCatalogEntry): number[] {
  return isFamilyActive(entry, selected) ? selected.filter((id) => id !== entry.id) : [...selected, entry.id];
}

export function activeFamilyCount(catalog: readonly PlatformCatalogEntry[], selected: readonly number[]): number {
  return catalog.filter((entry) => isFamilyActive(entry, selected)).length;
}
