import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CARD_SIZE_GRID_COLUMNS, CARD_SIZES, previewZoneShown, type CardSize } from "@tentacle-tv/tv-core";
import { CardSizeProvider } from "../../../src/redesign/cards/cardSizeMode";
import {
  TrailerPreviewProvider, usePreviewZoneCard, usePreviewZoneState, usePreviewZoneStore, type PreviewZoneRenderer,
} from "../../../src/redesign/cards/trailerPreviewPort";
import { PreviewZoneView } from "../../../src/redesign/previewZone/PreviewZoneView";
import { zoneModelOfCard, zoneModelOfHero } from "../../../src/redesign/previewZone/zoneModel";
import { HomeView } from "../../../src/redesign/screens/home/HomeView";
import type { BenchData } from "../data/benchData";
import { navOf } from "../data/screenModels";
import { FOR_YOU_SCENES } from "./forYouScenes";
import { LibraryScene } from "./libraryScenes";
import { rowsOf } from "./homeScenes";
import type { BenchScene } from "./types";

/**
 * La ZONE D'APERÇU, sans serveur : la zone de la page montre la carte
 * focalisée (fond, logo, titre, légende) et, `PREVIEW_DELAY_MS` après le
 * focus, une fausse vidéo OPAQUE (`FAKE_VIDEO`) qui entre en fondu sur le fond,
 * avec l'indice Lecture/Pause. Ce qu'on juge : la zone toujours au même
 * endroit, quelle que soit la colonne ; le texte lisible sur le dégradé ; la
 * rangée ou la ligne focalisée juste sous la zone ; rien de la zone ne
 * recouvre une carte ; la carte ne grandit jamais.
 */

const FAKE_VIDEO = (
  <View style={StyleSheet.absoluteFill}>
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#c2185b" }]} />
    <Text style={{ position: "absolute", top: 24, right: 32, color: "white", fontSize: 32, fontWeight: "700" }}>APERÇU</Text>
  </View>
);

/** Comme dans l'app, la vidéo paraît APRÈS le focus (le délai de l'utilisateur, plus court ici). */
const PREVIEW_DELAY_MS = 600;
const PLAYING = { paused: false, muted: false };

/** La zone du banc : la règle et la vue de l'app, une fausse vidéo à la place du lecteur. */
const BenchZone: PreviewZoneRenderer = ({ hero = null, fallback = null }) => {
  const store = usePreviewZoneStore();
  if (!store) return null;
  return <BenchZoneBody hero={hero} fallback={fallback} store={store} />;
};

function BenchZoneBody({ hero, fallback, store }: { hero: Parameters<typeof zoneModelOfHero>[0] | null; fallback: Parameters<typeof zoneModelOfCard>[0] | null; store: NonNullable<ReturnType<typeof usePreviewZoneStore>> }) {
  const state = usePreviewZoneState(store);
  const last = usePreviewZoneCard(store);
  const shown = previewZoneShown(state, { hasHero: hero !== null, fallbackId: fallback?.id ?? null });
  const card = shown?.kind === "card" ? (last?.id === shown.id ? last : fallback) : null;
  const model = shown?.kind === "hero" && hero ? zoneModelOfHero(hero) : card ? zoneModelOfCard(card, null) : null;
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    setPlaying(false);
    if (!state.focused) return undefined;
    const timer = setTimeout(() => setPlaying(true), PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state.focused, state.since]);
  return <PreviewZoneView model={model} heroRoom={shown?.kind === "hero"} video={FAKE_VIDEO} videoShown={playing} remote={playing ? PLAYING : null} />;
}

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

function wrap(size: CardSize, child: React.ReactElement) {
  return (
    <CardSizeProvider size={size}>
      <TrailerPreviewProvider zone={BenchZone}>{child}</TrailerPreviewProvider>
    </CardSizeProvider>
  );
}

/** Première, deuxième, avant-dernière et dernière colonnes de la deuxième ligne, puis la première de la troisième. */
const gridFocusKeys = (columns: number) => [1, 2, columns - 1, columns].map((column) => `grid:${columns + column - 1}`).concat(`grid:${2 * columns}`);

const forYouAbsent = FOR_YOU_SCENES.find((scene) => scene.id === "pour-vous/a-demander");

export const PREVIEW_SCENES: BenchScene[] = CARD_SIZES.flatMap((size): BenchScene[] => [
  {
    id: `apercu/accueil-${size}`,
    group: "Zone d'aperçu",
    label: `Accueil, six cartes par rangée · ${LABELS[size]}`,
    focusKeys: ["resume:0", "resume:2", "resume:5", "nextUp:5"],
    settleMs: 1800,
    render: (data) => wrap(size, <PreviewHome data={data} />),
  },
  {
    id: `apercu/grille-${size}`,
    group: "Zone d'aperçu",
    label: `Grille (Films), la zone quelle que soit la colonne · ${LABELS[size]}`,
    focusKeys: gridFocusKeys(CARD_SIZE_GRID_COLUMNS[size]),
    settleMs: 2400,
    render: (data) => wrap(size, <LibraryScene data={data} setup={{ kind: "movies", trailers: true }} />),
  },
  ...(forYouAbsent
    ? [{
        ...forYouAbsent,
        id: `apercu/pour-vous-${size}`,
        group: "Zone d'aperçu",
        label: `Pour vous, hors bibliothèque · ${LABELS[size]}`,
        render: (data: BenchData) => wrap(size, forYouAbsent.render(data)),
      }]
    : []),
]);
