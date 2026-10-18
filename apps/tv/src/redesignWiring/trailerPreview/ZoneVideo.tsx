import { memo, useCallback, useEffect, useRef, useState } from "react";
import { PREVIEW_ZONE_PLAYER_IDLE_MS, TV_TRAILER_PREVIEW_TIMING } from "@tentacle-tv/tv-core";
import { useTrailerPreviewSound } from "../../lib/trailerPreviewSettings";
import { PreviewVideo } from "./PreviewVideo";
import type { ZoneVideoWant } from "./ZoneSession";

/**
 * Le LECTEUR UNIQUE de la zone d'aperçu : monté à la première vidéo, il n'est
 * jamais démonté puis remonté d'un titre à l'autre — seule sa SOURCE change
 * (react-native-video sur Apple TV, mesuré : aucun lecteur créé sur dix cartes ;
 * le lecteur natif sur l'ExoPlayer partagé sur Android TV, `PreviewPlayerPool`).
 * Une rafale de flèches ne crée ni ne détruit aucun lecteur : la session du
 * titre suivant ne lui donne sa source que quand le focus a tenu.
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
  // La source dont la première image est déjà là : une session suivante qui veut la MÊME vidéo (une
  // série puis sa saison, le héros puis sa carte) ne la recharge pas — aucun avis ne reviendrait. Elle
  // l'apprend aussitôt.
  const sourceKey = source ? sourceKeyOf(source) : null;
  const readyKey = useRef<string | null>(null);
  if (readyKey.current !== null && readyKey.current !== sourceKey) readyKey.current = null;
  const onReady = useCallback(() => {
    if (!uri) return;
    readyKey.current = sourceKey;
    if (owns(uri)) current.current?.onReady();
  }, [uri, sourceKey, owns]);
  const wantReady = want?.onReady;
  const wantKey = want ? sourceKeyOf(want) : null;
  useEffect(() => {
    if (wantReady && wantKey !== null && readyKey.current === wantKey && sourceKey === wantKey) wantReady();
  }, [wantReady, wantKey, sourceKey]);
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

/** Une source : sa vidéo et d'où elle part (une reprise est une autre source). */
function sourceKeyOf(source: { uri: string; startAt: number }): string {
  return `${source.uri}#${source.startAt}`;
}
