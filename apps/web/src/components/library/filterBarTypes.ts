import type { ReactNode } from "react";
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
   * `panel` : la barre d'outils de la page Bibliothèque — un seul panneau qui
   * réunit recherche, compte, tri et filtres. Par défaut, la rangée de
   * pastilles de Ma liste et de Mes favoris, inchangée.
   */
  variant?: "chips" | "panel";
  /** Posé en tête du panneau — le champ de recherche de la bibliothèque. */
  leading?: ReactNode;
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
}
