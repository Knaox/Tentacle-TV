import { useEffect, useRef, type MutableRefObject } from "react";
import type { MediaItem, MediaStream } from "@tentacle-tv/shared";
import type { usePlaybackInfo } from "./usePlaybackInfo";
import { sourceEstDolbyVision } from "./playbackVerdict";

/** Le flux vidéo de la première source, seul endroit où la plage est décrite. */
function fluxVideoDe(item: MediaItem | undefined): MediaStream | undefined {
  return item?.MediaSources?.[0]?.MediaStreams?.find((s) => s.Type === "Video");
}

interface Options {
  /** Préférences de pistes du serveur appliquées (cf. useServerTrackPrefs). */
  prefsApplied: MutableRefObject<boolean>;
  /** L'utilisateur a explicitement choisi une piste audio dans le sélecteur. */
  audioOverrideRef: MutableRefObject<boolean>;
  /**
   * Compteur de relance des filets. Il ne sert qu'à une chose : garantir qu'une
   * requête repart, même quand rien d'autre n'a bougé (échec à 0 s).
   */
  relanceLecture: number;
  isDesktop: boolean;
  prefsReady: boolean;
  itemId: string | undefined;
  mediaSourceId: string | undefined;
  audioIndex: number;
  defaultAudio: number;
  burnInSubtitleIndex: number | undefined;
  startTicks: number;
  quality: number | null;
  /** Cap visuel du preset (MaxHeight Jellyfin) — indéfini sur « Originale ». */
  qualityMaxHeight?: number;
  item: MediaItem | undefined;
  supportsNativeAudioTracks: boolean;
  pbInfo: ReturnType<typeof usePlaybackInfo>;
}

/**
 * Web : fetch PlaybackInfo à chaque changement de paramètres — extraction
 * mécanique de useWatchSession (limite 300 lignes), comportement inchangé.
 */
export function useWebPlaybackInfoFetch({
  isDesktop, prefsReady, itemId, mediaSourceId, audioIndex, defaultAudio,
  burnInSubtitleIndex, startTicks, quality, qualityMaxHeight, item,
  supportsNativeAudioTracks, pbInfo, prefsApplied, audioOverrideRef, relanceLecture,
}: Options): void {
  /** Tout ce qui, HORS piste audio, oblige à redemander une session. */
  const contexteRef = useRef<string | null>(null);

  useEffect(() => {
    if (isDesktop || !prefsReady || !itemId) return;
    const resumeTicks = item?.UserData?.PlaybackPositionTicks ?? 0;
    const ticks = startTicks > 0 ? startTicks : resumeTicks;

    // En lecture directe, le fichier porte toutes ses pistes et le lecteur
    // bascule seul (cf. `useNativeMediaTracks`) : l'URL rendue serait identique,
    // aucun flux ne bougerait, et le serveur nous rendrait un `PlaySessionId`
    // tout neuf pour rien. On ne le dérange donc pas quand SEULE la piste a
    // changé — et si la bascule échoue, `surPisteIntrouvable` fait repartir
    // cette requête par le compteur de relance. Le repli reste le comportement
    // d'avant, jamais l'inverse.
    const contexte = [itemId, mediaSourceId, burnInSubtitleIndex, ticks, quality,
      relanceLecture, pbInfo.mkvNonFiable, pbInfo.pgsClientIndisponible].join("|");
    const seulePisteAChange = contexteRef.current === contexte;
    contexteRef.current = contexte;
    if (seulePisteAChange && pbInfo.isDirectPlay && supportsNativeAudioTracks) return;
    // Edge/Chrome: no native audioTracks API — if user wants non-default audio,
    // force server-side audio selection (remux/transcode) instead of direct play.
    //
    // Encore faut-il que quelqu'un ait DEMANDÉ cette piste : préférences du
    // serveur appliquées, ou choix explicite dans le sélecteur. Sans cette
    // garde, le premier rendu compare un `audioIndex` resté à sa valeur
    // d'initialisation avec un `defaultAudio` fraîchement résolu par l'arrivée
    // des `MediaStreams`, et sacrifie le DirectPlay du démarrage pour un écart
    // qui n'existe pas — l'effet de réconciliation le comble au rendu suivant.
    const pisteDemandee = prefsApplied.current || audioOverrideRef.current;
    const forceTranscode = pisteDemandee && !supportsNativeAudioTracks && audioIndex !== defaultAudio;
    pbInfo.fetchPlaybackInfo({
      itemId,
      mediaSourceId,
      audioStreamIndex: audioIndex,
      subtitleStreamIndex: burnInSubtitleIndex,
      startTimeTicks: ticks > 0 ? ticks : undefined,
      // « Originale » = aucun plafond. `quality` y vaut `null` (le preset
      // n'a pas de bitrate) : le laisser indéfini rend la main au
      // `MaxStreamingBitrate` du profil. Les paliers choisis par
      // l'utilisateur, eux, imposent bien leur débit — c'est leur raison d'être.
      maxStreamingBitrate: quality ?? undefined,
      // Le cap visuel du palier accompagne son débit : sans lui, Jellyfin
      // transcode au bitrate demandé mais garde la définition d'origine.
      maxHeight: quality != null ? qualityMaxHeight : undefined,
      forceTranscode,
      // Le profil ne voit jamais l'item : il faut lui dire ce qu'on s'apprête à
      // lui faire lire. Seul le téléviseur s'en sert, pour choisir le conteneur
      // d'un remux qui préserve le RPU.
      sourceDolbyVision: sourceEstDolbyVision(fluxVideoDe(item)),
    });
    // Les deux drapeaux de repli SONT des dépendances de rendu : ce sont eux,
    // et eux seuls, qui relancent la requête après un échec. Passer par
    // `startTicks` ne suffirait pas — l'échec MKV survient à 0 s, où la
    // position ne change pas.
  }, [isDesktop, prefsReady, itemId, mediaSourceId, audioIndex, burnInSubtitleIndex, startTicks, quality,
    pbInfo.mkvNonFiable, pbInfo.pgsClientIndisponible, relanceLecture]); // eslint-disable-line react-hooks/exhaustive-deps
}
