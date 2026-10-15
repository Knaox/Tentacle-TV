/**
 * Source de lecture desktop : LOCAL D'ABORD, en ligne comme hors ligne.
 * Si un fichier local complet et vérifié existe pour l'item (côté Rust), il
 * est lu depuis le disque — jamais de stream dans ce cas. Sinon, l'URL de
 * stream classique est construite (chaîne existante inchangée).
 * On attend la résolution locale avant de retomber sur le stream : évite un
 * chargement réseau furtif suivi d'un rechargement local.
 *
 * La résolution locale elle-même (query `local-source`) vit dans
 * useLocalSource : useWatchSession en a besoin AVANT ce hook pour gater
 * toutes ses requêtes serveur (zéro réseau en lecture locale).
 */

import { useMemo } from "react";
import { usePlaybackRights, type JellyfinClient } from "@tentacle-tv/api-client";
import { MPV_ENGINE, builtUrlRefusal, type AudioSource, type MediaSource, type PlaybackRefusal } from "@tentacle-tv/shared";
import type { LocalSource } from "../downloads/playbackApi";
import type { SubtitleTrack } from "../components/VideoPlayer";
import { parseSideCarFileName } from "./localPlaybackTrackSources";

interface DesktopSourceParams {
  isDesktop: boolean;
  itemId: string | undefined;
  prefsReady: boolean;
  client: JellyfinClient;
  mediaSourceId: string | undefined;
  urlAudioIndex: number | undefined;
  quality: number | null;
  qualityMaxHeight: number | undefined;
  desktopIsDirectPlay: boolean;
  startTicks: number;
  desktopPlaySessionId: string;
  burnInSubtitleIndex: number | undefined;
  useProgressiveRemux: boolean;
  /** La piste audio lue : copiée telle quelle quand mpv la décode (DTS, TrueHD…). */
  sourceAudio: AudioSource | null;
  /** La source lue : les droits de lecture jugent ce que l'URL lui fait faire. */
  mediaSource?: MediaSource;
  /** Résolution locale (useLocalSource). */
  localSource: LocalSource | null;
  waitingLocal: boolean;
}

export function useDesktopSource(params: DesktopSourceParams): {
  desktopStreamUrl: string | null;
  /** Les droits de lecture du compte refusent ce flux : rien ne part, le lecteur le dit. */
  desktopRefusal: PlaybackRefusal | null;
} {
  const {
    isDesktop, itemId, prefsReady, client, mediaSourceId, urlAudioIndex, quality,
    qualityMaxHeight, desktopIsDirectPlay, startTicks, desktopPlaySessionId,
    burnInSubtitleIndex, useProgressiveRemux, sourceAudio, localSource, waitingLocal, mediaSource,
  } = params;
  // Les droits de lecture pour cet appareil : aucun flux avant de les connaître.
  const { rights, settled: rightsSettled } = usePlaybackRights();

  const remoteUrl = useMemo(() => {
    if (!isDesktop || !itemId || !prefsReady) return null;
    return client.getStreamUrl(itemId, {
      audioIndex: urlAudioIndex, mediaSourceId, maxBitrate: quality ?? undefined,
      maxHeight: qualityMaxHeight, directPlay: desktopIsDirectPlay,
      startTimeTicks: !desktopIsDirectPlay && startTicks > 0 ? startTicks : undefined,
      playSessionId: desktopPlaySessionId, useProgressiveRemux,
      subtitleStreamIndex: burnInSubtitleIndex,
      // C'est mpv qui lit : HEVC, HDR et Dolby Vision, et tout son — la règle
      // partagée (`planStream`) en tire ce qu'on demande à Jellyfin.
      engine: MPV_ENGINE, sourceAudio,
    });
  }, [client, itemId, urlAudioIndex, mediaSourceId, quality, qualityMaxHeight, desktopIsDirectPlay, startTicks, desktopPlaySessionId, prefsReady, burnInSubtitleIndex, isDesktop, useProgressiveRemux, sourceAudio]);

  // Un fichier gardé sur l'appareil se lit sans le serveur : ses droits n'y ont plus prise.
  const refusal = remoteUrl && rightsSettled ? builtUrlRefusal(rights, remoteUrl, mediaSource) : null;
  if (!isDesktop || waitingLocal) return { desktopStreamUrl: null, desktopRefusal: null };
  if (localSource) return { desktopStreamUrl: localSource.absolutePath, desktopRefusal: null };
  if (!rightsSettled || refusal) return { desktopStreamUrl: null, desktopRefusal: refusal };
  return { desktopStreamUrl: remoteUrl, desktopRefusal: null };
}

/**
 * Rapproche les sous-titres du DTO serveur de ce qui existe SUR LE DISQUE quand
 * la lecture est locale — side-cars nommés `<indexJellyfin>-<langue>.<ext>`.
 *
 * En lecture locale, aucune URL distante ne doit partir, ni en ligne ni hors
 * ligne. Une piste sans side-car perd donc son URL de proxy plutôt que de la
 * garder : elle reste au menu et reste jouable par `sid` si elle est interne au
 * fichier, mais `selectExternalSub` — qui refuse une URL vide — ne tentera plus
 * de la charger depuis le serveur. Sans cela, un `sub-add` partait vers Jellyfin
 * pour une piste que mpv avait déjà sous la main, et échouait au bout du
 * network-timeout quand le réseau était coupé.
 *
 * Sans DTO serveur (démarrage 100 % hors ligne), il n'y a rien à rapprocher : la
 * liste des pistes est alors CONSTRUITE par useLocalPlaybackTracks, qui fusionne
 * les pistes internes du fichier et les side-cars. Synthétiser ici masquerait
 * les pistes internes et mélangerait deux espaces d'index.
 */
export function mapSubtitlesToLocal(
  tracks: SubtitleTrack[],
  localSource: LocalSource | null,
): SubtitleTrack[] {
  if (!localSource) return tracks;
  return tracks.map((track) => {
    if (!track.url) return track;
    // Index analysé plutôt que préfixe de nom : le nom porte aussi la langue et
    // ses variantes, et c'est l'index Jellyfin qui identifie la piste.
    const match = localSource.subtitleFiles.find(
      (file) => parseSideCarFileName(file.fileName)?.jfIndex === track.index,
    );
    return { ...track, url: match ? match.absolutePath : "" };
  });
}
