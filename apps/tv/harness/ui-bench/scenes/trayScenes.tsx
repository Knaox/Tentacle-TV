import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { i18n, type MediaItem } from "@tentacle-tv/shared";
import { AmbientBackdrop } from "../../../src/redesign/background/AmbientBackdrop";
import type { CardModel } from "../../../src/redesign/cards/cardTypes";
import { MediaRow } from "../../../src/redesign/rows/MediaRow";
import { PosterGrid } from "../../../src/redesign/screens/library/PosterGrid";
import type { BenchData } from "../data/benchData";
import { cardOf, episodeLabel, resumeSubtitle, yearOf } from "../data/models";
import { externalTray, libraryTray, withTray, type LibraryTrayOptions } from "../data/trayModels";
import type { BenchScene } from "./types";

/**
 * Le plateau du focus — le survol du bureau, sur les cartes de la TV : la
 * carte focalisée, chacun de ses boutons, la note posée (un affichage), les
 * états posés, la recommandation (cinq boutons sur l'affiche la plus étroite)
 * et le titre hors bibliothèque. Les notes et les états posés sont des
 * EXEMPLES : le compte de test n'en a presque pas. Les vignettes s'ouvrent
 * par l'appui long, comme dans l'app : leur carte focalisée le dit.
 */

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;
/** L'appui long ouvre la feuille dans l'app ; au banc, seule son indication compte. */
const HOLD = () => undefined;

type Variant = "poster" | "landscape" | "reco";

const trayed = (data: BenchData, items: MediaItem[], variant: Variant, subtitle: (item: MediaItem) => string | undefined, options?: (item: MediaItem, index: number) => LibraryTrayOptions) =>
  items.map((item, index) => withTray(cardOf(data, item, subtitle(item)), libraryTray(data, item, variant, options?.(item, index))));

function Page({ lead, children }: { lead: CardModel | undefined; children: ReactNode }) {
  return (
    <View style={styles.fill}>
      <AmbientBackdrop palette={lead?.palette ?? { glows: ["#3a3f5c", "#5c4a2e", "#6b4a3a"], deep: "#0d0b0f" }} />
      <View style={styles.page}>{children}</View>
    </View>
  );
}

/** Une reprise, puis des films jamais lancés : « Reprendre · position » et « Lire ». */
function posterItems(data: BenchData): MediaItem[] {
  const resume = data.list("resume").filter((it) => it.Type === "Movie");
  const fresh = data.list("movies").filter((it) => !(it.UserData?.PlaybackPositionTicks ?? 0));
  return [resume[0], fresh[3], resume[1], fresh[5], fresh[6], fresh[7], fresh[8]].filter((it): it is MediaItem => !!it);
}

function PosterScene({ data }: { data: BenchData }) {
  const cards = trayed(data, posterItems(data), "poster", yearOf);
  return (
    <Page lead={cards[1]}>
      <MediaRow rowKey="affiche" title={t("common:myList")} variant="poster" inset={96} cards={cards} />
    </Page>
  );
}

function LandscapeScene({ data }: { data: BenchData }) {
  const resume = trayed(data, data.list("resume", 6), "landscape", resumeSubtitle);
  // La note d'un épisode vise sa SÉRIE, encore en résolution ici : la place est gardée.
  const next = trayed(data, data.list("nextUp", 6), "landscape", (it) => episodeLabel(it, true), () => ({ pendingRating: true }));
  return (
    <Page lead={resume[0]}>
      <MediaRow rowKey="vignette" title={t("common:resumeWatching")} variant="landscape" inset={96} cards={resume} onLongPressCard={HOLD} />
      <MediaRow rowKey="suivant" title={t("common:nextEpisodes")} variant="landscape" inset={96} cards={next} onLongPressCard={HOLD} />
    </Page>
  );
}

function MorphScene({ data }: { data: BenchData }) {
  const cards = trayed(data, data.list("latest", 8), "poster", yearOf);
  return (
    <Page lead={cards[1]}>
      <MediaRow rowKey="redresse" title={t("common:latestAdditionsShort")} variant="morph" inset={96} cards={cards} />
    </Page>
  );
}

function StatesScene({ data }: { data: BenchData }) {
  const all = { watchlist: true, favorite: true, watched: true };
  const cards = trayed(data, posterItems(data), "poster", yearOf, (_, index) => (index === 0 ? { force: all, rating: 7 } : { rating: 6 }));
  return (
    <Page lead={cards[0]}>
      <MediaRow rowKey="poses" title={t("common:myList")} variant="poster" inset={96} cards={cards} />
    </Page>
  );
}

function RecoScene({ data }: { data: BenchData }) {
  const shelf = data.snapshot.shelves.find((s) => s.id === "forYou") ?? data.snapshot.shelves[0];
  const cards = trayed(data, data.items(shelf?.itemIds, 8), "reco", yearOf);
  return (
    <Page lead={cards[1]}>
      <MediaRow rowKey="reco" title={t("nav:forYou")} variant="morph" inset={96} cards={cards} />
    </Page>
  );
}

function ExternalScene({ data }: { data: BenchData }) {
  const items = data.list("movies").slice(10, 17);
  const cards = items.map((item, index) =>
    withTray(cardOf(data, item, yearOf(item)), externalTray("reco", index === 1 ? { watchlist: true, favorite: true, rating: 8 } : { busy: index === 2 })),
  );
  const posters = data.list("series").slice(6, 12).map((item) => withTray(cardOf(data, item, yearOf(item)), externalTray("poster")));
  return (
    <Page lead={cards[0]}>
      <MediaRow rowKey="vigie" title={t("nav:forYou")} variant="morph" inset={96} cards={cards} />
      <MediaRow rowKey="demande" title={t("search:externalFallback")} variant="poster" inset={96} cards={posters} />
    </Page>
  );
}

function GridScene({ data }: { data: BenchData }) {
  const cards = trayed(data, data.list("movies", 18), "poster", yearOf);
  return (
    <View style={styles.fill}>
      <AmbientBackdrop palette={cards[1]?.palette ?? { glows: ["#3a3f5c", "#5c4a2e", "#6b4a3a"], deep: "#0d0b0f" }} />
      <PosterGrid cards={cards} columns={6} focusPrefix="grille" />
    </View>
  );
}

const SETTLE = 1500;
const tray = (card: string, ...ids: string[]) => ids.map((id) => `${card}:tray:${id}`);

export const TRAY_SCENES: BenchScene[] = [
  {
    id: "briques/plateau-affiche",
    group: "Briques",
    label: "Plateau — affiche (« Lire » discret en tête)",
    focusKeys: ["affiche:0", ...tray("affiche:0", "play"), ...tray("affiche:1", "play", "watchlist", "favorite", "watched")],
    settleMs: SETTLE,
    render: (data) => <PosterScene data={data} />,
  },
  {
    id: "briques/plateau-vignette",
    group: "Briques",
    label: "Plateau — vignette 16:9 (OK lit : pas de « Lire » ; maintenir OK, dit la carte)",
    focusKeys: ["vignette:0", ...tray("vignette:0", "watchlist", "watched", "details"), "suivant:1"],
    settleMs: SETTLE,
    render: (data) => <LandscapeScene data={data} />,
  },
  {
    id: "briques/plateau-redresse",
    group: "Briques",
    label: "Plateau — carte qui se redresse (sur l'affiche)",
    focusKeys: ["redresse:1", ...tray("redresse:1", "play", "favorite")],
    settleMs: SETTLE,
    render: (data) => <MorphScene data={data} />,
  },
  {
    id: "briques/plateau-etats",
    group: "Briques",
    label: "Plateau — états posés, note 7 (demi-étoile)",
    focusKeys: ["poses:0", ...tray("poses:0", "watchlist", "favorite", "watched")],
    settleMs: SETTLE,
    render: (data) => <StatesScene data={data} />,
  },
  {
    id: "briques/plateau-reco",
    group: "Briques",
    label: "Plateau — recommandation (cinq boutons, affiche étroite)",
    focusKeys: ["reco:1", ...tray("reco:1", "play", "dismiss")],
    settleMs: SETTLE,
    render: (data) => <RecoScene data={data} />,
  },
  {
    id: "briques/plateau-hors-bibliotheque",
    group: "Briques",
    label: "Plateau — hors bibliothèque, « Demander » (exemple)",
    focusKeys: ["vigie:0", ...tray("vigie:0", "request", "watchlist", "dismiss"), ...tray("vigie:1", "favorite"), ...tray("vigie:2", "request"), "demande:1"],
    settleMs: SETTLE,
    render: (data) => <ExternalScene data={data} />,
  },
  {
    id: "briques/plateau-grille",
    group: "Briques",
    label: "Plateau — grille de bibliothèque (6 colonnes)",
    focusKeys: ["grille:1", ...tray("grille:1", "watched"), "grille:8"],
    settleMs: SETTLE,
    render: (data) => <GridScene data={data} />,
  },
];

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { paddingTop: 70, paddingBottom: 120 },
});
