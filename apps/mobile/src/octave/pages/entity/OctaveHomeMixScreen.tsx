/**
 * Octave mobile — la page d'un MIX de l'accueil, comme le bureau (`pages/homeMix.ts`) : sa mosaïque, son nom, ses
 * artistes, Lecture et Aléatoire, ses titres. Le mix vient de la réponse de l'accueil déjà en cache (aucune
 * attente depuis sa carte) ; une adresse ouverte à froid relit l'accueil ; un mix renouvelé depuis : « introuvable ».
 * Même file que la carte (`mixContextId`).
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMusicHome } from "@tentacle-tv/api-client";
import { findHomeMix, mixContextId, mixMosaic, mixSubtitle, mixTitle } from "@tentacle-tv/shared/octave";
import { PlaylistArtwork } from "../ui/PlaylistArtwork";
import { TrackCollectionPage, type CollectionHead } from "./TrackCollectionPage";

export function OctaveHomeMixScreen({ id }: { id: string }) {
  const { t, i18n } = useTranslation("music");
  const home = useMusicHome();
  const mix = findHomeMix(home.data, id);
  const head = useMemo<CollectionHead | null>(() => {
    if (!mix) return null;
    const name = mixTitle(mix);
    const urls = mixMosaic(mix.tracks);
    const artists = mixSubtitle(mix, i18n.language);
    return {
      kicker: t("octaveHome.mixKicker"),
      title: name.key === "octaveHome.mixArtist" ? t(name.key, { artist: name.artist }) : t(name.key),
      artworkUrl: urls[0] ?? null,
      renderArt: (size) => <PlaylistArtwork urls={urls} size={size} radius={14} />,
      extraMeta: () => [artists, t("octaveHome.mixFresh")].filter(Boolean).join(" · "),
    };
  }, [mix, t, i18n.language]);
  return (
    <TrackCollectionPage
      head={head}
      tracks={mix?.tracks}
      contextId={mix ? mixContextId(mix) : `home:mix:${id}`}
      pending={!mix && home.isPending && home.fetchStatus !== "idle"}
      failed={!mix && !home.isPending}
      notFound={t("octaveHome.mixNotFound")}
      onRetry={() => void home.refetch()}
    />
  );
}
