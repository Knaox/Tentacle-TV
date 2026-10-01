import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "react-native";
import { useTranslation } from "react-i18next";
import { useRequestTitleSeasons, useTitleSeasons } from "@tentacle-tv/api-client";
import type { TitleRequestOutcome } from "@tentacle-tv/shared";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { SeasonsSheet, seasonFocusKey } from "../../redesign/screens/requests/SeasonsSheet";
import { useBackLayer } from "../back/BackScope";
import { createEntryGuide } from "../focus/entryGuide";
import { useFocusStore } from "../focus/focusStore";
import { useChoiceEntry } from "../settings/settingsFocus";
import type { AbsentTitle } from "./absentTitle";
import { requestableNumbers, seasonsSheetModel } from "./seasonsSheetModel";
import type { VigieGate } from "./useVigieGate";

/**
 * La feuille des saisons d'une série absente (garde Vigie ouverte) : OK sur
 * la série l'ouvre, on coche, « Demander N saisons » en bas — la demande part
 * (`useRequestTitleSeasons`), la feuille se ferme, et l'écran dit la suite
 * (`onAnswer` : « Demande envoyée », ou pourquoi pas).
 *
 * Dans une `Modal` (Menu la ferme ; à la fermeture, tvOS rend le focus à la
 * carte), présentée une fois les saisons SUES : rien n'y déplace le focus
 * après coup. On y ENTRE par la première saison à cocher, sinon par la pilule
 * (`useChoiceEntry`) ; BAS depuis n'importe quelle ligne mène au pied
 * (`sheet:footer`). Un filet la présente quand même, sur sa lecture.
 */

const APPLY_KEY = "sheet:apply";
const isFooterKey = (key: string) => key === APPLY_KEY;
/** Le filet : des saisons qui tardent ne retiennent pas la feuille. */
const ENTRY_WAIT_MS = 1500;

interface Props {
  gate: VigieGate;
  title: AbsentTitle;
  onAnswer: (title: AbsentTitle, outcome: TitleRequestOutcome, seasons: number[]) => void;
  onClose: () => void;
}

export function SeasonsSheetRedesign({ gate, title, onAnswer, onClose }: Props) {
  const { t } = useTranslation();
  const { answer, failed } = useTitleSeasons(gate.provider, title.key, gate.lang);
  const { mutateAsync: requestSeasons } = useRequestTitleSeasons(gate.provider, gate.lang);
  const [checked, setChecked] = useState<ReadonlySet<number>>(() => new Set());
  const sheet = useMemo(() => seasonsSheetModel(t, title.title, answer, failed, checked), [t, title.title, answer, failed, checked]);

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
  const numbers = useMemo(() => requestableNumbers(answer), [answer]);
  const keys = useMemo(() => [...numbers.map(seasonFocusKey), APPLY_KEY], [numbers]);
  // L'entrée : décidée une fois les saisons sues (ou le filet écoulé), figée ensuite.
  const entry = useRef<string | null>(null);
  if (entry.current === null && (answer !== null || failed || waited)) {
    entry.current = numbers.length > 0 ? seasonFocusKey(numbers[0]) : APPLY_KEY;
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
