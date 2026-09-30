import { useCallback } from "react";
import { Modal, TVFocusGuideView } from "react-native";
import { useRecoSettings } from "@tentacle-tv/api-client";
import type { CardSheetTarget } from "../../components/cards/actions/cardSheetTarget";
import {
  FocusBindingProvider,
  type FocusBinding,
  type FocusGroupContainerProps,
} from "../../redesign/focus/focusBinding";
import { ActionSheetView } from "../../redesign/screens/sheet/ActionSheetView";
import { useSheetModel, type SheetMode } from "./useSheetModel";

/**
 * La feuille d'actions refondue (Apple TV) : `ActionSheetView` dans une
 * `Modal` de React Native, comme l'ancienne.
 *
 * - La `Modal` PIÈGE le focus (contrôleur présenté sur tvOS) et reçoit le
 *   bouton Menu par `onRequestClose` — le seul chemin par lequel il atteint
 *   le JS sans `usePreventRemove` ; à sa fermeture, tvOS rend le focus à la
 *   carte d'où elle vient.
 * - Le port du focus pose l'ENTRÉE sur la première action (sur la première
 *   étoile quand la feuille n'a que la note), et la garde anti-clic fantôme
 *   sur toutes ses clés : la feuille s'ouvre sous un OK encore enfoncé
 *   (l'appui long), dont le relâchement ne doit rien valider.
 * - Les étoiles s'entrent par la première, puis par la dernière visitée
 *   (guide `autoFocus`) : sans lui, BAS depuis la dernière action tombait sur
 *   l'étoile d'en dessous — la cinquième, et OK notait 10/10.
 */

interface Props {
  target: CardSheetTarget;
  /** `rate` : la note seule — le bouton « Noter » de la fiche. */
  mode?: SheetMode;
  onClose: () => void;
}

const GUARDED: FocusBinding = { phantomPressGuard: true };
const ENTRY: FocusBinding = { phantomPressGuard: true, native: { hasTVPreferredFocus: true } };

function StarsGuide({ style, pointerEvents, children }: FocusGroupContainerProps) {
  return (
    <TVFocusGuideView autoFocus style={style} pointerEvents={pointerEvents}>
      {children}
    </TVFocusGuideView>
  );
}
const STARS: FocusBinding = { container: StarsGuide };

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

function SheetBody({ target, mode, providerFilterActive, onClose }: Required<Props> & { providerFilterActive: boolean }) {
  const model = useSheetModel({ target, mode, providerFilterActive, onClose });
  const first = model.actions[0];
  const entryKey = first ? `sheet:action:${first.kind}` : "sheet:star:1";
  const bind = useCallback(
    (key: string) => {
      if (key === "sheet:stars") return STARS;
      return key.startsWith("sheet:") ? (key === entryKey ? ENTRY : GUARDED) : undefined;
    },
    [entryKey],
  );
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <FocusBindingProvider bind={bind}>
        <ActionSheetView {...model} />
      </FocusBindingProvider>
    </Modal>
  );
}
