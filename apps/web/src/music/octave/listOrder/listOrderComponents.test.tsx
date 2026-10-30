import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TrackActions } from "../actions/useTrackActions";
import { libraryTrack } from "@tentacle-tv/shared/octave/testing";
import type { HandleSlot } from "./DragHandle";

/**
 * Octave — la barre d'une liste et la poignée du glisser : la recherche a son libellé, une puce ne paraît que
 * si elle a un sens, le tri se dit en mot, le compte ne paraît que pendant une recherche ; la poignée est une
 * vraie cible nommée, et dit POURQUOI elle ne sert pas (recherche, filtre).
 */
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key), i18n: { language: "fr" } }),
}));
vi.mock("../player/OctavePlayerProvider", () => ({ useOctavePlayer: () => ({ prefetch: () => undefined }), useCurrentKey: () => null, usePlayerSelector: () => null }));
vi.mock("../components/QuickAddButton", () => ({ QuickAddButton: () => null }));
vi.mock("../components/Artwork", () => ({ Artwork: () => null }));
vi.mock("react-router-dom", () => ({ Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>, useNavigate: () => () => undefined }));
vi.mock("../data/entityIntent", () => ({ useEntityIntent: () => ({}) }));

const { ListToolbar } = await import("./ListToolbar");
const { TrackRow } = await import("../components/TrackRow");

const noop = () => undefined;
const actions: TrackActions = {
  canLike: () => false, toggleLike: noop, canAddToPlaylist: () => false, addToPlaylist: async () => true, canRemoveFromPlaylist: () => false,
  removeFromPlaylist: async () => true, removePending: async () => true, createPlaylistAndAdd: async () => true, quickAdd: async () => true,
};
const toolbar = (over: Partial<Parameters<typeof ListToolbar>[0]> = {}) =>
  renderToStaticMarkup(
    <ListToolbar query="" onQuery={noop} filter="all" filters={["all", "library", "elsewhere"]} onFilter={noop} prefs={{ sort: "added", direction: "desc", custom: null }} onSort={noop} shown={10} total={10} {...over} />,
  );
const slot = (blocked: string | null): HandleSlot => ({
  index: 0, title: "Halo", blocked, lifted: false,
  props: { onPointerDown: noop, onPointerMove: noop, onPointerUp: noop, onPointerCancel: noop, onLostPointerCapture: noop, onClick: noop },
});

describe("barre d'une liste", () => {
  it("recherche libellée, puces cochables, tri dit en mot", () => {
    const html = toolbar();
    expect(html).toContain('role="toolbar"');
    expect(html).toContain("listOrder.searchLabel");
    expect(html).toContain('type="search"');
    expect(html).toContain('role="radio" aria-checked="true"');
    expect(html).toContain("listOrder.filter.elsewhere");
    expect(html).toContain("listOrder.sort.added");
    expect(html).not.toContain("listOrder.count");
  });

  it("une seule puce : pas de groupe de filtres ; une recherche : le compte, et le bouton qui l'efface", () => {
    const html = toolbar({ filters: ["all"], query: "halo", shown: 3, total: 120 });
    expect(html).not.toContain('role="radiogroup"');
    expect(html).toContain("listOrder.count:{&quot;count&quot;:3,&quot;total&quot;:120}");
    expect(html).toContain("listOrder.clearSearch");
  });
});

describe("poignée de glisser", () => {
  it("une vraie cible nommée, en tête de la rangée, qui ne se glisse pas vers le rail", () => {
    const html = renderToStaticMarkup(<TrackRow track={libraryTrack("1", { title: "Halo" })} number={1} current={false} actions={actions} index={0} onPlayIndex={noop} handle={slot(null)} />);
    expect(html).toContain('aria-label="listOrder.handle:{&quot;title&quot;:&quot;Halo&quot;}"');
    expect(html).toContain('draggable="false"');
    expect(html).toContain("touch-action:none");
    expect(html).toContain("grid-cols-[1.25rem_1.5rem_2rem");
  });

  it("indisponible : dit pourquoi, sans bouton", () => {
    const html = renderToStaticMarkup(<TrackRow track={libraryTrack("1", { title: "Halo" })} number={1} current={false} actions={actions} index={0} onPlayIndex={noop} handle={slot("Effacez la recherche pour réordonner.")} />);
    expect(html).toContain('title="Effacez la recherche pour réordonner."');
    expect(html).not.toContain("touch-action:none");
  });

  it("sans poignée : la rangée d'avant, intacte", () => {
    const html = renderToStaticMarkup(<TrackRow track={libraryTrack("1")} number={1} current={false} actions={actions} index={0} onPlayIndex={noop} />);
    expect(html).not.toContain("listOrder.handle");
    expect(html).toContain("grid-cols-[1.5rem_2rem");
  });
});
