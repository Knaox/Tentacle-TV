/**
 * Les types du moteur de recommandation partagés par les hooks (page, rangées
 * de compat, notes, feedback). Déplacés hors de useRecoRows pour que
 * useRecoPage et les mutations ne s'importent pas en cycle.
 */
export type RecoState = "disabled" | "cold" | "warming" | "ready";

export interface RecoReason {
  kind: "facet" | "seed" | "exploration";
  key?: string;
  label?: string;
  seedTitle?: string;
}

/** Une plateforme où le titre est INCLUS (abonnement, pub, gratuit). */
export interface RecoProviderRef {
  id: number;
  name: string;
  logoPath: string | null;
}

export interface RecoRowItem {
  key: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** Visuel large TMDB (carrousel héros) — optionnel : vieux pools sans le champ. */
  backdropPath?: string | null;
  /** null = hors bibliothèque : badge + navigation vers la fiche Vigie. */
  jellyfinItemId: string | null;
  source: string;
  score: number;
  voteAverage: number | null;
  reasons: RecoReason[];
  exploration?: boolean;
  /** Plateformes de streaming : null = disponibilité inconnue, [] = aucune
   *  offre incluse ; absent = vieux serveur. Le FILTRE est appliqué par le
   *  serveur — le client n'a plus rien à deviner. */
  providers?: RecoProviderRef[] | null;
}
