import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { focusManager } from "@tanstack/react-query";
import { useRecoPage, type RecoPage } from "../hooks/useRecoPage";
import {
  RECO_ARRIVAL_MS,
  RECO_LONG_ABSENCE_MS,
  hasNewRecoContent,
  servedPageVerdict,
  visibleRecoPage,
} from "./recoPageVisit";
import { isRecoDismissed, isRecoRetired, registerShownRecoPage, subscribeRecoDropped } from "./recoRetirementState";

/** Ce que les écrans lisent : la page de LA visite, et de quoi la renouveler. */
export interface RecoPageVisit {
  /** La page à l'écran : celle de l'arrivée, moins les titres sortis depuis. */
  data: RecoPage | undefined;
  isError: boolean;
  /** Changement de filtre en cours : la page de l'ancien filtre est encore là. */
  isPlaceholderData: boolean;
  /** Relit la page ET l'affiche : réessayer, tirer pour rafraîchir — des gestes. */
  refetch: () => Promise<unknown>;
  /** Une page recalculée attend, avec du NOUVEAU à montrer (titres, rangées). */
  hasNewer: boolean;
  /** Le geste explicite et discret : l'afficher maintenant. */
  showNewer: () => void;
}

interface VisitState {
  /** La page adoptée (avant les retraits de la visite). */
  shown: RecoPage | undefined;
  /** La dernière page servie déjà jugée — une page servie ne se juge qu'une fois. */
  seen: RecoPage | undefined;
  /** Début de l'arrivée : le montage, ou le retour après une longue absence. */
  arrivedAt: number;
}

const NO_REMOVALS: ReadonlySet<string> = new Set();

/**
 * La page de recommandations d'une VISITE — la règle 5 de
 * docs/RECO-POUR-VOUS.md : une page servie reste à l'écran tant qu'on y est.
 *
 * `useRecoPage` dit ce que le serveur sert (le cache, que `reco:update`, les
 * refetchs et les gestes renouvellent) ; ce crochet dit ce que l'écran
 * MONTRE. La page de l'arrivée tient jusqu'à la frontière suivante :
 *   • la visite suivante (un nouveau montage lit le cache du moment) ;
 *   • l'arrivée elle-même (`RECO_ARRIVAL_MS`) — la page du cache s'affiche
 *     aussitôt, la fraîche la remplace dans la foulée ;
 *   • le retour après une longue absence (`RECO_LONG_ABSENCE_MS`, fenêtre
 *     cachée ou app en arrière-plan) — il vaut une nouvelle arrivée ;
 *   • un geste : changer de filtre, `showNewer`, `refetch`.
 * Une page qui n'a encore rien de personnel (froid, construction) laisse
 * entrer la première page personnelle : c'est elle qu'on attendait.
 *
 * Seuls les titres qui SORTENT passent sous les yeux (refus, jugé puis lâché,
 * noté, demandé : `dropRecoItemEverywhere` le signale) — rien d'autre ne bouge.
 * Mêmes options et mêmes champs que `useRecoPage` : un écran passe de l'un à
 * l'autre sans rien changer d'autre.
 */
export function useRecoPageVisit(
  filter: readonly number[] | null | undefined,
  options: { enabled?: boolean } = {},
): RecoPageVisit {
  const query = useRecoPage(filter, options);
  const served = query.data;
  const [visit, setVisit] = useState<VisitState>(() => ({ shown: served, seen: served, arrivedAt: Date.now() }));

  // Chaque page servie est jugée une fois, AU RENDU (état dérivé) : un
  // changement de filtre arrive habillé, sans un rendu de l'ancienne page.
  let current = visit;
  if (served !== visit.seen) {
    const verdict = servedPageVerdict(visit.shown, served, { arriving: Date.now() - visit.arrivedAt < RECO_ARRIVAL_MS });
    current = { ...visit, seen: served, shown: verdict === "adopt" ? served : visit.shown };
    setVisit(current);
  }

  // Les titres sortis PENDANT la visite (la page tenue ne se relit plus dans le cache).
  const [removed, setRemoved] = useState<ReadonlySet<string>>(NO_REMOVALS);
  useEffect(
    () => subscribeRecoDropped((key) => setRemoved((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))),
    [],
  );

  // La dernière page servie, pour les gestes et le retour d'absence.
  const servedRef = useRef(served);
  useEffect(() => {
    servedRef.current = served;
  }, [served]);
  const adopt = useCallback((page: RecoPage | undefined, arrivedAt?: number) => {
    setVisit((prev) => ({
      shown: page ?? prev.shown,
      seen: page ?? prev.seen,
      arrivedAt: arrivedAt ?? prev.arrivedAt,
    }));
  }, []);

  // Le retour après une longue absence vaut une nouvelle arrivée. `focusManager`
  // suit la visibilité de la page (web) ou l'AppState (mobile, s'il est branché).
  useEffect(() => {
    let leftAt: number | null = focusManager.isFocused() ? null : Date.now();
    return focusManager.subscribe(() => {
      if (!focusManager.isFocused()) {
        leftAt ??= Date.now();
        return;
      }
      const away = leftAt === null ? 0 : Date.now() - leftAt;
      leftAt = null;
      if (away >= RECO_LONG_ABSENCE_MS) adopt(servedRef.current, Date.now());
    });
  }, [adopt]);

  const refetchQuery = query.refetch;
  const refetch = useCallback(async () => {
    const result = await refetchQuery();
    adopt(result.data);
    return result;
  }, [refetchQuery, adopt]);
  const showNewer = useCallback(() => adopt(servedRef.current), [adopt]);

  const data = useMemo(
    () => visibleRecoPage(current.shown, (key) => removed.has(key) || isRecoRetired(key) || isRecoDismissed(key)),
    [current.shown, removed],
  );
  // La page MONTRÉE est une source du lâcher (recoItemsOf) : un titre jugé que
  // le serveur a déjà écarté de sa page doit pouvoir partir d'ici.
  useEffect(() => (data ? registerShownRecoPage(data) : undefined), [data]);
  const placeholder = query.isPlaceholderData || (query as { isPreviousData?: boolean }).isPreviousData === true;
  const hasNewer = useMemo(
    () => !placeholder && served !== current.shown && hasNewRecoContent(data, served),
    [placeholder, served, current.shown, data],
  );

  return { data, isError: query.isError, isPlaceholderData: placeholder, refetch, hasNewer, showNewer };
}
