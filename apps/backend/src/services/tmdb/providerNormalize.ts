import { getConfigValue } from "../configStore";

/** Une plateforme de streaming où le titre est INCLUS (abonnement/gratuit/pub). */
export interface ProviderRef {
  id: number;
  name: string;
  logoPath: string | null;
}

export type OfferKind = "flatrate" | "ads" | "free";

/**
 * Les offres qui valent « disponible selon vos abonnements » : l'abonnement,
 * l'abonnement avec publicité, et le gratuit — Arte (234) n'existe QUE dans
 * `free`, sans lui la famille Arte serait vide. Jamais la location ni
 * l'achat. Lue à la LECTURE du cache : resserrer cette liste ne demande aucun
 * refetch.
 */
export const INCLUDED_OFFER_KINDS: readonly OfferKind[] = ["flatrate", "ads", "free"];

export interface RawOffer {
  provider_id: number;
  provider_name?: string;
  logo_path?: string | null;
}

/** Le bloc `watch/providers` d'une fiche TMDB — TOUTES les régions, la
 *  configurée est choisie à la lecture. */
export interface RawWatchProvidersBlock {
  results?: Record<string, Partial<Record<OfferKind | "rent" | "buy", RawOffer[]>>>;
}

/** Région watch-providers configurée (Admin → Métadonnées), FR par défaut. */
export function watchRegion(): string {
  return getConfigValue("tmdb_watch_region") || "FR";
}

/**
 * Offres incluses de la région : null = bloc absent (ligne d'AVANT la clé
 * watch/providers, « inconnu »), [] = région sans offre incluse (« aucune »).
 * La distinction compte : le filtre strict exclut l'inconnu, et le crawler
 * ne redemande que lui.
 */
export function normalizeProviders(
  block: RawWatchProvidersBlock | undefined,
  region: string
): ProviderRef[] | null {
  if (!block) return null;
  const entry = block.results?.[region];
  const seen = new Set<number>();
  const out: ProviderRef[] = [];
  for (const kind of INCLUDED_OFFER_KINDS) {
    for (const p of entry?.[kind] ?? []) {
      if (seen.has(p.provider_id)) continue;
      seen.add(p.provider_id);
      out.push({ id: p.provider_id, name: p.provider_name ?? "", logoPath: p.logo_path ?? null });
    }
  }
  return out;
}
