import { beforeEach, describe, expect, it } from "vitest";

import {
  COLD_START_FRESH_MS, PLAYBACK_MARKER_KEY,
  clearPlaybackMarker, coldStartLanding, readPlaybackMarker, writePlaybackMarker,
  type MarkerStorage, type PlaybackMarker,
} from "./coldStart";

const ME = { userId: "u1", deviceId: "tv1" };
const NOW = 10_000_000;

const marker = (over: Partial<PlaybackMarker> = {}): PlaybackMarker => ({
  itemId: "film", owner: ME, phase: "playing", at: NOW - 60_000, playerId: "p1", ...over,
});

describe("où rouvrir l'app après une terminaison", () => {
  it("rouvre le lecteur quand l'app a été tuée pendant son absence", () => {
    expect(coldStartLanding(marker({ phase: "background" }), { now: NOW, owner: ME }))
      .toEqual({ kind: "player", itemId: "film" });
  });

  it("rouvre la fiche — jamais le lecteur — quand l'app est morte à l'écran", () => {
    expect(coldStartLanding(marker({ phase: "playing" }), { now: NOW, owner: ME }))
      .toEqual({ kind: "detail", itemId: "film" });
  });

  it("rend l'accueil sans marqueur : le lecteur avait été quitté", () => {
    expect(coldStartLanding(null, { now: NOW, owner: ME })).toEqual({ kind: "home" });
  });

  it("rend l'accueil passé trois heures, ou pour une marque venue du futur", () => {
    expect(coldStartLanding(marker({ phase: "background", at: NOW - COLD_START_FRESH_MS - 1 }), { now: NOW, owner: ME }).kind)
      .toBe("home");
    expect(coldStartLanding(marker({ phase: "background", at: NOW - COLD_START_FRESH_MS }), { now: NOW, owner: ME }).kind)
      .toBe("player");
    expect(coldStartLanding(marker({ at: NOW + 5 * 60_000 }), { now: NOW, owner: ME }).kind).toBe("home");
  });

  it("rend l'accueil sans session, ou pour un autre compte ou un autre appareil", () => {
    expect(coldStartLanding(marker(), { now: NOW, owner: null }).kind).toBe("home");
    expect(coldStartLanding(marker(), { now: NOW, owner: { userId: "u2", deviceId: "tv1" } }).kind).toBe("home");
    expect(coldStartLanding(marker(), { now: NOW, owner: { userId: "u1", deviceId: "tv2" } }).kind).toBe("home");
  });
});

describe("le marqueur persistant", () => {
  let content: Map<string, string>;
  let storage: MarkerStorage;
  beforeEach(() => {
    content = new Map();
    storage = {
      getItem: (k) => content.get(k) ?? null,
      setItem: (k, v) => void content.set(k, v),
      removeItem: (k) => void content.delete(k),
    };
  });

  it("se relit tel qu'écrit", () => {
    writePlaybackMarker(storage, marker());
    expect(readPlaybackMarker(storage)).toEqual(marker());
  });

  it("un lecteur ne retire que le sien : l'épisode suivant garde son marqueur", () => {
    writePlaybackMarker(storage, marker({ playerId: "suivant" }));
    clearPlaybackMarker(storage, "precedent");
    expect(readPlaybackMarker(storage)?.playerId).toBe("suivant");
    clearPlaybackMarker(storage, "suivant");
    expect(content.has(PLAYBACK_MARKER_KEY)).toBe(false);
  });

  it("ignore un contenu illisible ou incomplet", () => {
    content.set(PLAYBACK_MARKER_KEY, "{pas du json");
    expect(readPlaybackMarker(storage)).toBeNull();
    content.set(PLAYBACK_MARKER_KEY, JSON.stringify({ itemId: "film", phase: "background" }));
    expect(readPlaybackMarker(storage)).toBeNull();
  });
});
