import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "react-native";
import { useRecoSettings } from "@tentacle-tv/api-client";
import type { CardSheetTarget } from "../../components/cards/actions/cardSheetTarget";
import { FocusBindingProvider, type FocusBinding } from "../../redesign/focus/focusBinding";
import {
  ActionSheetView,
  RATING_ENTRY,
  SCALE_FOCUS_KEYS,
  scaleFocusKey,
  type SheetActionModel,
  type SheetRatingModel,
} from "../../redesign/screens/sheet/ActionSheetView";
import { createEntryGuide } from "../focus/entryGuide";
import { useFocusStore, type FocusStore } from "../focus/focusStore";
import { useChoiceEntry } from "../settings/settingsFocus";
import { useSheetModel, type SheetMode } from "./useSheetModel";

/**
 * Le grand panneau de l'appui maintenu (Apple TV) : `ActionSheetView` dans une
 * `Modal` de React Native.
 *
 * - La `Modal` PIÈGE le focus (contrôleur présenté sur tvOS) et reçoit le
 *   bouton Menu par `onRequestClose` — le seul chemin par lequel il atteint
 *   le JS sans `usePreventRemove` ; Menu ferme. À la fermeture, tvOS rend le
 *   focus à la carte d'où il vient.
 * - L'ENTRÉE : l'échelle de la note, sur la note posée, sinon sur 5/10
 *   (`RATING_ENTRY`) ; sans note à poser, le premier picto. Dans une `Modal`,
 *   aucune préférence de focus n'est honorée : les autres cibles restent
 *   infocalisables jusqu'au premier focus (`useChoiceEntry`). L'entrée se
 *   décide quand la note est CONNUE (la liste des notes, la série d'un
 *   épisode) et ne bouge plus ensuite : noter ne déplace pas le focus.
 * - Les GROUPES ont un guide d'entrée : HAUT depuis un picto revient sur la
 *   note posée (sinon 5), pas sur le cran qui se trouve au-dessus ; BAS depuis
 *   l'échelle entre dans les pictos par la lecture, puis par le dernier visité.
 * - La garde anti-clic fantôme couvre l'échelle, les pictos et la croix : le
 *   panneau s'ouvre sous un OK encore enfoncé (l'appui long), dont le
 *   relâchement ne doit rien valider — surtout pas une note.
 * - Le mode `rate` (le bouton « Noter » de la fiche) : l'échelle seule ; OK
 *   note et ferme.
 */

interface Props {
  target: CardSheetTarget;
  /** `rate` : la note seule — le bouton « Noter » de la fiche. */
  mode?: SheetMode;
  onClose: () => void;
}

const actionKey = (kind: SheetActionModel["kind"]) => `sheet:action:${kind}`;
const GUARDED = /^sheet:(action|scale):|^sheet:close$/;

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

/** L'entrée du panneau, une fois la note connue ; null tant qu'elle se résout. */
function entryOf(rating: SheetRatingModel | null | undefined, actions: SheetActionModel[]): string | null {
  if (rating?.pending) return null;
  if (rating) return scaleFocusKey(rating.current ?? RATING_ENTRY);
  return actions[0] ? actionKey(actions[0].kind) : "sheet:close";
}

function SheetBody({ target, mode, providerFilterActive, onClose }: Required<Props> & { providerFilterActive: boolean }) {
  const model = useSheetModel({ target, mode, providerFilterActive, onClose });
  const focus = useFocusStore();
  const rateOnly = mode === "rate";
  const { rating, actions } = model;

  // Décidée une fois, figée ensuite.
  const entry = useRef<string | null>(null);
  if (entry.current === null) entry.current = entryOf(rating, actions);
  const releases = useChoiceEntry(focus, [...SCALE_FOCUS_KEYS, ...actions.map((a) => actionKey(a.kind)), "sheet:close"], entry.current);
  useGroupGuides(focus, rating, actions);

  // Une identité neuve à chaque libération du verrou : les éléments relisent leur liaison.
  const bind = useCallback(
    (key: string): FocusBinding | undefined => {
      const binding = focus.binder(key);
      return GUARDED.test(key) ? { ...binding, phantomPressGuard: true } : binding;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [focus, releases],
  );

  const { onRate } = model;
  const rate = useCallback(
    (score: number | null) => {
      onRate?.(score);
      if (rateOnly) onClose();
    },
    [onRate, rateOnly, onClose],
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <FocusBindingProvider bind={bind}>
        <ActionSheetView {...model} onRate={rate} />
      </FocusBindingProvider>
    </Modal>
  );
}

/**
 * Les guides d'entrée des deux groupes, liés AVANT leur premier rendu (le port
 * l'exige) et une seule fois ; ce qui varie — la note posée, le premier
 * picto — se lit au moment de viser.
 */
function useGroupGuides(focus: FocusStore, rating: SheetRatingModel | null | undefined, actions: SheetActionModel[]): void {
  const latest = useRef({ rating, actions });
  latest.current = { rating, actions };
  useState(() => {
    focus.bind("sheet:scale", {
      container: createEntryGuide(focus, {
        owns: (key) => key.startsWith("sheet:scale:"),
        fallback: () => scaleFocusKey(latest.current.rating?.current ?? RATING_ENTRY),
        remember: false,
      }),
    });
    focus.bind("sheet:actions", {
      container: createEntryGuide(focus, {
        owns: (key) => key.startsWith("sheet:action:"),
        fallback: () => (latest.current.actions[0] ? actionKey(latest.current.actions[0].kind) : null),
      }),
    });
    return true;
  });
  useEffect(
    () => () => {
      focus.bind("sheet:scale", null);
      focus.bind("sheet:actions", null);
    },
    [focus],
  );
}
