import { describe, expect, it } from "vitest";
import { DECLARE_HEARTBEAT_MS, declaredPlaybackOf, shouldRedeclare } from "./declaredPlayback";
import { externalTrack, libraryTrack } from "./fixtures";
import { INITIAL_POSITION, INITIAL_SNAPSHOT, type PlayerSnapshot, type PositionState } from "./playerState";

function snap(overrides: Partial<PlayerSnapshot>): PlayerSnapshot {
  return { ...INITIAL_SNAPSHOT, ...overrides };
}

const at = (positionMs: number, running = true): PositionState => ({ ...INITIAL_POSITION, positionMs, durationMs: 200_000, running });

describe("l'écoute déclarée par Octave", () => {
  it("un titre de la bibliothèque porte son élément Jellyfin, pas de pochette (le serveur la tient de Jellyfin)", () => {
    const track = libraryTrack("abc123", { artworkUrl: "/api/music/artwork/album-1?tag=t" });
    const dto = declaredPlaybackOf(snap({ current: track, phase: "playing", wantsPlay: true }), at(12_345.7));
    expect(dto).toEqual({
      key: track.key, itemId: "abc123", title: "Titre abc123", artists: "Artiste", album: "Album",
      durationMs: 200_000, positionMs: 12_345, isPaused: false,
    });
  });

  it("un titre d'extension n'a pas d'élément, garde sa pochette et ne nomme jamais l'extension", () => {
    const track = externalTrack("sillon", "yt-1", {
      title: "Hors bibliothèque",
      artists: [{ name: "A", mbid: null, jellyfinId: null }, { name: "B", mbid: null, jellyfinId: null }],
      artworkUrl: "/api/plugins/sillon/art/1",
    });
    const dto = declaredPlaybackOf(snap({ current: track, phase: "paused" }), at(1_000, false));
    expect(dto?.itemId).toBeUndefined();
    expect(dto).toMatchObject({ title: "Hors bibliothèque", artists: "A, B", imageUrl: "/api/plugins/sillon/art/1", isPaused: true });
    expect(Object.keys(dto ?? {})).not.toContain("pluginId");
  });

  it("une pochette ni du serveur ni en https n'est pas déclarée", () => {
    for (const artworkUrl of ["javascript:alert(1)", "data:image/png;base64,AA", "http://exemple.test/a.jpg", "/api/../etc"]) {
      const dto = declaredPlaybackOf(snap({ current: externalTrack("p", "1", { artworkUrl }), phase: "playing" }), at(0));
      expect(dto?.imageUrl).toBeUndefined();
    }
    const https = declaredPlaybackOf(snap({ current: externalTrack("p", "1", { artworkUrl: "https://i.exemple.test/a.jpg" }), phase: "playing" }), at(0));
    expect(https?.imageUrl).toBe("https://i.exemple.test/a.jpg");
  });

  it("rien ne joue — arrêt, fin de file, titre en erreur : rien n'est déclaré", () => {
    expect(declaredPlaybackOf(snap({ current: null }), at(0))).toBeNull();
    for (const phase of ["idle", "ended", "error"] as const) {
      expect(declaredPlaybackOf(snap({ current: libraryTrack("a"), phase }), at(0))).toBeNull();
    }
  });

  it("une source qui charge n'avance pas : déclarée en pause", () => {
    expect(declaredPlaybackOf(snap({ current: libraryTrack("a"), phase: "starting", wantsPlay: true }), at(0))?.isPaused).toBe(true);
  });
});

describe("quand redire l'écoute", () => {
  const playing = declaredPlaybackOf(snap({ current: libraryTrack("a"), phase: "playing" }), at(10_000))!;

  it("la première fois, au changement de titre, de pause, et quand elle s'arrête", () => {
    expect(shouldRedeclare(null, playing, 0)).toBe(true);
    expect(shouldRedeclare(null, null, 0)).toBe(false);
    const last = { state: playing, at: 0 };
    expect(shouldRedeclare(last, { ...playing, key: "jf:b" }, 100)).toBe(true);
    expect(shouldRedeclare(last, { ...playing, isPaused: true }, 100)).toBe(true);
    expect(shouldRedeclare(last, null, 100)).toBe(true);
  });

  it("le son qui avance comme prévu ne dit rien ; un saut ou le battement de 15 s, si", () => {
    const last = { state: playing, at: 0 };
    expect(shouldRedeclare(last, { ...playing, positionMs: 15_000 }, 5_000)).toBe(false);
    expect(shouldRedeclare(last, { ...playing, positionMs: 60_000 }, 5_000)).toBe(true);
    expect(shouldRedeclare(last, { ...playing, positionMs: 10_000 + DECLARE_HEARTBEAT_MS }, DECLARE_HEARTBEAT_MS)).toBe(true);
  });

  it("en pause, la position attendue ne bouge pas", () => {
    const paused = { ...playing, isPaused: true };
    expect(shouldRedeclare({ state: paused, at: 0 }, paused, 5_000)).toBe(false);
    expect(shouldRedeclare({ state: paused, at: 0 }, { ...paused, positionMs: 0 }, 5_000)).toBe(true);
  });
});
