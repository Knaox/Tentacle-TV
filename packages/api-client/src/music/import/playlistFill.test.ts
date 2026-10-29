/** Remplir une playlist dans l'ordre (album, fichiers de l'appareil) : places, suites, refus, ordre d'un import de fichiers. */

import { describe, expect, it } from "vitest";
import type { ExternalActionOutcome, MusicAlbum, MusicPlaylistDetail, MusicTrack, ReleaseImportJob, ReleaseJobFile } from "@tentacle-tv/shared/music";
import { albumFillItems, fillPlaylist, type FillItem, type FillPort } from "./playlistFill";
import { releasePlaylistOrder, releaseTrackIds } from "./releaseOrder";

const detail = (id: string, name: string) => ({ jellyfinId: id, name }) as unknown as MusicPlaylistDetail;

function track(id: string, kind: "library" | "external"): MusicTrack {
  return {
    key: kind === "library" ? id : `ext:sillon:${id}`,
    jellyfinId: kind === "library" ? id : null,
    external: kind === "external" ? { pluginId: "sillon", id } : null,
    title: id,
    availability: kind === "library" ? "library" : "external",
  } as unknown as MusicTrack;
}

function recorder(refuseAt: number | null = null) {
  const calls: string[] = [];
  let externals = 0;
  const port: FillPort = {
    create: async (name, ids) => (calls.push(`create ${name} [${ids.join(",")}]`), detail("pl", name)),
    insert: async (id, ids, position) => (calls.push(`insert ${id} @${position} [${ids.join(",")}]`), detail(id, "x")),
    externalAdd: async (externalId, id, position): Promise<ExternalActionOutcome> => {
      calls.push(`ext ${id} @${position} ${externalId}`);
      externals += 1;
      if (refuseAt !== null && externals > refuseAt) return { ok: false, reason: "quota", message: null };
      return { ok: true, state: "pending", operationId: "op", jellyfinId: null };
    },
  };
  return { port, calls };
}

const lib = (id: string): FillItem => ({ kind: "library", jellyfinId: id });
const ext = (id: string): FillItem => ({ kind: "external", externalId: id });

describe("fillPlaylist", () => {
  it("un album de la bibliothèque : une seule requête, la création", async () => {
    const { port, calls } = recorder();
    const result = await fillPlaylist(port, { kind: "new", name: "Discovery" }, [lib("a"), lib("b"), lib("c")]);
    expect(calls).toEqual(["create Discovery [a,b,c]"]);
    expect(result).toMatchObject({ playlistId: "pl", added: 3, pending: 0, refused: 0 });
  });

  it("des fichiers importés : une playlist vide, puis chaque titre à SA place, dans l'ordre", async () => {
    const { port, calls } = recorder();
    const result = await fillPlaylist(port, { kind: "new", name: "Démos" }, [ext("t1"), ext("t2"), ext("t3")]);
    expect(calls).toEqual(["create Démos []", "ext pl @0 t1", "ext pl @1 t2", "ext pl @2 t3"]);
    expect(result).toMatchObject({ added: 3, pending: 3 });
  });

  it("une playlist existante : à la fin, l'ordre gardé entre bibliothèque et hors bibliothèque", async () => {
    const { port, calls } = recorder();
    await fillPlaylist(port, { kind: "existing", playlistId: "p9", name: "Route", entryCount: 4 }, [lib("a"), ext("x"), lib("b"), lib("c")]);
    expect(calls).toEqual(["insert p9 @4 [a]", "ext p9 @5 x", "insert p9 @6 [b,c]"]);
  });

  it("un refus de l'extension arrête l'ajout et dit combien sont restés dehors", async () => {
    const { port } = recorder(1);
    const result = await fillPlaylist(port, { kind: "new", name: "N" }, [ext("1"), ext("2"), ext("3")]);
    expect(result).toMatchObject({ added: 1, refused: 2, refusal: "quota" });
  });

  it("sans `playlistAdd`, un titre hors bibliothèque est refusé (unavailable)", async () => {
    const { port } = recorder();
    const result = await fillPlaylist({ ...port, externalAdd: undefined }, { kind: "new", name: "N" }, [ext("1")]);
    expect(result).toMatchObject({ added: 0, refused: 1, refusal: "unavailable" });
  });
});

describe("albumFillItems", () => {
  it("garde l'ordre de l'album ; un titre qu'aucune extension n'ajoute est laissé de côté", () => {
    const tracks = [track("a", "library"), track("x", "external"), track("b", "library")];
    expect(albumFillItems(tracks, () => true).map((i) => (i.kind === "library" ? i.jellyfinId : i.externalId))).toEqual(["a", "x", "b"]);
    expect(albumFillItems(tracks, () => false)).toHaveLength(2);
  });
});

const file = (name: string, trackId: string | undefined, state: ReleaseJobFile["state"] = "read"): ReleaseJobFile => ({ uploadId: name, name, size: 1, received: 1, state, trackId });
const job = (files: ReleaseJobFile[]) => ({ jobId: "j", source: "files", state: "done", files, albums: [], focus: null, createdAt: 0, updatedAt: 0 }) as ReleaseImportJob;
const album = (ids: string[]) => ({ key: "ext:sillon:al", tracks: ids.map((id) => track(id, "external")) }) as unknown as MusicAlbum;

describe("releasePlaylistOrder", () => {
  it("les titres des fichiers, refusés et pochettes exclus, doublons retrouvés gardés", () => {
    const j = job([file("02.flac", "t2"), file("cover.jpg", undefined), file("bad.mp3", undefined, "refused"), file("01.flac", "t1", "duplicate")]);
    expect(releaseTrackIds(j)).toEqual(["t2", "t1"]);
  });

  it("l'ordre est celui de l'ALBUM (piste), pas celui des fichiers ; un album complété garde ses anciens titres dehors", () => {
    const j = job([file("b.flac", "t2"), file("a.flac", "t1")]);
    expect(releasePlaylistOrder(j, [album(["old", "t1", "t2"])])).toEqual(["t1", "t2"]);
  });

  it("une archive ZIP : l'album entre en entier", () => {
    const j = job([file("Bastian Baker - TRUTH.zip", "t1")]);
    expect(releasePlaylistOrder(j, [album(["t1", "t2", "t3"])])).toEqual(["t1", "t2", "t3"]);
  });

  it("un album illisible : l'ordre des fichiers", () => {
    const j = job([file("b.flac", "t2"), file("a.flac", "t1")]);
    expect(releasePlaylistOrder(j, [null])).toEqual(["t2", "t1"]);
  });
});
