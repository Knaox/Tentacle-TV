import { memo, useCallback } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { sagaLabel, sagaSummary, sagaTitle, type MediaItem, type SagaEntry, type SagaView } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, typography, useThemedStyles, type AppTheme } from "@/theme";
import { useCardWidth } from "@/contexts/CardDensityContext";
import { MobileMediaCard } from "../MobileMediaCard";
import { ExternalResultCard } from "../search/ExternalResultCard";
import { useSearchNavigation } from "../search/useSearchNavigation";
import { useMobileSaga } from "./useMobileSaga";

const GAP = 14;

/**
 * La saga d'un film sur sa fiche — comme au bureau et dans Vigie : le nom de
 * la saga selon TMDB, le résumé dessous (« 8 films · 6 dans la bibliothèque ·
 * 2 vus »), puis les volets dans l'ordre, l'étiquette (« Volet 4 · Cette
 * fiche ») sous chaque carte. Un volet manquant, quand un plugin le donne,
 * ouvre la page du plugin ; le film ouvert est cerclé et inerte, et le rail
 * s'ouvre sur lui (le volet d'avant en contexte).
 */
export function SagaRow({ item }: { item: MediaItem }) {
  const view = useMobileSaga(item);
  return view === null ? null : <SagaRail view={view} />;
}

const SagaRail = memo(function SagaRail({ view }: { view: SagaView }) {
  const { t } = useTranslation("media");
  const st = useThemedStyles(makeStyles);
  const width = useCardWidth();
  const router = useRouter();
  const { openExternal } = useSearchNavigation({ modal: false });
  const title = sagaTitle(t, view);
  const start = Math.max(0, view.entries.findIndex((entry) => entry.cue === "current") - 1);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: width + GAP, offset: (width + GAP) * index, index }),
    [width],
  );
  const renderItem = useCallback(({ item: entry }: { item: SagaEntry }) => (
    <SagaColumn
      entry={entry}
      width={width}
      onOpenMedia={(id) => router.push(`/media/${id}`)}
      onOpenExternal={(pluginId, href) => openExternal({ pluginId }, href)}
    />
  ), [width, router, openExternal]);

  return (
    <View style={st.root}>
      <View style={st.header}>
        <Text style={st.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
        <Text style={st.summary} numberOfLines={1}>{sagaSummary(t, view)}</Text>
      </View>
      <FlatList
        horizontal
        data={view.entries}
        keyExtractor={(entry) => entry.key}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialScrollIndex={start}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.list}
        decelerationRate="fast"
      />
    </View>
  );
});

const SagaColumn = memo(function SagaColumn({ entry, width, onOpenMedia, onOpenExternal }: {
  entry: SagaEntry;
  width: number;
  onOpenMedia: (itemId: string) => void;
  onOpenExternal: (pluginId: string, href: string) => void;
}) {
  const { t } = useTranslation("media");
  const st = useThemedStyles(makeStyles);
  const { rank, cue } = sagaLabel(t, entry);
  const current = entry.kind === "library" && entry.cue === "current";

  return (
    // `flex: 1` : la colonne prend la hauteur de la cellule (la plus haute de
    // la rangée) et l'étiquette se pose au pied, alignée d'une carte à l'autre.
    <View style={{ width, flex: 1 }}>
      {entry.kind === "external" ? (
        <ExternalResultCard
          item={entry.item}
          width={width}
          onPress={() => onOpenExternal(entry.pluginId, entry.item.href)}
          onOpenHref={(href) => onOpenExternal(entry.pluginId, href)}
        />
      ) : (
        // Le film ouvert : inerte (on y est déjà), son affiche cerclée — un
        // liseré DANS l'affiche, qu'aucun conteneur ne peut rogner.
        <View pointerEvents={current ? "none" : "auto"} accessibilityState={current ? { selected: true } : undefined}>
          <MobileMediaCard item={entry.item} width={width} onPress={() => onOpenMedia(entry.item.Id)} />
          {current && <View pointerEvents="none" style={[st.ring, { height: width * 1.5 }]} />}
        </View>
      )}
      <Text style={st.label} numberOfLines={1}>
        {rank}
        {rank !== null && cue !== null ? " · " : ""}
        {cue !== null && <Text style={st.cue}>{cue}</Text>}
      </Text>
    </View>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  root: { marginTop: spacing.xxl },
  header: { paddingHorizontal: spacing.screenPadding, marginBottom: 12 },
  title: {
    ...typography.subtitle,
    fontFamily: FONT_FAMILY.bold,
    fontSize: 18,
    color: t.colors.text.primary,
    letterSpacing: -0.3,
  },
  summary: { fontSize: 12, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, marginTop: 2 },
  list: { paddingHorizontal: spacing.screenPadding, gap: GAP },
  ring: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: t.colors.brand.violet,
  },
  label: { fontSize: 11.5, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, marginTop: "auto", paddingTop: 4 },
  cue: { fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
});
