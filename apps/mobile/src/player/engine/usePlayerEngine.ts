import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { isAirPlayRouteActive, isMpvAvailable, supportsAv1HardwareDecode } from "../../../modules/mpv-player";
import { decideEngine, nativeMediaPlausible, type EngineDecision, type EngineReason } from "./engineRouter";
import { useEngineSettings } from "./engineSettings";
import { defaultTrackIndices } from "./trackMapping";
import type { MobilePlatform, PlayerEngineKind } from "./types";

export interface PlayerEngineState {
  engine: PlayerEngineKind;
  reason: EngineReason;
  mpvAvailable: boolean;
  /** Impose un moteur pour le reste de la session (repli après échec, AirPlay). */
  forceEngine: (engine: PlayerEngineKind, reason: EngineReason) => void;
  /** Le moteur à essayer après un échec de lecture directe, s'il en reste un plausible. */
  fallbackEngine: () => PlayerEngineKind | null;
}

const PLATFORM: MobilePlatform = Platform.OS === "android" ? "android" : "ios";

/**
 * La façade de décision : quel moteur lit cet élément. Décidé une fois par
 * élément, AVANT PlaybackInfo, à partir de ses flux et des pistes que Jellyfin
 * propose par défaut ; un repli (échec de lecture) ou AirPlay peut ensuite
 * imposer l'autre moteur pour la session. Jamais de retour automatique vers le
 * lecteur avancé en cours de lecture.
 */
export function usePlayerEngine(item: MediaItem | undefined): PlayerEngineState {
  const settings = useEngineSettings();
  const [override, setOverride] = useState<EngineDecision | null>(null);
  const triedRef = useRef<Set<PlayerEngineKind>>(new Set());
  const itemId = item?.Id;

  // Nouvel élément : la décision repart de zéro.
  useEffect(() => {
    setOverride(null);
    triedRef.current = new Set();
  }, [itemId]);

  const source = item?.MediaSources?.[0];
  const mpvAvailable = isMpvAvailable();

  const automatic = useMemo<EngineDecision>(() => {
    const defaults = source ? defaultTrackIndices(source) : { audio: -1, subtitle: -1 };
    return decideEngine({
      platform: PLATFORM,
      setting: settings.engine,
      mpvAvailable,
      airPlayActive: PLATFORM === "ios" && isAirPlayRouteActive(),
      preferSystemAtmos: settings.preferSystemAtmos,
      styledSubtitlesViaMpv: settings.styledSubtitlesViaMpv,
      av1Hardware: PLATFORM === "ios" && supportsAv1HardwareDecode(),
      container: source?.Container,
      streams: source?.MediaStreams ?? [],
      selectedAudioIndex: defaults.audio,
      selectedSubtitleIndex: defaults.subtitle,
    });
  }, [source, settings, mpvAvailable]);

  const decision = override ?? automatic;

  const forceEngine = useCallback((engine: PlayerEngineKind, reason: EngineReason) => {
    setOverride({ engine, reason });
  }, []);

  const fallbackEngine = useCallback((): PlayerEngineKind | null => {
    triedRef.current.add(decision.engine);
    const other: PlayerEngineKind = decision.engine === "mpv" ? "native" : "mpv";
    if (triedRef.current.has(other)) return null;
    if (other === "mpv" && !mpvAvailable) return null;
    if (other === "native" && !nativeMediaPlausible(PLATFORM, source?.Container, source?.MediaStreams ?? [])) {
      return null;
    }
    return other;
  }, [decision.engine, mpvAvailable, source]);

  return { engine: decision.engine, reason: decision.reason, mpvAvailable, forceEngine, fallbackEngine };
}
