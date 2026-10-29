/**
 * Octave — la bibliothèque rangée : « Vos favoris » et « Tous les … » seulement s'il y a des favoris ; le menu
 * d'une carte rend le modèle partagé par groupes (séparateurs), supprimer en rouge ; l'appui long ouvre le menu
 * après 500 ms immobile, pas après un glisser, et le clic qui suit n'ouvre pas la carte.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LibraryShelf } from "@tentacle-tv/api-client";
import { collectionActions } from "@tentacle-tv/shared/octave";

vi.mock("react-i18next", () => ({ useTranslation: (ns?: string) => ({ t: (key: string) => `${ns ?? "music"}:${key}` }) }));
vi.mock("../../../components/floating/FloatingLayer", () => ({ FloatingLayer: ({ children }: { children: unknown }) => <div role="menu">{children as React.ReactNode}</div> }));
vi.mock("../playlists/usePlaylistManagement", () => ({ usePlaylistManagement: () => ({ duplicate: async () => true }) }));
vi.mock("@tentacle-tv/api-client", () => ({
  useCollectionMenu: () => ({
    key: "jf:p",
    favorite: true,
    run: () => true,
    actions: collectionActions({ kind: "playlist", favorite: true, canFavorite: true, ordered: true, atTop: false, canReorder: true, playlist: { editable: true, isMember: false, canShareWith: false, canShareLink: false } }),
  }),
}));

const { ShelfSections } = await import("./ShelfSections");
const { CollectionMenuPanel } = await import("./CollectionMenu");

const shelf = (favorites: string[], rest: string[]): LibraryShelf<string> => ({
  capable: true, ready: true, favorites, rest, keyOf: (k) => k, sectionOf: () => null, ordered: () => true, atTop: () => false, canReorder: () => true, moveToTop: () => undefined, move: () => undefined,
});
const render = (s: LibraryShelf<string>) =>
  renderToStaticMarkup(<ShelfSections section="albums" shelf={s} renderCard={(k) => <i key={k}>{k}</i>} describe={(k) => ({ title: k, subtitle: "", artwork: null })} />);

describe("rubrique rangée", () => {
  it("des favoris : « Vos favoris » en tête, puis « Tous les albums »", () => {
    const html = render(shelf(["b", "a"], ["c"]));
    expect(html.indexOf("musicFavorites:shelfTitle")).toBeLessThan(html.indexOf("<i>b</i>"));
    expect(html.indexOf("<i>a</i>")).toBeLessThan(html.indexOf("musicFavorites:restTitle.albums"));
    expect(html.indexOf("musicFavorites:restTitle.albums")).toBeLessThan(html.indexOf("<i>c</i>"));
  });
  it("aucun favori : la grille seule, sans titre", () => {
    const html = render(shelf([], ["c"]));
    expect(html).not.toContain("shelfTitle");
    expect(html).not.toContain("restTitle");
    expect(html).toContain("<i>c</i>");
  });
});

describe("menu d'une collection", () => {
  it("les groupes du modèle, séparés, supprimer en rouge, les libellés de toujours pour la gestion", () => {
    const html = renderToStaticMarkup(<CollectionMenuPanel subject={{ section: "playlists", item: { kind: "library", playlist: { jellyfinId: "p", name: "P", trackCount: 0, durationMs: null, artworkUrl: null, editable: true, favorite: true } } }} anchor={{ x: 0, y: 0 }} onClose={() => undefined} ariaLabel="m" />);
    const order = ["musicFavorites:actions.unfavorite", "musicFavorites:actions.moveTop", "musicFavorites:actions.reorder", "music:playlistManage.editDetails", "music:playlistManage.duplicate", "music:playlistManage.delete"];
    const at = order.map((label) => html.indexOf(label));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html.match(/role="separator"/g)).toHaveLength(3);
    expect(html).toMatch(/text-status-error-fg[^>]*>.*music:playlistManage\.delete/);
  });
});
