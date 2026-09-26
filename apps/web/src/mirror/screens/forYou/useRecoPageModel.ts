import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { heroSelectionFromRows, useRecoPage } from "@tentacle-tv/api-client";
import { useRecoFilter } from "../../../hooks/useRecoFilter";
import { hasColdStartAck, markColdStartAck } from "../../../lib/coldStartAck";

/** Les rangées servies dans TOUS les états du moteur (contrat backend). */
export const GLOBAL_ROW_KEYS = new Set(["trending", "serverPulse", "bestOfLibrary"]);

export type ColdStartPhase = "auto" | "hold" | "dismissed";

/** La phase suivante du démarrage à froid — pure : collante une fois
 *  affichée, réarmée dès que le serveur a vraiment tourné. */
export function nextColdStartPhase(
  current: ColdStartPhase,
  page: { state: string; tmdbConfigured: boolean } | undefined,
  acked: boolean,
): ColdStartPhase {
  if (page?.state !== "cold") return "auto";
  return current === "auto" && page.tmdbConfigured !== false && !acked ? "hold" : current;
}

/**
 * `useRecoPageModel` de l'app : UNE requête (la page du filtre du compte, lu
 * de façon synchrone dans le store du web), le héros tiré au hasard avec une
 * graine par montage, et le démarrage à froid COLLANT — il ne cède l'écran
 * qu'au bouton, et ne s'impose qu'une fois par compte et par appareil
 * (accusé partagé avec le bureau).
 */
export function useRecoPageModel() {
  const { selected } = useRecoFilter();
  const query = useRecoPage(selected);
  const page = query.data;

  const heroSeed = useRef(Math.random());
  const hero = useMemo(() => heroSelectionFromRows(page?.rows, heroSeed.current), [page?.rows]);

  const [phase, setPhase] = useState<ColdStartPhase>("auto");
  const state = page?.state;
  const tmdbConfigured = page?.tmdbConfigured;
  useEffect(() => {
    setPhase((p) =>
      nextColdStartPhase(p, state ? { state, tmdbConfigured: tmdbConfigured ?? true } : undefined, hasColdStartAck()),
    );
  }, [state, tmdbConfigured]);
  // L'accusé se pose dès que la grille a été VUE — « Plus tard » compte aussi.
  useEffect(() => {
    if (phase === "hold") markColdStartAck();
  }, [phase]);

  const refetch = query.refetch;
  const retry = useCallback(() => void refetch(), [refetch]);
  const openColdStart = useCallback(() => setPhase("hold"), []);
  const dismissColdStart = useCallback(() => setPhase("dismissed"), []);

  return {
    page,
    providerFilter: selected,
    filtered: selected.length > 0,
    hero,
    phase,
    stale: query.isPlaceholderData,
    isError: query.isError,
    retry,
    hasPersonalizedRows: !!page?.rows.some((r) => !GLOBAL_ROW_KEYS.has(r.key)),
    canPersonalize: page?.personalized !== false && page?.tmdbConfigured !== false,
    openColdStart,
    dismissColdStart,
  };
}
