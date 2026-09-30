import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CardModel } from "../../../src/redesign/cards/cardTypes";
import { NEUTRAL_PALETTE, type ArtworkPalette } from "../../../src/redesign/color/artworkPalette";
import { useForcedFocusKey } from "../../../src/redesign/focus/focusPreview";
import type { LibraryFilterKey } from "../../../src/redesign/screens/library/libraryTypes";
import { LibraryView } from "../../../src/redesign/screens/library/LibraryView";
import type { StatusPanelProps } from "../../../src/redesign/screens/shared/StatusPanel";
import type { BenchData } from "../data/benchData";
import {
  DEFAULT_FILTERS,
  activeFiltersOf,
  filterCatalog,
  genresOf,
  libraryOf,
  pillsOf,
  removeFilter,
  yearSpan,
  type LibraryFilterState,
  type LibraryKind,
} from "../data/libraryModels";
import { applyOption, clearCriterion, sheetOf, stepYear } from "../data/librarySheets";
import { cardOf, yearOf } from "../data/models";
import { navOf } from "../data/screenModels";
import type { BenchScene } from "./types";

/**
 * La bibliothèque, sur les vrais catalogues du compte (Films, Séries, Animés :
 * les 48 premiers titres A→Z) et leurs vrais genres. Les filtres s'appliquent
 * à ce catalogue avec les règles de l'app ; la scène se manipule à la
 * télécommande (pastilles, listes, croix, « Tout effacer »).
 */

type Genres = Array<{ id: string; name: string }>;

interface Setup {
  kind: LibraryKind;
  /** L'état de départ des filtres, tiré des vrais genres au besoin. */
  filters?: (genres: Genres) => Partial<LibraryFilterState>;
  sheet?: LibraryFilterKey;
  variant?: "loading" | "empty" | "error";
}

const genreIds = (genres: Genres, names: string[]) =>
  names.map((name) => genres.find((g) => g.name === name)?.id).filter((id): id is string => !!id);

function LibraryScene({ data, setup }: { data: BenchData; setup: Setup }) {
  const { t } = useTranslation();
  const lib = libraryOf(data, setup.kind);
  const genres = genresOf(data, lib?.id);
  const span = useMemo(() => yearSpan(data, lib?.id), [data, lib?.id]);
  const [filters, setFilters] = useState<LibraryFilterState>(() => ({ ...DEFAULT_FILTERS, ...setup.filters?.(genres) }));
  const [sheetKey, setSheetKey] = useState<LibraryFilterKey | null>(setup.sheet ?? null);
  const [focusedPalette, setFocusedPalette] = useState<ArtworkPalette | null>(null);
  const forced = useForcedFocusKey();

  const empty = setup.variant === "empty";
  const items = useMemo(() => (empty ? [] : filterCatalog(data, lib?.id, filters)), [data, lib?.id, filters, empty]);
  const cards = useMemo(() => items.map((item) => cardOf(data, item, yearOf(item))), [data, items]);
  const forcedCard = forced?.startsWith("grid:") ? cards[Number(forced.slice(5))] : undefined;
  const palette = forcedCard?.palette ?? focusedPalette ?? cards[0]?.palette ?? NEUTRAL_PALETTE;

  const onFocusCard = useCallback((card: CardModel) => card.palette && setFocusedPalette(card.palette), []);
  const onPressPill = useCallback((key: LibraryFilterKey) => {
    if (key === "favorites") setFilters((f) => ({ ...f, isFavorite: !f.isFavorite, statusFilter: f.isFavorite ? f.statusFilter : null }));
    else setSheetKey(key);
  }, []);

  const sheet = sheetKey ? sheetOf(t, sheetKey, filters, { genres, resultCount: items.length, span }) : null;
  const filtered = filters !== DEFAULT_FILTERS && activeFiltersOf(t, filters, genres).length > 0;
  let status: StatusPanelProps | null = null;
  if (setup.variant === "error") {
    status = {
      kind: "error",
      title: t("common:contentErrorTitle"),
      message: t("common:contentErrorMessage"),
      primary: { label: t("common:retry"), icon: "refresh" },
      secondary: { label: t("common:backHome"), icon: "home" },
    };
  } else if (empty) {
    status = {
      kind: "empty",
      title: t("library:emptyTitle"),
      message: t("library:emptyHint"),
      primary: { label: t("common:backHome"), icon: "home" },
    };
  }

  return (
    <LibraryView
      nav={navOf(data, lib ? `Library_${lib.id}` : "Home")}
      title={lib?.name ?? t("common:movie")}
      count={setup.variant === "loading" ? t("library:loading") : t("library:titles", { count: items.length })}
      pills={pillsOf(t, filters, genres)}
      activeFilters={activeFiltersOf(t, filters, genres)}
      labels={{ activeFilters: t("library:activeFilters"), clearAll: t("library:clearAll") }}
      cards={cards}
      palette={palette}
      loading={setup.variant === "loading"}
      noResults={filtered && items.length === 0 ? { title: t("library:emptyFilteredTitle"), message: t("library:emptyFilteredHint"), actionLabel: t("library:clearAll") } : null}
      status={status}
      sheet={sheet}
      onPressPill={onPressPill}
      onRemoveFilter={(id) => setFilters((f) => removeFilter(f, id))}
      onClearAll={() => setFilters(DEFAULT_FILTERS)}
      onFocusCard={onFocusCard}
      onSheetOption={(filter, id) => setFilters((f) => applyOption(f, filter, id))}
      onSheetClear={(filter) => setFilters((f) => clearCriterion(f, filter))}
      onSheetApply={() => setSheetKey(null)}
      onYearStep={(bound, delta) => setFilters((f) => stepYear(f, bound, delta, span))}
      onRatingSelect={(value) => setFilters((f) => ({ ...f, ratingMin: value > 0 ? value : null }))}
    />
  );
}

/** Les affiches à précharger : la première page de la grille. */
function posters(kind: LibraryKind, count = 18) {
  return (data: BenchData) => {
    const lib = libraryOf(data, kind);
    return data
      .items(lib ? data.snapshot.catalog?.[lib.id] : undefined, count)
      .map((item) => data.image(item.Id, "Primary"))
      .filter((uri): uri is string => !!uri);
  };
}

const G = "Bibliothèque";
const scene = (id: string, label: string, setup: Setup, focusKeys: string[], settleMs = 1300): BenchScene => ({
  id: `bibliotheque/${id}`,
  group: G,
  label,
  focusKeys,
  settleMs,
  images: posters(setup.kind),
  render: (data) => <LibraryScene data={data} setup={setup} />,
});

const ACTIVE = (genres: Genres): Partial<LibraryFilterState> => ({
  genreIds: genreIds(genres, ["Science-Fiction", "Action", "Thriller"]),
  sortBy: "CommunityRating",
  sortOrder: "Descending",
});

export const LIBRARY_SCENES: BenchScene[] = [
  scene("films", "Films", { kind: "movies" }, ["grid:0", "pill:genres", "pill:favorites", "grid:3"]),
  scene("series", "Séries", { kind: "series" }, ["grid:0", "pill:sort"]),
  scene("animes", "Animés", { kind: "anime" }, ["grid:0", "pill:platforms"]),
  scene("filtres-actifs", "Filtres actifs (exemple : 3 genres + tri)", { kind: "movies", filters: ACTIVE }, ["grid:0", "active:0", "active:clear"]),
  scene("genres", "Liste Genres ouverte (Films)", { kind: "movies", filters: ACTIVE, sheet: "genres" }, ["sheet:option:0", "sheet:option:4", "sheet:apply"]),
  scene("genres-animes", "Liste Genres ouverte (Animés, 104 genres)", { kind: "anime", sheet: "genres" }, ["sheet:option:1"]),
  scene("tri", "Liste Tri ouverte", { kind: "movies", filters: () => ({ sortBy: "ProductionYear", sortOrder: "Descending" }), sheet: "sort" }, ["sheet:option:2", "sheet:order:1"]),
  scene("plateformes", "Liste Plateformes ouverte", { kind: "series", filters: () => ({ platformIds: [8, 1899] }), sheet: "platforms" }, ["sheet:option:0", "sheet:option:7"]),
  scene("annees", "Liste Années ouverte", { kind: "movies", filters: () => ({ yearFrom: 2010, yearTo: 2019 }), sheet: "years" }, ["sheet:from:next", "sheet:preset:2"]),
  scene("note", "Liste Note minimum ouverte", { kind: "movies", filters: () => ({ ratingMin: 7.5 }), sheet: "rating" }, ["sheet:stop:15", "sheet:stop:17"]),
  scene("visionnage", "Liste Visionnage ouverte", { kind: "movies", filters: () => ({ statusFilter: "IsResumable" }), sheet: "status" }, ["sheet:option:2"]),
  scene("aucun-resultat", "Aucun résultat (Favoris + Horreur)", { kind: "movies", filters: (g) => ({ isFavorite: true, genreIds: genreIds(g, ["Horreur"]) }) }, ["empty:primary", "active:clear"]),
  scene("vide", "Bibliothèque vide (exemple)", { kind: "movies", variant: "empty" }, ["status:primary"]),
  scene("chargement", "Chargement", { kind: "movies", variant: "loading" }, ["pill:status"]),
  scene("erreur", "Erreur", { kind: "movies", variant: "error" }, ["status:primary", "status:secondary"]),
];
