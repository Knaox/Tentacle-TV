import { i18n, type MediaItem } from "@tentacle-tv/shared";
import { ActionSheetView } from "../../../src/redesign/screens/sheet/ActionSheetView";
import type { BenchData } from "../data/benchData";
import { externalSheet, librarySheet, type SheetSceneModel } from "../data/sheetModels";
import { HOME_SCENES } from "./homeScenes";
import type { BenchScene } from "./types";

/**
 * Le grand panneau de l'appui maintenu, posé sur l'accueil réel. Les titres
 * sont ceux du compte ; les notes perso sont des exemples (le compte de test
 * n'en a posé aucune). La première clé de chaque scène est l'ENTRÉE du
 * câblage : l'échelle à la note posée, sinon à 5/10 — sans note possible, le
 * premier picto.
 */

/** Les mots de l'extension (Vigie), pas une clé du cœur : elle les traduit elle-même. */
const requestLabel = () => (i18n.language.startsWith("fr") ? "Demander" : "Request");

const pick = (items: MediaItem[], test: (item: MediaItem) => boolean) => items.find(test) ?? items[0];

function Sheet({ data, model }: { data: BenchData; model: SheetSceneModel | null }) {
  const home = HOME_SCENES[0].render(data);
  return (
    <>
      {home}
      {model ? <ActionSheetView header={model.header} actions={model.actions} rating={model.rating} /> : null}
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

const SETTLE = 1800;

export const SHEET_SCENES: BenchScene[] = [
  {
    id: "feuille/affiche",
    group: "Feuille d'actions",
    label: "Affiche — film entamé, pas encore noté",
    focusKeys: ["sheet:scale:5", "sheet:scale:8", "sheet:scale:1", "sheet:action:play", "sheet:action:watchlist", "sheet:action:details", "sheet:close"],
    settleMs: SETTLE,
    render: (data) => <Sheet data={data} model={model(data, (d) => { const it = movieOf(d); return it ? librarySheet(d, it, "poster") : null; })} />,
  },
  {
    id: "feuille/note-posee",
    group: "Feuille d'actions",
    label: "Note 7 posée (exemple) — l'échelle entre sur elle",
    focusKeys: ["sheet:scale:7", "sheet:scale:3", "sheet:scale:10", "sheet:scale:remove", "sheet:action:favorite"],
    settleMs: SETTLE,
    render: (data) => <Sheet data={data} model={model(data, (d) => { const it = movieOf(d); return it ? librarySheet(d, it, "poster", { rating: 7 }) : null; })} />,
  },
  {
    id: "feuille/serie",
    group: "Feuille d'actions",
    label: "Affiche — série (épisode à suivre)",
    focusKeys: ["sheet:scale:5", "sheet:action:play", "sheet:action:watched"],
    settleMs: SETTLE,
    render: (data) => <Sheet data={data} model={model(data, (d) => { const it = seriesOfList(d); return it ? librarySheet(d, it, "poster") : null; })} />,
  },
  {
    id: "feuille/vignette",
    group: "Feuille d'actions",
    label: "Vignette 16:9 — épisode",
    focusKeys: ["sheet:scale:5", "sheet:action:play", "sheet:action:details"],
    settleMs: SETTLE,
    render: (data) => <Sheet data={data} model={model(data, (d) => { const it = episodeOf(d); return it ? librarySheet(d, it, "landscape") : null; })} />,
  },
  {
    id: "feuille/etats-poses",
    group: "Feuille d'actions",
    label: "Ma liste, favori et vu posés, note 8 (exemple)",
    focusKeys: ["sheet:scale:8", "sheet:action:watchlist", "sheet:action:favorite"],
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
    focusKeys: ["sheet:scale:5", "sheet:action:dismiss", "sheet:action:providersAll"],
    settleMs: SETTLE,
    render: (data) => <Sheet data={data} model={model(data, (d) => { const it = recoOf(d); return it ? librarySheet(d, it, "reco", { providerFilter: true }) : null; })} />,
  },
  {
    id: "feuille/hors-bibliotheque",
    group: "Feuille d'actions",
    label: "Hors bibliothèque — « Demander » (exemple)",
    focusKeys: ["sheet:scale:5", "sheet:action:request", "sheet:action:watchlist"],
    settleMs: SETTLE,
    render: (data) => <Sheet data={data} model={model(data, (d) => { const it = recoOf(d); return it ? externalSheet(d, it, requestLabel()) : null; })} />,
  },
  {
    id: "feuille/note-en-attente",
    group: "Feuille d'actions",
    label: "Note en résolution — l'échelle attend, l'entrée va au premier picto",
    focusKeys: ["sheet:action:play"],
    settleMs: SETTLE,
    render: (data) => <Sheet data={data} model={model(data, (d) => { const it = episodeOf(d); return it ? librarySheet(d, it, "landscape", { pending: true }) : null; })} />,
  },
];
