import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useJellyfinClient, useMediaItem, useTentacleConfig } from "@tentacle-tv/api-client";
import { parseYouTubeId } from "@tentacle-tv/shared";
import { TRAILER_CLOSE_KEY, TRAILER_QUALITY_KEY, TRAILER_SUBTITLES_KEY, TRAILER_TIMELINE_KEY, trailerState } from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import { TrailerFocusScope, useTrailerFocus, useTrailerFocusStore, useTrailerReturn } from "../../platform/tvos/screens/trailer";
import { TrailerView } from "../../redesign/screens/trailer/TrailerView";
import { TrailerWebView, TRAILER_WEBVIEW_SUPPORTED } from "../../screens/trailer/TrailerWebView";
import type { TrailerPlayerHandle } from "../../screens/trailer/types";
import type { SubtitleCue } from "../../redesign/screens/trailer/trailerTypes";
import { detailBackdropUri } from "../detail/detailImages";
import { useTrailerPlayback } from "./useTrailerPlayback";
import { useTrailerTracks } from "./useTrailerTracks";

type Props = NativeStackScreenProps<RootStackParamList, "Trailer">;

/**
 * La bande-annonce (Apple TV et Android TV) : un lecteur ULTRA simplifié —
 * `TrailerView` autour du flux résolu par le serveur (`TrailerWebView.tsx`,
 * sourd à la télécommande), qui dit chacune de ses issues : la première image
 * (« lecture »), la fin, ou l'échec (« indisponible », puis la fiche revient
 * d'elle-même — jamais un chargement sans fin).
 *
 * En lecture : avancer / reculer sur la barre (les contrôles du grand
 * lecteur, `useTrailerPlayback`), afficher ou non les sous-titres, changer la
 * qualité (`useTrailerTracks`, gardés par la capacité `trailers.player` : un
 * serveur d'avant n'offre que la barre). Le focus, le Retour, la
 * télécommande : les règles de tv-core (`player/trailer*.ts`), posées par
 * l'applicateur (`platform/tvos/screens/trailer.tsx`).
 */

export function TrailerRedesign({ route, navigation }: Props) {
  const { url, name, itemId } = route.params;
  const { i18n } = useTranslation();
  const { storage } = useTentacleConfig();
  const client = useJellyfinClient();
  // L'œuvre, déjà en cache (la fiche l'a lue) : son image pendant le chargement.
  const { data: item } = useMediaItem(itemId);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [cue, setCue] = useState<SubtitleCue | null>(null);
  const engine = useRef<TrailerPlayerHandle | null>(null);

  const ytId = parseYouTubeId(url);
  const lang = (i18n.language ?? "en").slice(0, 2);
  const serverUrl = (storage.getItem("tentacle_server_url") ?? "").replace(/\/$/, "");
  // Sans identifiant YouTube ni serveur, rien à lire : l'écran le dit — et,
  // pour une vidéo hors YouTube, que c'est le téléviseur qui ne sait pas la lire.
  const canPlay = TRAILER_WEBVIEW_SUPPORTED && !!ytId && !!serverUrl;
  const state = trailerState({ canPlay, failed, loaded });
  const isFocused = useIsFocused();

  const close = useCallback(() => navigation.goBack(), [navigation]);
  // Stables : le lecteur relance sa résolution quand ils changent.
  const onLoadEnd = useCallback(() => setLoaded(true), []);
  const onError = useCallback(() => setFailed(true), []);
  useTrailerReturn(state, isFocused, close);

  const store = useTrailerFocusStore();
  const tracks = useTrailerTracks();
  const panel = tracks.panel?.kind ?? null;
  const playback = useTrailerPlayback({
    state,
    store,
    panel,
    engine,
    screenFocused: isFocused,
    openPanel: tracks.open,
    closePanel: tracks.close,
    leave: close,
  });
  const { onPanelExited, bridges } = useTrailerFocus(store, { state, tools: tracks.tools, chromeShown: playback.chromeShown, panel }, tracks.panelEntry);
  const { press } = playback;
  // Chaque appui passe par la règle de tv-core (`trailerSelectAction`), sous la garde du défilement.
  const presses = useMemo(() => ({
    close: () => press(TRAILER_CLOSE_KEY),
    timeline: () => press(TRAILER_TIMELINE_KEY),
    subtitles: () => press(TRAILER_SUBTITLES_KEY),
    quality: () => press(TRAILER_QUALITY_KEY),
  }), [press]);

  const video = canPlay && ytId && !failed ? (
    <TrailerWebView
      ref={engine}
      ytId={ytId}
      embedUri={`${serverUrl}/yt-embed.html?v=${ytId}&hl=${lang}`}
      quality={tracks.quality}
      subtitle={tracks.subtitle}
      paused={playback.paused}
      onTracks={tracks.onTracks}
      onProgress={playback.onProgress}
      onCue={setCue}
      onLoadEnd={onLoadEnd}
      onError={onError}
      onEnded={close}
      onWaitingChange={setWaiting}
    />
  ) : undefined;

  return (
    <TrailerFocusScope bridges={bridges}>
      <TrailerView
        state={state}
        title={name || item?.Name || ""}
        backdropUri={item ? detailBackdropUri(client, item) : undefined}
        video={video}
        chromeShown={playback.chromeShown}
        timelineShown={playback.timelineShown}
        waiting={waiting}
        unavailableReason={ytId ? "youtube" : "unsupported"}
        timeline={playback.timeline}
        paused={playback.paused}
        scrubTarget={playback.scrubTarget}
        seekFlash={playback.seekFlash}
        subtitle={tracks.subtitle ? cue : null}
        tools={tracks.tools}
        panel={tracks.panel}
        onClose={presses.close}
        onPressTimeline={presses.timeline}
        onOpenSubtitles={presses.subtitles}
        onOpenQuality={presses.quality}
        onSelectSubtitle={tracks.choose}
        onSelectQuality={tracks.choose}
        onClosePanel={tracks.close}
        onPanelExited={onPanelExited}
      />
    </TrailerFocusScope>
  );
}
