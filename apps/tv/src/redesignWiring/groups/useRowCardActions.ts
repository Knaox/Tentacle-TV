import { useCallback, useMemo, useRef, type ReactNode } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { cardPressOf, holdPanelOf } from "@tentacle-tv/tv-core";
import { useTVCardActions } from "../../components/cards/actions/useTVCardActions";
import type { AmbientSource } from "../../redesign/background/ambientSource";
import type { CardModel } from "../../redesign/cards/cardTypes";
import { useOpenDetail } from "../detail/useOpenDetail";
import { useAmbientStore } from "../screen/ambientStore";

export interface RowCardActions {
  /** Une rangée dit ses titres : les gestes de ses cartes les retrouvent. */
  register: (items: readonly MediaItem[]) => void;
  ambient: AmbientSource;
  onPressCard: (card: CardModel) => void;
  onLongPressCard: (card: CardModel) => void;
  onFocusCard: (card: CardModel) => void;
  /** La feuille d'actions de l'appui long, à rendre dans l'écran. */
  sheet: ReactNode;
}

/**
 * Les gestes des cartes d'une page EN RANGÉES (bibliothèque, Ma liste, Mes
 * favoris) — ceux de la grille d'avant (`usePosterGrid`) : OK ouvre la fiche
 * (la suite de fiches, `useOpenDetail`), l'appui maintenu la feuille
 * d'actions, le fond prend la lumière de l'affiche focalisée — selon les
 * règles des cartes (`cardPressOf`, `holdPanelOf`, surface « grid »). Chaque
 * rangée charge SES titres : elle les inscrit ici (`register`), les gestes,
 * stables, les y lisent au moment du geste.
 */
export function useRowCardActions(): RowCardActions {
  const { openTitle } = useOpenDetail();
  const ambient = useAmbientStore();
  const byId = useRef(new Map<string, MediaItem>());
  const { openPoster, sheet } = useTVCardActions();
  const register = useCallback((items: readonly MediaItem[]) => {
    for (const item of items) byId.current.set(item.Id, item);
  }, []);
  const onPressCard = useCallback((card: CardModel) => {
    if (cardPressOf({ surface: "grid" }) === "detail") openTitle(byId.current.get(card.id) ?? { Id: card.id });
  }, [openTitle]);
  const onLongPressCard = useCallback((card: CardModel) => {
    const item = byId.current.get(card.id);
    if (item && holdPanelOf({ surface: "grid" })?.kind === "media") openPoster(item);
  }, [openPoster]);
  const onFocusCard = useCallback((card: CardModel) => {
    if (card.palette) ambient.set(card.palette);
  }, [ambient]);
  return useMemo(
    () => ({ register, ambient, onPressCard, onLongPressCard, onFocusCard, sheet }),
    [register, ambient, onPressCard, onLongPressCard, onFocusCard, sheet],
  );
}
