/**
 * Octave mobile — les étagères de l'accueil, dans l'ordre du bureau : les mixes
 * du jour et les albums du moment (« pour vous », servis avec l'accueil), puis
 * les nouveautés de la bibliothèque, « parce que vous avez écouté », les
 * artistes du moment, vos titres les plus écoutés, vos playlists. Une étagère
 * vide ne s'écrit pas ; un serveur d'avant n'envoie rien de « pour vous ».
 */

import { memo, useCallback } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import type { MusicHomeResponse, MusicTrack } from "@tentacle-tv/shared/music";
import { useRouter } from "expo-router";
import { usePagesCurrentKey, usePagesPlayer } from "../env/pagesPlayer";
import { AlbumCard, ArtistCard, PlaylistCard } from "../ui/Cards";
import { SectionTitle, Shelf, albumSelf } from "../ui/Shelf";
import { TrackRow } from "../ui/TrackRow";
import { usePageMetrics } from "../ui/pageStyle";
import { MixCard } from "./MixCard";
import { playRow } from "../env/playFrom";

const MOST_CONTEXT = "home:most";

function MostPlayed({ tracks }: { tracks: readonly MusicTrack[] }) {
  const { t } = useTranslation("music");
  const player = usePagesPlayer();
  const current = usePagesCurrentKey();
  const { gutter } = usePageMetrics();
  const play = useCallback((index: number) => playRow(player, tracks, index, MOST_CONTEXT), [player, tracks]);
  if (tracks.length === 0) return null;
  return (
    <View>
      <SectionTitle title={t("home.mostPlayed")} />
      {tracks.map((track, i) => (
        <TrackRow key={track.key} track={track} index={i} list={tracks} contextId={MOST_CONTEXT} playing={current === track.key} onPlay={play} gutter={gutter} />
      ))}
    </View>
  );
}

export const ForYouTop = memo(function ForYouTop({ home }: { home: MusicHomeResponse }) {
  const { t } = useTranslation("music");
  const { card } = usePageMetrics();
  const forYou = home.forYou;
  if (!forYou) return null;
  return (
    <>
      <Shelf title={t("octaveHome.mixes")} hint={t("octaveHome.mixesHint")} items={forYou.mixes} keyOf={(m) => m.id} render={(mix, w) => <MixCard mix={mix} width={w} />} width={card} />
      <Shelf title={t("octaveHome.recentAlbums")} items={forYou.recentAlbums} keyOf={(a) => a.key} albumOf={albumSelf} render={(album, w) => <AlbumCard album={album} width={w} />} />
    </>
  );
});

export const HomeShelves = memo(function HomeShelves({ home, gap }: { home: MusicHomeResponse; gap: number }) {
  const { t } = useTranslation("music");
  const router = useRouter();
  const forYou = home.forYou;
  return (
    <View style={{ gap }}>
      <Shelf
        title={t("octaveHome.newInLibrary")}
        items={home.recentlyAdded}
        keyOf={(a) => a.key}
        render={(album, w) => <AlbumCard album={album} width={w} />}
        // Les nouveautés sont des albums : la bibliothèque du mobile s'ouvre sur les Playlists, on vise l'onglet.
        onSeeAll={() => router.push(`${octavePaths.library}?tab=albums` as never)}
      />
      {forYou?.because.map((row) => (
        <Shelf key={row.artist.key} title={t("octaveHome.because", { artist: row.artist.name })} items={row.albums} keyOf={(a) => a.key} albumOf={albumSelf} render={(album, w) => <AlbumCard album={album} width={w} />} />
      ))}
      {forYou ? <Shelf title={t("octaveHome.recentArtists")} items={forYou.recentArtists} keyOf={(a) => a.key} render={(artist, w) => <ArtistCard artist={artist} width={w} />} /> : null}
      <MostPlayed tracks={home.mostPlayed.slice(0, 5)} />
      <Shelf
        title={t("home.playlists")}
        items={home.playlists}
        keyOf={(p) => p.jellyfinId}
        render={(p, w) => <PlaylistCard playlist={p} width={w} />}
        onSeeAll={() => router.push(octavePaths.playlists as never)}
      />
    </View>
  );
});
