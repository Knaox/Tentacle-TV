import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "react-native";
import { useRecoSettings } from "@tentacle-tv/api-client";
import type { CardSheetTarget } from "../../components/cards/actions/cardSheetTarget";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { ActionSheetView } from "../../redesign/screens/sheet/ActionSheetView";
import { useFocusStore } from "../focus/focusStore";
import { firstPictoOf, sheetEntryOf, useSheetFocus } from "./sheetFocus";
import { useSheetModel, type SheetMode } from "./useSheetModel";

/**
 * Le grand panneau de l'appui maintenu (Apple TV) : `ActionSheetView` dans une
 * `Modal` de React Native.
 *
 * - La `Modal` PIÈGE le focus (contrôleur présenté sur tvOS) et reçoit le
 *   bouton Menu par `onRequestClose` — le seul chemin par lequel il atteint
 *   le JS sans `usePreventRemove` ; Menu ferme. À la fermeture, tvOS rend le
 *   focus à la carte d'où il vient.
 * - Le FOCUS — l'entrée, les guides des groupes, la garde anti-clic
 *   fantôme — est celui de `sheetFocus` (commun avec le banc). L'entrée se
 *   décide quand la note est CONNUE (la fiche complète, la liste des notes,
 *   la série d'un épisode) et ne bouge plus ensuite : noter ne déplace pas le
 *   focus. Et rien, dans une `Modal` présentée, ne déplace plus le focus : le
 *   panneau ne se PRÉSENTE qu'une fois son entrée décidée — mesuré en réel,
 *   décidée trop tôt (note pas encore sue), elle tombait sur « Lire ». Un
 *   filet (`ENTRY_WAIT_MS`) le présente quand même, sur le premier picto.
 * - Le mode `rate` (le bouton « Noter » de la fiche) : l'échelle seule ; OK
 *   note et ferme.
 * - La SORTIE : fermer (Menu, la croix, une action qui quitte) joue d'abord
 *   la sortie du panneau (`closing`), et la `Modal` — présentée sans
 *   animation système, le panneau ayant la sienne — ne se retire qu'au bout
 *   (`onClosed`). Une action qui navigue pousse son écran pendant ce temps.
 */

interface Props {
  target: CardSheetTarget;
  /** `rate` : la note seule — le bouton « Noter » de la fiche. */
  mode?: SheetMode;
  onClose: () => void;
}

/** Filet : une note qui tarde à se savoir ne retient pas le panneau plus longtemps. */
const ENTRY_WAIT_MS = 1200;

export function ActionSheetRedesign({ target, mode = "actions", onClose }: Props) {
  if (target.kind === "reco") return <RecoSheet target={target} onClose={onClose} />;
  return <SheetBody target={target} mode={mode} providerFilterActive={false} onClose={onClose} />;
}

/** Les réglages reco ne se lisent que pour une carte reco : « Toutes les plateformes » en dépend. */
function RecoSheet({ target, onClose }: { target: CardSheetTarget; onClose: () => void }) {
  const { data: settings } = useRecoSettings();
  const filtered = (settings?.providerFilter.length ?? 0) > 0;
  return <SheetBody target={target} mode="actions" providerFilterActive={filtered} onClose={onClose} />;
}

/** Vrai une fois `ms` écoulées depuis le montage. */
function useElapsed(ms: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setElapsed(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return elapsed;
}

function SheetBody({ target, mode, providerFilterActive, onClose }: Required<Props> & { providerFilterActive: boolean }) {
  // Fermer, c'est d'abord jouer la sortie ; `onClose` ne part qu'à sa fin.
  const [closing, setClosing] = useState(false);
  const requestClose = useCallback(() => setClosing(true), []);
  const model = useSheetModel({ target, mode, providerFilterActive, onClose: requestClose });
  const focus = useFocusStore();
  const rateOnly = mode === "rate";
  const { rating, actions } = model;

  // Décidée une fois, figée ensuite ; le filet écoulé, sur le premier picto.
  const waited = useElapsed(ENTRY_WAIT_MS);
  const entry = useRef<string | null>(null);
  if (entry.current === null) entry.current = sheetEntryOf(rating, actions) ?? (waited ? firstPictoOf(actions) : null);
  const bind = useSheetFocus(focus, { rating, actions, entry: entry.current });

  const { onRate } = model;
  const rate = useCallback(
    (score: number | null) => {
      onRate?.(score);
      if (rateOnly) requestClose();
    },
    [onRate, rateOnly, requestClose],
  );

  return (
    <Modal visible={entry.current !== null} transparent animationType="none" onRequestClose={requestClose}>
      <FocusBindingProvider bind={bind}>
        <ActionSheetView {...model} onRate={rate} closing={closing} onClosed={onClose} />
      </FocusBindingProvider>
    </Modal>
  );
}
