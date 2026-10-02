import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "react-native";
import { useTranslation } from "react-i18next";
import { useMyTitles, useRequestTitleSeasons, useSeasons, useTitleSeasons } from "@tentacle-tv/api-client";
import { librarySeasonNumbers, type TitleRequestOutcome } from "@tentacle-tv/shared";
import { isAdvancing } from "@tentacle-tv/tv-core";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { SeasonsSheet, seasonFocusKey } from "../../redesign/screens/requests/SeasonsSheet";
import { useBackLayer } from "../back/BackScope";
import { createEntryGuide } from "../focus/entryGuide";
import { useFocusStore } from "../focus/focusStore";
import { useChoiceEntry } from "../settings/settingsFocus";
import type { AbsentTitle } from "./absentTitle";
import { useLiveRefresh } from "./liveRequests";
import { requestableNumbers, seasonsSheetModel } from "./seasonsSheetModel";
import { useAppActive } from "./useAppActive";
import type { VigieGate } from "./useVigieGate";

/**
 * La feuille des saisons d'une série à demander (garde Vigie ouverte) : une
 * série absente, ou une série de la bibliothèque à qui il en manque
 * (`seriesId` : ses saisons présentes disent « Dans la bibliothèque » et ne
 * se cochent pas). OK sur la série l'ouvre, on coche, « Demander N saisons »
 * en bas — la demande part (`useRequestTitleSeasons`), la feuille se ferme, et
 * l'écran dit la suite (`onAnswer` : « Demande envoyée », ou pourquoi pas).
 *
 * Dans une `Modal` (Menu la ferme ; à la fermeture, tvOS rend le focus à la
 * carte), présentée une fois les saisons SUES — et celles de la bibliothèque :
 * rien n'y déplace le focus après coup. On y ENTRE par la saison choisie
 * (`focus` : l'onglet grisé de la fiche, déjà cochée), sinon par la première
 * à cocher, sinon par la pilule (`useChoiceEntry`) ; BAS depuis n'importe
 * quelle ligne mène au pied (`sheet:footer`). Un filet la présente quand
 * même, sur sa lecture.
 *
 * Les saisons de la demande du compte en cours disent son état et son
 * avancement, en direct (`useLiveRefresh` tant qu'elle avance).
 */

const APPLY_KEY = "sheet:apply";
const isFooterKey = (key: string) => key === APPLY_KEY;
/** Le filet : des saisons qui tardent ne retiennent pas la feuille. */
const ENTRY_WAIT_MS = 1500;

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
  const { mutateAsync: requestSeasons } = useRequestTitleSeasons(gate.provider, gate.lang);
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

  // Une couche « menu » de la pile du Retour : la Modal reçoit Menu elle-même
  // (`onRequestClose`), mais l'écran sait qu'un menu est ouvert.
  useBackLayer("menu", true, onClose);

  const focus = useFocusStore();
  // Le pied de la liste, lié avant le premier rendu de la vue.
  useState(() => focus.bind("sheet:footer", { container: createEntryGuide(focus, { owns: isFooterKey, fallback: () => APPLY_KEY }) }));
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), ENTRY_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  const numbers = useMemo(() => (ownedKnown ? requestableNumbers(answer, owned) : []), [ownedKnown, answer, owned]);
  const keys = useMemo(() => [...numbers.map(seasonFocusKey), APPLY_KEY], [numbers]);
  // L'entrée : décidée une fois les saisons sues (ou le filet écoulé), figée ensuite.
  const entry = useRef<string | null>(null);
  if (entry.current === null && ((answer !== null && ownedKnown) || failed || waited)) {
    const first = focusSeason !== undefined && numbers.includes(focusSeason) ? focusSeason : numbers[0];
    entry.current = first !== undefined ? seasonFocusKey(first) : APPLY_KEY;
  }
  useChoiceEntry(focus, keys, entry.current);

  const onToggle = useCallback((number: number) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });
  }, []);

  const sending = useRef(false);
  const onSubmit = useCallback(async () => {
    const seasons = numbers.filter((n) => checked.has(n));
    if (sending.current || seasons.length === 0) return;
    sending.current = true;
    try {
      const outcome = await requestSeasons({ key: title.key, seasons });
      onClose();
      onAnswer(title, outcome, seasons);
    } catch {
      onClose();
      onAnswer(title, { kind: "done", ok: false, message: null, state: null }, seasons);
    } finally {
      sending.current = false;
    }
  }, [numbers, checked, requestSeasons, title, onClose, onAnswer]);

  return (
    <Modal visible={entry.current !== null} transparent animationType="none" onRequestClose={onClose}>
      <FocusBindingProvider bind={focus.binder}>
        <SeasonsSheet sheet={sheet} onToggle={onToggle} onSubmit={onSubmit} onClose={onClose} />
      </FocusBindingProvider>
    </Modal>
  );
}
