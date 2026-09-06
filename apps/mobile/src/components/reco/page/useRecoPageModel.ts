import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  heroSelectionFromRows, invalidateRecoQueries, useRecoPage, useRecoSettings, useTentacleConfig, useUserId,
} from "@tentacle-tv/api-client";
import { hasColdStartAck, markColdStartAck } from "@/reco/coldStartAck";

const EMPTY: number[] = [];

/** Les rangées servies dans TOUS les états du moteur (contrat backend). */
export const GLOBAL_ROW_KEYS = new Set(["trending", "serverPulse", "bestOfLibrary"]);

export type ColdStartPhase = "auto" | "hold" | "dismissed";

/**
 * Le modèle de la page Pour vous — la même machine que la page web : UNE
 * requête (`useRecoPage`, gardée par les réglages du compte pour ne pas
 * demander deux pages au premier rendu), le héros tiré au hasard avec une
 * graine par montage, et le démarrage à froid COLLANT : une fois affiché
 * (« hold »), il ne cède l'écran qu'au bouton — jamais à un refetch —, et il
 * ne s'impose qu'une fois par compte et par appareil (accusé).
 */
export function useRecoPageModel() {
  const qc = useQueryClient();
  const { storage } = useTentacleConfig();
  const userId = useUserId();
  const settings = useRecoSettings();
  // En erreur (vieux serveur) : page « toutes plateformes ».
  const settingsReady = settings.isSuccess || settings.isError;
  const providerFilter = settings.data?.providerFilter ?? EMPTY;
  const query = useRecoPage(providerFilter, { enabled: settingsReady });
  const page = query.data;

  const heroSeed = useRef(Math.random());
  const hero = useMemo(() => heroSelectionFromRows(page?.rows, heroSeed.current), [page?.rows]);

  const [phase, setPhase] = useState<ColdStartPhase>("auto");
  useEffect(() => {
    if (page?.state === "cold") {
      setPhase((p) =>
        p === "auto" && page.tmdbConfigured !== false && !hasColdStartAck(storage, userId) ? "hold" : p,
      );
    } else {
      setPhase("auto");
    }
  }, [page?.state, page?.tmdbConfigured, storage, userId]);
  // L'accusé se pose dès que la grille a été VUE — « Plus tard » compte aussi.
  useEffect(() => {
    if (phase === "hold") markColdStartAck(storage, userId);
  }, [phase, storage, userId]);

  // Tirer pour rafraîchir : un drapeau LOCAL — `isFetching` seul ferait
  // tourner l'anneau à chaque reco:update poussé par le socket.
  const [refreshing, setRefreshing] = useState(false);
  const settingsRefetch = settings.refetch;
  const pageRefetch = query.refetch;
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      invalidateRecoQueries(qc);
      await Promise.allSettled([settingsRefetch(), pageRefetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [qc, settingsRefetch, pageRefetch]);
  const retry = useCallback(() => { void pageRefetch(); }, [pageRefetch]);
  const openColdStart = useCallback(() => setPhase("hold"), []);
  const dismissColdStart = useCallback(() => setPhase("dismissed"), []);

  const hasPersonalizedRows = !!page?.rows.some((r) => !GLOBAL_ROW_KEYS.has(r.key));
  const canPersonalize = page?.personalized !== false && page?.tmdbConfigured !== false;

  return {
    page,
    providerFilter,
    filtered: providerFilter.length > 0,
    hero,
    phase,
    stale: query.isPlaceholderData,
    isError: query.isError,
    retry,
    refreshing,
    refresh,
    hasPersonalizedRows,
    canPersonalize,
    openColdStart,
    dismissColdStart,
  };
}
