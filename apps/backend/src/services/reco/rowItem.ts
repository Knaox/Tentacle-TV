import type { PoolEntry } from "./generationJob";
import type { ProviderRef } from "../tmdb/providerNormalize";

/** Une raison lisible de la présence d'un titre (explicabilité ET debug). */
export interface RecoReason {
  kind: "facet" | "seed" | "exploration";
  /** Clé de facette brute — le client la localise par préfixe. */
  key?: string;
  /** Libellé humain quand le serveur le connaît (personnes, genres…). */
  label?: string;
  seedTitle?: string;
}

export interface RecoRowItem {
  key: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** Visuel large TMDB pour le carrousel héros (null : backdrop Jellyfin ou rien). */
  backdropPath: string | null;
  /** null = hors bibliothèque (badge + navigation Vigie côté client). */
  jellyfinItemId: string | null;
  source: string;
  score: number;
  voteAverage: number | null;
  reasons: RecoReason[];
  exploration?: boolean;
  /** Plateformes de streaming où le titre est INCLUS — OBLIGATOIRE :
   *  null = disponibilité inconnue (jamais `undefined`, le client ne devine
   *  plus), [] = aucune offre incluse dans la région. Sous un filtre, le
   *  serveur exclut l'inconnu. */
  providers: ProviderRef[] | null;
}

export interface BuiltRow {
  key: string;
  items: RecoRowItem[];
  seedTitle?: string;
  generatedAt: string;
}

export const REASONS_MAX = 2;

function bareRef(id: number): ProviderRef {
  return { id, name: "", logoPath: null };
}

/** L'item servi d'une entrée du pool. Les ids de plateformes du pool sont
 *  hydratés (nom, logo) par `providerRefOf` — l'annuaire mondial en mémoire ;
 *  sans annuaire, des références nues. null reste null (inconnu). */
export function toItem(
  entry: PoolEntry,
  labels: Record<string, string>,
  providerRefOf: (id: number) => ProviderRef = bareRef
): RecoRowItem {
  const { candidate, breakdown } = entry;
  const reasons: RecoReason[] = [];
  for (const contributor of breakdown.topContributors) {
    if (contributor.contribution <= 0) continue;
    reasons.push({ kind: "facet", key: contributor.key, label: labels[contributor.key] });
    if (reasons.length >= REASONS_MAX) break;
  }
  return {
    key: candidate.key,
    mediaType: candidate.mediaType,
    tmdbId: candidate.tmdbId,
    title: candidate.title,
    year: candidate.year,
    posterPath: candidate.posterPath ?? null,
    backdropPath: candidate.backdropPath ?? null,
    jellyfinItemId: candidate.jellyfinItemId ?? null,
    source: candidate.source,
    score: breakdown.total,
    voteAverage: candidate.voteAverage,
    reasons,
    providers: entry.providers ? entry.providers.map(providerRefOf) : null,
  };
}
