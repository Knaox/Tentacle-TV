import type { ReactNode } from "react";
import type { LibraryLanguages } from "@tentacle-tv/api-client";
import type { LibraryFilterState } from "../../hooks/useLibraryFilters";

export interface LibraryFilterBarProps {
  /** Les genres proposés, fournis par l'appelant (cf. `GenreMenu`). */
  genres: Array<{ Id: string; Name: string }>;
  /**
   * Proposer le filtre « Favoris ». Faux sur la page Favoris elle-même, où il
   * ne filtrerait rien : toute la liste l'est déjà.
   */
  showFavorite?: boolean;
  /**
   * Proposer les pastilles de statut (Tous / Non vus / En cours). Faux sur Ma
   * liste, dont les étapes de visionnage disent déjà la même chose.
   */
  showStatus?: boolean;
  /**
   * `panel` : la barre d'outils de la page Bibliothèque — un seul panneau qui
   * réunit recherche, compte, tri et filtres. Par défaut, la rangée de
   * pastilles de Ma liste et de Mes favoris, inchangée.
   */
  variant?: "chips" | "panel";
  /** Posé en tête du panneau — le champ de recherche de la bibliothèque. */
  leading?: ReactNode;
  /**
   * Panneau : les gestes propres à la page (partager, sélectionner, grille ou
   * liste), au bout de l'étage du haut, après le tri. Ma liste, Mes favoris.
   */
  actions?: ReactNode;
  /**
   * Panneau : ce qui ouvre l'étage du bas, À LA PLACE du statut de
   * visionnage — les étapes de Ma liste, le regroupement de Mes favoris.
   */
  segment?: ReactNode;
  /** Le catalogue n'a pas encore répondu : le compte n'est pas connu. */
  resultsLoading?: boolean;
  filters: LibraryFilterState;
  activeCount: number;
  hasActiveFilters: boolean;
  totalResults: number | undefined;
  onToggleGenre: (id: string) => void;
  onTogglePlatform: (id: number) => void;
  onStatusChange: (v: string | null) => void;
  onYearFromChange: (v: number | null) => void;
  onYearToChange: (v: number | null) => void;
  onRatingMinChange: (v: number | null) => void;
  onFavoriteChange: (v: boolean) => void;
  onSortByChange: (v: string) => void;
  onSortOrderChange: (v: string) => void;
  onReset: () => void;
  onClearYears: () => void;
  onClearRating: () => void;
  /**
   * Les langues filtrables (Jellyfin 12+) ; absentes ou `null` : le serveur ne
   * sait pas filtrer par langue, les menus ne s'affichent pas.
   */
  languages?: LibraryLanguages | null;
  onAudioLangChange?: (code: string | null) => void;
  onSubtitleLangChange?: (code: string | null) => void;
}
