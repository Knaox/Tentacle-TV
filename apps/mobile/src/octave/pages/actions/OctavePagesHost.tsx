/**
 * Octave mobile — l'HÔTE des pages : la feuille d'actions d'un titre, le choix
 * de playlist, la confirmation d'un doublon, les avis, et l'enregistreur du
 * « déjà écouté » (chaque titre dont le premier son est sorti, la règle du
 * bureau `recordSearchListensTo`). La coquille le monte une
 * fois (m1) ; chaque écran des pages le monte aussi, et seul le premier monté
 * rend (`useSingleHost`) — jamais deux feuilles l'une sur l'autre.
 */

import { DuplicateSheet } from "./DuplicateSheet";
import { NoticeHost } from "./NoticeHost";
import { PlaylistChooserSheet } from "./PlaylistChooserSheet";
import { TrackActionSheet } from "./TrackActionSheet";
import { useEffect } from "react";
import { recordSearchListensTo } from "@tentacle-tv/shared/octave";
import { useSingleHost } from "../env/singleHost";
import { useDeviceStore } from "../env/pagesEnv";
import { usePagesPlayer } from "../env/pagesPlayer";

function SearchListenRecorder() {
  const player = usePagesPlayer();
  const store = useDeviceStore();
  useEffect(() => (player ? recordSearchListensTo(player, store) : undefined), [player, store]);
  return null;
}

export function OctavePagesHost() {
  const active = useSingleHost();
  if (!active) return null;
  return (
    <>
      <TrackActionSheet />
      <PlaylistChooserSheet />
      <DuplicateSheet />
      <NoticeHost />
      <SearchListenRecorder />
    </>
  );
}
