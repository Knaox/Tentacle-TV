import { memo, useCallback, useEffect, useRef, useState } from "react";
import { PREVIEW_ZONE_PLAYER_IDLE_MS, TV_TRAILER_PREVIEW_TIMING } from "@tentacle-tv/tv-core";
import { useTrailerPreviewSound } from "../../lib/trailerPreviewSettings";
import { PREVIEW_VIDEO_SWAPS_SOURCE, PreviewVideo } from "./PreviewVideo";
import type { ZoneVideoWant } from "./ZoneSession";

/**
 * Le LECTEUR UNIQUE de la zone d'aperçu : jamais deux à la fois, et rien ne se
 * crée ni ne se détruit pendant une rafale de flèches — la session du titre
 * suivant ne lui donne sa source que quand le focus a tenu. Sur Android TV, le
 * lecteur natif CHANGE DE SOURCE sur place (l'ExoPlayer partagé,
 * `PreviewPlayerPool`) ; sur Apple TV, react-native-video ne le sait pas
 * (`PREVIEW_VIDEO_SWAPS_SOURCE`) : l'élément est remonté à chaque source.
 *
 * Sans rien à jouer, il garde sa dernière source, EN PAUSE, invisible (la zone
 * l'efface) ; resté ainsi `PREVIEW_ZONE_PLAYER_IDLE_MS`, il se démonte — la
 * mémoire d'un lecteur en pause. Les avis du lecteur ne vont qu'à la session
 * qui le veut EN CE MOMENT : ceux d'une source quittée se perdent.
 */
export const ZoneVideo = memo(function ZoneVideo({ want }: { want: ZoneVideoWant | null }) {
  const sound = useTrailerPreviewSound();
  const [source, setSource] = useState<Pick<ZoneVideoWant, "uri" | "hls" | "startAt"> | null>(null);
  const current = useRef(want);
  current.current = want;
  // La source suit ce que veut la session ; sans vœu, la dernière reste.
  if (want && (source?.uri !== want.uri || source.startAt !== want.startAt)) {
    setSource({ uri: want.uri, hls: want.hls, startAt: want.startAt });
  }
  // Resté sans rien à jouer : démonté au bout du délai.
  const idle = want === null && source !== null;
  useEffect(() => {
    if (!idle) return undefined;
    const timer = setTimeout(() => setSource(null), PREVIEW_ZONE_PLAYER_IDLE_MS);
    return () => clearTimeout(timer);
  }, [idle]);

  const owns = useCallback((uri: string) => current.current?.uri === uri, []);
  const uri = source?.uri ?? null;
  const onReady = useCallback(() => {
    if (uri && owns(uri)) current.current?.onReady();
  }, [uri, owns]);
  const onError = useCallback(() => {
    if (uri && owns(uri)) current.current?.onError();
  }, [uri, owns]);
  const onEnded = useCallback(() => {
    if (uri && owns(uri)) current.current?.onEnded();
  }, [uri, owns]);
  const onPosition = useCallback(
    (position: number, duration: number) => {
      if (uri && owns(uri)) current.current?.onPosition(position, duration);
    },
    [uri, owns],
  );

  if (!source) return null;
  return (
    <PreviewVideo
      key={PREVIEW_VIDEO_SWAPS_SOURCE ? "zone" : source.uri}
      uri={source.uri}
      hls={source.hls}
      startAt={source.startAt}
      playing={want?.uri === source.uri && want.playing}
      muted={!sound}
      volume={TV_TRAILER_PREVIEW_TIMING.volume}
      onReady={onReady}
      onError={onError}
      onEnded={onEnded}
      onPosition={onPosition}
    />
  );
});
