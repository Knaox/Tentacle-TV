/**
 * Octave mobile — une playlist HORS bibliothèque (clé `ext:<pluginId>:<id>`),
 * comme le bureau : sa tête, qui l'a composée, ses titres (ce que la
 * bibliothèque a, montré et joué comme le sien). Sans l'extension qui l'a
 * donnée : « introuvable », sans rien trahir.
 */

import { useTranslation } from "react-i18next";
import { useMusicExternalPlaylist } from "@tentacle-tv/api-client";
import { KeepCollectionButton } from "../../offline/KeepCollectionButton";
import { useOctavePagesProvider } from "../env/pagesEnv";
import { TrackCollectionPage } from "./TrackCollectionPage";

export function OctaveExternalPlaylistScreen({ id }: { id: string }) {
  const { t } = useTranslation("music");
  const playlist = useMusicExternalPlaylist(useOctavePagesProvider(), id);
  const data = playlist.data;
  const head = data ? { kicker: t("playlist.kicker"), title: data.title, artworkUrl: data.artworkUrl, extraMeta: () => data.owner } : null;
  return (
    <TrackCollectionPage
      head={head}
      tracks={data?.tracks}
      contextId={`playlist:${id}`}
      pending={playlist.isPending}
      failed={playlist.isError}
      notFound={t("playlist.notFound")}
      keptKeys={[`playlist:${id}`]}
      onRetry={() => void playlist.refetch()}
      extra={(tracks) => (data ? <KeepCollectionButton kind="playlist" collectionKey={id} title={data.title} subtitle={data.owner ?? null} tracks={tracks} /> : null)}
    />
  );
}
