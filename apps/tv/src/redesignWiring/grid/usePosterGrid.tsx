import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTVCardActions } from "../../components/cards/actions/useTVCardActions";
import type { RootStackParamList } from "../../navigation/types";
import type { CardModel } from "../../redesign/cards/cardTypes";
import { NEUTRAL_PALETTE, type ArtworkPalette } from "../../redesign/color/artworkPalette";
import { useCardModels } from "../cards/cardModels";

/** La légende d'une affiche de grille : l'année. Stable (niveau du module) :
 *  les cartes du socle ne se refont pas pour une légende qui ne change pas. */
export const yearSubtitle = (item: MediaItem): string | undefined =>
  item.ProductionYear ? String(item.ProductionYear) : undefined;

export interface PosterGrid {
  cards: CardModel[];
  /** La lumière du fond : l'affiche focalisée, sinon la première. */
  palette: ArtworkPalette;
  onPressCard: (card: CardModel) => void;
  onLongPressCard: (card: CardModel) => void;
  onFocusCard: (card: CardModel) => void;
  /** La feuille d'actions de l'appui long, à rendre dans l'écran. */
  sheet: ReactNode;
}

/**
 * Une grille d'affiches de la refonte — bibliothèque, Ma liste, Favoris,
 * Parcourir : les cartes du socle (`useCardModels`, légende = année), la
 * lumière de l'affiche focalisée, la fiche à l'appui, la feuille d'actions à
 * l'appui long (`useTVCardActions`, la même que partout ailleurs).
 */
export function usePosterGrid(items: MediaItem[]): PosterGrid {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const cards = useCardModels(items, { variant: "poster", subtitle: yearSubtitle });
  const [focused, setFocused] = useState<ArtworkPalette | null>(null);
  const byId = useMemo(() => new Map(items.map((item) => [item.Id, item])), [items]);
  const { openPoster, sheet } = useTVCardActions();

  const onPressCard = useCallback((card: CardModel) => navigation.navigate("MediaDetail", { itemId: card.id }), [navigation]);
  const onLongPressCard = useCallback((card: CardModel) => {
    const item = byId.get(card.id);
    if (item) openPoster(item);
  }, [byId, openPoster]);
  const onFocusCard = useCallback((card: CardModel) => {
    if (card.palette) setFocused(card.palette);
  }, []);

  return {
    cards,
    palette: focused ?? cards[0]?.palette ?? NEUTRAL_PALETTE,
    onPressCard,
    onLongPressCard,
    onFocusCard,
    sheet,
  };
}
