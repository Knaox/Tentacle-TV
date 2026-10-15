import { CARD_SIZES, type CardSize } from "@tentacle-tv/tv-core";
import { CardSizeProvider } from "../../../src/redesign/cards/cardSizeMode";
import { DETAIL_SCENES } from "./detailScenes";
import { HOME_SCENES } from "./homeScenes";
import { LIBRARY_SCENES } from "./libraryScenes";
import { SEARCH_SCENES } from "./searchScenes";
import { SETTINGS_SCENES } from "./settingsScenes";
import type { BenchScene } from "./types";

/**
 * La taille des cartes (Réglages › Apparence), taille par taille : les écrans
 * qui portent des cartes — l'accueil, une grille de bibliothèque, les
 * résultats de recherche, la saga d'une fiche — et l'onglet du réglage, en
 * Petite, Normale et Grande. Chaque scène est celle de son écran, montée sous
 * le fournisseur à la taille voulue, comme l'app le fait depuis la clé
 * `tentacle_tv_card_size` : `planche taille-cartes --focus` les compare.
 */

const LABELS: Readonly<Record<CardSize, string>> = { small: "Petite", normal: "Normale", large: "Grande" };

/** Les écrans repris, avec les éléments à figer au focus. */
const SOURCES: Array<{ id: string; slug: string; focusKeys?: string[] }> = [
  { id: "accueil/sans-heros", slug: "accueil", focusKeys: ["resume:0", "nextUp:1", "reco:forYou:1"] },
  { id: "bibliotheque/films", slug: "bibliotheque", focusKeys: ["grid:0", "grid:3"] },
  { id: "recherche/complets", slug: "recherche", focusKeys: ["movies:0", "episodes:0"] },
  { id: "fiche/film-saga", slug: "fiche-saga", focusKeys: ["saga:0", "saga:1"] },
  { id: "reglages/apparence", slug: "reglage" },
];

const ALL = [...HOME_SCENES, ...LIBRARY_SCENES, ...SEARCH_SCENES, ...DETAIL_SCENES, ...SETTINGS_SCENES];

function sized(base: BenchScene, size: CardSize, slug: string, focusKeys: string[] | undefined): BenchScene {
  return {
    ...base,
    id: `taille-cartes/${slug}-${size}`,
    group: "Taille des cartes",
    label: `${base.group} — ${base.label} · ${LABELS[size]}`,
    // L'onglet du réglage : le focus sur la pastille de SA taille.
    focusKeys: focusKeys ?? [`settings:cardSize:${size}`, "settings:tab:appearance"],
    render: (data) => <CardSizeProvider size={size}>{base.render(data)}</CardSizeProvider>,
  };
}

export const CARD_SIZE_SCENES: BenchScene[] = CARD_SIZES.flatMap((size) =>
  SOURCES.flatMap(({ id, slug, focusKeys }) => {
    const base = ALL.find((scene) => scene.id === id);
    return base ? [sized(base, size, slug, focusKeys)] : [];
  }),
);
