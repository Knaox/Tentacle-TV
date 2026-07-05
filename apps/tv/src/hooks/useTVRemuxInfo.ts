import { useEffect, useRef, type MutableRefObject } from "react";
import { NativeModules } from "react-native";

/** Instantané de production de la session remux locale (natif `sessionInfo`). */
export interface RemuxInfo {
  /** Secondes PRODUITES depuis le début de session (0-based, timeline playlist). */
  writtenSec: number;
  /** Origine ABSOLUE exacte de la timeline (1ᵉʳ DTS muxé, cf. TVNoteFirstDts). */
  sessionStartSec: number;
  /** Remux terminé (trailer/ENDLIST écrit — ou sorti en erreur, cf. error). */
  done: boolean;
  error: boolean;
  gen: number;
  /** Date.now() du dernier rafraîchissement (fraîcheur du snapshot). */
  at: number;
}

const Remux = (NativeModules as {
  TVLocalRemux?: { sessionInfo?: () => Promise<Omit<RemuxInfo, "at">> };
}).TVLocalRemux;

/**
 * Poll ~1 Hz de l'état de production du remux local tvOS, exposé en ref (lectures
 * SYNCHRONES par les décisions de seek et le détecteur de fin — pas de re-render).
 * Inerte hors remux (Android : module absent ; direct play/transcode : gate).
 */
export function useTVRemuxInfo(isLocalRemux: boolean): MutableRefObject<RemuxInfo | null> {
  const infoRef = useRef<RemuxInfo | null>(null);

  useEffect(() => {
    if (!isLocalRemux || !Remux?.sessionInfo) { infoRef.current = null; return; }
    let alive = true;
    const tick = () => {
      Remux.sessionInfo!()
        .then((r) => { if (alive && r) infoRef.current = { ...r, at: Date.now() }; })
        .catch(() => {});
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => { alive = false; clearInterval(id); infoRef.current = null; };
  }, [isLocalRemux]);

  return infoRef;
}
