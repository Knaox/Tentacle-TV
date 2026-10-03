import { createFocusStore } from "@bench/focusStore";
import { useDetailEntries } from "@bench/detailEntries";
import { fakeNode, mount, record, step, takeTrace, type Trace } from "../runtime";

/**
 * Les entrées des sections de la fiche : l'onglet de la saison affichée,
 * toujours ; l'épisode à reprendre, à la première visite, réarmé à chaque
 * saison choisie — relevées par le `tvEntry` posé sur les sections.
 */

type Store = ReturnType<typeof createFocusStore>;
interface Episodes { seasons: Array<{ id: string }>; selectedSeasonId: string; episodes: unknown[]; anchorIndex?: number }

function Detail({ store, episodes }: { store: Store; episodes: Episodes | null }) {
  useDetailEntries(store, episodes as never);
  return null;
}

const attach = (store: Store, key: string) => step(() => store.binder(key)?.ref?.(fakeNode(key) as never));
const detach = (store: Store, key: string) => step(() => store.binder(key)?.ref?.(null));
const focus = (store: Store, key: string) => step(() => store.binder(key)?.onFocus?.());

const seasons = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];
const model = (selectedSeasonId: string, anchorIndex: number | undefined, count = 6): Episodes => ({ seasons, selectedSeasonId, episodes: Array.from({ length: count }), anchorIndex });

export function detailEntries(): Trace {
  const store = createFocusStore();
  const view = mount(<Detail store={store} episodes={null} />);
  record("—", "les sections se montent, puis leurs éléments");
  attach(store, "detail:seasons");
  attach(store, "detail:episodes");
  view.render(<Detail store={store} episodes={model("s2", 3)} />);
  for (const key of ["season:0", "season:1", "season:2", "episode:0", "episode:3"]) attach(store, key);
  record("—", "un focus hors des épisodes ne désarme pas");
  focus(store, "season:1");
  focus(store, "hero:primary");
  record("—", "le premier focus d'un épisode désarme");
  focus(store, "episode:0");
  focus(store, "episode:3");
  view.render(<Detail store={store} episodes={model("s2", 3)} />);
  record("—", "une autre saison choisie réarme");
  view.render(<Detail store={store} episodes={model("s3", undefined)} />);
  detach(store, "episode:3");
  attach(store, "episode:3");
  focus(store, "episode:3");
  record("—", "une saison sans épisode, puis la fiche sans épisodes");
  view.render(<Detail store={store} episodes={model("s1", 2, 0)} />);
  view.render(<Detail store={store} episodes={null} />);
  view.unmount();
  return takeTrace();
}
