/**
 * Octave — les rangées « pour vous » de l'accueil (`MusicHomeForYou`, servi par
 * le cœur avec l'accueil, aucune requête de plus) : les mixes du jour, les
 * albums du moment, « parce que vous avez écouté », les artistes du moment.
 * Chaque rangée tient en UNE rangée pleine (`CardRow`) ; une rangée vide ne
 * s'écrit pas. Un serveur d'avant n'envoie rien : rien ne s'affiche.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { MusicHomeForYou } from "@tentacle-tv/shared/music";
import { AlbumCard, ArtistCard, Shelf } from "../components/Cards";
import { CardRow } from "../components/CardRow";
import { MixCard } from "./MixCard";

/** Les mixes et les albums du moment : en tête, juste après les écoutes récentes et les ambiances. */
export const ForYouTop = memo(function ForYouTop({ forYou }: { forYou: MusicHomeForYou }) {
  const { t } = useTranslation("music");
  return (
    <>
      {forYou.mixes.length > 0 && (
        <Shelf title={t("octaveHome.mixes")}>
          <p className="-mt-2 px-2 text-sm text-content-tertiary">{t("octaveHome.mixesHint")}</p>
          <CardRow items={forYou.mixes} render={(mix) => <MixCard key={mix.id} mix={mix} />} />
        </Shelf>
      )}
      {forYou.recentAlbums.length > 0 && (
        <Shelf title={t("octaveHome.recentAlbums")}>
          <CardRow items={forYou.recentAlbums} render={(album) => <AlbumCard key={album.key} album={album} />} />
        </Shelf>
      )}
    </>
  );
});

/** « Parce que vous avez écouté » et les artistes du moment : plus bas, après les nouveautés. */
export const ForYouMore = memo(function ForYouMore({ forYou }: { forYou: MusicHomeForYou }) {
  const { t } = useTranslation("music");
  return (
    <>
      {forYou.because.map((row) => (
        <Shelf key={row.artist.key} title={t("octaveHome.because", { artist: row.artist.name })}>
          <CardRow items={row.albums} render={(album) => <AlbumCard key={album.key} album={album} />} />
        </Shelf>
      ))}
      {forYou.recentArtists.length > 0 && (
        <Shelf title={t("octaveHome.recentArtists")}>
          <CardRow items={forYou.recentArtists} render={(artist) => <ArtistCard key={artist.key} artist={artist} />} />
        </Shelf>
      )}
    </>
  );
});

/** La règle est partagée avec le mobile (`@tentacle-tv/shared/octave` › homeModel). */
export { hasForYou } from "@tentacle-tv/shared/octave";
