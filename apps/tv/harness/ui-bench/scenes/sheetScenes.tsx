import { i18n, type MediaItem } from "@tentacle-tv/shared";
import { ActionSheetView } from "../../../src/redesign/screens/sheet/ActionSheetView";
import type { BenchData } from "../data/benchData";
import { externalSheet, librarySheet, type SheetSceneModel } from "../data/sheetModels";
import { HOME_SCENES } from "./homeScenes";
import type { BenchScene } from "./types";

/**
 * La feuille d'actions de l'appui long, posée sur l'accueil réel. Les titres
 * sont ceux du compte ; les notes perso sont des exemples (le compte de test
 * n'en a posé aucune).
 */

/** Les mots de l'extension (Vigie), pas une clé du cœur : elle les traduit elle-même. */
const requestLabel = () => (i18n.language.startsWith("fr") ? "Demander" : "Request");

const pick = (items: MediaItem[], test: (item: MediaItem) => boolean) => items.find(test) ?? items[0];

function Sheet({ data, model, ratingOpen = false }: { data: BenchData; model: SheetSceneModel | null; ratingOpen?: boolean }) {
  const home = HOME_SCENES[0].render(data);
  return (
    <>
      {home}
      {model ? <ActionSheetView header={model.header} actions={model.actions} rating={model.rating} ratingOpen={ratingOpen} /> : null}
    </>
  );
}

const movieOf = (data: BenchData) => pick(data.list("resume"), (it) => it.Type === "Movie");
const seriesOfList = (data: BenchData) => pick(data.list("series"), (it) => data.list("nextUp").some((ep) => ep.SeriesId === it.Id));
const episodeOf = (data: BenchData) => pick(data.list("nextUp"), (it) => it.Type === "Episode");
const recoOf = (data: BenchData) => data.items(data.snapshot.shelves[0]?.itemIds, 3)[2] ?? data.list("movies")[0];

const model = (data: BenchData, build: (data: BenchData) => SheetSceneModel | null) => {
  try {
    return build(data);
  } catch {
    return null;
  }
};

const ACTIONS = ["sheet:action:play", "sheet:action:rate", "sheet:action:watchlist", "sheet:action:details", "sheet:close"];
const SETTLE = 1800;

export const SHEET_SCENES: BenchScene[] = [
  {
    id: "feuille/affiche",
    group: "Feuille d'actions",
    label: "Affiche — film entamé",
    focusKeys: ACTIONS,
    settleMs: SETTLE,
    render: (data) => <Sheet data={data} model={model(data, (d) => { const it = movieOf(d); return it ? librarySheet(d, it, "poster") : null; })} />,
  },
  {
    id: "feuille/serie",
    group: "Feuille d'actions",
    label: "Affiche — série (épisode à suivre)",
    focusKeys: ["sheet:action:play", "sheet:action:watched"],
    settleMs: SETTLE,
    render: (data) => <Sheet data={data} model={model(data, (d) => { const it = seriesOfList(d); return it ? librarySheet(d, it, "poster") : null; })} />,
  },
  {
    id: "feuille/vignette",
    group: "Feuille d'actions",
    label: "Vignette 16:9 — épisode",
    focusKeys: ["sheet:action:play", "sheet:action:details"],
    settleMs: SETTLE,
    render: (data) => <Sheet data={data} model={model(data, (d) => { const it = episodeOf(d); return it ? librarySheet(d, it, "landscape") : null; })} />,
  },
  {
    id: "feuille/etats-poses",
    group: "Feuille d'actions",
    label: "Ma liste, favori et vu posés (exemple)",
    focusKeys: ["sheet:action:favorite", "sheet:action:rate"],
    settleMs: SETTLE,
    render: (data) => (
      <Sheet
        data={data}
        model={model(data, (d) => { const it = movieOf(d); return it ? librarySheet(d, it, "poster", { force: { watchlist: true, favorite: true, watched: true }, rating: 8 }) : null; })}
      />
    ),
  },
  {
    id: "feuille/reco",
    group: "Feuille d'actions",
    label: "Recommandation, filtre de plateformes actif",
    focusKeys: ["sheet:action:details", "sheet:action:dismiss", "sheet:action:providersAll"],
    settleMs: SETTLE,
    render: (data) => <Sheet data={data} model={model(data, (d) => { const it = recoOf(d); return it ? librarySheet(d, it, "reco", { providerFilter: true }) : null; })} />,
  },
  {
    id: "feuille/hors-bibliotheque",
    group: "Feuille d'actions",
    label: "Hors bibliothèque — « Demander » (exemple)",
    focusKeys: ["sheet:action:request", "sheet:action:watchlist"],
    settleMs: SETTLE,
    render: (data) => <Sheet data={data} model={model(data, (d) => { const it = recoOf(d); return it ? externalSheet(d, it, requestLabel()) : null; })} />,
  },
  {
    id: "feuille/echelle",
    group: "Feuille d'actions",
    label: "Noter — l'échelle verticale, note 7 posée (exemple)",
    focusKeys: ["sheet:scale:7", "sheet:scale:9", "sheet:scale:3", "sheet:scale:remove"],
    settleMs: SETTLE,
    render: (data) => <Sheet data={data} ratingOpen model={model(data, (d) => { const it = movieOf(d); return it ? librarySheet(d, it, "poster", { rating: 7 }) : null; })} />,
  },
  {
    id: "feuille/echelle-sans-note",
    group: "Feuille d'actions",
    label: "Noter — l'échelle, pas encore de note",
    focusKeys: ["sheet:scale:6", "sheet:scale:10", "sheet:scale:1"],
    settleMs: SETTLE,
    render: (data) => <Sheet data={data} ratingOpen model={model(data, (d) => { const it = episodeOf(d); return it ? librarySheet(d, it, "landscape") : null; })} />,
  },
  {
    id: "feuille/note-en-attente",
    group: "Feuille d'actions",
    label: "Note en résolution (« Noter » attend sa cible)",
    focusKeys: ["sheet:action:rate"],
    settleMs: SETTLE,
    render: (data) => <Sheet data={data} model={model(data, (d) => { const it = episodeOf(d); return it ? librarySheet(d, it, "landscape", { pending: true }) : null; })} />,
  },
];
