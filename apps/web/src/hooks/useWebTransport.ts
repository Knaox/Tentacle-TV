import { useEffect, type MutableRefObject, type RefObject } from "react";
import type { PlayerTransportRef } from "../watchTogether/playerTransport";
import { wtLog } from "../watchTogether/wtLog";

/**
 * Watch Together côté web : surface de commande impérative du moteur de sync
 * sur l'élément <video>. Positions en « position film » — seekTo hérite du
 * seek intelligent 3 niveaux (useSmartSeek). Miroir de useDesktopTransport.
 */
export function useWebTransport({
  transportRef,
  videoRef,
  lastKnownPositionRef,
  sourceChangingRef,
  handleSeek,
  cancelAutoNextLocal,
}: {
  transportRef?: PlayerTransportRef;
  videoRef: RefObject<HTMLVideoElement | null>;
  lastKnownPositionRef: MutableRefObject<number>;
  sourceChangingRef: MutableRefObject<boolean>;
  handleSeek: (seconds: number) => void;
  cancelAutoNextLocal: () => void;
}) {
  useEffect(() => {
    if (!transportRef) return;
    transportRef.current = {
      play: () => {
        wtLog("transport", "cmd play() [web]", { pos: lastKnownPositionRef.current.toFixed(1) });
        const v = videoRef.current;
        if (v?.paused) v.play().catch(() => {});
      },
      pause: () => {
        wtLog("transport", "cmd pause() [web]", { pos: lastKnownPositionRef.current.toFixed(1) });
        videoRef.current?.pause();
      },
      seekTo: (seconds: number) => {
        wtLog("transport", "cmd seekTo() [web]", {
          targetFilmS: seconds.toFixed(1), fromS: lastKnownPositionRef.current.toFixed(1),
          seeking: videoRef.current?.seeking ?? false,
        });
        handleSeek(seconds);
      },
      getPositionSeconds: () => lastKnownPositionRef.current,
      isPaused: () => videoRef.current?.paused ?? true,
      setRate: (rate: number) => {
        const v = videoRef.current;
        if (v && v.playbackRate !== rate) {
          wtLog("transport", `cmd setRate(${rate}) [web]`);
          v.playbackRate = rate;
        }
      },
      cancelAutoNext: cancelAutoNextLocal,
      // HAVE_FUTURE_DATA : le média courant est décodable ici et maintenant —
      // lu par la déclaration du moteur (join de groupe player déjà chargé).
      isMediaReady: () => {
        const v = videoRef.current;
        return !!v && v.readyState >= 3 && !sourceChangingRef.current;
      },
      isSeeking: () => videoRef.current?.seeking ?? false,
    };
    return () => { transportRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transportRef, handleSeek, cancelAutoNextLocal]);
}
