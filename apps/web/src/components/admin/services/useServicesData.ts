import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { servicesApi } from "./servicesApi";
import { SERVICES_KEYS } from "./servicesModel";
import { explainFailure } from "./serviceSummary";

/**
 * Les lectures de la page « Services », partagées entre le résumé et les
 * sections : une seule requête par service, et ce qu'une section enregistre,
 * le résumé le montre aussitôt.
 *
 * Fraîches à chaque visite (`staleTime: 0`) : l'état d'une connexion d'il y a
 * cinq minutes ne dit rien de celui d'aujourd'hui. Pas de relecture au retour
 * sur l'onglet (réglage global) — un formulaire en cours n'est pas remplacé
 * sous les doigts.
 */

export const useServicesStatus = () =>
  useQuery({ queryKey: SERVICES_KEYS.status, queryFn: servicesApi.status, staleTime: 0 });

export const usePublicUrlConfig = () =>
  useQuery({ queryKey: SERVICES_KEYS.publicUrl, queryFn: servicesApi.publicUrl, staleTime: 0 });

export const useDirectStreamingConfig = () =>
  useQuery({ queryKey: SERVICES_KEYS.directStreaming, queryFn: servicesApi.directStreaming, staleTime: 0 });

export const useAudioAnalysis = () =>
  useQuery({ queryKey: SERVICES_KEYS.audioAnalysis, queryFn: servicesApi.audioAnalysis, staleTime: 0 });

/** Même entrée et mêmes réglages que le bandeau d'alerte de la clé. */
export const useKeyHealth = () =>
  useQuery({ queryKey: SERVICES_KEYS.jellyfinKey, queryFn: () => servicesApi.keyHealth(), staleTime: 5 * 60_000, retry: false });

/**
 * « Revérifier » : Jellyfin et la base sondés à nouveau, les compteurs relus,
 * et le verdict de la clé refait par le serveur — il le garde cinq minutes.
 */
export function useRecheck() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const recheck = useCallback(async () => {
    setPending(true);
    try {
      await Promise.all([
        servicesApi.keyHealth(true).then(
          (health) => queryClient.setQueryData(SERVICES_KEYS.jellyfinKey, health),
          () => undefined,
        ),
        queryClient.refetchQueries({ queryKey: SERVICES_KEYS.status }),
        queryClient.refetchQueries({ queryKey: SERVICES_KEYS.audioAnalysis }),
      ]);
    } finally {
      setPending(false);
    }
  }, [queryClient]);
  return { recheck, pending };
}

/** Un échec en une phrase : le code du serveur traduit, ou son message tel quel. */
export function useExplainFailure() {
  const { t } = useTranslation("adminServices");
  return useCallback((error: unknown) => {
    const failure = explainFailure(error);
    return "message" in failure ? failure.message : t(failure.key, failure.values);
  }, [t]);
}
