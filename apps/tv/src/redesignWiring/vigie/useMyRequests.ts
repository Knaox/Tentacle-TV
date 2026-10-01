import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useMyTitles, type MyTitlesFeed } from "@tentacle-tv/api-client";
import { MY_TITLES_REFRESH, myTitlesRefetchMs } from "@tentacle-tv/tv-core";
import type { VigieGate } from "./useVigieGate";

/**
 * Le suivi des demandes en cours, léger (règle de la tâche, rythme dans
 * tv-core `MY_TITLES_REFRESH`) :
 * - la liste ouverte (`watching`) : relue en l'ouvrant si elle date, puis
 *   toutes les 30 s ;
 * - le rail seul : toutes les 5 min, par l'écran DEVANT seulement (`active`)
 *   — les écrans empilés dessous lisent le même cache sans rien demander ;
 * - au retour au premier plan, si la dernière lecture a plus d'une minute ;
 * - application en arrière-plan : rien ; garde fermée (pas de Vigie, compte
 *   sans droit) : aucune requête.
 */

const OPEN_STALE_MS = 10_000;

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => subscription.remove();
  }, []);
  return active;
}

export function useMyRequests(gate: VigieGate | null, { watching, active }: { watching: boolean; active: boolean }): MyTitlesFeed {
  const appActive = useAppActive();
  const polling = !!gate && active && appActive;
  const feed = useMyTitles(gate?.provider ?? null, gate?.lang ?? "en", {
    enabled: !!gate && active,
    refetchIntervalMs: polling ? myTitlesRefetchMs(watching) : false,
  });
  const latest = useRef(feed);
  latest.current = feed;

  // La première lecture est celle de la requête elle-même : on ne relit que ce qui date.
  const refreshIfOlder = useCallback((ms: number) => {
    const { updatedAt, refetch } = latest.current;
    if (updatedAt > 0 && Date.now() - updatedAt > ms) void refetch();
  }, []);
  // La liste qu'on ouvre se montre à jour.
  useEffect(() => {
    if (watching && polling) refreshIfOlder(OPEN_STALE_MS);
  }, [watching, polling, refreshIfOlder]);
  // Le retour au premier plan, ou sur un écran du rail.
  useEffect(() => {
    if (polling) refreshIfOlder(MY_TITLES_REFRESH.staleMs);
  }, [polling, refreshIfOlder]);

  return feed;
}
