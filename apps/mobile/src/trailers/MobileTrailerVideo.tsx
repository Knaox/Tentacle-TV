import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Video, { type OnProgressData, type OnVideoErrorData } from "react-native-video";
import { SubtitleOverlay } from "../components/player/SubtitleOverlay";
import { PLAYER } from "@/theme";

interface Props {
  uri: string;
  /** `m3u8` : un maître HLS (une URL sans extension ne dirait rien au lecteur). */
  type?: "m3u8";
  /** Le WebVTT relayé de la piste choisie, ou `null` : aucun sous-titre. */
  subtitleUrl: string | null;
  onStarted: () => void;
  /** La raison va au compte rendu du serveur, jamais à l'écran. */
  onFailed: (reason: string) => void;
  onEnded: () => void;
}

/** Pas d'image en 15 s : la lecture a échoué (le flux ne répond pas), comme sur la TV. */
export const TRAILER_START_TIMEOUT_MS = 15_000;
const PROGRESS_INTERVAL_MS = 250;

/**
 * La vidéo d'une bande-annonce : `react-native-video` (AVPlayer sur iOS,
 * ExoPlayer sur Android) sur le maître HLS — relayé par le serveur, ou lu
 * directement chez Dailymotion —, avec ses commandes NATIVES (lecture, frise,
 * plein écran du système) et les sous-titres en calque (`SubtitleOverlay`,
 * le rendu du lecteur de l'app).
 *
 * Chaque lecture FINIT : la première image, la fin, ou un échec — erreur du
 * lecteur, ou aucune image au bout de 15 s (AVPlayer peut attendre sans fin
 * un flux qui ne répond pas). Une seule issue par source.
 */
export const MobileTrailerVideo = memo(function MobileTrailerVideo({ uri, type, subtitleUrl, onStarted, onFailed, onEnded }: Props) {
  const [position, setPosition] = useState(0);
  const latest = useRef({ onStarted, onFailed, onEnded });
  latest.current = { onStarted, onFailed, onEnded };
  const state = useRef({ started: false, done: false });

  // Une source neuve : tout recommence, et le chien de garde attend sa première image.
  useEffect(() => {
    state.current = { started: false, done: false };
    setPosition(0);
    const timer = setTimeout(() => {
      if (state.current.started || state.current.done) return;
      state.current.done = true;
      latest.current.onFailed(`aucune image en ${TRAILER_START_TIMEOUT_MS / 1000} s`);
    }, TRAILER_START_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [uri]);

  const start = useCallback(() => {
    if (state.current.started || state.current.done) return;
    state.current.started = true;
    latest.current.onStarted();
  }, []);
  const finish = useCallback((reason: string | null) => {
    if (state.current.done) return;
    state.current.done = true;
    if (reason === null) latest.current.onEnded();
    else latest.current.onFailed(reason);
  }, []);

  const onProgress = useCallback((data: OnProgressData) => {
    if (data.currentTime > 0.05) start();
    setPosition(data.currentTime);
  }, [start]);
  const onError = useCallback((e: OnVideoErrorData) => {
    // AVPlayer (code, description) ou ExoPlayer (errorCode, errorString).
    const err = e?.error;
    const code = err?.code ?? err?.errorCode ?? "?";
    const text = err?.localizedDescription ?? err?.localizedFailureReason ?? err?.error ?? err?.errorString ?? "?";
    finish(`lecteur ${code} : ${text}`);
  }, [finish]);
  const onEnd = useCallback(() => finish(null), [finish]);

  // Mémorisée : un objet neuf à chaque rendu rechargerait la source native.
  const source = useMemo(() => ({ uri, type }), [uri, type]);

  return (
    <View style={st.frame}>
      <Video
        key={uri}
        source={source}
        style={StyleSheet.absoluteFill}
        controls
        resizeMode="contain"
        progressUpdateInterval={PROGRESS_INTERVAL_MS}
        onReadyForDisplay={start}
        onProgress={onProgress}
        onError={onError}
        onEnd={onEnd}
      />
      <SubtitleOverlay vttUrl={subtitleUrl} currentTime={position} />
    </View>
  );
});

const st = StyleSheet.create({
  frame: { flex: 1, backgroundColor: PLAYER.bg },
});
