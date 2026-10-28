import { describe, expect, it } from "vitest";
import { mosaicCandidates, pickMosaic, type MusicPlaylist, type MusicPlaylistDetail, type MusicTrack } from "@tentacle-tv/shared/music";
import { COVER_REREAD_MS, createCoverKeeper } from "./coverKeeper";
import { memoryCoverBackend } from "./coverStore";

const NOW = Date.UTC(2026, 9, 28, 12);

function track(album: string): MusicTrack {
  return {
    key: `jf:${album}1`, jellyfinId: `${album}1`, external: null, title: album, artists: [{ name: album, mbid: null, jellyfinId: `ar${album}` }],
    album: { title: album, mbid: null, jellyfinId: `al${album}` }, durationMs: 1, trackNumber: 1, discNumber: 1, year: null,
    artworkUrl: `/api/music/artwork/${album}1?tag=x`, mbids: { recording: null, release: null, releaseGroup: null, artists: [] }, availability: "library", format: null, favorite: false,
  };
}
const albums = Array.from({ length: 6 }, (_, k) => track(`a${k}`));
const candidates = mosaicCandidates(albums);

function detail(handPlaced = false, artworkUrl = "/api/music/artwork/p1?tag=img"): MusicPlaylistDetail {
  return { jellyfinId: "p1", name: "New", trackCount: 6, durationMs: null, artworkUrl, editable: true, entries: [], cover: { handPlaced, candidates } };
}
const listed = (d: MusicPlaylistDetail): MusicPlaylist => ({ ...d, ...(d.cover!.handPlaced ? {} : { mosaic: pickMosaic(candidates, "p1", NOW) }) });

function setup() {
  const backend = memoryCoverBackend();
  const fetched: string[] = [];
  const reads: string[] = [];
  let current = detail();
  let clock = NOW;
  const keeper = createCoverKeeper({
    backend,
    readDetail: async (id) => (reads.push(id), current),
    fetchImage: async (url) => (fetched.push(url), new Blob([url])),
    objectUrl: (blob) => `blob:${blob.size}`,
    revoke: () => undefined,
    now: () => clock,
  });
  return { keeper, backend, fetched, reads, setDetail: (d: MusicPlaylistDetail) => (current = d), tick: (ms: number) => (clock += ms) };
}

const kept = new Set(["p1"]);

describe("createCoverKeeper", () => {
  it("un détail déjà lu donne la couverture : aucune requête, et elle survit au redémarrage", async () => {
    const t = setup();
    await t.keeper.load("owner");
    await t.keeper.noteDetail(detail(), kept);
    await t.keeper.sync({ keptIds: kept, list: [listed(detail())], local: new Map(), online: true });
    expect(t.reads).toEqual([]);
    const again = createCoverKeeper({ backend: t.backend, readDetail: async () => detail(), fetchImage: async () => null, objectUrl: () => "blob:", revoke: () => undefined, now: () => NOW });
    await again.load("owner");
    expect(again.state().covers.get("p1")?.cover.candidates).toHaveLength(6);
  });

  it("une playlist non gardée n'est pas retenue", async () => {
    const t = setup();
    await t.keeper.load("owner");
    await t.keeper.noteDetail(detail(), new Set());
    expect(t.keeper.state().covers.size).toBe(0);
  });

  it("jamais lue : le détail se lit une fois ; la liste change : une relecture, au plus une par demi-heure", async () => {
    const t = setup();
    await t.keeper.load("owner");
    const input = { keptIds: kept, list: [listed(detail())], local: new Map<string, string>(), online: true };
    await t.keeper.sync(input);
    expect(t.reads).toEqual(["p1"]);
    await t.keeper.sync(input);
    expect(t.reads).toEqual(["p1"]);
    // L'utilisateur pose une image à la main ailleurs : la liste ne montre plus la mosaïque.
    const changed = detail(true, "/api/music/artwork/p1?tag=mine");
    t.setDetail(changed);
    await t.keeper.sync({ ...input, list: [listed(changed)] });
    expect(t.reads).toEqual(["p1"]);
    t.tick(COVER_REREAD_MS + 1);
    await t.keeper.sync({ ...input, list: [listed(changed)] });
    expect(t.reads).toEqual(["p1", "p1"]);
    expect(t.keeper.state().covers.get("p1")?.cover.handPlaced).toBe(true);
  });

  it("copie chaque image candidate qu'aucune pochette gardée ne donne, une seule fois", async () => {
    const t = setup();
    await t.keeper.load("owner");
    await t.keeper.noteDetail(detail(), kept);
    const local = new Map([[albums[0]!.artworkUrl!, "tentacle://local/a0.jpg"]]);
    await t.keeper.sync({ keptIds: kept, list: [listed(detail())], local, online: true });
    expect(t.fetched.sort()).toEqual(albums.slice(1).map((a) => a.artworkUrl).sort());
    await t.keeper.sync({ keptIds: kept, list: [listed(detail())], local, online: true });
    expect(t.fetched).toHaveLength(5);
    expect(t.keeper.state().copies.size).toBe(5);
  });

  it("posée à la main : son image est copiée, les pochettes d'albums sont oubliées", async () => {
    const t = setup();
    await t.keeper.load("owner");
    await t.keeper.noteDetail(detail(), kept);
    await t.keeper.sync({ keptIds: kept, list: null, local: new Map(), online: true });
    await t.keeper.noteDetail(detail(true), kept);
    await t.keeper.sync({ keptIds: kept, list: null, local: new Map(), online: true });
    expect([...t.keeper.state().copies.keys()]).toEqual(["/api/music/artwork/p1?tag=img"]);
    expect([...t.backend.images.values()].map((i) => i.url)).toEqual(["/api/music/artwork/p1?tag=img"]);
  });

  it("sans réseau : rien ne part ; une playlist qui n'est plus gardée est oubliée, ses images aussi", async () => {
    const t = setup();
    await t.keeper.load("owner");
    await t.keeper.noteDetail(detail(), kept);
    await t.keeper.sync({ keptIds: kept, list: null, local: new Map(), online: true });
    const before = t.fetched.length;
    await t.keeper.sync({ keptIds: kept, list: [listed(detail(true))], local: new Map(), online: false });
    expect(t.fetched).toHaveLength(before);
    expect(t.reads).toEqual([]);
    await t.keeper.sync({ keptIds: new Set(), list: null, local: new Map(), online: false });
    expect(t.keeper.state().covers.size).toBe(0);
    expect(t.backend.images.size).toBe(0);
    expect(t.backend.covers.size).toBe(0);
  });

  it("chaque compte de l'appareil a ses jaquettes", async () => {
    const t = setup();
    await t.keeper.load("owner");
    await t.keeper.noteDetail(detail(), kept);
    await t.keeper.load("other");
    expect(t.keeper.state().covers.size).toBe(0);
    await t.keeper.load("owner");
    expect(t.keeper.state().covers.size).toBe(1);
  });
});
