/**
 * Octave mobile — une AMBIANCE, comme le bureau : sa tête à sa couleur, ses
 * titres (ce que la bibliothèque a, compté), et d'autres playlists de
 * l'ambiance. Sans extension qui les sert : « introuvable », sans rien trahir.
 */

import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { moodContextId, useMusicMoodMix } from "@tentacle-tv/api-client";
import { useOctavePagesProvider } from "../env/pagesEnv";
import { ExternalPlaylistCard } from "../ui/Cards";
import { Shelf } from "../ui/Shelf";
import { usePageMetrics } from "../ui/pageStyle";
import { TrackCollectionPage } from "./TrackCollectionPage";

export function OctaveMoodScreen({ id }: { id: string }) {
  const { t, i18n } = useTranslation("music");
  const { sectionGap } = usePageMetrics();
  const mix = useMusicMoodMix(useOctavePagesProvider(), id, i18n.language);
  const data = mix.data;
  const head = data
    ? { kicker: t("moods.kicker"), title: data.mood.name, artworkUrl: data.artworkUrl ?? data.mood.artworkUrl, tint: data.mood.color, extraMeta: (owned: number) => (owned > 0 ? t("moods.inLibrary", { count: owned }) : null) }
    : null;
  const footer = data?.playlists?.length ? (
    <View style={{ marginTop: sectionGap }}>
      <Shelf title={t("moods.morePlaylists")} items={data.playlists} keyOf={(p) => p.key} render={(p, w) => <ExternalPlaylistCard playlist={p} width={w} />} />
    </View>
  ) : null;
  return (
    <TrackCollectionPage
      head={head}
      tracks={data?.tracks}
      contextId={moodContextId(id)}
      pending={mix.isPending}
      failed={mix.isError}
      // Comme le bureau : l'extension momentanément indisponible (503) ne se dit pas « introuvable ».
      notFound={t((mix.error as { status?: number } | null)?.status === 503 ? "moods.unavailable" : "moods.notFound")}
      onRetry={() => void mix.refetch()}
      footer={footer}
    />
  );
}
