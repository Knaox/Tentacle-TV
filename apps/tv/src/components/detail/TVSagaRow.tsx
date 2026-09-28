import { memo, useCallback, useMemo } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
import { useSagaView } from "@tentacle-tv/api-client";
import { sagaLabel, sagaSummary, sagaTitle, type MediaItem, type SagaLibraryEntry } from "@tentacle-tv/shared";
import { FocusableRow } from "../focus/FocusableRow";
import { TVPosterFrame, TVPosterMeta } from "../cards/TVPosterCard";
import { TV_CARD_RADIUS } from "../cards/cardSizes";
import { CardConfig, Colors, Fonts, Spacing, Typography } from "../../theme/colors";

interface Props {
  item: MediaItem;
  onOpen: (itemId: string) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  onRowFocus?: () => void;
  /** HAUT depuis un volet → ce focusable : la page ancrée sur la rangée sort les actions de l'écran. */
  cellNextFocusUp?: number;
  /** L'appui long d'un volet : la feuille d'actions des cartes (`useTVCardActions`). */
  onLongPress?: (item: MediaItem) => void;
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
 *
 * Comme toutes les rangées : l'anneau n'entoure que l'affiche (`renderItem`),
 * la légende et l'étiquette du volet vivent dessous (`renderBelow`), et
 * l'appui long ouvre la feuille d'actions des cartes.
 */
export const TVSagaRow = memo(function TVSagaRow({ item, onOpen, onLayout, onRowFocus, cellNextFocusUp, onLongPress }: Props) {
  const { t, i18n } = useTranslation("media");
  const { view } = useSagaView(item, { lang: (i18n.language || "fr").slice(0, 2) });
  const entries = useMemo(
    () => (view?.entries ?? []).filter((entry): entry is SagaLibraryEntry => entry.kind === "library"),
    [view],
  );
  const renderItem = useCallback(
    (entry: SagaLibraryEntry, _index: number, focused: boolean) => <SagaVisual entry={entry} focused={focused} />,
    [],
  );
  const renderBelow = useCallback((entry: SagaLibraryEntry) => <SagaCaption entry={entry} />, []);
  const onItemPress = useCallback((entry: SagaLibraryEntry) => {
    if (entry.cue !== "current") onOpen(entry.item.Id);
  }, [onOpen]);
  const onItemLongPress = useCallback((entry: SagaLibraryEntry) => onLongPress?.(entry.item), [onLongPress]);

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
      renderBelow={renderBelow}
      keyExtractor={(entry) => entry.key}
      itemWidth={CardConfig.portrait.width}
      style={{ marginTop: Spacing.sectionGap }}
      onItemPress={onItemPress}
      onItemLongPress={onLongPress ? onItemLongPress : undefined}
      onLayout={onLayout}
      onRowFocus={onRowFocus}
      cellNextFocusUp={cellNextFocusUp}
    />
  );
});

/** L'affiche du volet, sous l'anneau — cerclée quand c'est le film ouvert. */
const SagaVisual = memo(function SagaVisual({ entry, focused }: { entry: SagaLibraryEntry; focused: boolean }) {
  const width = CardConfig.portrait.width;
  return (
    <View style={{ width }}>
      <TVPosterFrame item={entry.item} focused={focused} width={width} />
      {entry.cue === "current" && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute", top: 0, left: 0, width, height: width * 1.5,
            borderRadius: TV_CARD_RADIUS, borderWidth: 3, borderColor: Colors.accentPurple,
          }}
        />
      )}
    </View>
  );
});

/** Titre et année, puis l'étiquette du volet (« Volet 4 · Cette fiche »). */
const SagaCaption = memo(function SagaCaption({ entry }: { entry: SagaLibraryEntry }) {
  const { t } = useTranslation("media");
  const { rank, cue } = sagaLabel(t, entry);
  const width = CardConfig.portrait.width;
  return (
    <View style={{ width }}>
      <TVPosterMeta item={entry.item} width={width} />
      <Text numberOfLines={1} style={{ ...Typography.caption, color: Colors.textTertiary, marginTop: 4 }}>
        {rank}
        {rank !== null && cue !== null ? " · " : ""}
        {cue !== null && <Text style={{ fontFamily: Fonts.semibold, color: Colors.accentPurpleLight }}>{cue}</Text>}
      </Text>
    </View>
  );
});
