/**
 * Octave (mobile) — garder les TITRES LIKÉS en entier sur ce téléphone (en-tête
 * de « Titres likés », m4) : une collection `playlist:liked`
 * (`LIKED_COLLECTION_KEY`), tenue à jour comme une playlist — un cœur posé ailleurs
 * (bureau, autre appareil) garde le titre ici, un cœur retiré le libère.
 *
 * `tracks` : TOUS les titres likés (`useWholeLiked` d'api-client), pas la seule page affichée.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { LIKED_PLAYLIST_ID } from "@tentacle-tv/offline-core/music";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { KeepCollectionButton } from "./KeepCollectionButton";

export const KeepLikedButton = memo(function KeepLikedButton({ tracks }: { tracks: readonly MusicTrack[] }) {
  const { t } = useTranslation("musicOffline");
  return <KeepCollectionButton kind="playlist" collectionKey={LIKED_PLAYLIST_ID} title={t("liked")} tracks={tracks} liked />;
});
