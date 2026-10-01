import { useCallback, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  loadTitleState,
  myTitlesQueryKey,
  tentacleApiFetch,
  titleStateQueryKey,
  useMyTitles,
  useRequestTitle,
} from "@tentacle-tv/api-client";
import { parseTitleKey, withMyTitle, type MyTitle, type TitleRequestOutcome, type TitleState } from "@tentacle-tv/shared";
import { showNotice } from "../overlays/transientNotice";
import { AbsentSheetRedesign } from "./AbsentSheetRedesign";
import { mineLabel, sayable } from "./absentStates";
import { requestedTitle, type AbsentTitle } from "./absentTitle";
import { SeasonsSheetRedesign } from "./SeasonsSheetRedesign";
import { useVigieGate, type VigieGate } from "./useVigieGate";

/**
 * LE geste « demander » d'un titre absent de la bibliothèque, sur Apple TV —
 * pour la collection d'un film et la rangée « À demander » de la recherche,
 * et rien d'autre. `null` tant que la garde Vigie est fermée : l'écran garde
 * alors son « pas disponible ».
 *
 * OK sur un titre absent :
 * - le compte l'a déjà demandé → son état, et l'invite à le suivre sur le
 *   téléphone — jamais une seconde demande ;
 * - un film que l'extension offre de demander → la demande, en UN geste, puis
 *   « Demande envoyée » ; elle paraît aussitôt dans les demandes du compte
 *   (`withMyTitle`), et son badge change ;
 * - une série → la feuille de ses saisons (`SeasonsSheetRedesign`), si
 *   l'extension sait les dire (`titles.seasons`) ;
 * - rien à demander → l'état que dit l'extension et la même invite, sinon
 *   « pas disponible ».
 * L'appui maintenu ouvre le grand panneau du titre (`AbsentSheetRedesign`).
 * Les feuilles se rendent DANS l'écran (`overlay`) : le focus revient à la
 * carte quand elles se ferment.
 */

export interface TitleRequests {
  gate: VigieGate;
  open: (title: AbsentTitle) => void;
  hold: (title: AbsentTitle) => void;
  overlay: ReactElement | null;
}

const fetcher = (url: string) => tentacleApiFetch(url);
/** Entre le retrait d'une `Modal` et la présentation de la suivante. */
const MODAL_GAP_MS = 320;

export function useTitleRequests(): TitleRequests | null {
  const { t } = useTranslation();
  const gate = useVigieGate();
  const provider = gate?.provider ?? null;
  const lang = gate?.lang ?? "fr";
  const qc = useQueryClient();
  const { titles: mine } = useMyTitles(provider, lang, { enabled: gate !== null });
  const { mutateAsync: requestTitle } = useRequestTitle(provider, lang);
  const [seasonsOf, setSeasonsOf] = useState<AbsentTitle | null>(null);
  const [held, setHeld] = useState<AbsentTitle | null>(null);
  const busy = useRef(new Set<string>());

  // Les gestes lisent l'état du moment sans changer d'identité.
  const latest = useRef({ gate, mine, t });
  latest.current = { gate, mine, t };

  /** La demande partie : l'avis, et la liste des demandes du compte qui la montre aussitôt. */
  const confirm = useCallback((title: AbsentTitle, seasons: number[] | null) => {
    const { gate: g, t: tr } = latest.current;
    const entry = requestedTitle(title, seasons);
    if (g && entry) qc.setQueryData<MyTitle[]>(myTitlesQueryKey(g.provider, g.lang), (list) => withMyTitle(list ?? [], entry));
    showNotice({ kind: "success", title: tr("cards:requestSent"), text: tr("requests:followOnPhone") });
  }, [qc]);

  /** La réponse d'une demande, dite : partie, déjà faite (son état), ou refusée (la phrase de l'extension). */
  const answer = useCallback((title: AbsentTitle, outcome: TitleRequestOutcome, seasons: number[] | null) => {
    const { t: tr } = latest.current;
    if (outcome.kind === "done" && outcome.ok) return confirm(title, seasons);
    const badge = outcome.kind === "done" ? outcome.state?.badge : null;
    if (badge) return showNotice({ kind: "info", title: badge.label, text: tr("requests:followOnPhone") });
    const message = outcome.kind === "done" ? sayable(outcome.message) : null;
    showNotice({ kind: "error", title: tr("cards:requestFailed"), text: message ?? undefined });
  }, [confirm]);

  const open = useCallback(async (title: AbsentTitle) => {
    const { gate: g, mine: m, t: tr } = latest.current;
    if (!g || busy.current.has(title.key)) return;
    const already = m?.find((x) => x.key === title.key);
    if (already) return showNotice({ kind: "info", title: mineLabel(tr, already), text: tr("requests:followOnPhone") });
    busy.current.add(title.key);
    try {
      const state = await qc.fetchQuery<TitleState | null>({
        queryKey: titleStateQueryKey(g.provider, g.lang, title.key),
        queryFn: () => loadTitleState(g.provider, title.key, g.lang, fetcher),
        staleTime: 60_000,
      });
      const offer = state?.request;
      if (offer?.mode === "direct") return answer(title, await requestTitle(title.key), null);
      const series = parseTitleKey(title.key)?.mediaType === "tv";
      if (offer?.mode === "open" && series && g.provider.seasonsPath !== null) return setSeasonsOf(title);
      if (state?.badge) return showNotice({ kind: "info", title: state.badge.label, text: tr("requests:followOnPhone") });
      showNotice({ kind: "info", title: tr("cards:notInLibraryNotice") });
    } catch {
      showNotice({ kind: "error", title: tr("cards:requestFailed") });
    } finally {
      busy.current.delete(title.key);
    }
  }, [qc, requestTitle, answer]);

  const openTitle = useCallback((title: AbsentTitle) => void open(title), [open]);
  const hold = useCallback((title: AbsentTitle) => setHeld(title), []);
  const closeSeasons = useCallback(() => setSeasonsOf(null), []);
  const closeHeld = useCallback(() => setHeld(null), []);

  // Du grand panneau : « Demander » referme le panneau, puis fait le geste
  // d'OK — un temps après : une `Modal` présentée pendant le retrait de la
  // précédente ne paraît pas (la feuille des saisons d'une série).
  const requestFromSheet = useCallback((title: AbsentTitle) => {
    setHeld(null);
    setTimeout(() => void open(title), MODAL_GAP_MS);
  }, [open]);

  const overlay = gate ? (
    <>
      {seasonsOf ? <SeasonsSheetRedesign gate={gate} title={seasonsOf} onAnswer={answer} onClose={closeSeasons} /> : null}
      {held ? <AbsentSheetRedesign gate={gate} title={held} onRequest={requestFromSheet} onClose={closeHeld} /> : null}
    </>
  ) : null;

  // `open` et `hold` sont stables : les rangées mémoïsées ne se redessinent pas pour eux.
  return gate ? { gate, open: openTitle, hold, overlay } : null;
}
