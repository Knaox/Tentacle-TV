import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MusicAlbum, MusicArtist, MusicTrack } from "@tentacle-tv/shared/music";
import type { ShownAlbum } from "../../library/ownedItems";

/**
 * Octave — la seconde moitié de la page d'un artiste : ce que l'autre côté connaît de PLUS, jamais un doublon ; place
 * réservée pendant qu'on cherche ; rien trouvé, rien (une extension absente ou d'avant : la page d'avant).
 */

const h = vi.hoisted(() => ({
  counterpart: { elsewhere: null as MusicArtist | null, library: null as (MusicArtist & { albums: MusicAlbum[] }) | null, pending: false },
  ownedTrackKeys: new Set<string>(),
  ownedAlbumKeys: new Map<string, "full" | "partial">(),
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./useArtistCounterpart", () => ({ useArtistCounterpart: () => h.counterpart }));
vi.mock("../../library/useOwnedTracks", () => ({
  useOwnedTracks: (tracks: MusicTrack[]) => ({ tracks: tracks.map((t) => (h.ownedTrackKeys.has(t.key) ? { ...t, jellyfinId: `jf-${t.key}` } : t)), settled: true }),
}));
vi.mock("../../library/useOwnedAlbums", () => ({
  useOwnedAlbums: (albums: MusicAlbum[]): ShownAlbum[] => albums.map((album) => ({ album, ownership: h.ownedAlbumKeys.get(album.key) ?? null })),
}));
vi.mock("../../components/TrackList", () => ({
  rowsOf: (tracks: MusicTrack[]) => tracks,
  TrackList: ({ rows }: { rows: MusicTrack[] }) => <ol>{rows.map((t) => <li key={t.key}>{`titre:${t.title}`}</li>)}</ol>,
}));
vi.mock("../../components/Cards", () => ({
  Shelf: ({ title, children }: { title: string; children: React.ReactNode }) => <section data-title={title}>{children}</section>,
  CardGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlbumCard: ({ album }: { album: MusicAlbum }) => <span>{`album:${album.title}`}</span>,
}));
vi.mock("../../components/ViewStates", () => ({ RowsSkeleton: () => <div data-skeleton /> }));

const { ArtistMore } = await import("./ArtistMore");

const track = (key: string, title: string): MusicTrack => ({ key, title, jellyfinId: null }) as MusicTrack;
const album = (key: string, title: string, jellyfinId: string | null = null): MusicAlbum => ({ key, title, jellyfinId, kind: "album", year: 2020, releaseDate: null }) as MusicAlbum;
const groupOf = (albums: readonly ShownAlbum[]) => (albums.length ? [{ group: "albums", albums: [...albums] }] : []);
const libraryArtist = { key: "jf:a", jellyfinId: "a", external: null, name: "Kevin MacLeod", mbid: null, imageUrl: null } as MusicArtist;
const render = (artist: MusicArtist = libraryArtist, shown: ShownAlbum[] = []) =>
  renderToStaticMarkup(<ArtistMore artist={artist} shown={shown} groupOf={groupOf} contextId="artist:a" />);

beforeEach(() => {
  h.counterpart = { elsewhere: null, library: null, pending: false };
  h.ownedTrackKeys = new Set();
  h.ownedAlbumKeys = new Map();
});

describe("page d'un artiste de la bibliothèque : ce que l'extension connaît en plus", () => {
  it("titres et albums d'ailleurs, SAUF ceux que la bibliothèque a (même en partie)", () => {
    h.counterpart.elsewhere = {
      ...libraryArtist, key: "ext:s:art:1", jellyfinId: null,
      topTracks: [track("ext:t1", "Hors"), track("ext:t2", "Déjà là")],
      albums: [album("ext:al1", "Inédit"), album("ext:al2", "En partie"), album("ext:al3", "Entier")],
    };
    h.ownedTrackKeys.add("ext:t2");
    h.ownedAlbumKeys.set("ext:al2", "partial").set("ext:al3", "full");
    const html = render();
    expect(html).toContain("artistMore.elsewhere");
    expect(html).toContain("titre:Hors");
    expect(html).not.toContain("Déjà là");
    expect(html).toContain("album:Inédit");
    expect(html).not.toMatch(/album:En partie|album:Entier/);
  });

  it("pendant la recherche : la place réservée ; rien trouvé (ou pas d'extension) : rien", () => {
    h.counterpart.pending = true;
    expect(render()).toContain("data-skeleton");
    h.counterpart.pending = false;
    expect(render()).not.toMatch(/artistMore|data-skeleton|titre:|album:/);
  });
});

describe("page d'un artiste d'ailleurs : ce que la bibliothèque a en plus", () => {
  it("les albums de la bibliothèque que la page ne montre pas encore", () => {
    const outside = { ...libraryArtist, key: "ext:s:art:1", jellyfinId: null } as MusicArtist;
    h.counterpart.library = { ...libraryArtist, albums: [album("jf:1", "Déjà montré", "1"), album("jf:2", "Rangé", "2")] };
    const html = render(outside, [{ album: album("jf:1", "Déjà montré", "1"), ownership: "full" }]);
    expect(html).toContain("artistMore.library");
    expect(html).toContain("album:Rangé");
    expect(html).not.toContain("album:Déjà montré");
  });
});
