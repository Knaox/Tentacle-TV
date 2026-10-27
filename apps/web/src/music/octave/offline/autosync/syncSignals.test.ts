import { describe, expect, it } from "vitest";
import type { MusicEvent } from "@tentacle-tv/shared/music";
import { onSyncSignal, signalMusicEvent, type SyncSignal } from "./syncSignals";

function heard(event: MusicEvent): SyncSignal[] {
  const out: SyncSignal[] = [];
  const off = onSyncSignal((s) => out.push(s));
  signalMusicEvent(event);
  off();
  return out;
}

describe("signalMusicEvent", () => {
  it("une playlist modifiée, un titre ajouté OU mis à jour, une version Jellyfin arrivée réveillent la tenue à jour", () => {
    expect(heard({ type: "music:playlist", playlistId: "p1" })).toEqual([{ kind: "playlist", playlistId: "p1" }]);
    expect(heard({ type: "music:library", added: [{ jellyfinId: "a", recording: null }], updated: [], removed: [] })).toEqual([{ kind: "library" }]);
    // Jellyfin pose le titre puis lit ses étiquettes : la mise à jour compte.
    expect(heard({ type: "music:library", added: [], updated: [{ jellyfinId: "a", recording: null }], removed: [] })).toEqual([{ kind: "library" }]);
    expect(heard({ type: "music:resolved", pluginId: "musique", externalId: "ytm:t:x", jellyfinId: "z", recording: null, track: null })).toEqual([
      { kind: "twin", externalKey: "ext:musique:ytm:t:x", track: null },
    ]);
  });

  it("des attentes changées (une playlist importée a gagné, perdu ou renommé un titre) réveillent la tenue à jour", () => {
    expect(heard({ type: "music:pending", pluginId: "sillon" })).toEqual([{ kind: "pending" }]);
  });

  it("le reste ne réveille rien", () => {
    expect(heard({ type: "music:library", added: [], updated: [], removed: ["a"] })).toEqual([]);
    expect(heard({ type: "music:userdata", changes: [] })).toEqual([]);
  });
});
