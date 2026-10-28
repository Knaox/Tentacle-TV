import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { externalTrack, libraryTrack } from "@tentacle-tv/shared/octave/testing";
import type { MusicProvider } from "../../pluginMusic/musicProvider";

/**
 * Règles 15 et 16 du lot « Octave mobile » : sans la capacité du serveur (1.40.0) ou sans le droit, les pages
 * n'affichent RIEN et ne demandent RIEN — ni requête, ni bouton. Les crochets des pages (web large, web étroit,
 * mobile) lisent les mêmes sources que le bureau : capacités, extension servie au compte, droits de Sillon.
 */
const h = vi.hoisted(() => ({
  caps: new Set<string>(),
  queries: [] as { key: unknown; enabled: unknown; fn?: (ctx: { signal: AbortSignal }) => unknown }[],
  data: new Map<string, unknown>(),
  fetched: [] as string[],
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (o: { queryKey: unknown; enabled?: unknown; queryFn?: (ctx: { signal: AbortSignal }) => unknown }) => {
    h.queries.push({ key: o.queryKey, enabled: o.enabled ?? true, fn: o.queryFn });
    const data = h.data.get(JSON.stringify(o.queryKey));
    return { data, isPending: data === undefined, isError: false, refetch: () => undefined };
  },
  useInfiniteQuery: (o: { queryKey: unknown; enabled?: unknown }) => {
    h.queries.push({ key: o.queryKey, enabled: o.enabled ?? true });
    return { data: undefined, isPending: true, isError: false };
  },
  useQueryClient: () => ({
    fetchQuery: (o: { queryKey: unknown }) => (h.fetched.push(JSON.stringify(o.queryKey)), Promise.resolve(null)),
    getQueryData: (key: unknown) => h.data.get(JSON.stringify(key)),
    setQueryData: () => undefined,
    invalidateQueries: () => undefined,
  }),
  useMutation: () => ({ mutate: () => undefined, mutateAsync: () => Promise.resolve(undefined) }),
}));
vi.mock("../../hooks/useServerCapabilities", () => ({
  useServerCapability: (key: string) => h.caps.has(key),
  useServerCapabilities: () => ({ capabilities: h.caps, settled: true }),
}));
vi.mock("../../pluginMusic/musicRequests", () => ({
  fetchExternalAlbum: () => (h.fetched.push("album"), Promise.resolve(null)),
  fetchExternalArtist: () => (h.fetched.push("artist"), Promise.resolve(null)),
  fetchExternalPlaylist: () => (h.fetched.push("playlist"), Promise.resolve(null)),
}));
vi.mock("../../pluginMusic/useMusicActions", () => ({
  useMusicGestures: () => ({ canLike: true, canPlaylistAdd: true, canRemovePending: true, like: vi.fn(), playlistAdd: vi.fn(), removePending: vi.fn() }),
  useMusicPending: () => ({ data: { items: [] }, isPending: false }),
}));
vi.mock("../useMusicPlaylists", () => ({
  useMusicPlaylists: () => ({ data: [] }),
  useMusicPlaylistReader: () => () => Promise.resolve({ entries: [] }),
  useAddToMusicPlaylist: () => ({ mutateAsync: vi.fn() }),
  useRemoveMusicPlaylistEntry: () => ({ mutateAsync: vi.fn() }),
  useCreateMusicPlaylist: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("../useMusicFavorite", () => ({ useToggleMusicFavorite: () => ({ mutate: vi.fn() }) }));

const { useMusicMoods, useMusicMoodTracks } = await import("./useMusicMoods");
const { useMusicAlbumEntity, useMusicExternalPlaylist } = await import("./useMusicEntities");
const { useTrackActions } = await import("./actions/useTrackActions");
const { useMusicHome, useMusicAlbums } = await import("../useMusicLibrary");
const { useMusicSearch } = await import("../useMusicSearch");

function run(hook: () => unknown): unknown {
  let out: unknown;
  function Probe() {
    out = hook();
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return out;
}

const sillon = (music: Record<string, unknown> = {}) => ({ pluginId: "sillon", name: "Sillon", music: { search: "/s", resolve: "/r", ...music } }) as unknown as MusicProvider;
const ui = { t: (k: string) => k, notify: () => undefined, store: null };

beforeEach(() => {
  h.caps = new Set();
  h.queries = [];
  h.data.clear();
  h.fetched = [];
});

describe("serveur qui ne déclare rien (avant 1.40.0) : les pages ne demandent rien", () => {
  it("accueil, albums, recherche : aucune requête permise", () => {
    run(() => [useMusicHome(), useMusicAlbums(), useMusicSearch("daft punk", { debounceMs: 0 })]);
    expect(h.queries.length).toBeGreaterThan(0);
    expect(h.queries.every((q) => q.enabled === false)).toBe(true);
  });

  it("avec la capacité `music.library`, l'accueil se demande", () => {
    h.caps = new Set(["music.library"]);
    run(() => useMusicHome());
    expect(h.queries.some((q) => q.enabled === true)).toBe(true);
  });
});

describe("sans l'extension servie au compte (Sillon absent, invité, droit retiré) : rien d'elle", () => {
  it("ambiances : liste vide, aucune requête", () => {
    const moods = run(() => useMusicMoods(null, "fr")) as { moods: unknown[]; pending: boolean };
    expect(moods).toEqual({ moods: [], pending: false });
    expect(h.queries.every((q) => q.enabled === false)).toBe(true);
  });

  it("une extension qui ne sert pas les ambiances : pareil", () => {
    const moods = run(() => useMusicMoods(sillon(), "fr")) as { moods: unknown[] };
    expect(moods.moods).toEqual([]);
    expect(h.queries.every((q) => q.enabled === false)).toBe(true);
  });

  it("lire une ambiance d'un geste : rien ne part", async () => {
    const play = run(() => useMusicMoodTracks(null, "fr")) as (id: string) => Promise<unknown>;
    expect(await play("chill")).toBeNull();
    expect(h.fetched).toEqual([]);
  });

  it("une page d'album ou de playlist d'ailleurs : « introuvable », sans appel à l'extension", async () => {
    run(() => [useMusicAlbumEntity(null, "ext:sillon:a1"), useMusicExternalPlaylist(null, "ext:sillon:p1")]);
    // Ce qui part vraiment : les requêtes permises (la bibliothèque, sans id, ne l'est pas).
    for (const q of h.queries.filter((x) => x.enabled === true)) await q.fn?.({ signal: new AbortController().signal });
    expect(h.fetched).toEqual([]);
  });
});

describe("sans le droit d'ajout de Sillon : ni cœur, ni « Ajouter à une playlist » sur un titre d'ailleurs", () => {
  it("droit retiré : absents pour un titre d'ailleurs, présents pour un titre de la bibliothèque (droits Jellyfin)", () => {
    h.data.set(JSON.stringify(["music", "rights", "sillon"]), { acquire: false, dailyLimit: 0, remainingToday: null, keepOffline: false, resetsAt: null });
    const actions = run(() => useTrackActions(sillon({ rights: "/me/rights" }), null, ui)) as { canLike: (t: unknown) => boolean; canAddToPlaylist: (t: unknown) => boolean };
    const outside = externalTrack("sillon", "x1");
    expect(actions.canLike(outside)).toBe(false);
    expect(actions.canAddToPlaylist(outside)).toBe(false);
    expect(actions.canLike(libraryTrack("j1"))).toBe(true);
    expect(actions.canAddToPlaylist(libraryTrack("j1"))).toBe(true);
  });

  it("droit accordé : présents", () => {
    h.data.set(JSON.stringify(["music", "rights", "sillon"]), { acquire: true, dailyLimit: 0, remainingToday: null, keepOffline: true, resetsAt: null });
    const actions = run(() => useTrackActions(sillon({ rights: "/me/rights" }), null, ui)) as { canLike: (t: unknown) => boolean };
    expect(actions.canLike(externalTrack("sillon", "x1"))).toBe(true);
  });

  it("titre d'une AUTRE extension que celle du serveur : aucun geste", () => {
    const actions = run(() => useTrackActions(sillon(), null, ui)) as { canLike: (t: unknown) => boolean; canAddToPlaylist: (t: unknown) => boolean };
    expect(actions.canLike(externalTrack("autre", "x1"))).toBe(false);
    expect(actions.canAddToPlaylist(externalTrack("autre", "x1"))).toBe(false);
  });
});
