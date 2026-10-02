import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { myTitlesQueryKey, useMyTitles, type MyTitlesFeed } from "@tentacle-tv/api-client";
import type { MyTitle } from "@tentacle-tv/shared";
import { MY_TITLES_REFRESH, anyAdvancing, myTitlesRefetchMs } from "@tentacle-tv/tv-core";
import type { ArrivalReading } from "./arrivalModels";
import { useLiveRefresh } from "./liveRequests";
import { useAppActive } from "./useAppActive";
import type { VigieGate } from "./useVigieGate";

/**
 * Le suivi des demandes en cours de l'aperçu du rail et de sa fenêtre (rythmes
 * dans tv-core, `MY_TITLES_REFRESH`) :
 * - un titre AVANCE (en route, ou en train d'entrer dans la bibliothèque) et
 *   l'écran est devant : le DIRECT, toutes les 10 s (`useLiveRefresh`, un
 *   battement pour tout l'appareil) — l'aperçu le montre (ce qui bouge passe
 *   devant), la fenêtre aussi ;
 * - sinon, la liste ouverte (`watching`) : relue en l'ouvrant si elle date,
 *   puis toutes les 30 s ; le rail seul : toutes les 5 min, par l'écran DEVANT
 *   seulement (`active`) — les écrans empilés dessous lisent le même cache
 *   sans rien demander ;
 * - au retour au premier plan, si la dernière lecture a plus d'une minute ;
 * - application en arrière-plan : rien ; garde fermée (pas de Vigie, compte
 *   sans droit) : aucune requête.
 *
 * `reading` : d'où partent les vues — l'heure de la lecture, et si on la voit
 * (l'avancement bouge alors seul, d'une seconde à l'autre).
 */

const OPEN_STALE_MS = 10_000;

export interface MyRequestsFeed extends MyTitlesFeed {
  reading: ArrivalReading;
}

export function useMyRequests(gate: VigieGate | null, { watching, active }: { watching: boolean; active: boolean }): MyRequestsFeed {
  const qc = useQueryClient();
  const appActive = useAppActive();
  const polling = !!gate && active && appActive;
  // Ce qui avance se suit au rythme du direct : les rythmes lents s'effacent alors (jamais deux lectures).
  const cached = gate ? qc.getQueryData<MyTitle[]>(myTitlesQueryKey(gate.provider, gate.lang)) : undefined;
  const advancing = anyAdvancing(cached);
  const feed = useMyTitles(gate?.provider ?? null, gate?.lang ?? "en", {
    enabled: !!gate && active,
    refetchIntervalMs: polling && !advancing ? myTitlesRefetchMs(watching) : false,
  });
  useLiveRefresh(gate, polling && advancing);
  const updatedAt = useRef(feed.updatedAt);
  updatedAt.current = feed.updatedAt;

  // La première lecture est celle de la requête elle-même : on ne relit que ce
  // qui date — la liste qu'on ouvre (10 s), le retour au premier plan ou sur un
  // écran du rail (1 min). UNE relecture, jamais annulée : le battement du
  // direct a pu partir à la même seconde (mesuré : deux lectures au retour).
  const provider = gate?.provider ?? null;
  const lang = gate?.lang ?? "en";
  const refreshIfOlder = useCallback((ms: number) => {
    if (!provider || updatedAt.current === 0 || Date.now() - updatedAt.current <= ms) return;
    void qc.refetchQueries({ queryKey: myTitlesQueryKey(provider, lang), exact: true }, { cancelRefetch: false });
  }, [qc, provider, lang]);
  useEffect(() => {
    if (polling) refreshIfOlder(watching ? OPEN_STALE_MS : MY_TITLES_REFRESH.staleMs);
  }, [watching, polling, refreshIfOlder]);

  const reading = useMemo<ArrivalReading>(() => ({ at: feed.updatedAt, live: polling }), [feed.updatedAt, polling]);
  return { ...feed, reading };
}
