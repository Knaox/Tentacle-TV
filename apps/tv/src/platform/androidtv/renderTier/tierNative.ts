import { NativeModules } from "react-native";
import {
  tierFromDeviceConstants,
  type BenchResult,
  type DeviceSignals,
  type RenderTier,
  type RenderTierState,
} from "@tentacle-tv/tv-core";

/**
 * Le niveau de rendu d'Android TV, décidé au CHARGEMENT du JS — avant la
 * première image. Le module natif `TentacleDevice` (`android/…/device/`) donne
 * en constantes ce qu'il a lu dès `Application.onCreate` : les signaux, le
 * micro-test gardé du lancement précédent, le réglage, les propriétés de
 * débogage ; la règle est celle de tv-core (`device/renderTier`), jamais une
 * copie. La décision repart au natif (`report`) : gardée, et dite au journal
 * `adb logcat -s TentacleLite`.
 */

interface DeviceNativeModule {
  signals?: DeviceSignals;
  bench?: BenchResult;
  benchStale?: boolean;
  mode?: string;
  forcedTier?: string;
  signalOverride?: string;
  returnState?: string;
  report(tier: string, reason: string, detail: string | null): void;
  setModeAndReload(mode: string, returnState: string | null): void;
}

export const deviceNative = NativeModules.TentacleDevice as DeviceNativeModule | undefined;

// Le calcul est celui de tv-core (`device/nativeTier`), le même que relit le
// profil de rendu de la refonte (`redesign/render/renderProfile.ts`).
const { state, override } = tierFromDeviceConstants(deviceNative);

export const RENDER_TIER_STATE: Readonly<RenderTierState> = state;

export const RENDER_TIER: RenderTier = RENDER_TIER_STATE.tier;

const reportDetail = [RENDER_TIER_STATE.detail, override ? "signaux simulés" : undefined].filter(Boolean).join(" · ");
deviceNative?.report(RENDER_TIER_STATE.tier, RENDER_TIER_STATE.reason, reportDetail || null);

/** L'écran à rouvrir après un rechargement dû au réglage (une fois). */
export const RETURN_STATE: string | null = deviceNative?.returnState ?? null;

export function useRenderTier(): RenderTier {
  return RENDER_TIER;
}

export function useRenderTierState(): Readonly<RenderTierState> {
  return RENDER_TIER_STATE;
}
