/**
 * Octave mobile — l'HÔTE des pages : la feuille d'actions d'un titre, celle d'un album, d'un artiste ou
 * d'une playlist (appui maintenu), celle d'un album qui ne se lit pas, le choix de playlist, la confirmation d'un
 * doublon (d'un titre, d'un lot), les avis, et l'enregistreur du
 * « déjà écouté » (chaque titre dont le premier son est sorti, la règle du
 * bureau `recordSearchListensTo`). La coquille le monte une
 * fois (m1) ; chaque écran des pages le monte aussi, et seul le premier monté
 * rend (`useSingleHost`) — jamais deux feuilles l'une sur l'autre.
 */

import { BulkDuplicateSheet } from "./BulkDuplicateSheet";
import { CollectionActionSheet } from "../../collections/CollectionActionSheet";
import { DuplicateSheet } from "./DuplicateSheet";
import { NoticeHost } from "./NoticeHost";
import { PlaylistChooserSheet } from "./PlaylistChooserSheet";
import { TrackActionSheet } from "./TrackActionSheet";
import { UnavailableAlbumSheet } from "./UnavailableAlbumSheet";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { onUnavailableTrack, recordSearchListensTo } from "@tentacle-tv/shared/octave";
import { useSingleHost } from "../env/singleHost";
import { useDeviceStore } from "../env/pagesEnv";
import { usePagesPlayer } from "../env/pagesPlayer";
import { showNotice } from "../env/notices";

function SearchListenRecorder() {
  const player = usePagesPlayer();
  const store = useDeviceStore();
  useEffect(() => (player ? recordSearchListensTo(player, store) : undefined), [player, store]);
  return null;
}

/** Un titre indisponible touché (rangée, file d'attente) : rien ne se lance, l'avis le dit (`unavailableTrack.ts`). */
function UnavailableTrackNotice() {
  const { t } = useTranslation("music");
  useEffect(() => onUnavailableTrack(() => showNotice("info", t("track.unavailableNotice"))), [t]);
  return null;
}

/** `primary` : celui de la coquille (au-dessus des onglets et du mini-lecteur), qui passe avant ceux des écrans. */
export function OctavePagesHost({ primary = false }: { primary?: boolean }) {
  const active = useSingleHost(primary);
  if (!active) return null;
  return (
    <>
      <TrackActionSheet />
      <CollectionActionSheet />
      <UnavailableAlbumSheet />
      <PlaylistChooserSheet />
      <DuplicateSheet />
      <BulkDuplicateSheet />
      <NoticeHost />
      <SearchListenRecorder />
      <UnavailableTrackNotice />
    </>
  );
}
