import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CARD_SIZE_GRID_COLUMNS, CARD_SIZES, type CardSize } from "@tentacle-tv/tv-core";
import { CardSizeProvider } from "../../../src/redesign/cards/cardSizeMode";
import { TrailerPreviewProvider, type CardPreview, type CardPreviewHook } from "../../../src/redesign/cards/trailerPreviewPort";
import { HomeView } from "../../../src/redesign/screens/home/HomeView";
import type { BenchData } from "../data/benchData";
import { navOf } from "../data/screenModels";
import { FOR_YOU_SCENES } from "./forYouScenes";
import { LibraryScene } from "./libraryScenes";
import { rowsOf } from "./homeScenes";
import type { BenchScene } from "./types";

/**
 * L'aperçu de bande-annonce au focus — la GRANDE CARTE, sans serveur : une
 * fausse vidéo OPAQUE (`FAKE_VIDEO`) s'y montre dès que la carte a le focus.
 * Ce qu'on juge : rien de la carte ne dépasse de la grande carte (ni ses
 * bords agrandis, ni sa lueur), la dernière carte d'une rangée se montre
 * entière, la grande carte suit la taille des cartes, et une recommandation
 * hors bibliothèque grandit comme les autres. Dans une grille (`apercu/grille-*`),
 * chaque ligne se comporte comme une rangée : la grande carte, sa légende
 * dessous, les lignes du dessous descendues. Le passage en tête, lui, ne se
 * voit qu'au focus NATIF (`focus off`, la télécommande) : figé, le focus ne
 * fait pas défiler une rangée de l'accueil non plus.
 */

const FAKE_VIDEO = (
  <View style={StyleSheet.absoluteFill}>
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#c2185b" }]} />
    <Text style={{ position: "absolute", top: 24, right: 32, color: "white", fontSize: 32, fontWeight: "700" }}>APERÇU</Text>
  </View>
);

const FOCUSED_PREVIEW: CardPreview = { expanded: true, video: FAKE_VIDEO };

/** La carte focalisée a sa vidéo, et grandit aussitôt. */
const useFakePreview: CardPreviewHook = (subject, focused) => (subject && focused ? FOCUSED_PREVIEW : null);

/** Comme dans l'app, l'aperçu démarre APRÈS le focus : la ligne apprend le focus d'abord. */
const PREVIEW_DELAY_MS = 600;
const useDelayedFakePreview: CardPreviewHook = (subject, focused) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!subject || !focused) {
      setReady(false);
      return undefined;
    }
    const timer = setTimeout(() => setReady(true), PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [subject, focused]);
  return subject && focused && ready ? FOCUSED_PREVIEW : null;
};

const LABELS: Readonly<Record<CardSize, string>> = { small: "Petite", normal: "Normale", large: "Grande" };
/** Six cartes par rangée : la dernière est `<rangée>:5`. */
const ROW_CARDS = 6;

function PreviewHome({ data }: { data: BenchData }) {
  // Chaque carte a sa bande-annonce (le banc n'en déclare pas) : son identifiant suffit à la fausse vidéo.
  const rows = useMemo(
    () => rowsOf(data).map((row) => ({ ...row, cards: row.cards.slice(0, ROW_CARDS).map((card) => ({ ...card, trailer: card.trailer ?? { kind: "item" as const, itemId: card.id } })) })),
    [data],
  );
  const nav = useMemo(() => navOf(data, "Home", false), [data]);
  const palette = rows[0]?.cards[0]?.palette ?? { glows: ["#3a3f5c", "#5c4a2e", "#6b4a3a"], deep: "#0d0b0f" };
  return <HomeView nav={nav} hero={null} rows={rows} palette={palette} onLongPressCard={() => undefined} />;
}

function wrap(size: CardSize, child: React.ReactElement, usePreview: CardPreviewHook = useFakePreview) {
  return (
    <CardSizeProvider size={size}>
      <TrailerPreviewProvider usePreview={usePreview}>{child}</TrailerPreviewProvider>
    </CardSizeProvider>
  );
}

/** Première, deuxième, avant-dernière et dernière colonnes de la deuxième ligne, puis la première de la troisième. */
const gridFocusKeys = (columns: number) => [1, 2, columns - 1, columns].map((column) => `grid:${columns + column - 1}`).concat(`grid:${2 * columns}`);

const forYouAbsent = FOR_YOU_SCENES.find((scene) => scene.id === "pour-vous/a-demander");

export const PREVIEW_SCENES: BenchScene[] = CARD_SIZES.flatMap((size): BenchScene[] => [
  {
    id: `apercu/accueil-${size}`,
    group: "Aperçu au focus",
    label: `Accueil, six cartes par rangée · ${LABELS[size]}`,
    focusKeys: ["resume:0", "resume:2", "resume:5", "nextUp:5"],
    settleMs: 1800,
    render: (data) => wrap(size, <PreviewHome data={data} />),
  },
  {
    id: `apercu/grille-${size}`,
    group: "Aperçu au focus",
    label: `Grille (Films), chaque ligne un carrousel · ${LABELS[size]}`,
    focusKeys: gridFocusKeys(CARD_SIZE_GRID_COLUMNS[size]),
    settleMs: 2400,
    render: (data) => wrap(size, <LibraryScene data={data} setup={{ kind: "movies", trailers: true }} />, useDelayedFakePreview),
  },
  ...(forYouAbsent
    ? [{
        ...forYouAbsent,
        id: `apercu/pour-vous-${size}`,
        group: "Aperçu au focus",
        label: `Pour vous, hors bibliothèque · ${LABELS[size]}`,
        render: (data: BenchData) => wrap(size, forYouAbsent.render(data)),
      }]
    : []),
]);
