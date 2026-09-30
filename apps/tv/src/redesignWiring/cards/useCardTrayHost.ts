import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRecoCardHold } from "@tentacle-tv/api-client";
import { cardTrayEntries } from "@tentacle-tv/shared";
import type { CardSheetTarget } from "../../components/cards/actions/cardSheetTarget";
import type { CardModel, CardTrayAction, CardTrayModel } from "../../redesign/cards/cardTypes";
import { useCardActions, type CardActions } from "./useCardActions";

/**
 * Le plateau du FOCUS d'un écran — le survol du bureau, posé sur les cartes
 * de la refonte (`redesign/cards/tray/CardTray`). L'écran dit quelle carte
 * prend le focus (`focusCard`, depuis le `onFocusCard` de ses rangées et de
 * ses grilles) ; le crochet résout SES actions, et seulement les siennes —
 * quatre-vingts cartes ne portent pas chacune leurs crochets d'état —, par le
 * crochet commun de la feuille (`useCardActions`), puis pose le plateau sur
 * son modèle (`withTray`). Les autres cartes gardent leur objet : les rangées
 * mémoïsées ne se redessinent pas pour elles.
 *
 * La carte focalisée est TENUE (`useRecoCardHold`), comme celle d'une feuille
 * ouverte : un titre jugé depuis le plateau ne quitte pas « Pour vous » sous
 * le focus, mais au lâcher — quand une autre carte le prend. Une rangée qui
 * veut mieux (rien ne bouge tant que le focus y reste) se tient elle-même
 * (`useHeldRecoItems`), comme au bureau.
 *
 * Le parcours à la télécommande se pose par le port du focus, sur les clés
 * `<carte>:tray…` (en-tête de `CardTray`) : l'entrée sur l'action primaire
 * (guide `autoFocus` du groupe `<carte>:tray`), Menu → la carte.
 */

export interface CardTrayHost {
  /** La carte qui prend le focus, et ce qu'elle vise : un média et sa variante, ou une reco. */
  focusCard: (cardId: string, target: CardSheetTarget) => void;
  /** Les cartes d'une liste, celle qui a le focus avec son plateau. */
  withTray: (cards: CardModel[]) => CardModel[];
}

type Translate = (key: string) => string;

/** Le plateau d'une carte : ses lignes dans l'ordre du PLATEAU (`cardTrayEntries`). */
export function trayOf(actions: CardActions, t: Translate): CardTrayModel {
  const list: CardTrayAction[] = [];
  for (const entry of cardTrayEntries(actions.overlay, actions.states)) {
    // Rien ne se garde hors ligne sur un téléviseur : le modèle ne l'offre pas.
    if (entry.kind === "offline") continue;
    list.push({
      kind: entry.kind,
      label: t(`cards:${entry.labelKey}`),
      active: entry.active,
      detail: entry.kind === "play" ? actions.play?.detail : null,
    });
  }
  return { actions: list, rating: actions.rating, onAction: actions.onAction, onRate: actions.onRate };
}

export function useCardTrayHost(): CardTrayHost {
  const { t } = useTranslation();
  const [focused, setFocused] = useState<{ cardId: string; target: CardSheetTarget } | null>(null);
  const target = focused?.target ?? null;
  const actions = useCardActions(target);
  useRecoCardHold(target ? (target.kind === "reco" ? target.item.key : target.item.Id) : null);
  const tray = useMemo(() => (actions ? trayOf(actions, t) : undefined), [actions, t]);

  const focusCard = useCallback((cardId: string, next: CardSheetTarget) => {
    setFocused((current) => (current?.cardId === cardId && current.target === next ? current : { cardId, target: next }));
  }, []);
  const cardId = focused?.cardId ?? null;
  const withTray = useCallback(
    (cards: CardModel[]) => (tray && cardId ? cards.map((card) => (card.id === cardId ? { ...card, tray } : card)) : cards),
    [tray, cardId],
  );
  return { focusCard, withTray };
}
