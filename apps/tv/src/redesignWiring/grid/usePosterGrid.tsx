import { useCallback, useMemo, useRef, type ReactNode } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { cardPressOf, holdPanelOf } from "@tentacle-tv/tv-core";
import { useTVCardActions } from "../../components/cards/actions/useTVCardActions";
import type { CardModel } from "../../redesign/cards/cardTypes";
import { NEUTRAL_PALETTE, type ArtworkPalette } from "../../redesign/color/artworkPalette";
import type { AmbientSource } from "../../redesign/background/ambientSource";
import { useCardModels } from "../cards/cardModels";
import { useAmbientStore } from "../screen/ambientStore";
import { useOpenDetail } from "../detail/useOpenDetail";

/** La légende d'une affiche de grille : l'année. Stable (niveau du module) :
 *  les cartes du socle ne se refont pas pour une légende qui ne change pas. */
export const yearSubtitle = (item: MediaItem): string | undefined =>
  item.ProductionYear ? String(item.ProductionYear) : undefined;

export interface PosterGrid {
  cards: CardModel[];
  /** La lumière du fond quand aucune affiche n'impose la sienne : la première. */
  palette: ArtworkPalette;
  /** La lumière de l'affiche focalisée, que le fond suit seul (`ambientSource`). */
  ambient: AmbientSource;
  onPressCard: (card: CardModel) => void;
  onLongPressCard: (card: CardModel) => void;
  onFocusCard: (card: CardModel) => void;
  /** La feuille d'actions de l'appui long, à rendre dans l'écran. */
  sheet: ReactNode;
}

/**
 * Une grille d'affiches de la refonte — bibliothèque, Ma liste, Favoris,
 * Parcourir : les cartes du socle (`useCardModels`, légende = année), la
 * lumière de l'affiche focalisée, la fiche à l'appui — elle remplace la page
 * d'une personne (la suite de fiches, `useOpenDetail`) —, la feuille d'actions
 * à l'appui long (`useTVCardActions`, la même que partout ailleurs) ; ce que
 * font OK et l'appui long : les règles des cartes (`cardPressOf`, `holdPanelOf`).
 */
export function usePosterGrid(items: MediaItem[]): PosterGrid {
  const { openTitle } = useOpenDetail();
  const cards = useCardModels(items, { variant: "poster", subtitle: yearSubtitle });
  // Tenue hors du rendu : un pas du focus dans la grille ne redessine que le fond.
  const ambient = useAmbientStore();
  const byId = useMemo(() => new Map(items.map((item) => [item.Id, item])), [items]);
  // Les gestionnaires lisent l'index du moment : stables d'une page à
  // l'autre, une page qui arrive ne redessine pas toute la grille montée.
  const byIdRef = useRef(byId);
  byIdRef.current = byId;
  const { openPoster, sheet } = useTVCardActions();

  const onPressCard = useCallback((card: CardModel) => {
    if (cardPressOf({ surface: "grid" }) === "detail") openTitle(byIdRef.current.get(card.id) ?? { Id: card.id });
  }, [openTitle]);
  const onLongPressCard = useCallback((card: CardModel) => {
    const item = byIdRef.current.get(card.id);
    if (item && holdPanelOf({ surface: "grid" })?.kind === "media") openPoster(item);
  }, [openPoster]);
  const onFocusCard = useCallback((card: CardModel) => {
    if (card.palette) ambient.set(card.palette);
  }, [ambient]);

  return {
    cards,
    palette: cards[0]?.palette ?? NEUTRAL_PALETTE,
    ambient,
    onPressCard,
    onLongPressCard,
    onFocusCard,
    sheet,
  };
}
