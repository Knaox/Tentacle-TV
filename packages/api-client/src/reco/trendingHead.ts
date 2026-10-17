import { useCallback } from "react";
import { RECO_TRENDING_NOW_ROW_KEY } from "@tentacle-tv/shared";
import { useRecoSettings } from "../hooks/useHomeLayout";
import { useSaveRecoSettingsPatch } from "../hooks/usePreferencesPatch";
import { useServerCapability } from "../hooks/useServerCapabilities";

/**
 * « Tendances actuelles » en tête de « Pour vous » (capacité `reco.trending`,
 * serveur 1.31.0) : les tendances TMDB de la semaine, sans le goût du compte.
 * Le serveur la sert dans la page (`trendingNow`, à la demande du client —
 * `acceptRecoTrendingHead`), en tête, sans doublon dans les rangées suivantes.
 */

/**
 * Pur : les rangées que « Pour vous » montre. Avec la tête, la rangée
 * `trending` (filtrée par le goût, gardée dans la réponse pour l'accueil qui
 * peut l'épingler) n'y paraît pas : deux fois « Tendances » sur une page.
 * Sans la tête (serveur d'avant, préférence coupée), rien ne change.
 */
export function forYouPageRows<R extends { key: string }>(rows: readonly R[]): R[] {
  if (!rows.some((row) => row.key === RECO_TRENDING_NOW_ROW_KEY)) return [...rows];
  return rows.filter((row) => row.key !== "trending");
}

export interface TrendingNowSetting {
  /** L'interrupteur a lieu d'être : le serveur sait servir la rangée et les réglages sont lus. */
  available: boolean;
  /** Le choix du compte — allumée par défaut. */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

/**
 * L'interrupteur « Tendances actuelles » : préférence du COMPTE (jamais de
 * l'appareil), écrite en « lire avant d'écrire » ; la page se relit d'elle-même
 * (`useSaveRecoSettingsPatch` invalide les pages reco). Absent face à un
 * serveur qui ne déclare pas `reco.trending`.
 */
export function useTrendingNowSetting(): TrendingNowSetting {
  const supported = useServerCapability("reco.trending");
  const settings = useRecoSettings();
  const save = useSaveRecoSettingsPatch();
  const { mutate } = save;
  const setEnabled = useCallback((enabled: boolean) => mutate({ trendingNow: enabled }), [mutate]);
  return {
    available: supported && !!settings.data,
    enabled: settings.data?.trendingNow ?? true,
    setEnabled,
  };
}
