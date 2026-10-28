/**
 * Le magasin commun : la liste du compte de l'appareil, la progression sans
 * relecture, un titre renommé retrouvé sous sa clé d'aujourd'hui.
 */

import { describe, expect, it } from "vitest";
import type { KeptMusicTrack } from "../core/musicLibrary";
import { createKeptMusicStore, type KeptMusicPort } from "./keptMusicStore";
import { keptTrack } from "./testing/fixtures";

function setup(tracks: KeptMusicTrack[], owner: string | null = "compte") {
  let progress: ((fileId: number, bytes: number, expected: number | null) => void) | null = null;
  let changed: (() => void) | null = null;
  const port: KeptMusicPort = {
    enabled: () => true,
    ownerUserId: () => owner,
    list: async () => ({ tracks, collections: [] }),
    listen: (onChanged, onProgress) => {
      changed = onChanged;
      progress = onProgress;
    },
  };
  return { store: createKeptMusicStore(port), progress: () => progress!, changed: () => changed! };
}

describe("createKeptMusicStore", () => {
  it("lit la liste du compte, et la progression avance sans relire", async () => {
    const s = setup([keptTrack("jf:a", { fileId: 3, status: "queued", bytesDone: 0 })]);
    s.store.start();
    await s.store.refresh();
    expect(s.store.state().loaded).toBe(true);
    expect(s.store.completeTrack("jf:a")).toBeNull();
    s.progress()(3, 50, 100);
    expect(s.store.state().byKey.get("jf:a")).toMatchObject({ status: "downloading", bytesDone: 50 });
  });

  it("sans compte : une liste vide, connue", async () => {
    const s = setup([keptTrack("jf:a")], null);
    await s.store.refresh();
    expect(s.store.state()).toMatchObject({ loaded: true, userId: null, tracks: [] });
  });

  it("un titre renommé mène à la copie d'hier", async () => {
    const s = setup([keptTrack("ext:s:imp:1")]);
    await s.store.refresh();
    s.store.setRenames(new Map([["ext:s:ytm:t:1", ["ext:s:imp:1"]]]));
    expect(s.store.completeTrack("ext:s:ytm:t:1")?.trackKey).toBe("ext:s:imp:1");
  });
});
