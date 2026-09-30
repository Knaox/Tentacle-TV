import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { CardModel } from "../../../src/redesign/cards/cardTypes";
import { NEUTRAL_PALETTE, type ArtworkPalette } from "../../../src/redesign/color/artworkPalette";
import { useForcedFocusKey } from "../../../src/redesign/focus/focusPreview";
import { BrowseView } from "../../../src/redesign/screens/browse/BrowseView";
import type { BenchData } from "../data/benchData";
import { genreBrowse, personBrowse, studioBrowse, type BrowseModel } from "../data/browseModels";
import { cardOf, yearOf } from "../data/models";
import { navOf } from "../data/screenModels";
import type { BenchScene } from "./types";

/**
 * Parcourir : une vraie filmographie (Keira Knightley, Rosamund Pike), un
 * genre et un studio du vrai catalogue — puis chargement, vide, erreur. La
 * navigation garde « Rechercher » allumé : on arrive de la recherche.
 */

type Build = (data: BenchData, t: TFunction) => BrowseModel;
type Variant = "ready" | "loading" | "empty" | "error";

function BrowseScene({ data, build, variant }: { data: BenchData; build: Build; variant: Variant }) {
  const { t } = useTranslation();
  const model = useMemo(() => build(data, t), [build, data, t]);
  const cards = useMemo(() => model.items.map((item) => cardOf(data, item, yearOf(item))), [data, model]);
  const [focusedPalette, setFocusedPalette] = useState<ArtworkPalette | null>(null);
  const forced = useForcedFocusKey();
  const forcedCard = forced?.startsWith("grid:") ? cards[Number(forced.slice(5))] : undefined;
  const onFocusCard = useCallback((card: CardModel) => card.palette && setFocusedPalette(card.palette), []);
  const person = model.kind === "person";

  return (
    <BrowseView
      nav={navOf(data, "Search")}
      kind={model.kind}
      kicker={model.kicker}
      name={model.name}
      meta={model.meta}
      portraitUri={model.portraitUri}
      initials={model.initials}
      backLabel={t("common:back")}
      cards={variant === "ready" ? cards : []}
      palette={forcedCard?.palette ?? focusedPalette ?? cards[0]?.palette ?? NEUTRAL_PALETTE}
      loading={variant === "loading"}
      empty={
        variant === "empty" || (variant === "ready" && cards.length === 0)
          ? { title: person ? t("media:personLibraryEmpty") : t("common:noResultsLibrary") }
          : null
      }
      status={
        variant === "error"
          ? {
              kind: "error",
              title: person ? t("media:personLoadError") : t("common:contentErrorTitle"),
              message: t("common:contentErrorMessage"),
              primary: { label: t("common:retry"), icon: "refresh" },
              secondary: { label: t("common:back"), icon: "chevronLeft" },
            }
          : null
      }
      onFocusCard={onFocusCard}
    />
  );
}

const keira: Build = (data, t) => personBrowse(data, t, "Keira Knightley");
const rosamund: Build = (data, t) => personBrowse(data, t, "Rosamund Pike");
const sciFi: Build = (data, t) => genreBrowse(data, t, "movies", "Science-Fiction");
const hbo: Build = (data, t) => studioBrowse(data, t, "series", "HBO");
const western: Build = (data, t) => genreBrowse(data, t, "movies", "Western");

function images(build: Build) {
  return (data: BenchData) => {
    const model = build(data, ((key: string) => key) as unknown as TFunction);
    return [model.portraitUri, ...model.items.slice(0, 12).map((item) => data.image(item.Id, "Primary"))].filter(
      (uri): uri is string => !!uri,
    );
  };
}

const G = "Parcourir";
const scene = (id: string, label: string, build: Build, variant: Variant, focusKeys: string[]): BenchScene => ({
  id: `parcourir/${id}`,
  group: G,
  label,
  focusKeys,
  settleMs: 1300,
  images: images(build),
  render: (data) => <BrowseScene data={data} build={build} variant={variant} />,
});

export const BROWSE_SCENES: BenchScene[] = [
  scene("personne", "Filmographie (Keira Knightley)", keira, "ready", ["grid:0", "browse:back"]),
  scene("personne-2", "Filmographie (Rosamund Pike)", rosamund, "ready", ["grid:1"]),
  scene("genre", "Genre (Science-Fiction, Films)", sciFi, "ready", ["grid:0", "browse:back"]),
  scene("studio", "Studio (HBO, Séries)", hbo, "ready", ["grid:2"]),
  scene("chargement", "Chargement (filmographie)", keira, "loading", ["browse:back"]),
  scene("vide", "Vide (exemple : Western, Films)", western, "empty", ["browse:back"]),
  scene("erreur", "Erreur (filmographie)", keira, "error", ["status:primary", "status:secondary"]),
];
