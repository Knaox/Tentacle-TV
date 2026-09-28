import { memo, useCallback, useMemo } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
import { useSagaView } from "@tentacle-tv/api-client";
import { sagaLabel, sagaSummary, sagaTitle, type MediaItem, type SagaLibraryEntry } from "@tentacle-tv/shared";
import { FocusableRow } from "../focus/FocusableRow";
import { TVPosterCard } from "../cards/TVPosterCard";
import { TV_CARD_RADIUS } from "../cards/cardSizes";
import { CardConfig, Colors, Fonts, Spacing, Typography } from "../../theme/colors";

interface Props {
  item: MediaItem;
  onOpen: (itemId: string) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  onRowFocus?: () => void;
  /** HAUT depuis un volet → ce focusable : la page ancrée sur la rangée sort les actions de l'écran. */
  cellNextFocusUp?: number;
}

/**
 * La saga d'un film sur la fiche du téléviseur — celle du web : le nom de la
 * saga selon TMDB et son résumé, puis les volets dans l'ordre, l'étiquette
 * (« Volet 4 · Cette fiche ») sous chaque carte, dans la cellule focalisable
 * comme le titre et l'année. Le film ouvert reste focalisable (un trou dans
 * la rangée désorienterait) mais inerte, son affiche cerclée.
 *
 * Bibliothèque seule : le téléviseur n'a pas de plugins. React-query v4 ici :
 * `useSagaView` s'en tient aux options communes aux deux versions.
 */
export const TVSagaRow = memo(function TVSagaRow({ item, onOpen, onLayout, onRowFocus, cellNextFocusUp }: Props) {
  const { t, i18n } = useTranslation("media");
  const { view } = useSagaView(item, { lang: (i18n.language || "fr").slice(0, 2) });
  const entries = useMemo(
    () => (view?.entries ?? []).filter((entry): entry is SagaLibraryEntry => entry.kind === "library"),
    [view],
  );
  const renderItem = useCallback(
    (entry: SagaLibraryEntry, _index: number, focused: boolean) => <SagaCell entry={entry} focused={focused} />,
    [],
  );
  const onItemPress = useCallback((entry: SagaLibraryEntry) => {
    if (entry.cue !== "current") onOpen(entry.item.Id);
  }, [onOpen]);

  if (view === null || entries.length < 2) return null;
  return (
    <FocusableRow
      title={sagaTitle(t, view)}
      titleAccessory={
        <Text numberOfLines={1} style={{ ...Typography.meta, color: Colors.textTertiary, flexShrink: 1 }}>
          {sagaSummary(t, view)}
        </Text>
      }
      data={entries}
      renderItem={renderItem}
      keyExtractor={(entry) => entry.key}
      itemWidth={CardConfig.portrait.width}
      style={{ marginTop: Spacing.sectionGap }}
      onItemPress={onItemPress}
      onLayout={onLayout}
      onRowFocus={onRowFocus}
      cellNextFocusUp={cellNextFocusUp}
    />
  );
});

const SagaCell = memo(function SagaCell({ entry, focused }: { entry: SagaLibraryEntry; focused: boolean }) {
  const { t } = useTranslation("media");
  const { rank, cue } = sagaLabel(t, entry);
  const width = CardConfig.portrait.width;
  return (
    <View style={{ width }}>
      <TVPosterCard item={entry.item} focused={focused} width={width} />
      {entry.cue === "current" && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute", top: 0, left: 0, width, height: width * 1.5,
            borderRadius: TV_CARD_RADIUS, borderWidth: 3, borderColor: Colors.accentPurple,
          }}
        />
      )}
      <Text numberOfLines={1} style={{ ...Typography.caption, color: Colors.textTertiary, marginTop: 4 }}>
        {rank}
        {rank !== null && cue !== null ? " · " : ""}
        {cue !== null && <Text style={{ fontFamily: Fonts.semibold, color: Colors.accentPurpleLight }}>{cue}</Text>}
      </Text>
    </View>
  );
});
