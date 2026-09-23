import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { FocusableRow } from "../../src/components/focus/FocusableRow";
import { Focusable } from "../../src/components/focus/Focusable";
import { useTVRemote } from "../../src/components/focus/useTVRemote";
import { TVPlayerEpisodePanel } from "../../src/components/player/TVPlayerEpisodePanel";
import { TVScreenFrame } from "../../src/components/nav/TVScreenFrame";
import { TVLibraryGrid } from "../../src/components/library/TVLibraryGrid";
import { TVLibraryFilterBar, type FilterMenuKind } from "../../src/components/library/TVLibraryFilterBar";
import type { MenuAnchor } from "../../src/components/library/TVLibraryFilterMenu";
import { TVSortMenu, TVGenreMenu } from "../../src/components/library/TVLibrarySortGenreMenus";
import { TVYearMenu, TVRatingMenu } from "../../src/components/library/TVLibraryRangeMenus";
import { TVPlatformMenu } from "../../src/components/library/TVLibraryPlatformMenu";
import { useLibraryFilters } from "../../src/hooks/useLibraryFilters";
import { claimTvFocus } from "../../src/hooks/useTvFocusClaim";
import { Colors } from "../../src/theme/colors";
import { CURRENT_EPISODE, GENRES, MOVIES, SERIES_ID } from "./fixtures";

/**
 * Les trois scènes du banc. Chacune monte les VRAIS composants de l'app ; seul
 * l'écran qui les héberge est reconstitué — au plus près de l'original quand il
 * porte une logique de focus (`FiltersScene` reprend celle de `LibraryScreen`).
 */

const CARD_COLORS = ["#3b2a6b", "#6b2a4f", "#2a4f6b", "#2a6b4a", "#6b5a2a"];

/** Trois carrousels de vingt cartes : l'entrée d'une rangée par sa première
 *  carte visible (`RowEntryGuide`). */
export function RowsScene({ onExit }: { onExit: () => void }) {
  useTVRemote({ onBack: onExit });
  const cards = Array.from({ length: 20 }, (_, i) => i);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 40, paddingBottom: 200 }}>
      {["A", "B", "C"].map((row, rowIndex) => (
        <FocusableRow
          key={row}
          title={`Rangée ${row}`}
          data={cards}
          itemWidth={180}
          keyExtractor={(i) => `${row}-${i}`}
          onItemPress={() => undefined}
          renderItem={(i) => (
            <View
              style={{
                height: 110,
                borderRadius: 8,
                backgroundColor: CARD_COLORS[(i + rowIndex) % CARD_COLORS.length],
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>{`${row}${i}`}</Text>
            </View>
          )}
        />
      ))}
    </ScrollView>
  );
}

/** Le panneau des épisodes du lecteur, sur l'épisode 41 d'une saison de 60. */
export function EpisodesScene({ onExit }: { onExit: () => void }) {
  // Fermé au départ, ouvert par le bouton — comme dans le lecteur. Monté en
  // même temps que la scène, le panneau enregistrerait son Retour AVANT elle
  // (les effets d'un enfant passent d'abord) et c'est la scène qui le volerait.
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  useTVRemote({ onBack: onExit });
  const onSelect = useCallback((ep: MediaItem) => {
    setPicked(ep.Name ?? ep.Id);
    setOpen(false);
  }, []);
  return (
    <View style={{ flex: 1, padding: 60 }}>
      <Focusable variant="button" focusRadius={12} style={{ alignSelf: "flex-start" }} onPress={() => setOpen(true)} hasTVPreferredFocus>
        <View style={{ paddingHorizontal: 24, paddingVertical: 14, backgroundColor: Colors.ctaGhostBg, borderRadius: 12 }}>
          <Text style={{ color: "#fff", fontSize: 20 }}>Épisodes</Text>
        </View>
      </Focusable>
      <Text style={{ color: Colors.textSecondary, fontSize: 18, marginTop: 24 }}>
        {picked ? `Choisi : ${picked}` : "Aucun épisode choisi"}
      </Text>
      {open && (
        <TVPlayerEpisodePanel
          seriesId={SERIES_ID}
          currentEpisode={CURRENT_EPISODE}
          onSelectEpisode={onSelect}
          onClose={() => setOpen(false)}
        />
      )}
    </View>
  );
}

/** La barre de filtres au-dessus de la grille, et ses menus — la logique de
 *  focus de `LibraryScreen`, recopiée telle quelle. */
export function FiltersScene({ onExit }: { onExit: () => void }) {
  const lf = useLibraryFilters("bench-library");
  const [openMenu, setOpenMenu] = useState<{ kind: FilterMenuKind; anchor: MenuAnchor } | null>(null);

  const openMenuRef = useRef(openMenu);
  openMenuRef.current = openMenu;
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (fallbackTimer.current) clearTimeout(fallbackTimer.current); }, []);
  const dismissMenu = useCallback(() => {
    const menu = openMenuRef.current;
    if (!menu) return;
    if (!menu.anchor.triggerView) {
      setOpenMenu(null);
      return;
    }
    claimTvFocus(menu.anchor.triggerView);
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    fallbackTimer.current = setTimeout(() => {
      setOpenMenu((current) => (current === menu ? null : current));
    }, 400);
  }, []);

  useTVRemote({
    onBack: () => {
      if (openMenu) dismissMenu();
      else onExit();
    },
  });

  const openMenuAt = useCallback((kind: FilterMenuKind, anchor: MenuAnchor) => {
    setOpenMenu({ kind, anchor });
  }, []);
  const closeMenuIfOpen = useCallback(() => {
    setOpenMenu((current) => (current ? null : current));
  }, []);

  const header = (
    <View style={{ paddingTop: 40 }}>
      <Text style={{ color: "#fff", fontSize: 34, fontWeight: "700", marginBottom: 28 }}>Bibliothèque du banc</Text>
      <TVLibraryFilterBar
        filters={lf.filters}
        hasActiveFilters={lf.hasActiveFilters}
        totalResults={MOVIES.length}
        onStatusChange={lf.setStatusFilter}
        onFavoriteChange={lf.setIsFavorite}
        onOpenMenu={openMenuAt}
        onChipFocus={closeMenuIfOpen}
        onReset={lf.resetFilters}
      />
    </View>
  );

  return (
    <TVScreenFrame>
      <TVLibraryGrid listKey="bench-library" items={MOVIES} header={header} onPressItem={() => undefined} />
      {openMenu?.kind === "sort" && (
        <TVSortMenu anchor={openMenu.anchor} onClose={dismissMenu} filters={lf.filters} onSortByChange={lf.setSortBy} onSortOrderChange={lf.setSortOrder} />
      )}
      {openMenu?.kind === "genres" && (
        <TVGenreMenu anchor={openMenu.anchor} onClose={dismissMenu} genres={GENRES} selectedIds={lf.filters.genreIds} onToggle={lf.toggleGenre} />
      )}
      {openMenu?.kind === "years" && (
        <TVYearMenu anchor={openMenu.anchor} onClose={dismissMenu} yearFrom={lf.filters.yearFrom} yearTo={lf.filters.yearTo} onYearFromChange={lf.setYearFrom} onYearToChange={lf.setYearTo} />
      )}
      {openMenu?.kind === "rating" && (
        <TVRatingMenu anchor={openMenu.anchor} onClose={dismissMenu} ratingMin={lf.filters.ratingMin} onRatingMinChange={lf.setRatingMin} />
      )}
      {openMenu?.kind === "platforms" && (
        <TVPlatformMenu anchor={openMenu.anchor} onClose={dismissMenu} selectedIds={lf.filters.platformIds} onToggle={lf.togglePlatform} />
      )}
    </TVScreenFrame>
  );
}
