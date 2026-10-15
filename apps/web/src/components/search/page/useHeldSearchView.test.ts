import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchMediaItem, SearchResponse } from "@tentacle-tv/shared";
import { EPISODES_WAIT_MS } from "./searchViewHold";
import { useHeldSearchView, type SearchView } from "./useHeldSearchView";

// React sans DOM, comme les bancs de l'aperçu (`trailerPreview/previewTestRig.ts`).
const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = () => ({
  nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml",
  ownerDocument: doc, addEventListener() {}, removeEventListener() {},
});

const NONE: readonly SearchMediaItem[] = [];
const response = (query: string) => ({ query }) as SearchResponse;
const episodes = (query: string) => [{ Id: `e-${query}`, Name: query, Type: "Episode" }] as SearchMediaItem[];

interface Props { current: SearchView; settled: boolean; searchKey: string }

/** Le crochet monté dans une sonde : `render` rejoue un rendu avec d'autres entrées. */
function mount(initial: Props) {
  const seen: { current: SearchView } = { current: initial.current };
  function Probe(props: Props) {
    seen.current = useHeldSearchView(props.current, props.settled, props.searchKey);
    return null;
  }
  let root: Root | null = null;
  const render = (props: Props) => act(() => {
    root ??= createRoot(container() as never);
    root.render(createElement(Probe, props));
  });
  render(initial);
  return { seen, render };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useHeldSearchView — résultats et épisodes d'un bloc", () => {
  it("épisodes À L'HEURE : rien, puis résultats ET épisodes ensemble", () => {
    const dune = response("dune");
    const { seen, render } = mount({ current: { response: dune, episodes: NONE }, settled: false, searchKey: "all|dune" });
    // Les titres sont là, pas les épisodes : la page attend, sans rien montrer.
    expect(seen.current.response).toBeUndefined();

    act(() => { vi.advanceTimersByTime(EPISODES_WAIT_MS - 200); });
    expect(seen.current.response).toBeUndefined();

    const eps = episodes("dune");
    render({ current: { response: dune, episodes: eps }, settled: true, searchKey: "all|dune" });
    expect(seen.current).toEqual({ response: dune, episodes: eps });
  });

  it("épisodes EN RETARD (au-delà du plafond) : les résultats partent seuls, les épisodes s'ajoutent à leur arrivée", () => {
    const dune = response("dune");
    const { seen, render } = mount({ current: { response: dune, episodes: NONE }, settled: false, searchKey: "all|dune" });

    act(() => { vi.advanceTimersByTime(EPISODES_WAIT_MS); });
    // Le plafond est atteint : les titres s'affichent, sans section Épisodes.
    expect(seen.current).toEqual({ response: dune, episodes: NONE });

    // Les épisodes arrivent ensuite : ils s'insèrent (le seul saut qui reste).
    const eps = episodes("dune");
    render({ current: { response: dune, episodes: eps }, settled: true, searchKey: "all|dune" });
    expect(seen.current.episodes).toBe(eps);
  });

  it("pendant une frappe, la vue précédente reste — jamais d'écran blanc", () => {
    const dune = response("dune");
    const duneEps = episodes("dune");
    const { seen, render } = mount({ current: { response: dune, episodes: duneEps }, settled: true, searchKey: "all|dune" });
    expect(seen.current.response).toBe(dune);

    const dunes = response("dunes");
    render({ current: { response: dunes, episodes: NONE }, settled: false, searchKey: "all|dunes" });
    expect(seen.current).toEqual({ response: dune, episodes: duneEps });

    const dunesEps = episodes("dunes");
    render({ current: { response: dunes, episodes: dunesEps }, settled: true, searchKey: "all|dunes" });
    expect(seen.current).toEqual({ response: dunes, episodes: dunesEps });
  });
});
