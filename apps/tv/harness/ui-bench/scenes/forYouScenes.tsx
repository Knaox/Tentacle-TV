import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { i18n } from "@tentacle-tv/shared";
import { tvRecoHero, tvRecoNotice, tvRecoShelves } from "@tentacle-tv/tv-core";
import type { CardModel } from "../../../src/redesign/cards/cardTypes";
import { NEUTRAL_PALETTE, type ArtworkPalette } from "../../../src/redesign/color/artworkPalette";
import { useForcedFocusKey } from "../../../src/redesign/focus/focusPreview";
import { ForYouView, type ForYouShelfModel, type ForYouViewProps } from "../../../src/redesign/screens/forYou/ForYouView";
import type { BenchData } from "../data/benchData";
import {
  capturedRecoPage,
  recoFilterOf,
  recoHeroOf,
  recoPageAs,
  recoPageExplorationFirst,
  recoPageFiltered,
  recoShelvesOf,
  type RecoPageModel,
} from "../data/forYouModels";
import { navOf } from "../data/screenModels";
import type { BenchScene } from "./types";

/**
 * « Pour vous », sur la VRAIE page de recommandations du compte : le héros et
 * les étagères de `tvRecoHero` / `tvRecoShelves` (tv-core), leurs titres et
 * leurs raisons par l'api-client. Les états que le compte n'a pas —
 * désactivé, à froid, en préparation, vide, filtre de plateformes, rangée
 * « exploration » en tête — sont des copies de cette page, dites « exemple ».
 */

type Variant = "default" | "filter" | "discovery" | "disabled" | "cold" | "preparing" | "empty" | "loading" | "error";

/** Netflix et Disney+ : deux familles bien présentes dans la page réelle. */
const EXAMPLE_FILTER = [8, 337];

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;

function pageOf(data: BenchData, variant: Variant): RecoPageModel | null {
  const page = capturedRecoPage(data);
  if (!page) return null;
  switch (variant) {
    case "filter":
      return recoPageFiltered(page, EXAMPLE_FILTER);
    case "discovery":
      return recoPageExplorationFirst(page);
    case "disabled":
    case "cold":
      return recoPageAs(page, variant);
    case "preparing":
      return { state: "warming", generating: true, refining: false, rows: [] };
    case "empty":
      return { state: "ready", generating: false, refining: false, rows: [] };
    default:
      return page;
  }
}

function modelOf(data: BenchData, variant: Variant, lang: string): Omit<ForYouViewProps, "palette"> & { lang: string } {
  const nav = navOf(data, "Recommendations");
  const base = { lang, nav, hero: null, shelves: [] as ForYouShelfModel[] };
  if (variant === "loading") return { ...base, status: { kind: "loading", title: t("common:loading") } };
  if (variant === "error") {
    return {
      ...base,
      status: { kind: "error", title: t("reco:loadError"), message: t("reco:tvErrorHint"), primary: { label: t("common:retry"), icon: "refresh" } },
    };
  }
  const page = pageOf(data, variant);
  const heroItem = tvRecoHero(page ?? undefined);
  const shelves = tvRecoShelves(page ?? undefined, { hero: heroItem });
  const notice = tvRecoNotice(page ?? undefined, shelves);
  const hero = heroItem ? recoHeroOf(data, heroItem) : null;
  if (notice === "preparing") {
    return { ...base, status: { kind: "loading", title: t("reco:tvPreparingTitle"), message: t("reco:generatingHint") } };
  }
  if (!page || (shelves.length === 0 && !hero)) {
    return { ...base, status: { kind: "empty", title: t("reco:tvEmptyTitle"), message: t("reco:tvEmpty") } };
  }
  return {
    ...base,
    hero,
    shelves: recoShelvesOf(data, shelves),
    notice: notice === "disabled" ? { kind: "disabled", text: t("reco:tvDisabledHint") } : notice === "cold" ? { kind: "cold", text: t("reco:tvColdHint") } : null,
    filter: variant === "filter" ? recoFilterOf(EXAMPLE_FILTER) : null,
  };
}

/** La carte à clé figée (`${étagère}:${index}` — une étagère peut porter des « : »). */
function forcedCard(shelves: ForYouShelfModel[], forced: string | null): CardModel | null {
  if (!forced) return null;
  const cut = forced.lastIndexOf(":");
  const shelf = shelves.find((s) => s.key === forced.slice(0, cut));
  return shelf?.cards[Number(forced.slice(cut + 1))] ?? null;
}

function ForYouScene({ data, variant }: { data: BenchData; variant: Variant }) {
  // La langue du banc : les textes se retraduisent quand elle change.
  const { i18n: i18next } = useTranslation();
  const lang = i18next.language;
  const { lang: _lang, ...model } = useMemo(() => modelOf(data, variant, lang), [data, variant, lang]);
  const [focusedPalette, setFocusedPalette] = useState<ArtworkPalette | null>(null);
  const forced = useForcedFocusKey();
  const onFocusCard = useCallback((_shelf: string, card: CardModel) => card.palette && setFocusedPalette(card.palette), []);
  const palette =
    forcedCard(model.shelves, forced)?.palette ??
    (forced ? null : focusedPalette) ??
    model.hero?.palette ??
    model.shelves[0]?.cards[0]?.palette ??
    NEUTRAL_PALETTE;
  return <ForYouView {...model} palette={palette} onFocusCard={onFocusCard} />;
}

const scene = (id: string, label: string, variant: Variant, focusKeys: string[] = []): BenchScene => ({
  id: `pour-vous/${id}`,
  group: "Pour vous",
  label,
  focusKeys,
  settleMs: 1600,
  render: (data) => <ForYouScene data={data} variant={variant} />,
});

export const FOR_YOU_SCENES: BenchScene[] = [
  scene("defaut", "Héros et étagères (page réelle)", "default", ["hero:primary", "hero:list", "forYou:0", "forYou:3", "inLibrary:1"]),
  scene("filtre", "Filtre de plateformes (exemple)", "filter", ["filter:remove", "forYou:0"]),
  scene("decouverte", "Découverte en tête (exemple)", "discovery", ["exploration:0", "exploration:2"]),
  scene("desactive", "Recommandations désactivées (exemple)", "disabled", ["hero:primary", "trending:0"]),
  scene("froid", "Démarrage à froid (exemple)", "cold", ["hero:primary", "trending:1"]),
  scene("preparation", "En préparation (exemple)", "preparing"),
  scene("vide", "Rien à recommander (exemple)", "empty"),
  scene("chargement", "Chargement", "loading"),
  scene("erreur", "Erreur", "error", ["status:primary"]),
];
