import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMyTitles, useRequestTitleSeasons, useSeasons, useTitleSeasons } from "@tentacle-tv/api-client";
import { librarySeasonNumbers, type TitleRequestOutcome } from "@tentacle-tv/shared";
import {
  SEASONS_APPLY_KEY,
  SEASONS_FOOTER_GROUP,
  SEASONS_SHEET_ENTRY_WAIT_MS,
  canSubmitSeasons,
  checkedSeasons,
  closesAtOnce,
  isAdvancing,
  isSeasonsFooterKey,
  panelBackLayers,
  panelPresented,
  seasonsSheetEntry,
  seasonsSheetFocusOf,
  seasonsSheetKeys,
  seasonsSheetReady,
  shortcutSeasons,
  toggleAllSeasons,
  toggleSeason,
} from "@tentacle-tv/tv-core";
import { useChoiceEntry } from "../../platform/tvos/panels/useChoiceEntry";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { FadingModal } from "../../redesign/motion/FadingModal";
import { SeasonsSheet } from "../../redesign/screens/requests/SeasonsSheet";
import { useBackLayer } from "../back/BackScope";
import { createEntryGuide } from "../focus/entryGuide";
import { useFocusStore } from "../focus/focusStore";
import { useRemoteEvents } from "../remote/remoteEvents";
import type { AbsentTitle } from "./absentTitle";
import { useLiveRefresh } from "./liveRequests";
import { requestableNumbers, seasonsSheetModel } from "./seasonsSheetModel";
import { useAppActive } from "./useAppActive";
import type { VigieGate } from "./useVigieGate";

/**
 * La feuille des saisons d'une série à demander (garde Vigie ouverte) : une
 * série absente, ou une série de la bibliothèque à qui il en manque
 * (`seriesId` : ses saisons présentes disent « Dans la bibliothèque » et ne
 * se cochent pas). OK sur la série l'ouvre ; dans la feuille, OK COCHE (la
 * ligne « Toutes les saisons manquantes » coche tout) et Lecture/Pause
 * DEMANDE — tout depuis « Toutes », sinon ce qui est coché, sinon la saison
 * focalisée (tv-core `shortcutSeasons`) ; « Demander N saisons » en bas fait
 * de même. La demande part (`useRequestTitleSeasons`, origine de la TV), la
 * feuille se ferme, et l'écran dit la suite (`onAnswer` : « Demande
 * envoyée », ou pourquoi pas).
 *
 * Dans une `Modal` (Menu la ferme ; à la fermeture, tvOS rend le focus à la
 * carte), présentée une fois les saisons SUES — et celles de la bibliothèque :
 * rien n'y déplace le focus après coup. Fermer joue d'abord sa sortie, un seul
 * fondu (`FadingModal`) ; `onClose` — et la réponse d'une demande — ne partent
 * qu'à sa fin. On y ENTRE par la saison choisie (`focus` : l'onglet grisé de
 * la fiche, déjà cochée), sinon par la première à cocher, sinon par la pilule
 * (`useChoiceEntry`) ; BAS depuis n'importe quelle ligne mène au pied
 * (`sheet:footer`). Un filet la présente quand même, sur sa lecture. Ces
 * règles sont celles de tv-core (`titles/seasonsSheet`, `seasonsShortcut`,
 * `panels/panelLifecycle`) ; ce câblage les applique.
 *
 * Les saisons de la demande du compte en cours disent son état et son
 * avancement, en direct (`useLiveRefresh` tant qu'elle avance).
 */

interface Props {
  gate: VigieGate;
  title: AbsentTitle;
  /** La série dans la bibliothèque : ses saisons présentes ne se cochent pas. */
  seriesId?: string;
  /** La saison par laquelle on entre, cochée d'avance (l'onglet grisé d'une fiche). */
  focus?: number;
  onAnswer: (title: AbsentTitle, outcome: TitleRequestOutcome, seasons: number[]) => void;
  onClose: () => void;
}

export function SeasonsSheetRedesign({ gate, title, seriesId, focus: focusSeason, onAnswer, onClose }: Props) {
  const { t } = useTranslation();
  const { answer, failed } = useTitleSeasons(gate.provider, title.key, gate.lang);
  const { mutateAsync: requestSeasons } = useRequestTitleSeasons(gate.provider, gate.lang, gate.origin);
  // Ce que la bibliothèque a de la série : attendu avant d'ouvrir (sans série, rien à attendre).
  const library = useSeasons(seriesId);
  const owned = useMemo(() => (seriesId ? librarySeasonNumbers(library.data ?? []) : null), [seriesId, library.data]);
  const ownedKnown = !seriesId || library.data !== undefined || library.isError;
  const [checked, setChecked] = useState<ReadonlySet<number>>(() => new Set(focusSeason !== undefined ? [focusSeason] : []));
  // La demande du compte sur cette série : ses saisons disent où elle en est, en direct.
  const { titles: mine, updatedAt } = useMyTitles(gate.provider, gate.lang);
  const appActive = useAppActive();
  const own = useMemo(() => {
    const found = mine?.find((m) => m.key === title.key);
    return found ? { mine: found, reading: { at: updatedAt, live: appActive } } : null;
  }, [mine, title.key, updatedAt, appActive]);
  useLiveRefresh(gate, appActive && own !== null && isAdvancing(own.mine.state));
  const sheet = useMemo(
    () => seasonsSheetModel(t, title.title, ownedKnown ? answer : null, failed, checked, owned, own),
    [t, title.title, ownedKnown, answer, failed, checked, owned, own],
  );

  // Fermer, c'est d'abord jouer la sortie ; `onClose` ne part qu'à sa fin —
  // tout de suite si la feuille n'a pas encore paru (saisons pas encore sues).
  const [closing, setClosing] = useState(false);
  const after = useRef<(() => void) | null>(null);
  const closed = useCallback(() => {
    onClose();
    after.current?.();
  }, [onClose]);
  const entry = useRef<string | null>(null);
  const requestClose = useCallback(() => {
    if (closesAtOnce("seasons", panelPresented(entry.current))) closed();
    else setClosing(true);
  }, [closed]);
  // Une couche « menu » de la pile du Retour : la Modal reçoit Menu elle-même
  // (`onRequestClose`), mais l'écran sait qu'un menu est ouvert.
  const [back] = panelBackLayers("seasons", closing);
  useBackLayer(back.kind, back.active, requestClose);

  const focus = useFocusStore();
  // Le pied de la liste, lié avant le premier rendu de la vue.
  useState(() => focus.bind(SEASONS_FOOTER_GROUP, { container: createEntryGuide(focus, { owns: isSeasonsFooterKey, fallback: () => SEASONS_APPLY_KEY }) }));
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), SEASONS_SHEET_ENTRY_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  const numbers = useMemo(() => (ownedKnown ? requestableNumbers(answer, owned) : []), [ownedKnown, answer, owned]);
  const keys = useMemo(() => seasonsSheetKeys(numbers), [numbers]);
  // L'entrée : décidée une fois les saisons sues (ou le filet écoulé), figée ensuite.
  if (entry.current === null && seasonsSheetReady({ answered: answer !== null, ownedKnown, failed, waited })) {
    entry.current = seasonsSheetEntry(numbers, focusSeason);
  }
  useChoiceEntry(focus, keys, entry.current);

  const onToggle = useCallback((number: number) => setChecked((current) => toggleSeason(current, number)), []);

  const onToggleAll = useCallback(() => setChecked((current) => toggleAllSeasons(numbers, current)), [numbers]);

  const sending = useRef(false);
  const submit = useCallback(async (seasons: number[]) => {
    if (!canSubmitSeasons(seasons, sending.current)) return;
    sending.current = true;
    try {
      const outcome = await requestSeasons({ key: title.key, seasons });
      after.current = () => onAnswer(title, outcome, seasons);
    } catch {
      after.current = () => onAnswer(title, { kind: "done", ok: false, message: null, state: null }, seasons);
    } finally {
      sending.current = false;
    }
    requestClose();
  }, [requestSeasons, title, onAnswer, requestClose]);
  const onSubmit = useCallback(() => void submit(checkedSeasons(numbers, checked)), [submit, numbers, checked]);

  // Lecture/Pause : la feuille ouverte, un appui simple (jamais l'appui maintenu).
  const ticked = useRef(checked);
  ticked.current = checked;
  useRemoteEvents((event) => {
    if (event.kind !== "press" || event.button !== "playPause" || event.long) return;
    void submit(shortcutSeasons(numbers, ticked.current, seasonsSheetFocusOf(focus.focusedKey())));
  }, panelPresented(entry.current) && !closing);

  return (
    <FadingModal value={panelPresented(entry.current) && !closing ? sheet : null} onRequestClose={requestClose} onExited={closed}>
      {(shown, leaving) => (
        <FocusBindingProvider bind={focus.binder}>
          <SeasonsSheet
            sheet={shown}
            onToggle={leaving ? undefined : onToggle}
            onToggleAll={leaving ? undefined : onToggleAll}
            onSubmit={leaving ? undefined : onSubmit}
            onClose={leaving ? undefined : requestClose}
          />
        </FocusBindingProvider>
      )}
    </FadingModal>
  );
}
