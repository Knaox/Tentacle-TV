import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useItemAncestors, useJellyfinClient, useEpisodeNavigation } from "@tentacle-tv/api-client";
import {
  ticksToSeconds, TICKS_PER_SECOND, extractSourceQuality,
  construireEchelleQualite, trouverPreset, presetEstPropose,
} from "@tentacle-tv/shared";
import type { MediaStream as JfStream, QualityKey } from "@tentacle-tv/shared";
import type { AudioTrack, SubtitleTrack } from "../components/VideoPlayer";
import { usePlaybackInfo } from "./usePlaybackInfo";
import { useDesktopSource, mapSubtitlesToLocal } from "./useDesktopSource";
import { useLocalSource } from "./useLocalSource";
import { useLocalFirstMedia } from "./useLocalFirstMedia";
import { useAutoplayConfigLocalFirst } from "./useAutoplayConfigLocalFirst";
import { useWebPlaybackInfoFetch } from "./useWebPlaybackInfoFetch";
import { useSkipSegmentsLocalFirst } from "./useSkipSegmentsLocalFirst";
import { buildAudioTracks, buildPosterUrl, buildSubtitleTracks, generatePlaySessionId, resumeStartSeconds } from "./watchSessionMedia";
import { useLocalPosterUrl } from "./useLocalPosterUrl";
import { useServerTrackPrefs } from "./useServerTrackPrefs";
import { useOfflineMode } from "../offline/useOfflineMode";
import { useLocalEpisodeNavigation } from "../downloads/useLocalEpisodeNavigation";
import { wtLog } from "../watchTogether/wtLog";

const DBG = "[Tentacle:Player]";

// Déplacé dans packages/shared (réutilisé par la TV) — import + ré-export
// (utilisé aussi en interne dans ce fichier).
import { BURN_IN_SUBTITLE_CODECS } from "@tentacle-tv/shared";
export { BURN_IN_SUBTITLE_CODECS };

export const supportsNativeAudioTracks = (() => {
  if (typeof document === "undefined") return false;
  const v = document.createElement("video");
  return "audioTracks" in v;
})();

const useProgressiveRemux = false;

export interface WatchSessionOptions {
  isDesktop: boolean;
  /** Only used by desktop path. Web uses server-driven PlaybackInfo. */
  checkAudioTranscode?: (codec: string, channels: number) => boolean;
}

export function useWatchSession({ isDesktop, checkAudioTranscode }: WatchSessionOptions) {
  const { t } = useTranslation("player");
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const client = useJellyfinClient();
  // Résolution de la source locale AVANT toute requête serveur : en lecture
  // locale (fichier téléchargé), AUCUNE query réseau ne doit partir — zéro
  // bande passante, en ligne comme hors ligne.
  const offlineMode = useOfflineMode();
  const { localSource, isLocalPlayback, waitingLocal } = useLocalSource({ isDesktop, itemId });
  const { item, isLoading } = useLocalFirstMedia({ itemId, isLocalPlayback, waitingLocal });
  // Config auto-play : pollée pendant une lecture STREAMING (seuil MaxResumePct
  // à jour en ≤ ~60 s) ; en lecture locale, dernier état connu (localStorage).
  const autoplayConfig = useAutoplayConfigLocalFirst(true, isLocalPlayback);
  const { data: ancestors } = useItemAncestors(itemId, { enabled: !isLocalPlayback });
  // Navigation entre épisodes : Jellyfin en streaming (série complète), liste
  // des téléchargements en lecture locale ou hors ligne — zéro réseau en
  // local, et un épisode non téléchargé serait illisible sans serveur.
  const useLocalNav = offlineMode || isLocalPlayback;
  const serverNav = useEpisodeNavigation(useLocalNav ? undefined : item);
  const localNav = useLocalEpisodeNavigation(itemId, useLocalNav);
  const { nextEpisode, previousEpisode } = useLocalNav ? localNav : serverNav;

  // Sécurité : si l'item n'est pas lisible (série, saison, boxset), rediriger vers la page détail
  useEffect(() => {
    if (!item || isLoading) return;
    const nonPlayable = ["Series", "Season", "BoxSet"];
    if (nonPlayable.includes(item.Type)) {
      console.warn(DBG, "non-playable item loaded in player, redirecting", { id: item.Id, type: item.Type, name: item.Name });
      navigate(`/media/${item.Id}`, { replace: true });
    }
  }, [item, isLoading, navigate]);

  const mediaSource = item?.MediaSources?.[0];
  const mediaSourceId = mediaSource?.Id ?? itemId;
  const streams: JfStream[] = mediaSource?.MediaStreams ?? [];
  const defaultAudio = streams.find((s) => s.Type === "Audio" && s.IsDefault)?.Index
    ?? streams.find((s) => s.Type === "Audio")?.Index ?? 0;

  const [audioIndex, setAudioIndex] = useState<number>(defaultAudio);
  const [subtitleIndex, setSubtitleIndex] = useState<number | null>(null);
  const [qualityKey, setQualityKey] = useState<QualityKey>("original");
  // Les paliers dépendent de la source : proposer un transcodage plus lourd
  // que l'original serait absurde (cf. construireEchelleQualite).
  const qualityPresets = useMemo(() => construireEchelleQualite(mediaSource), [mediaSource]);
  const qualityPreset = trouverPreset(qualityKey, qualityPresets);
  const quality = qualityPreset.bitrate; // legacy bitrate ref (null = Original/direct)
  const [startTicks, setStartTicks] = useState<number>(0);
  const [prefsReady, setPrefsReady] = useState(false);
  const [burnInSubtitleIndex, setBurnInSubtitleIndex] = useState<number | undefined>(undefined);
  const positionRef = useRef(0);
  const prefsApplied = useRef(false);
  const audioOverrideRef = useRef(false);
  const subtitleOverrideRef = useRef(false);
  const resumeApplied = useRef(false);

  // Web: server-driven stream selection via PlaybackInfo
  // `isDesktop` vaut ici « c'est mpv qui lira » : WatchDesktop n'est monté que
  // derrière `supportsMpv()`, et le repli web repasse par WatchWeb (isDesktop
  // faux) — le profil suit donc toujours le lecteur réellement à l'œuvre.
  const pbInfo = usePlaybackInfo(isDesktop);

  useEffect(() => {
    setStartTicks(0); setQualityKey("original"); setSubtitleIndex(null); setPrefsReady(false);
    setBurnInSubtitleIndex(undefined); positionRef.current = 0;
    prefsApplied.current = false; audioOverrideRef.current = false;
    subtitleOverrideRef.current = false; resumeApplied.current = false;
    if (!isDesktop) pbInfo.reset();
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (streams.length > 0 && !audioOverrideRef.current && !prefsApplied.current) {
      const defAudio = streams.find((s) => s.Type === "Audio" && s.IsDefault)?.Index
        ?? streams.find((s) => s.Type === "Audio")?.Index ?? 0;
      setAudioIndex(defAudio);
    }
  }, [streams]);

  useEffect(() => {
    if (streams.length > 0 && !prefsApplied.current && !subtitleOverrideRef.current) {
      const defSub = streams.find((s) => s.Type === "Subtitle" && s.IsDefault)?.Index ?? null;
      if (defSub != null) setSubtitleIndex(defSub);
    }
  }, [streams]);

  // Garde-fou : l'échelle étant calculée d'après la source, un palier proposé
  // sur un fichier peut disparaître sur le suivant. Sans ce repli, la clé
  // survivrait sans correspondance — sélecteur sans sélection visible, et un
  // débit rendu par `trouverPreset` qui ne serait plus celui affiché.
  useEffect(() => {
    if (!presetEstPropose(qualityKey, qualityPresets)) setQualityKey("original");
  }, [qualityPresets, qualityKey]);

  // Desktop: client-side playback mode computation
  const selectedAudioStream = streams.find((s) => s.Type === "Audio" && s.Index === audioIndex);
  const selectedAudioCodec = selectedAudioStream?.Codec?.toLowerCase();
  const selectedAudioChannels = selectedAudioStream?.Channels ?? 2;
  const needsAudioTranscode = isDesktop ? false
    : (!!selectedAudioCodec && !!checkAudioTranscode && checkAudioTranscode(selectedAudioCodec, selectedAudioChannels));

  const desktopIsDirectPlay = isDesktop
    ? quality == null
    : (quality == null && !needsAudioTranscode
       && (audioIndex === defaultAudio || supportsNativeAudioTracks));

  // Desktop: resume position for transcoded streams
  useEffect(() => {
    if (!isDesktop) return;
    if (resumeApplied.current || desktopIsDirectPlay || startTicks > 0 || positionRef.current > 0) return;
    const resumeTicks = item?.UserData?.PlaybackPositionTicks;
    if (resumeTicks && resumeTicks > 0) { resumeApplied.current = true; setStartTicks(resumeTicks); }
  }, [isDesktop, desktopIsDirectPlay, item, startTicks]);

  // Segments « passer l'intro » : snapshot disque en lecture locale (zéro
  // réseau), requêtes serveur en streaming.
  const skipSegments = useSkipSegmentsLocalFirst(itemId, item, isLocalPlayback);

  const getPositionTicks = useCallback((): number => {
    if (positionRef.current > 0) return Math.floor(positionRef.current * TICKS_PER_SECOND);
    const resumeTicks = item?.UserData?.PlaybackPositionTicks;
    return resumeTicks && resumeTicks > 0 ? resumeTicks : 0;
  }, [item]);

  // Desktop: client-generated playSessionId. Régénéré à CHAQUE rebuild de
  // stream (qualité/audio/burn-in) comme le fait jellyfin-web : Jellyfin
  // associe le transcode ffmpeg au PlaySessionId — réutiliser l'id avec une
  // nouvelle URL laisse la session accrochée à l'ancien encodage (jamais de
  // premier segment → mpv attend indéfiniment, écran noir). L'ancien encodage
  // est tué AVANT le changement (killTranscode dans les handlers) avec
  // l'ancien id, puis la nouvelle URL repart sur une session propre.
  const desktopPlaySessionId = useMemo(() => {
    if (!isDesktop) return "";
    return generatePlaySessionId();
  }, [itemId, isDesktop, qualityKey, audioIndex, burnInSubtitleIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const desktopIsDirectStream = isDesktop && !desktopIsDirectPlay && needsAudioTranscode && quality == null;

  // Résolution des préférences EN LIGNE (backend) — cf. useServerTrackPrefs.
  // Neutralisée en lecture locale (résolution locale, zéro réseau).
  useServerTrackPrefs({
    item, streams, ancestors, isDesktop, isLocalPlayback, quality, defaultAudio,
    supportsNativeAudioTracks, checkAudioTranscode,
    prefsApplied, resumeApplied, audioOverrideRef, subtitleOverrideRef,
    setAudioIndex, setSubtitleIndex, setBurnInSubtitleIndex, setStartTicks, setPrefsReady,
  });

  useEffect(() => {
    if (prefsReady) return;
    // Si l'item est chargé mais sans MediaSources, débloquer immédiatement
    if (streams.length === 0 && item && !isLoading) { setPrefsReady(true); return; }
    if (streams.length === 0) return;
    const timer = setTimeout(() => setPrefsReady(true), 2000);
    return () => clearTimeout(timer);
  }, [prefsReady, streams.length, item, isLoading]);

  // ── Web: fetch PlaybackInfo when params change (extraction — cf. hook) ──
  useWebPlaybackInfoFetch({
    isDesktop, prefsReady, itemId, mediaSourceId, audioIndex, defaultAudio,
    burnInSubtitleIndex, startTicks, quality, item, supportsNativeAudioTracks, pbInfo,
    prefsApplied, audioOverrideRef,
  });

  // ── Desktop: LOCAL D'ABORD (téléchargement complet vérifié), sinon URL de
  // stream classique — construit dans useDesktopSource (chaîne inchangée). ──
  const qualityMaxHeight = qualityPreset.height ?? undefined;
  const urlAudioIndex = desktopIsDirectPlay ? undefined : audioIndex;

  const { desktopStreamUrl } = useDesktopSource({
    isDesktop, itemId, prefsReady, client, mediaSourceId, urlAudioIndex,
    quality, qualityMaxHeight, desktopIsDirectPlay, startTicks,
    desktopPlaySessionId, burnInSubtitleIndex, useProgressiveRemux,
    localSource, waitingLocal,
  });

  // ── Unified return values ──
  const isDirectPlay = isDesktop ? (isLocalPlayback || desktopIsDirectPlay) : pbInfo.isDirectPlay;
  const isDirectStream = isDesktop ? desktopIsDirectStream : pbInfo.isDirectStream;
  const playSessionId = isDesktop ? desktopPlaySessionId : (pbInfo.playSessionId ?? "");
  const streamUrl = isDesktop ? desktopStreamUrl : pbInfo.streamUrl;
  // Desktop: no streamOffset — StartTimeTicks stripped from HLS URLs (Jellyfin 10.10+ compat),
  // mpv handles seeking client-side via startPositionSeconds.
  const streamOffset = isDesktop ? 0 : pbInfo.streamOffset;

  // Filet de la lecture directe MKV (cf. lib/deviceProfile/browser.ts). Le
  // rattrapage n'est proposé que s'il y a matière à rattraper : un MKV, sur le
  // lecteur web, dont la lecture directe n'a pas encore été disqualifiée.
  // Partout ailleurs il vaut `undefined`, donc la garde des trois secondes
  // n'est pas même armée — un mp4 lent à charger ne risque rien.
  const signalerMkvNonFiable = pbInfo.signalerMkvNonFiable;
  const handleDirectPlayNonFiable = useCallback((seconds: number) => {
    if (seconds > 0) setStartTicks(Math.floor(seconds * TICKS_PER_SECOND));
    signalerMkvNonFiable();
  }, [signalerMkvNonFiable]);
  const conteneurLu = (pbInfo.mediaSource?.Container ?? mediaSource?.Container)?.toLowerCase();
  const onDirectPlayNonFiable = !isDesktop && conteneurLu === "mkv" && !pbInfo.mkvNonFiable
    ? handleDirectPlayNonFiable
    : undefined;

  // Diagnostic : chaque (re)construction d'URL de stream, avec la session
  // Jellyfin associée (le transcode ffmpeg est lié à DeviceId+PlaySessionId).
  useEffect(() => {
    if (!streamUrl) return;
    wtLog("session", "URL de stream (re)construite", {
      itemId, qualityKey, audioIndex, burnInSubtitleIndex, isLocalPlayback,
      startTicksS: (startTicks / TICKS_PER_SECOND).toFixed(1),
      isDirectPlay, isDirectStream, playSessionId,
      url: streamUrl.substring(0, 130),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl]);

  const audioTracks: AudioTrack[] = useMemo(() => buildAudioTracks(streams, t), [streams, t]);

  // Lecture locale : les URLs proxy des sous-titres EXTERNES sont remplacées
  // par les side-cars locaux (fonctionne aussi hors ligne).
  const subtitleTracks: SubtitleTrack[] = useMemo(
    () => mapSubtitlesToLocal(buildSubtitleTracks(streams, client, itemId!, mediaSourceId!, t), localSource),
    [streams, client, itemId, mediaSourceId, t, localSource]);

  // Durée : DTO serveur, sinon méta locale (démarrage hors ligne).
  const jellyfinDuration = useMemo(
    () => ticksToSeconds(item?.RunTimeTicks ?? localSource?.runtimeTicks ?? undefined),
    [item, localSource]);
  const sourceQuality = useMemo(() => extractSourceQuality(item), [item]);
  // Affiche : le fichier local prime en lecture locale (immédiat, et seule
  // source hors ligne où l'URL Jellyfin est injoignable ou absente).
  const localPosterUrl = useLocalPosterUrl(itemId, isLocalPlayback);
  const remotePosterUrl = useMemo(() => buildPosterUrl(client, item), [client, item]);
  const posterUrl = localPosterUrl ?? remotePosterUrl;
  const startPositionSeconds = useMemo(
    () => resumeStartSeconds(item?.UserData?.PlaybackPositionTicks, localSource),
    [item, localSource]);

  const handleNextEpisode = useCallback(() => {
    if (nextEpisode) navigate(`/watch/${nextEpisode.Id}`, { replace: true });
  }, [nextEpisode, navigate]);
  const handlePreviousEpisode = useCallback(() => {
    if (previousEpisode) navigate(`/watch/${previousEpisode.Id}`, { replace: true });
  }, [previousEpisode, navigate]);

  const autoplayNextEnabled = autoplayConfig.enabled;
  const maxResumePct = autoplayConfig.maxResumePct;

  return {
    itemId, item, isLoading, client, streams, mediaSourceId, defaultAudio,
    audioIndex, setAudioIndex, subtitleIndex, setSubtitleIndex,
    qualityKey, setQualityKey, sourceQuality, qualityPresets,
    startTicks, setStartTicks,
    burnInSubtitleIndex, setBurnInSubtitleIndex,
    positionRef, audioOverrideRef, subtitleOverrideRef,
    needsAudioTranscode, isDirectPlay, isDirectStream, playSessionId,
    streamUrl, streamOffset, onDirectPlayNonFiable,
    audioTracks, subtitleTracks,
    jellyfinDuration, startPositionSeconds, posterUrl,
    nextEpisode, previousEpisode, handleNextEpisode, handlePreviousEpisode,
    skipSegments, autoplayNextEnabled, maxResumePct, getPositionTicks,
    isLocalPlayback, localSource,
  };
}
