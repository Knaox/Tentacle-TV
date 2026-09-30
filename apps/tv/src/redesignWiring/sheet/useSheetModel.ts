import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { sheetLibraryId, type CardSheetTarget } from "../../components/cards/actions/cardSheetTarget";
import type { ActionSheetViewProps } from "../../redesign/screens/sheet/ActionSheetView";
import { useCardActions } from "../cards/useCardActions";
import { mediaSheetHeader, recoSheetHeader } from "./sheetHeader";
import { sheetRows } from "./sheetRows";

/**
 * Ce que la feuille refondue reçoit, résolu comme sur toutes les plateformes
 * par le crochet COMMUN à la feuille et au plateau du focus
 * (`cards/useCardActions`) : le modèle partagé du survol, les bascules, la
 * lecture, la note et les gestes. La feuille en tire ses lignes par
 * `sheetRows` — le modèle partagé, la lecture toujours en tête (elle remplace
 * la carte), « Plus d'infos » sur toute carte de la bibliothèque, « Toutes les
 * plateformes » sous un filtre actif. Les bascules et la
 * note la laissent ouverte (les libellés basculent sous les yeux) ; lire, la
 * fiche, le refus et le filtre la ferment (`onLeave`).
 *
 * `rate` : la même feuille réduite à ses étoiles — le bouton « Noter » de la
 * fiche, qui a déjà ses propres boutons de lecture et de bascule.
 */

export type SheetMode = "actions" | "rate";

export interface SheetModelInput {
  target: CardSheetTarget;
  mode: SheetMode;
  /** Un filtre de plateformes est actif : « Toutes les plateformes » suit (recommandations). */
  providerFilterActive: boolean;
  onClose: () => void;
}

export function useSheetModel({ target, mode, providerFilterActive, onClose }: SheetModelInput): ActionSheetViewProps {
  const { t } = useTranslation();
  const client = useJellyfinClient();
  const actionsShown = mode === "actions";
  const card = useCardActions(target, { withActions: actionsShown, onLeave: onClose });

  const header = useMemo(
    () => (target.kind === "reco" ? recoSheetHeader(client, target.item) : mediaSheetHeader(client, target.item, target.variant, t)),
    [client, target, t],
  );

  const actions = actionsShown
    ? sheetRows(
        {
          overlay: card.overlay,
          states: card.states,
          playDetail: card.play?.detail,
          inLibrary: sheetLibraryId(target) !== null,
          providerFilterActive,
          rating: card.rating,
        },
        t,
      )
    : [];

  return { header, actions, rating: card.rating, onAction: card.onAction, onRate: card.onRate, onClose };
}
