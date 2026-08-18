import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, FlatList, useWindowDimensions } from "react-native";
import { useSearchItems } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVSearchKeyboard } from "../components/TVSearchKeyboard";
import { TVPosterCard } from "../components/cards/TVPosterCard";
import { Focusable } from "../components/focus/Focusable";
import { SkeletonCardPortrait } from "../components/SkeletonLoader";
import { TVRecentSearches } from "../components/search/TVRecentSearches";
import { useTVRemote } from "../components/focus/useTVRemote";
import { useTVContentEntry } from "../hooks/useTVContentEntry";
import { TVScreenFrame } from "../components/nav/TVScreenFrame";
import { RAIL_COLLAPSED } from "../components/nav/TVSideRail";
import { pushRecentSearch, readRecentSearches } from "../storage/recentSearches";
import { Colors, Typography, CardConfig } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;

/** Colonne clavier 6×6 + son padding gauche. */
const KEYBOARD_ZONE_W = 320;
/** Cartes de résultat : largeur cible 200, écart 24 — `search-tv.css`. */
const RESULT_CARD = 200;
const RESULT_GAP = 24;
const GRID_PAD = 24;

export function SearchScreen({ navigation }: Props) {
  const { t } = useTranslation(["common", "nav"]);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [recents, setRecents] = useState<string[]>(() => readRecentSearches());
  const resultsRef = useRef<FlatList>(null);
  const { width: windowW } = useWindowDimensions();

  // Zone résultats = écran − cadre (rail + overscan droit, posés par
  // TVScreenFrame) − colonne clavier. L'ancienne valeur `RAIL_W = 76` en dur
  // sous-estimait le rail de 110 pt : la grille était calculée trop large.
  const resultsAvail = windowW - RAIL_COLLAPSED - TV_OVERSCAN_PT.x - KEYBOARD_ZONE_W - GRID_PAD * 2;
  const numColumns = Math.max(2, Math.floor((resultsAvail + RESULT_GAP) / (RESULT_CARD + RESULT_GAP)));
  const cardW = Math.floor((resultsAvail - RESULT_GAP * (numColumns - 1)) / numColumns);
  const cardH = Math.round(cardW / CardConfig.portrait.aspectRatio);
  const rowHeight = cardH + 56 + RESULT_GAP;

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = useSearchItems(debounced);

  useTVRemote({ onBack: () => navigation.goBack() });

  // Sélection « Rechercher » au rail → focus sur la 1ʳᵉ touche de la grille.
  const contentEntry = useTVContentEntry();

  const handleKeyPress = (key: string) => setQuery((q) => q + key);
  const handleDelete = () => setQuery((q) => q.slice(0, -1));
  const handleClear = () => setQuery("");

  // Mémorisée à la SÉLECTION, pas à la frappe (parité webOS) : une requête
  // abandonnée en route n'a rien donné, la ressortir serait un mauvais conseil.
  const navigateToDetail = useCallback((item: MediaItem) => {
    if (debounced.length >= 2) setRecents(pushRecentSearch(debounced));
    navigation.navigate("MediaDetail", { itemId: item.Id });
  }, [navigation, debounced]);

  const scrollToRow = useCallback((index: number) => {
    const row = Math.floor(index / numColumns);
    resultsRef.current?.scrollToOffset({ offset: Math.max(0, row * rowHeight - 60), animated: true });
  }, [numColumns, rowHeight]);

  const idle = query.length === 0;

  return (
    <TVScreenFrame>
    <View style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
      {/* Main content: keyboard left + results right */}
      <View style={{ flex: 1, flexDirection: "row" }}>
        {/* Left side: title + keyboard */}
        <View style={{ paddingTop: 8, width: KEYBOARD_ZONE_W }}>
          <Text style={{
            color: Colors.textPrimary,
            ...Typography.sectionTitle,
            marginBottom: 16,
          }}>
            {t("nav:search")}
          </Text>
          <TVSearchKeyboard
            entryRef={contentEntry}
            query={query}
            onKeyPress={handleKeyPress}
            onDelete={handleDelete}
            onClear={handleClear}
            onVoiceResult={(text) => setQuery(text)}
            onSetQuery={setQuery}
          />
        </View>

        {/* Right side: results */}
        <View style={{ flex: 1 }}>
          {/* Champ vide : les recherches récentes, sinon l'invite */}
          {idle && (recents.length > 0 ? (
            <TVRecentSearches recents={recents} onPick={setQuery} />
          ) : (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: Colors.textTertiary, ...Typography.body }}>
                {t("common:rechercheTvVide")}
              </Text>
            </View>
          ))}

          {/* Loading skeleton */}
          {!idle && isLoading && debounced.length >= 2 && (
            <View style={{
              flexDirection: "row", flexWrap: "wrap",
              paddingHorizontal: GRID_PAD, paddingVertical: 24, gap: RESULT_GAP,
            }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCardPortrait key={i} />
              ))}
            </View>
          )}

          {/* No results */}
          {!idle && !isLoading && debounced.length >= 2 && (!results || results.length === 0) && (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: Colors.textTertiary, ...Typography.body }}>
                {t("common:noResults")}
              </Text>
            </View>
          )}

          {/* Results grid */}
          {!idle && results && results.length > 0 && (
            <FlatList
              key={numColumns}
              ref={resultsRef}
              data={results}
              numColumns={numColumns}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
              maxToRenderPerBatch={10}
              windowSize={5}
              contentContainerStyle={{ paddingHorizontal: GRID_PAD, paddingVertical: 24 }}
              keyExtractor={(item) => item.Id}
              columnWrapperStyle={{ gap: RESULT_GAP, marginBottom: RESULT_GAP }}
              getItemLayout={(_, index) => ({
                length: rowHeight,
                offset: rowHeight * Math.floor(index / numColumns),
                index,
              })}
              renderItem={({ item, index }) => (
                <ResultCell item={item} cardW={cardW} onPress={() => navigateToDetail(item)} onFocusScroll={() => scrollToRow(index)} />
              )}
            />
          )}

          {/* Prompt to type (1 caractère) */}
          {!idle && debounced.length < 2 && !isLoading && (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: Colors.textTertiary, ...Typography.body }}>
                {t("common:typeMinChars")}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
    </TVScreenFrame>
  );
}

/** Cellule résultat — état de focus local pour révéler la méta qualité.
 *  L'échelle de focus est celle du jeton partagé (1,08) — l'ancien 1,03 local
 *  divergeait, comme le 1,06 corrigé côté webOS. */
function ResultCell({ item, cardW, onPress, onFocusScroll }: {
  item: MediaItem; cardW: number; onPress: () => void; onFocusScroll: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Focusable
      variant="card"
      onPress={onPress}
      onFocus={() => { setFocused(true); onFocusScroll(); }}
      onBlur={() => setFocused(false)}
    >
      <TVPosterCard item={item} width={cardW} focused={focused} />
    </Focusable>
  );
}
