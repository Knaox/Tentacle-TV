import { useCallback, useState } from "react";
import { Modal } from "react-native";
import { useRecoSettings } from "@tentacle-tv/api-client";
import type { CardSheetTarget } from "../../components/cards/actions/cardSheetTarget";
import { FocusBindingProvider, type FocusBinding } from "../../redesign/focus/focusBinding";
import { ActionSheetView, type SheetActionKind } from "../../redesign/screens/sheet/ActionSheetView";
import { useFocusStore } from "../focus/focusStore";
import { useChoiceEntry } from "../settings/settingsFocus";
import { useSheetModel, type SheetMode } from "./useSheetModel";

/**
 * La feuille d'actions refondue (Apple TV) : `ActionSheetView` dans une
 * `Modal` de React Native, comme l'ancienne.
 *
 * - La `Modal` PIÈGE le focus (contrôleur présenté sur tvOS) et reçoit le
 *   bouton Menu par `onRequestClose` — le seul chemin par lequel il atteint
 *   le JS sans `usePreventRemove` ; à sa fermeture, tvOS rend le focus à la
 *   carte d'où elle vient.
 * - L'ENTRÉE est le choix de tvOS lui-même : dans une `Modal`,
 *   `hasTVPreferredFocus` est sans effet (la racine React est introuvable
 *   depuis le contrôleur présenté — cf. `settingsFocus.tsx`) ; tvOS prend
 *   l'élément le plus proche du coin haut-gauche : la première action (la
 *   croix est à droite).
 * - La NOTE : « Noter » ouvre l'échelle verticale à la place de la liste.
 *   Elle s'entre sur la note posée, sinon sur 6 — jamais sur un bout, qu'un
 *   OK réflexe validerait —, par le verrou des listes de choix
 *   (`useChoiceEntry` : les autres crans ne se focalisent qu'après le premier
 *   focus). OK note et revient à la liste, sur « Noter » (même verrou) ; Menu
 *   y revient sans rien changer. Le mode `rate` (le bouton « Noter » de la
 *   fiche) ouvre directement sur l'échelle : OK note et ferme, Menu ferme.
 * - Le port du focus pose la garde anti-clic fantôme sur les actions et la
 *   croix : la feuille s'ouvre sous un OK encore enfoncé (l'appui long), dont
 *   le relâchement ne doit rien valider.
 */

interface Props {
  target: CardSheetTarget;
  /** `rate` : la note seule — le bouton « Noter » de la fiche. */
  mode?: SheetMode;
  onClose: () => void;
}

const SCORES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const SCALE_KEYS = [...SCORES.map((score) => `sheet:scale:${score}`), "sheet:scale:remove"];
/** Le cran d'entrée sans note posée : trois étoiles, au milieu. */
const DEFAULT_SCORE = 6;

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
  const focus = useFocusStore();
  const rateOnly = mode === "rate";
  const [ratingOpen, setRatingOpen] = useState(rateOnly);
  // Revenue de l'échelle, la liste s'entre sur « Noter » ; à l'ouverture, sur la 1re action (tvOS).
  const [back, setBack] = useState(false);
  const current = model.rating?.current ?? null;
  const entryKey = ratingOpen ? `sheet:scale:${current ?? DEFAULT_SCORE}` : back ? "sheet:action:rate" : null;
  // Tout ce qui pourrait prendre le focus à sa place est verrouillé le temps du premier focus.
  const actionKeys = model.actions.map((action) => `sheet:action:${action.kind}`);
  const releases = useChoiceEntry(focus, [...SCALE_KEYS, ...actionKeys, "sheet:close"], entryKey);

  // Une identité neuve à chaque libération du verrou : les éléments relisent leur liaison.
  const bind = useCallback(
    (key: string): FocusBinding | undefined => {
      const binding = focus.binder(key);
      const guarded = key.startsWith("sheet:action:") || key === "sheet:close";
      return guarded ? { ...binding, phantomPressGuard: true } : binding;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [focus, releases],
  );

  const closeScale = useCallback(() => {
    setRatingOpen(false);
    setBack(true);
  }, []);
  const { onAction, onRate } = model;
  const act = useCallback(
    (kind: SheetActionKind) => {
      if (kind !== "rate") return onAction?.(kind);
      // Une cible encore en résolution (la série d'un épisode) : rien à noter.
      if (!model.rating?.pending) setRatingOpen(true);
    },
    [onAction, model.rating?.pending],
  );
  const rate = useCallback(
    (score: number | null) => {
      onRate?.(score);
      if (rateOnly) onClose();
      else closeScale();
    },
    [onRate, rateOnly, onClose, closeScale],
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={ratingOpen && !rateOnly ? closeScale : onClose}>
      <FocusBindingProvider bind={bind}>
        <ActionSheetView {...model} ratingOpen={ratingOpen} onAction={act} onRate={rate} />
      </FocusBindingProvider>
    </Modal>
  );
}
