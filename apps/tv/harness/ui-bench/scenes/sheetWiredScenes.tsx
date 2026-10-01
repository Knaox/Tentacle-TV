import { useCallback, useState } from "react";
import { Modal } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { FocusBindingProvider } from "../../../src/redesign/focus/focusBinding";
import { ActionSheetView } from "../../../src/redesign/screens/sheet/ActionSheetView";
import { useFocusStore } from "../../../src/redesignWiring/focus/focusStore";
import { sheetEntryOf, useSheetFocus } from "../../../src/redesignWiring/sheet/sheetFocus";
import type { BenchData } from "../data/benchData";
import { librarySheet, type SheetSceneModel } from "../data/sheetModels";
import { HOME_SCENES } from "./homeScenes";
import type { BenchScene } from "./types";

/**
 * Le grand panneau CÂBLÉ : la vue dans une `Modal`, comme dans l'app, sous le
 * focus du câblage lui-même (`useSheetFocus` : entrée verrouillée, guides des
 * groupes, garde anti-clic fantôme). Ce que la `Modal` fait du focus ne se
 * voit pas au focus figé du banc : ces scènes s'éprouvent en focus NATIF, au
 * pavé de l'agent XCUITest (`harness/atv-remote`), qui lit l'élément
 * focalisé. Noter pose la note sous les yeux ; la croix, Menu (et OK, en mode
 * « Noter ») ferment — Menu de nouveau rend le catalogue.
 *
 * D'une scène câblée à l'autre, passer par le catalogue (`menu`) : la `Modal`
 * de la suivante, présentée dans le même rendu que le retrait de la
 * précédente, ne paraît pas — et le focus n'est plus nulle part.
 */

const NO_ACTIONS: SheetSceneModel["actions"] = [];
const pick = (items: MediaItem[], test: (item: MediaItem) => boolean) => items.find(test) ?? items[0];
const movieOf = (data: BenchData) => pick(data.list("resume"), (it) => it.Type === "Movie");

/** L'accueil, puis le panneau — monté une fois son modèle connu (l'instantané
 *  arrive après le premier rendu) : son entrée se décide alors, une fois. */
function WiredScene({ data, model, rateOnly = false }: { data: BenchData; model: SheetSceneModel | null; rateOnly?: boolean }) {
  return (
    <>
      {HOME_SCENES[0].render(data)}
      {model ? <WiredSheet model={model} rateOnly={rateOnly} /> : null}
    </>
  );
}

function WiredSheet({ model, rateOnly }: { model: SheetSceneModel; rateOnly: boolean }) {
  const focus = useFocusStore();
  const [open, setOpen] = useState(true);
  const [closing, setClosing] = useState(false);
  const [current, setCurrent] = useState(model.rating?.current ?? null);
  const rating = model.rating ? { ...model.rating, current } : null;
  const actions = rateOnly ? NO_ACTIONS : model.actions;
  const [entry] = useState(() => sheetEntryOf(rating, actions));
  const bind = useSheetFocus(focus, { rating, actions, entry });
  const close = useCallback(() => setClosing(true), []);
  const closed = useCallback(() => setOpen(false), []);
  const rate = useCallback(
    (score: number | null) => {
      setCurrent(score);
      if (rateOnly) setClosing(true);
    },
    [rateOnly],
  );

  return open ? (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <FocusBindingProvider bind={bind}>
        <ActionSheetView
          header={model.header}
          actions={actions}
          rating={rating}
          onRate={rate}
          onClose={close}
          closing={closing}
          onClosed={closed}
        />
      </FocusBindingProvider>
    </Modal>
  ) : null;
}

const sheetOf = (data: BenchData, rating?: number) => {
  try {
    const item = movieOf(data);
    return item ? librarySheet(data, item, "poster", { rating }) : null;
  } catch {
    return null;
  }
};

/** Un titre que rien ne permet de noter : pas d'échelle, l'entrée sur la lecture. */
const unratedOf = (data: BenchData) => {
  const sheet = sheetOf(data);
  return sheet ? { ...sheet, rating: null } : null;
};

const SETTLE = 1800;

export const SHEET_WIRED_SCENES: BenchScene[] = [
  {
    id: "feuille/cablee",
    group: "Feuille d'actions",
    label: "Câblée (Modal, focus natif) — pas encore notée",
    focusKeys: ["sheet:scale:5", "sheet:close"],
    settleMs: SETTLE,
    render: (data) => <WiredScene data={data} model={sheetOf(data)} />,
  },
  {
    id: "feuille/cablee-note",
    group: "Feuille d'actions",
    label: "Câblée (Modal, focus natif) — note 7 posée",
    focusKeys: ["sheet:scale:7", "sheet:close"],
    settleMs: SETTLE,
    render: (data) => <WiredScene data={data} model={sheetOf(data, 7)} />,
  },
  {
    id: "feuille/cablee-sans-note",
    group: "Feuille d'actions",
    label: "Câblée (Modal, focus natif) — titre non notable",
    focusKeys: ["sheet:action:play", "sheet:close"],
    settleMs: SETTLE,
    render: (data) => <WiredScene data={data} model={unratedOf(data)} />,
  },
  {
    id: "feuille/cablee-noter",
    group: "Feuille d'actions",
    label: "Câblée (Modal, focus natif) — « Noter » : la note seule",
    focusKeys: ["sheet:scale:5", "sheet:close"],
    settleMs: SETTLE,
    render: (data) => <WiredScene data={data} model={sheetOf(data)} rateOnly />,
  },
];
