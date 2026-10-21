import type { QueryClient } from "@tanstack/react-query";
import { resolveServerCapabilities, type ServerCapabilitiesSource } from "@tentacle-tv/shared";
import { RECO_SETTINGS_KEY, useRecoSettings, type RecoSettingsData } from "../hooks/useHomeLayout";
import { appConfigQuery, useAppConfig } from "../hooks/useConfig";

/**
 * La page reco demande-t-elle « Tendances actuelles » en tête (`?trendingNow=1`) ?
 * Seulement si TROIS choses sont vraies (garde-fous du lot 1017) :
 *   1. l'application sait la rendre (`acceptRecoTrendingHead`, posé au
 *      démarrage : web, bureau, Apple TV, Android TV, mobile — pas webOS) ;
 *   2. le serveur déclare `reco.trending` ;
 *   3. la préférence du compte n'est pas coupée (`trendingNow`).
 * Sinon la requête — et sa clé de cache, mémoire et disque — est EXACTEMENT
 * celle d'avant : une bascule de l'interrupteur ne sert jamais l'autre page.
 */

let accepted = false;

/** Posé UNE fois, au démarrage, par l'application qui sait rendre la tête. */
export function acceptRecoTrendingHead(): void {
  accepted = true;
}

/** Pur : la décision, d'après la configuration du serveur et les réglages du compte. */
export function wantsTrendingHead(
  config: ServerCapabilitiesSource | null | undefined,
  settings: Pick<RecoSettingsData, "trendingNow"> | null | undefined,
  appAccepts = accepted,
): boolean {
  if (!appAccepts) return false;
  if (!resolveServerCapabilities(config).has("reco.trending")) return false;
  return settings?.trendingNow !== false;
}

export interface TrendingHeadRequest {
  /** La décision est prise : la page peut partir (sans quoi elle partirait deux fois). */
  ready: boolean;
  trendingNow: boolean;
}

/**
 * Pour le crochet de page : attend la configuration et les réglages (déjà
 * demandés partout ailleurs) avant de décider — une application qui ne sait
 * pas rendre la tête n'attend rien.
 */
export function useTrendingHeadRequest(): TrendingHeadRequest {
  const config = useAppConfig();
  const settings = useRecoSettings();
  if (!accepted) return { ready: true, trendingNow: false };
  const settled = !config.isPending && (settings.isSuccess || settings.isError);
  return { ready: settled, trendingNow: settled && wantsTrendingHead(config.data, settings.data) };
}

/** Pour les préchargements (sans crochet) : la même décision, lue dans le cache. */
export function trendingHeadFromCache(qc: QueryClient): TrendingHeadRequest {
  if (!accepted) return { ready: true, trendingNow: false };
  const config = qc.getQueryData<ServerCapabilitiesSource>(appConfigQuery().queryKey);
  const settings = qc.getQueryData<RecoSettingsData>(RECO_SETTINGS_KEY);
  if (!config || !settings) return { ready: false, trendingNow: false };
  return { ready: true, trendingNow: wantsTrendingHead(config, settings) };
}
