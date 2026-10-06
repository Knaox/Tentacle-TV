import { useCallback, useMemo } from "react";
import { changeRenderTierMode, useRenderTierState } from "../../platform/renderTier";
import { PLATFORM_TRAITS } from "../../platform/traits";
import type { SettingsRenderTier } from "../../redesign/screens/settings/settingsTypes";

/**
 * Le réglage « Mode Lite » des Réglages (Android TV seulement, trait
 * `renderTierSetting`) : le niveau en vigueur, sa raison détectée, et le
 * changement — qui recharge l'interface et rouvre l'onglet Apparence. Sur
 * l'Apple TV : `null`, l'onglet n'en sait rien.
 */
export function useRenderTierSetting(): {
  renderTier: SettingsRenderTier | null;
  onSelectLiteMode?: (mode: SettingsRenderTier["mode"]) => void;
} {
  const state = useRenderTierState();
  const renderTier = useMemo<SettingsRenderTier | null>(() => (PLATFORM_TRAITS.renderTierSetting ? {
    mode: state.mode,
    tier: state.tier,
    detected: { tier: state.auto.tier, reason: state.auto.reason, detail: state.auto.detail },
    forced: state.reason === "debugForced",
  } : null), [state]);
  const onSelectLiteMode = useCallback((mode: SettingsRenderTier["mode"]) => {
    changeRenderTierMode(mode, { tab: "appearance" });
  }, []);
  return renderTier ? { renderTier, onSelectLiteMode } : { renderTier: null };
}
