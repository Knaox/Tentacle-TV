import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { isAirPlayRouteActive, isMpvAvailable, supportsAv1HardwareDecode } from "../../../modules/mpv-player";
import {
  decideEngine, nativeMediaPlausible,
  type EngineDecision, type EngineReason, type EngineRouterInput,
} from "./engineRouter";
import { useEngineSettings } from "./engineSettings";
import { defaultTrackIndices } from "./trackMapping";
import type { MobilePlatform, PlayerEngineKind } from "./types";

export interface PlayerEngineState {
  engine: PlayerEngineKind;
  reason: EngineReason;
  mpvAvailable: boolean;
  /** Impose un moteur pour le reste de la session (repli après un échec de lecture). */
  forceEngine: (engine: PlayerEngineKind, reason: EngineReason) => void;
  /** Le moteur à essayer après un échec de lecture directe, s'il en reste un plausible. */
  fallbackEngine: () => PlayerEngineKind | null;
  /**
   * La sortie audio vient de passer sur AirPlay (ou d'en revenir). Rend le
   * moteur qui vaut désormais, pour que l'écran renégocie sans attendre le rendu.
   */
  setAirPlayRoute: (active: boolean) => PlayerEngineKind;
}

const PLATFORM: MobilePlatform = Platform.OS === "android" ? "android" : "ios";

/** AirPlay l'emporte sur tout : seul le lecteur système diffuse. */
const AIRPLAY_DECISION: EngineDecision = { engine: "native", reason: "airplay" };

/**
 * La façade de décision : quel moteur lit cet élément. Décidé une fois par
 * élément, AVANT PlaybackInfo, à partir de ses flux et des pistes que Jellyfin
 * propose par défaut ; un repli (échec de lecture) impose ensuite l'autre
 * moteur pour la session. AirPlay est un état de l'APPAREIL, réactif et
 * symétrique : actif, le lecteur système l'emporte sur tout — même sur un
 * repli vers le lecteur avancé, qui ne diffuse pas ; éteint, la décision
 * redevient celle du média, et le lecteur avancé reprend là où le système ne
 * le remplaçait que pour AirPlay.
 */
export function usePlayerEngine(item: MediaItem | undefined): PlayerEngineState {
  const settings = useEngineSettings();
  const [override, setOverride] = useState<EngineDecision | null>(null);
  // Initialisé sur la route courante ; jamais remis à zéro au changement
  // d'élément : la route ne dépend pas du média.
  const [airPlay, setAirPlay] = useState<boolean>(() => PLATFORM === "ios" && isAirPlayRouteActive());
  const triedRef = useRef<Set<PlayerEngineKind>>(new Set());
  const itemId = item?.Id;

  // Nouvel élément : le repli repart de zéro.
  useEffect(() => {
    setOverride(null);
    triedRef.current = new Set();
  }, [itemId]);

  const source = item?.MediaSources?.[0];
  const mpvAvailable = isMpvAvailable();

  // Ce que le routeur juge du média — AirPlay mis à part, tenu à côté.
  const input = useMemo<Omit<EngineRouterInput, "airPlayActive">>(() => {
    const defaults = source ? defaultTrackIndices(source) : { audio: -1, subtitle: -1 };
    return {
      platform: PLATFORM,
      setting: settings.engine,
      mpvAvailable,
      preferSystemAtmos: settings.preferSystemAtmos,
      styledSubtitlesViaMpv: settings.styledSubtitlesViaMpv,
      av1Hardware: PLATFORM === "ios" && supportsAv1HardwareDecode(),
      container: source?.Container,
      streams: source?.MediaStreams ?? [],
      selectedAudioIndex: defaults.audio,
      selectedSubtitleIndex: defaults.subtitle,
    };
  }, [source, settings, mpvAvailable]);

  const automatic = useMemo<EngineDecision>(() => decideEngine({ ...input, airPlayActive: false }), [input]);

  const decision = airPlay ? AIRPLAY_DECISION : (override ?? automatic);

  const forceEngine = useCallback((engine: PlayerEngineKind, reason: EngineReason) => {
    setOverride({ engine, reason });
  }, []);

  const fallbackEngine = useCallback((): PlayerEngineKind | null => {
    // Sous AirPlay, il n'y a pas d'autre moteur : la relance transcodée prend la suite.
    if (airPlay) return null;
    triedRef.current.add(decision.engine);
    const other: PlayerEngineKind = decision.engine === "mpv" ? "native" : "mpv";
    if (triedRef.current.has(other)) return null;
    if (other === "mpv" && !mpvAvailable) return null;
    if (other === "native" && !nativeMediaPlausible(PLATFORM, source?.Container, source?.MediaStreams ?? [])) {
      return null;
    }
    return other;
  }, [airPlay, decision.engine, mpvAvailable, source]);

  const setAirPlayRoute = useCallback((active: boolean): PlayerEngineKind => {
    setAirPlay(active);
    return active ? AIRPLAY_DECISION.engine : (override ?? automatic).engine;
  }, [override, automatic]);

  return {
    engine: decision.engine, reason: decision.reason, mpvAvailable,
    forceEngine, fallbackEngine, setAirPlayRoute,
  };
}
