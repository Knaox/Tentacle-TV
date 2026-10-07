import { parseRenderTierMode, resolveRenderTier, type BenchResult, type DeviceSignals, type RenderTierState } from "./renderTier";
import { applySignalOverride, parseForcedTier, parseSignalOverride, type SignalOverride } from "./signalOverride";

/**
 * Le niveau de rendu tiré des CONSTANTES du module natif `TentacleDevice`
 * (Android TV) : signaux, micro-test gardé, réglage, propriétés de débogage.
 * Une seule lecture, deux lecteurs : la plateforme (`platform/androidtv/
 * renderTier`, qui le dit au natif) et le profil de rendu de la refonte
 * (`redesign/render/renderProfile.ts`, qui n'a pas le droit d'importer
 * l'app) — le même calcul, pur, sur les mêmes constantes.
 */
export interface DeviceConstants {
  signals?: DeviceSignals;
  bench?: BenchResult;
  mode?: string;
  forcedTier?: string;
  signalOverride?: string;
}

export interface NativeTier {
  state: RenderTierState;
  /** Des signaux simulés par `debug.tentacle.lite.signals`. */
  override: SignalOverride | null;
}

export function tierFromDeviceConstants(native: DeviceConstants | null | undefined): NativeTier {
  const override = parseSignalOverride(native?.signalOverride);
  const state = resolveRenderTier({
    platform: "androidtv",
    mode: parseRenderTierMode(native?.mode),
    signals: applySignalOverride(native?.signals ?? {}, override),
    bench: override?.bench ?? native?.bench ?? null,
    forced: parseForcedTier(native?.forcedTier),
  });
  return { state, override };
}
