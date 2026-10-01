import { beforeEach, describe, expect, it } from "vitest";

import {
  COLD_START_FRESH_MS, PLAYBACK_MARKER_KEY,
  clearPlaybackMarker, coldStartDetailId, coldStartLanding, readPlaybackMarker, writePlaybackMarker,
  type MarkerStorage, type PlaybackMarker,
} from "./coldStart";

const ME = { userId: "u1", deviceId: "tv1" };
const NOW = 10_000_000;

const marker = (over: Partial<PlaybackMarker> = {}): PlaybackMarker => ({
  itemId: "film", owner: ME, phase: "playing", at: NOW - 60_000, playerId: "p1", ...over,
});

describe("où rouvrir l'app après une terminaison", () => {
  it("rouvre la fiche — jamais le lecteur — quand l'app a été tuée pendant son absence", () => {
    expect(coldStartLanding(marker({ phase: "background" }), { now: NOW, owner: ME }))
      .toEqual({ kind: "detail", itemId: "film" });
  });

  it("rouvre la fiche — jamais le lecteur — quand l'app est morte à l'écran", () => {
    expect(coldStartLanding(marker({ phase: "playing" }), { now: NOW, owner: ME }))
      .toEqual({ kind: "detail", itemId: "film" });
  });

  it("garde la série d'un épisode, pour ouvrir sa fiche même sans réseau", () => {
    expect(coldStartLanding(marker({ itemId: "s1e5", seriesId: "serie" }), { now: NOW, owner: ME }))
      .toEqual({ kind: "detail", itemId: "s1e5", seriesId: "serie" });
  });

  it("rend l'accueil sans marqueur : le lecteur avait été quitté", () => {
    expect(coldStartLanding(null, { now: NOW, owner: ME })).toEqual({ kind: "home" });
  });

  it("rend l'accueil passé trois heures, ou pour une marque venue du futur", () => {
    expect(coldStartLanding(marker({ phase: "background", at: NOW - COLD_START_FRESH_MS - 1 }), { now: NOW, owner: ME }).kind)
      .toBe("home");
    expect(coldStartLanding(marker({ phase: "background", at: NOW - COLD_START_FRESH_MS }), { now: NOW, owner: ME }).kind)
      .toBe("detail");
    expect(coldStartLanding(marker({ at: NOW + 5 * 60_000 }), { now: NOW, owner: ME }).kind).toBe("home");
  });

  it("rend l'accueil sans session, ou pour un autre compte ou un autre appareil", () => {
    expect(coldStartLanding(marker(), { now: NOW, owner: null }).kind).toBe("home");
    expect(coldStartLanding(marker(), { now: NOW, owner: { userId: "u2", deviceId: "tv1" } }).kind).toBe("home");
    expect(coldStartLanding(marker(), { now: NOW, owner: { userId: "u1", deviceId: "tv2" } }).kind).toBe("home");
  });
});

describe("la fiche de la relance", () => {
  const film = { kind: "detail" as const, itemId: "film" };
  const episode = { kind: "detail" as const, itemId: "s1e5", seriesId: "serie" };

  it("un film ouvre sa propre fiche", () => {
    expect(coldStartDetailId(film, { Type: "Movie" })).toBe("film");
    expect(coldStartDetailId(film)).toBe("film");
  });

  it("un épisode ouvre la fiche de sa série — l'item relu fait foi", () => {
    expect(coldStartDetailId(episode, { Type: "Episode", SeriesId: "serie" })).toBe("serie");
    expect(coldStartDetailId({ kind: "detail", itemId: "s1e5" }, { Type: "Episode", SeriesId: "serie" })).toBe("serie");
  });

  it("sans l'item (serveur muet), la série que le marqueur a notée", () => {
    expect(coldStartDetailId(episode)).toBe("serie");
    expect(coldStartDetailId(episode, null)).toBe("serie");
  });

  it("un épisode sans série connue ouvre sa propre fiche", () => {
    expect(coldStartDetailId({ kind: "detail", itemId: "s1e5" }, { Type: "Episode", SeriesId: null })).toBe("s1e5");
    expect(coldStartDetailId({ kind: "detail", itemId: "s1e5" })).toBe("s1e5");
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

  it("porte la position de l'arrêt d'arrière-plan, et la relit", () => {
    writePlaybackMarker(storage, marker({ positionSeconds: 106.4 }));
    expect(readPlaybackMarker(storage)?.positionSeconds).toBe(106.4);
  });

  it("un marqueur d'avant la position (version précédente) reste valable", () => {
    const { positionSeconds: _absent, ...older } = marker({ positionSeconds: 1 });
    content.set(PLAYBACK_MARKER_KEY, JSON.stringify(older));
    expect(readPlaybackMarker(storage)?.positionSeconds).toBeUndefined();
  });

  it("une position illisible rend le marqueur illisible", () => {
    content.set(PLAYBACK_MARKER_KEY, JSON.stringify({ ...marker(), positionSeconds: "106" }));
    expect(readPlaybackMarker(storage)).toBeNull();
  });

  it("porte la série d'un épisode ; une série illisible rend le marqueur illisible", () => {
    writePlaybackMarker(storage, marker({ seriesId: "serie" }));
    expect(readPlaybackMarker(storage)?.seriesId).toBe("serie");
    content.set(PLAYBACK_MARKER_KEY, JSON.stringify({ ...marker(), seriesId: 42 }));
    expect(readPlaybackMarker(storage)).toBeNull();
  });

  it("ignore un contenu illisible ou incomplet", () => {
    content.set(PLAYBACK_MARKER_KEY, "{pas du json");
    expect(readPlaybackMarker(storage)).toBeNull();
    content.set(PLAYBACK_MARKER_KEY, JSON.stringify({ itemId: "film", phase: "background" }));
    expect(readPlaybackMarker(storage)).toBeNull();
  });
});
