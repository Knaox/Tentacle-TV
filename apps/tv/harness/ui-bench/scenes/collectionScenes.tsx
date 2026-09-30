import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import type { CardModel } from "../../../src/redesign/cards/cardTypes";
import { NEUTRAL_PALETTE, type ArtworkPalette } from "../../../src/redesign/color/artworkPalette";
import { useForcedFocusKey } from "../../../src/redesign/focus/focusPreview";
import { CollectionView } from "../../../src/redesign/screens/collection/CollectionView";
import type { BenchData } from "../data/benchData";
import { collectionTexts, exampleCollection, type CollectionKind } from "../data/collectionModels";
import { cardOf, yearOf } from "../data/models";
import { navOf } from "../data/screenModels";
import type { BenchScene } from "./types";

/**
 * Ma liste et Favoris : la vraie collection du compte (un titre chacune),
 * un exemple rempli de vrais titres du catalogue, puis les états — vide,
 * chargement, erreur.
 */

type Variant = "real" | "example" | "empty" | "loading" | "error";

function CollectionScene({ data, kind, variant }: { data: BenchData; kind: CollectionKind; variant: Variant }) {
  const { t } = useTranslation();
  const texts = collectionTexts(t, kind);
  const items: MediaItem[] = useMemo(() => {
    if (variant === "real") return data.list(kind);
    if (variant === "example") return exampleCollection(data, kind);
    return [];
  }, [data, kind, variant]);
  const cards = useMemo(() => items.map((item) => cardOf(data, item, yearOf(item))), [data, items]);
  const [focusedPalette, setFocusedPalette] = useState<ArtworkPalette | null>(null);
  const forced = useForcedFocusKey();
  const forcedCard = forced?.startsWith("grid:") ? cards[Number(forced.slice(5))] : undefined;
  const onFocusCard = useCallback((card: CardModel) => card.palette && setFocusedPalette(card.palette), []);
  // Vide : la lumière d'un titre du catalogue, pour que la page reste vivante.
  const fallback = useMemo(() => {
    const first = data.list("movies", 1)[0];
    return first ? cardOf(data, first).palette : undefined;
  }, [data]);

  return (
    <CollectionView
      nav={navOf(data, texts.navKey)}
      kicker={texts.kicker}
      title={texts.title}
      count={t("library:titles", { count: cards.length })}
      cards={cards}
      palette={forcedCard?.palette ?? focusedPalette ?? cards[0]?.palette ?? fallback ?? NEUTRAL_PALETTE}
      loading={variant === "loading"}
      empty={variant === "empty" || (variant === "real" && cards.length === 0) ? texts.empty : null}
      status={
        variant === "error"
          ? {
              kind: "error",
              title: t("common:contentErrorTitle"),
              message: t("common:contentErrorMessage"),
              primary: { label: t("common:retry"), icon: "refresh" },
              secondary: { label: t("common:backHome"), icon: "home" },
            }
          : null
      }
      onFocusCard={onFocusCard}
    />
  );
}

function posters(kind: CollectionKind, variant: Variant) {
  return (data: BenchData) =>
    (variant === "real" ? data.list(kind) : exampleCollection(data, kind))
      .slice(0, 18)
      .map((item) => data.image(item.Id, "Primary"))
      .filter((uri): uri is string => !!uri);
}

const G = "Ma liste et Favoris";
const scene = (id: string, label: string, kind: CollectionKind, variant: Variant, focusKeys: string[]): BenchScene => ({
  id: `collection/${id}`,
  group: G,
  label,
  focusKeys,
  settleMs: 1300,
  images: variant === "real" || variant === "example" ? posters(kind, variant) : undefined,
  render: (data) => <CollectionScene data={data} kind={kind} variant={variant} />,
});

export const COLLECTION_SCENES: BenchScene[] = [
  scene("ma-liste", "Ma liste (compte réel : 1 titre)", "watchlist", "real", ["grid:0"]),
  scene("ma-liste-remplie", "Ma liste remplie (exemple)", "watchlist", "example", ["grid:0", "grid:2"]),
  scene("ma-liste-vide", "Ma liste vide", "watchlist", "empty", ["empty:primary"]),
  scene("favoris", "Favoris (compte réel : 1 titre)", "favorites", "real", ["grid:0"]),
  scene("favoris-remplis", "Favoris remplis (exemple)", "favorites", "example", ["grid:0", "grid:4"]),
  scene("favoris-vide", "Favoris vides", "favorites", "empty", ["empty:primary"]),
  scene("chargement", "Chargement (Ma liste)", "watchlist", "loading", []),
  scene("erreur", "Erreur (Favoris)", "favorites", "error", ["status:primary", "status:secondary"]),
];
