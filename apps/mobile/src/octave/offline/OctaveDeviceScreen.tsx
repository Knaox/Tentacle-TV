/**
 * Octave (mobile) — « Sur cet appareil » (`/octave/device`, écran `device` du
 * registre) : la musique que le compte de l'appareil a gardée, lisible SANS
 * RÉSEAU — le pendant de la vue du bureau. Les albums et playlists gardés en
 * entier en tête (toucher les ouvre ici même : leur page d'origine demande le
 * serveur), puis les titres. Hors ligne, seul ce qui est complet.
 *
 * Tout vient de la base locale (`keptMusic.ts`) : aucune requête. Liste
 * virtualisée (rangées à hauteur fixe) ; tablette : étagère plus large, marges du mode.
 */

import { useCallback, useMemo } from "react";
import { useRouter, type Href } from "expo-router";
import { FlatList, StyleSheet, Text, View, type ListRenderItem } from "react-native";
import Animated from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { deviceModel, keptBytes, type DeviceCollection } from "@tentacle-tv/offline-core/music";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { offlineDiskInfo } from "@/offline/engineApi";
import { formatBytes } from "@/offline/formatBytes";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { keptMusicResourceUri } from "@/offline/engineMusicApi";
import { OctaveLargeTitle, OctaveSection, OctaveTopBar, useOctaveColors, useOctaveLayout, useOctavePageScroll } from "../layout";
import { DeviceCollectionCard } from "./DeviceCollectionCard";
import { DeviceSummary } from "./DeviceSummary";
import { DeviceTrackRow } from "./DeviceTrackRow";
import { KeepCollectionButton } from "./KeepCollectionButton";
import { playKept } from "./keptPlayPort";
import { useOfflineSurface } from "./musicOfflineContext";
import type { OctaveScreenProps } from "../registry/octaveRegistryTypes";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import { useKeptMusic } from "./useKeptMusic";
import { DeviceEmpty } from "./DeviceEmpty";

const DEVICE_CONTEXT = "device";
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<MusicTrack>);

/** Une taille lisible, ou rien quand le disque ne répond pas. */
function freeSpaceText(): string | null {
  try {
    return formatBytes(offlineDiskInfo().freeBytes);
  } catch {
    return null;
  }
}

/** `asHome` : l'ACCUEIL hors ligne (`OctaveHomeScreen`) — la même vue, sans « Retour ». */
export function OctaveDeviceScreen({ params, asHome = false }: OctaveScreenProps & { asHome?: boolean }) {
  const { t } = useTranslation("musicOffline");
  const { t: tm } = useTranslation("music");
  const colors = useOctaveColors();
  const layout = useOctaveLayout();
  const surface = useOfflineSurface();
  const offline = useOfflineMode();
  const kept = useKeptMusic();
  const { scrollY, scrollProps } = useOctavePageScroll();
  const router = useRouter();
  // Une collection s'ouvre comme une page EMPILÉE (`?c=`) : « Retour » et le geste système la referment.
  const openKey = params.c ?? null;
  const openCollection = useCallback((key: string) => router.push(`${octavePaths.device}?c=${encodeURIComponent(key)}` as Href), [router]);
  const model = useMemo(
    // `resolve` : un titre renommé depuis qu'il a été gardé reste à sa place dans sa playlist (comme le bureau).
    // Hors de la porte (droit `keepOffline` refusé, rien d'Octave hors ligne ici) : rien de gardé ne se montre.
    () => (surface.visible ? deviceModel(kept.tracks, kept.collections, keptMusicResourceUri, { completeOnly: offline, resolve: (key) => kept.byKey.get(key) }) : { tracks: [], collections: [] }),
    [surface.visible, kept.tracks, kept.collections, kept.byKey, offline],
  );
  const open: DeviceCollection | null = model.collections.find((c) => c.key === openKey) ?? null;
  const tracks = open?.tracks ?? model.tracks;
  const contextId = open ? `${DEVICE_CONTEXT}:${open.key}` : DEVICE_CONTEXT;
  // Relue quand la liste change (un titre arrivé, un retrait) : jamais à chaque rendu.
  const free = useMemo(() => (kept.loaded && kept.tracks ? freeSpaceText() : null), [kept.loaded, kept.tracks]);
  const summary = kept.loaded ? t("view.summary", { tracks: tm("count.tracks", { count: tracks.length }), size: formatBytes(keptBytes(kept.tracks)) }) : null;
  const title = open?.title ?? t("view.title");
  const cardWidth = layout.isTablet ? 180 : 148;

  const onPlay = useCallback((index: number) => playKept(tracks, index, contextId), [tracks, contextId]);
  const renderItem = useCallback<ListRenderItem<MusicTrack>>(({ item, index }) => <DeviceTrackRow track={item} index={index} onPlay={onPlay} />, [onPlay]);

  const header = (
    <View>
      <OctaveLargeTitle
        title={title}
        subtitle={open ? (open.subtitle ?? undefined) : offline ? t("view.kicker") : t("view.kickerOnline")}
        scrollY={scrollY}
        accessory={open ? <KeepCollectionButton kind={open.kind} collectionKey={open.key.slice(open.key.indexOf(":") + 1)} title={open.title} subtitle={open.subtitle} tracks={open.tracks} /> : undefined}
      />
      {!open && <DeviceSummary summary={summary} free={free} offline={offline} canKeep={surface.library} />}
      {kept.loaded && model.tracks.length === 0 && <DeviceEmpty />}
      {!open && model.collections.length > 0 && (
        <OctaveSection title={t("view.collections")}>
          <FlatList
            horizontal
            data={model.collections}
            keyExtractor={(c) => c.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: layout.gap }}
            renderItem={({ item }) => <DeviceCollectionCard collection={item} width={cardWidth} onOpen={openCollection} />}
          />
        </OctaveSection>
      )}
      {!open && tracks.length > 0 && <Text style={[styles.heading, { color: colors.text }]}>{t("view.tracks")}</Text>}
    </View>
  );

  return (
    <View style={[styles.page, { backgroundColor: colors.ink }]}>
      <AnimatedFlatList
        {...scrollProps}
        data={tracks}
        keyExtractor={(track) => track.key}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={[scrollProps.contentContainerStyle, { paddingHorizontal: layout.gutter }]}
        style={styles.page}
        initialNumToRender={14}
        windowSize={7}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
      />
      <OctaveTopBar scrollY={scrollY} title={title} back={!(asHome && !open)} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  heading: { fontSize: 21, fontWeight: "700", letterSpacing: -0.3, marginTop: 8, marginBottom: 8 },
});
