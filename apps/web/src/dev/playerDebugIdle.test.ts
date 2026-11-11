import { describe, expect, it } from "vitest";
import { hasMpvPlayback, idleVerdict } from "./playerDebugIdle";
import { verdicts } from "./playerDebugVerdict";

describe("le diagnostic sans lecture mpv", () => {
  it("sans fichier chargé, mpv ne lit rien — quelles que soient ses autres propriétés", () => {
    expect(hasMpvPlayback({})).toBe(false);
    expect(hasMpvPlayback({ path: null, "hwdec-current": "no" })).toBe(false);
    expect(hasMpvPlayback({ path: "" })).toBe(false);
    expect(hasMpvPlayback({ path: "http://serveur/Videos/1/stream.mkv" })).toBe(true);
  });

  it("ce que la garde évite : des verdicts tranchés, dont un rouge, sur des propriétés vides", () => {
    const lines = verdicts({}, false);
    expect(lines.find((v) => v.key === "Source")?.value).toBe("lecture directe");
    expect(lines.find((v) => v.key === "Decodage")?.good).toBe(false);
  });

  it("une seule ligne neutre, qui dit qui a la main", () => {
    expect(idleVerdict(false)).toEqual({ key: "Lecture", value: "aucune lecture mpv en cours", good: null });
    expect(idleVerdict(true).value).toMatch(/lecteur web a la main/);
    expect(idleVerdict(true).good).toBeNull();
  });
});
