import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TrailerPreviewProvider, type CardPreview, type CardPreviewHook } from "../../../src/redesign/cards/trailerPreviewPort";
import { HomeView } from "../../../src/redesign/screens/home/HomeView";
import type { BenchData } from "../data/benchData";
import { navOf } from "../data/screenModels";
import { rowsOf } from "./homeScenes";
import type { BenchScene } from "./types";

/**
 * La carte en aperçu passe EN TÊTE de sa rangée (lot du 16/10) — l'accueil,
 * sans serveur : une fausse vidéo opaque grandit dès qu'une carte a le focus
 * (comme `previewScenes`), et la rangée défile pour que cette carte prenne la
 * place de la première. Chaque focus figé de la planche est un pas de plus
 * dans la rangée : la 2e en tête, puis la 3e… puis le bout de rangée, en
 * butée. Une rangée courte (trois cartes) ne bouge pas tant que la grande
 * carte y tient.
 */

const FAKE_VIDEO = (
  <View style={StyleSheet.absoluteFill}>
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#c2185b" }]} />
    <Text style={{ position: "absolute", top: 24, right: 32, color: "white", fontSize: 32, fontWeight: "700" }}>APERÇU</Text>
  </View>
);

const FOCUSED_PREVIEW: CardPreview = { expanded: true, video: FAKE_VIDEO };

const useFakePreview: CardPreviewHook = (subject, focused) => (subject && focused ? FOCUSED_PREVIEW : null);

function RowHeadHome({ data, cardsPerRow }: { data: BenchData; cardsPerRow: number }) {
  const rows = useMemo(
    () => rowsOf(data).map((row) => ({
      ...row,
      cards: row.cards.slice(0, cardsPerRow).map((card) => ({ ...card, trailer: card.trailer ?? { kind: "item" as const, itemId: card.id } })),
    })),
    [data, cardsPerRow],
  );
  const nav = useMemo(() => navOf(data, "Home", false), [data]);
  const palette = rows[0]?.cards[0]?.palette ?? { glows: ["#3a3f5c", "#5c4a2e", "#6b4a3a"], deep: "#0d0b0f" };
  return <HomeView nav={nav} hero={null} rows={rows} palette={palette} onLongPressCard={() => undefined} />;
}

function scene(id: string, label: string, cardsPerRow: number, focusKeys: string[]): BenchScene {
  return {
    id: `apercu/en-tete-${id}`,
    group: "Aperçu au focus",
    label,
    focusKeys,
    settleMs: 1800,
    render: (data) => (
      <TrailerPreviewProvider usePreview={useFakePreview}>
        <RowHeadHome data={data} cardsPerRow={cardsPerRow} />
      </TrailerPreviewProvider>
    ),
  };
}

/** Le parcours d'une rangée de douze : les premières passent en tête, puis le bout. */
const WALK = ["resume:0", "resume:1", "resume:2", "resume:3", "resume:8", "resume:9", "resume:10", "resume:11"];

export const ROW_HEAD_SCENES: BenchScene[] = [
  scene("butee", "En tête — bout de rangée en butée", 12, WALK),
  scene("courte", "En tête — rangée de trois cartes", 3, ["resume:0", "resume:1", "resume:2"]),
];
