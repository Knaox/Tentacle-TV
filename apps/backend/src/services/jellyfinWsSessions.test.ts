import { describe, it, expect } from "vitest";
import { sessionSignatures, type JellyfinSession } from "./jellyfinWsSessions";

const playbackOf = (user: string, item: string, pause = false): JellyfinSession => ({
  UserId: user,
  NowPlayingItem: { Id: item },
  PlayState: { IsPaused: pause },
});

describe("sessionSignatures", () => {
  it("ignore les sessions sans lecture", () => {
    const sig = sessionSignatures([{ UserId: "u1" }, { UserId: "u2", NowPlayingItem: null }]);
    expect(sig).toEqual({ playing: "", states: "" });
  });

  it("survit à une trame absente ou malformée", () => {
    expect(sessionSignatures(null)).toEqual({ playing: "", states: "" });
    expect(sessionSignatures(undefined)).toEqual({ playing: "", states: "" });
    expect(sessionSignatures({} as never)).toEqual({ playing: "", states: "" });
  });

  it("ne bouge pas quand seule la position avance", () => {
    const a = sessionSignatures([playbackOf("u1", "film-1")]);
    const b = sessionSignatures([playbackOf("u1", "film-1")]);
    expect(b).toEqual(a);
  });

  it("ne bouge pas quand Jellyfin renvoie les sessions dans un autre ordre", () => {
    const a = sessionSignatures([playbackOf("u1", "film-1"), playbackOf("u2", "film-2")]);
    const b = sessionSignatures([playbackOf("u2", "film-2"), playbackOf("u1", "film-1")]);
    expect(b).toEqual(a);
  });

  it("change quand quelqu'un commence une lecture", () => {
    const before = sessionSignatures([playbackOf("u1", "film-1")]);
    const after = sessionSignatures([playbackOf("u1", "film-1"), playbackOf("u2", "film-2")]);
    expect(after.playing).not.toBe(before.playing);
  });

  it("change quand quelqu'un passe à un autre épisode", () => {
    const before = sessionSignatures([playbackOf("u1", "ep-1")]);
    const after = sessionSignatures([playbackOf("u1", "ep-2")]);
    expect(after.playing).not.toBe(before.playing);
  });

  it("une pause borne un segment sans déranger les listes", () => {
    const before = sessionSignatures([playbackOf("u1", "film-1")]);
    const after = sessionSignatures([playbackOf("u1", "film-1", true)]);
    expect(after.playing).toBe(before.playing);
    expect(after.states).not.toBe(before.states);
  });

  it("deux personnes sur le même contenu comptent pour deux", () => {
    const sig = sessionSignatures([playbackOf("u1", "film-1"), playbackOf("u2", "film-1")]);
    expect(sig.playing.split("|")).toHaveLength(2);
  });
});
