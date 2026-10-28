/**
 * Les identités d'hier dites par l'extension (relevé du 27/10 : `ext:sillon:imp:5ce21388…`, gardé avec la playlist,
 * montré depuis sous `ext:sillon:ytm:t:7svMLLxcJYE`).
 */

import { describe, expect, it } from "vitest";
import type { MusicTrack, PendingMusicItem } from "@tentacle-tv/shared/music";
import { renamesOf, shownToFormer } from "./keptRenames";

const OLD = "imp:5ce21388-9a8a-568e-8c8f-cd87ff2538c7";
const NOW = "ytm:t:7svMLLxcJYE";
const track = (id: string): MusicTrack => ({
  key: `ext:sillon:${id}`, jellyfinId: null, external: { pluginId: "sillon", id }, title: "L'assasymphonie", artists: [], album: null,
  durationMs: 231_000, trackNumber: null, discNumber: null, year: null, artworkUrl: null,
  mbids: { recording: null, release: null, releaseGroup: null, artists: [] }, availability: "remote", format: null, favorite: false,
});
const item = (id: string, formerIds?: string[]): PendingMusicItem => ({
  operationId: `op-${id}`, externalId: id, kind: "playlistAdd", playlistId: "016730ba00b940ebb413bce5cc7ee158", position: 3, track: track(id),
  state: "pending", createdAt: 0, imported: true, ...(formerIds ? { formerIds } : {}),
});

describe("renamesOf — les identités d'hier dites par l'extension", () => {
  it("l'entrée rapprochée porte sa fiche d'hier : clé d'hier → titre d'aujourd'hui", () => {
    const renames = renamesOf([item(NOW, [OLD]), item("ytm:t:autre")]);
    expect([...renames].map(([k, t]) => [k, t.key])).toEqual([[`ext:sillon:${OLD}`, `ext:sillon:${NOW}`]]);
    expect([...shownToFormer(renames)]).toEqual([[`ext:sillon:${NOW}`, [`ext:sillon:${OLD}`]]]);
  });

  it("une identité d'hier qui mènerait à deux titres différents n'est pas rapprochée ; elle-même ou vide, ignorée", () => {
    expect(renamesOf([item(NOW, [OLD]), item("ytm:t:autre", [OLD])]).size).toBe(0);
    expect(renamesOf([item(NOW, [NOW, ""])]).size).toBe(0);
    expect(renamesOf([item(NOW, [OLD]), item(NOW, [OLD])]).size).toBe(1);
  });

  it("une extension d'avant (sans `formerIds`) : rien", () => {
    expect(renamesOf([item(NOW), item(OLD)]).size).toBe(0);
  });
});
