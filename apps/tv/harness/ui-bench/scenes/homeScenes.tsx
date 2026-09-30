import { useCallback, useMemo, useState } from "react";
import { i18n, type CardOverlayVariant, type MediaItem } from "@tentacle-tv/shared";
import { cardIndexOf } from "../../../src/redesign/cards/cardFocusKeys";
import type { CardModel } from "../../../src/redesign/cards/cardTypes";
import type { ArtworkPalette } from "../../../src/redesign/color/artworkPalette";
import { useForcedFocusKey } from "../../../src/redesign/focus/focusPreview";
import { HomeView, type HomeRowModel, type HomeViewProps } from "../../../src/redesign/screens/home/HomeView";
import type { BenchData } from "../data/benchData";
import { cardOf, episodeLabel, resumeSubtitle, yearOf } from "../data/models";
import { heroOf, navOf } from "../data/screenModels";
import { libraryTray, withTray } from "../data/trayModels";
import type { BenchScene } from "./types";

/**
 * L'accueil, sur les vraies données du compte : le héros tourne sur les
 * reprises (sinon sur la mise en avant), les rangées suivent la mise en page
 * du compte (`home-layout`), puis les derniers ajouts de chaque bibliothèque.
 * Chaque carte porte son plateau, dans la variante du modèle que sa rangée
 * lui donne : vignette 16:9 (OK lit), affiche, recommandation.
 */

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;
/** L'appui long ouvre la feuille dans l'app ; au banc, seule son indication compte. */
const HOLD = () => undefined;

function rowsOf(data: BenchData): HomeRowModel[] {
  const layout = (data.snapshot.extras?.homeLayout as { layout?: { rows?: Array<{ key: string; enabled: boolean }> } } | undefined)
    ?.layout?.rows?.filter((row) => row.enabled).map((row) => row.key) ?? ["resume", "nextUp", "watchlist", "watched"];
  const rows: HomeRowModel[] = [];
  const cards = (items: MediaItem[], subtitle: (item: MediaItem) => string | undefined, tray: CardOverlayVariant) =>
    items.map((item) => withTray(cardOf(data, item, subtitle(item)), libraryTray(data, item, tray)));
  for (const key of layout) {
    if (key === "resume") rows.push({ key, title: t("common:resumeWatching"), variant: "landscape", cards: cards(data.list("resume"), resumeSubtitle, "landscape") });
    if (key === "nextUp") rows.push({ key, title: t("common:nextEpisodes"), variant: "landscape", cards: cards(data.list("nextUp"), (it) => episodeLabel(it, true), "landscape") });
    if (key === "watched") rows.push({ key, title: t("common:alreadyWatched"), variant: "landscape", cards: cards(data.list("watched"), (it) => (it.Type === "Episode" ? episodeLabel(it) : yearOf(it)), "landscape") });
    if (key === "watchlist") rows.push({ key, title: t("common:myList"), variant: "poster", cards: cards(data.list("watchlist"), yearOf, "poster") });
    if (key.startsWith("reco:")) {
      const shelf = data.snapshot.shelves.find((s) => s.id === key.slice(5));
      if (shelf) rows.push({ key, title: t(`reco:rows.${shelf.id}`, { defaultValue: t("nav:forYou") }), variant: "morph", cards: cards(data.items(shelf.itemIds), yearOf, "reco") });
    }
  }
  for (const lib of data.snapshot.libraries) {
    const list = data.items(data.snapshot.latestByLibrary?.[lib.id], 12);
    if (list.length) rows.push({ key: `library:${lib.id}`, title: t("common:latestAdditions", { name: lib.name }), variant: "morph", cards: cards(list, yearOf, "poster") });
  }
  return rows;
}

function heroItems(data: BenchData): MediaItem[] {
  const resume = data.list("resume");
  return (resume.length ? resume : data.list("movies")).slice(0, 5);
}

/** L'accueil vivant : la lumière suit la carte focalisée (natif ou figé). */
function HomeScene({ data, variant }: { data: BenchData; variant: "default" | "nav" | "noHero" | "loading" | "error" | "empty" }) {
  const items = heroItems(data);
  const hero = useMemo(
    () => (items[0] ? heroOf(data, items[0], t("common:resumeWatching"), { index: 0, count: items.length }) : null),
    [data, items],
  );
  const rows = useMemo(() => rowsOf(data), [data]);
  const [focusedPalette, setFocusedPalette] = useState<ArtworkPalette | null>(null);
  const forced = useForcedFocusKey();
  const forcedCard = useMemo(() => {
    for (const row of rows) {
      // La carte, ou un bouton de son plateau ; `reco:forYou:1` comme `resume:0`.
      const index = cardIndexOf(forced, row.key);
      if (index !== null) return row.cards[index] ?? null;
    }
    return null;
  }, [forced, rows]);
  const onFocusCard = useCallback((_row: string, card: CardModel) => card.palette && setFocusedPalette(card.palette), []);

  const nav = navOf(data, "Home", variant === "nav");
  const base: HomeViewProps = {
    nav,
    hero: variant === "noHero" ? null : hero,
    rows,
    palette: forcedCard?.palette ?? focusedPalette ?? hero?.palette ?? rows[0]?.cards[0]?.palette ?? { glows: ["#3a3f5c", "#5c4a2e", "#6b4a3a"], deep: "#0d0b0f" },
    onFocusCard,
    // L'appui long ouvre la feuille dans l'app : les vignettes le disent au focus.
    onLongPressCard: HOLD,
  };
  if (variant === "loading") return <HomeView {...base} status={{ kind: "loading", title: t("common:loading", { defaultValue: "Chargement…" }) }} />;
  if (variant === "error") {
    return (
      <HomeView
        {...base}
        status={{
          kind: "error",
          title: t("common:connectionError"),
          message: t("common:offlineMessage"),
          primary: { label: t("common:retry"), icon: "refresh" },
          secondary: { label: t("common:reconnect"), icon: "logout" },
        }}
      />
    );
  }
  if (variant === "empty") {
    return <HomeView {...base} hero={null} rows={[]} status={{ kind: "empty", title: t("common:emptyLibrary"), message: t("common:emptyHomeHint") }} />;
  }
  return <HomeView {...base} />;
}

const HOME_FOCUS = ["hero:primary", "hero:secondary", "hero:list", "resume:0", "resume:0:tray:watchlist", "resume:1"];

export const HOME_SCENES: BenchScene[] = [
  { id: "accueil/defaut", group: "Accueil", label: "Héros et rangées", focusKeys: HOME_FOCUS, settleMs: 1600, render: (data) => <HomeScene data={data} variant="default" /> },
  { id: "accueil/navigation", group: "Accueil", label: "Navigation ouverte", focusKeys: ["nav:Home", "nav:Recommendations", "nav:Settings"], settleMs: 1600, render: (data) => <HomeScene data={data} variant="nav" /> },
  { id: "accueil/sans-heros", group: "Accueil", label: "Sans héros (rangées)", focusKeys: ["resume:0", "nextUp:2", "nextUp:2:tray:details", "reco:forYou:1"], settleMs: 1600, render: (data) => <HomeScene data={data} variant="noHero" /> },
  { id: "accueil/chargement", group: "Accueil", label: "Chargement", render: (data) => <HomeScene data={data} variant="loading" /> },
  { id: "accueil/erreur", group: "Accueil", label: "Erreur de connexion", focusKeys: ["status:primary"], render: (data) => <HomeScene data={data} variant="error" /> },
  { id: "accueil/vide", group: "Accueil", label: "Bibliothèque vide", render: (data) => <HomeScene data={data} variant="empty" /> },
];
