import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { useQueries } from "@tanstack/react-query";
import { loadTitleState, tentacleApiFetch, titleStateQueryKey, useMyTitles } from "@tentacle-tv/api-client";
import { parseTitleKey, type TitleKey, type TitleState } from "@tentacle-tv/shared";
import { isAdvancing } from "@tentacle-tv/tv-core";
import type { AbsentModel } from "../../redesign/cards/cardTypes";
import { absentOf } from "./absentStates";
import type { ArrivalReading } from "./arrivalModels";
import { useArrivals, useLiveRefresh } from "./liveRequests";
import { useAppActive } from "./useAppActive";
import type { VigieGate } from "./useVigieGate";

/**
 * Ce que les cartes de titres ABSENTS disent quand la garde Vigie est ouverte
 * — la collection d'un film, la rangée « À demander » de la recherche : le
 * badge de chacun (`absentOf` : sa demande, l'état que dit l'extension, ou
 * l'absence) et l'indication du geste sous la carte focalisée (« OK :
 * demander », « OK : choisir les saisons »), seulement quand l'extension
 * offre la demande.
 *
 * Une entrée de cache par titre (`titleStateQueryKey`, celle de
 * `useTitleState`) : les cartes montées ensemble partent dans UNE requête
 * (`loadTitleState`), et une demande ne réécrit que la sienne. La liste des
 * demandes du compte est celle du socle (`useMyTitles`) : une demande faite
 * ici, patchée dedans, change aussitôt son badge.
 *
 * EN DIRECT : une carte de demande du compte qui avance, sur l'écran de
 * devant, l'app au premier plan, inscrit l'écran au battement de 10 s
 * (`useLiveRefresh`) ; son affiche se colore au fil de l'avancement, qui bouge
 * d'une seconde à l'autre. Arrivée (sortie de la liste en avançant) : pleine
 * couleur, « Disponible ».
 */

export interface AbsentResolver {
  /** `fallback` : la pastille qu'une réponse de recherche portait déjà, le temps que l'état se lise. */
  absentOf: (key: TitleKey, fallback?: TitleState["badge"]) => AbsentModel;
  /** L'indication du geste sous la carte focalisée ; rien quand OK ne demanderait rien. */
  hintOf: (key: TitleKey) => string | undefined;
}

const fetcher = (url: string) => tentacleApiFetch(url);

export function useAbsentStates(gate: VigieGate | null, keys: readonly TitleKey[]): AbsentResolver | null {
  const { t } = useTranslation();
  const provider = gate?.provider ?? null;
  const lang = gate?.lang ?? "fr";
  const { titles: mine, updatedAt } = useMyTitles(provider, lang, { enabled: gate !== null });
  const arrivals = useArrivals();
  const screenFocused = useIsFocused();
  const appActive = useAppActive();
  const visible = gate !== null && screenFocused && appActive;
  const mineOf = useMemo(() => new Map((mine ?? []).map((m) => [m.key, m])), [mine]);
  const advancing = keys.some((key) => {
    const own = mineOf.get(key);
    return own !== undefined && isAdvancing(own.state);
  });
  useLiveRefresh(gate, visible && advancing);
  const reading = useMemo<ArrivalReading>(() => ({ at: updatedAt, live: visible }), [updatedAt, visible]);
  const results = useQueries({
    queries: keys.map((key) => ({
      queryKey: titleStateQueryKey(provider, lang, key),
      queryFn: () => loadTitleState(provider!, key, lang, fetcher),
      enabled: provider !== null,
      staleTime: 60_000,
      retry: 1,
    })),
  });

  // Les réponses se relisent à chaque rendu (v4) : un nouveau tableau ne vaut
  // que si l'une d'elles a changé.
  const states = results.map((r) => (r.data ?? null) as TitleState | null);
  const kept = useRef<{ keys: readonly TitleKey[]; states: (TitleState | null)[] }>({ keys, states });
  const same = kept.current.keys === keys && kept.current.states.length === states.length
    && kept.current.states.every((s, i) => s === states[i]);
  if (!same) kept.current = { keys, states };
  const stable = kept.current.states;

  return useMemo(() => {
    if (!gate) return null;
    const stateOf = new Map<TitleKey, TitleState | null>(keys.map((key, i) => [key, stable[i] ?? null]));
    return {
      absentOf: (key, fallback) =>
        absentOf(t, mineOf.get(key), stateOf.get(key) ?? (fallback ? { badge: fallback, request: null } : null), reading, arrivals.has(key)),
      hintOf: (key) => {
        if (mineOf.has(key) || arrivals.has(key)) return undefined;
        const offer = stateOf.get(key)?.request;
        if (offer?.mode === "direct") return t("requests:hintRequest");
        const seasons = offer?.mode === "open" && parseTitleKey(key)?.mediaType === "tv" && gate.provider.seasonsPath !== null;
        return seasons ? t("requests:hintSeasons") : undefined;
      },
    };
  }, [gate, keys, stable, mineOf, reading, arrivals, t]);
}
