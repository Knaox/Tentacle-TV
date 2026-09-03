import { readGlobalCache, writeGlobalCache } from "../globalCacheStore";
import { tmdbConfigured, tmdbFetch } from "./client";
import { PLATFORM_FAMILIES } from "./platforms";
import { watchRegion } from "./providerNormalize";
import type { ProviderRef } from "./providerNormalize";
import { deriveRegionDirectory, mergeWorldProviders } from "./providerMerge";
import type { RawWatchProvider, WatchProviderDirectory, WorldProvider } from "./providerMerge";

export type { WatchProviderDirectory } from "./providerMerge";
// La région vit dans providerNormalize (même règle que metaCache) ; ré-exportée
// pour les importeurs historiques.
export { watchRegion } from "./providerNormalize";

/**
 * L'annuaire des plateformes est MONDIAL : deux appels TMDB sans
 * `watch_region` (`/watch/providers/movie` et `/tv`) rendent les ~885
 * providers avec leur logo et leur priorité PAR région. On en dérive la liste
 * d'une région sans réseau — et les logos de toutes les familles connues,
 * présentes dans la région ou non. Persisté en base (survit au redémarrage,
 * un changement de région ne coûte aucun appel), périmé après sept jours :
 * servi tel quel pendant que le rafraîchissement part en fond.
 */
const WORLD_TTL_MS = 7 * 24 * 3600_000;
/** La ligne DB vit plus longtemps que la fraîcheur : la purge horaire ne la
 *  tue jamais entre deux rafraîchissements. */
const WORLD_DB_TTL_MS = 30 * 24 * 3600_000;
const WORLD_ROW_KEY = "providerDirectory:world";

interface WorldSnapshot {
  fetchedAt: string;
  providers: WorldProvider[];
}

const FAMILY_IDS: ReadonlySet<number> = new Set(PLATFORM_FAMILIES.flatMap((f) => [...f.ids]));

let world: WorldSnapshot | null = null;
let byId = new Map<number, WorldProvider>();
let inFlight: Promise<WorldSnapshot | null> | null = null;

function adopt(snapshot: WorldSnapshot): void {
  world = snapshot;
  byId = new Map(snapshot.providers.map((p) => [p.id, p]));
}

function isFresh(snapshot: WorldSnapshot): boolean {
  const age = Date.now() - Date.parse(snapshot.fetchedAt);
  return Number.isFinite(age) && age < WORLD_TTL_MS;
}

async function fetchWorld(): Promise<WorldSnapshot> {
  const [movie, tv] = await Promise.all([
    tmdbFetch<{ results?: RawWatchProvider[] }>("/watch/providers/movie"),
    tmdbFetch<{ results?: RawWatchProvider[] }>("/watch/providers/tv"),
  ]);
  return {
    fetchedAt: new Date().toISOString(),
    providers: mergeWorldProviders([...(movie.results ?? []), ...(tv.results ?? [])]),
  };
}

/** Rafraîchit depuis TMDB, dédoublonné en vol ; en échec, null — l'appelant
 *  garde sa copie. */
function refreshWorld(): Promise<WorldSnapshot | null> {
  if (inFlight) return inFlight;
  inFlight = fetchWorld()
    .then(async (snapshot) => {
      adopt(snapshot);
      await writeGlobalCache(WORLD_ROW_KEY, snapshot, WORLD_DB_TTL_MS).catch(() => undefined);
      return snapshot;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Mémoire, sinon base, sinon TMDB. Périmée : servie, rafraîchie en fond. */
async function loadWorld(): Promise<WorldSnapshot | null> {
  if (!world) {
    const row = await readGlobalCache<WorldSnapshot>(WORLD_ROW_KEY).catch(() => null);
    if (row?.payload && Array.isArray(row.payload.providers)) adopt(row.payload);
  }
  if (world && isFresh(world)) return world;
  if (!tmdbConfigured()) return world;
  if (world) {
    void refreshWorld();
    return world;
  }
  return refreshWorld();
}

/**
 * L'annuaire d'une région : ses plateformes dans l'ordre TMDB et la carte des
 * logos (région ∪ familles). Sans clé TMDB ni copie en base : vide — le
 * client garde ses initiales.
 */
export async function getWatchProviderDirectory(
  region = watchRegion()
): Promise<WatchProviderDirectory> {
  const snapshot = await loadWorld();
  if (!snapshot) return { region, providers: [], logos: {} };
  return deriveRegionDirectory(snapshot.providers, region, FAMILY_IDS);
}

/** Nom et logo d'un id, depuis la liste mondiale EN MÉMOIRE — les entrées du
 *  pool ne portent que des ids. Inconnu : nom vide, pas de logo. */
export function providerRefOf(id: number): ProviderRef {
  const p = byId.get(id);
  return p ? { id, name: p.name, logoPath: p.logoPath } : { id, name: "", logoPath: null };
}

export function hydrateProviderIds(ids: readonly number[]): ProviderRef[] {
  return ids.map(providerRefOf);
}

/** Au démarrage : la liste mondiale en mémoire avant la première page servie. */
export function warmProviderDirectory(): void {
  void loadWorld().catch(() => undefined);
}

/** Isolation des tests. */
export function resetProviderDirectoryForTests(): void {
  world = null;
  byId = new Map();
  inFlight = null;
}
