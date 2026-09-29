import { describe, expect, it } from "vitest";
import { autoUpdateEnabled, tagFromLocation, zipappChecksum } from "./ytDlp";

describe("autoUpdateEnabled", () => {
  it("tourne en production quand l'image porte l'épinglé", () => {
    expect(autoUpdateEnabled(undefined, "production", true)).toBe(true);
    expect(autoUpdateEnabled(undefined, "production", false)).toBe(false);
    expect(autoUpdateEnabled(undefined, "development", true)).toBe(false);
  });

  it("« 0 » coupe tout, « 1 » l'active même hors production", () => {
    expect(autoUpdateEnabled("0", "production", true)).toBe(false);
    expect(autoUpdateEnabled("1", "development", false)).toBe(true);
  });
});

describe("tagFromLocation", () => {
  it("lit la version dans la redirection de /releases/latest", () => {
    expect(tagFromLocation("https://github.com/yt-dlp/yt-dlp/releases/tag/2026.08.19")).toBe("2026.08.19");
  });

  it("rien sans redirection ni étiquette", () => {
    expect(tagFromLocation(null)).toBeNull();
    expect(tagFromLocation("https://github.com/yt-dlp/yt-dlp/releases")).toBeNull();
  });
});

describe("zipappChecksum", () => {
  const sums = [
    "0f6b2c1d9e2a1b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4  yt-dlp.exe",
    "1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6  yt-dlp",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  yt-dlp_linux",
  ].join("\n");

  it("prend la ligne du zipapp, pas celle d'un exécutable voisin", () => {
    expect(zipappChecksum(sums)).toBe("1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6");
  });

  it("refuse une somme absente ou mal formée", () => {
    expect(zipappChecksum("abc  yt-dlp")).toBeNull();
    expect(zipappChecksum("")).toBeNull();
  });
});
