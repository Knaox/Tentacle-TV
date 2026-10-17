import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { focusManager } from "@tanstack/react-query";
import { useRecoPage, type RecoPage } from "../hooks/useRecoPage";
import {
  RECO_ARRIVAL_MS,
  RECO_LONG_ABSENCE_MS,
  hasNewRecoContent,
  recoPageFilterKey,
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
  /** L'empreinte de la dernière page servie déjà jugée (`servedStampOf`) — une page
   *  servie ne se juge qu'une fois. */
  seen: string;
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
/**
 * Ce qui RECONNAÎT une page servie : son CONTENU — filtre, état du moteur,
 * rangées et titres, « à la une » — et si c'est une donnée de remplacement
 * (page précédente gardée pendant un changement de clé). Jamais l'identité de
 * l'objet seule : juste après un changement de clé, TanStack v4 (la TV)
 * recalcule `select` à CHAQUE rendu tant que l'effet qui passe à la nouvelle
 * requête n'a pas tourné — un objet neuf par rendu, et l'état posé au rendu
 * ci-dessous bouclait (« Too many re-renders », lot 1017, à la bascule de
 * « Tendances actuelles »). Ni la date de la donnée : deux pages posées dans
 * la même milliseconde se confondraient.
 */
export function servedStampOf(served: RecoPage | undefined, placeholder: boolean): string {
  if (!served) return "none";
  const rows = served.rows.map((row) => `${row.key}:${row.items.map((item) => item.key).join(",")}`).join(";");
  const flags = [served.state, served.generating, served.refining, served.exploring, served.tmdbConfigured, served.personalized];
  return [placeholder ? "p" : "d", recoPageFilterKey(served), flags.join(","), served.featured?.item.key ?? "", rows].join("|");
}

export function useRecoPageVisit(
  filter: readonly number[] | null | undefined,
  options: { enabled?: boolean } = {},
): RecoPageVisit {
  const query = useRecoPage(filter, options);
  const served = query.data;
  const placeholder = query.isPlaceholderData || (query as { isPreviousData?: boolean }).isPreviousData === true;
  // Recalculée seulement quand l'objet servi change (quelques rendus, au plus, après une bascule).
  const stamp = useMemo(() => servedStampOf(served, placeholder), [served, placeholder]);
  const [visit, setVisit] = useState<VisitState>(() => ({ shown: served, seen: stamp, arrivedAt: Date.now() }));

  // Chaque page servie est jugée une fois, AU RENDU (état dérivé) : un
  // changement de filtre arrive habillé, sans un rendu de l'ancienne page.
  let current = visit;
  if (stamp !== visit.seen) {
    const verdict = servedPageVerdict(visit.shown, served, { arriving: Date.now() - visit.arrivedAt < RECO_ARRIVAL_MS });
    current = { ...visit, seen: stamp, shown: verdict === "adopt" ? served : visit.shown };
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
  const stampRef = useRef(stamp);
  useEffect(() => {
    servedRef.current = served;
    stampRef.current = stamp;
  }, [served, stamp]);
  // La page adoptée par un geste vaut jugée : c'est la dernière servie (son empreinte).
  const adopt = useCallback((page: RecoPage | undefined, arrivedAt?: number) => {
    setVisit((prev) => ({
      shown: page ?? prev.shown,
      seen: page ? stampRef.current : prev.seen,
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
  const hasNewer = useMemo(
    () => !placeholder && served !== current.shown && hasNewRecoContent(data, served),
    [placeholder, served, current.shown, data],
  );

  return { data, isError: query.isError, isPlaceholderData: placeholder, refetch, hasNewer, showNewer };
}
