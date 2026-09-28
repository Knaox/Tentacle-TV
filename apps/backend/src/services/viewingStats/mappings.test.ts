import { describe, expect, it } from "vitest";
import { deviceOf } from "./distributions";
import { genreIdsFromNames, normalizeGenreName } from "./genreNames";
import { languageName } from "./present";

describe("les genres Jellyfin rapprochés de TMDB", () => {
  it("reconnaît les noms français, anglais et leurs variantes", () => {
    expect(genreIdsFromNames(["Science-Fiction", "Comédie", "Drama"])).toEqual([878, 35, 18]);
    expect(genreIdsFromNames(["Sci-Fi & Fantasy", "Action & Adventure", "Science-fiction & fantastique"])).toEqual([10765, 10759]);
    expect(genreIdsFromNames(["War & Politics", "Téléfilm", "Kids"])).toEqual([10768, 10770, 10762]);
  });

  it("ignore les étiquettes qui ne sont pas des genres, et les doublons", () => {
    expect(genreIdsFromNames(["super power", "Earth", "Anime", "Action", "action"])).toEqual([28]);
  });

  it("normalise accents, esperluettes et ponctuation", () => {
    expect(normalizeGenreName("  Science-Fiction & Fantastique ")).toBe("science fiction and fantastique");
  });
});

describe("l'application d'une séance", () => {
  it("reconnaît nos cinq clients", () => {
    expect(deviceOf("Tentacle TV - Web")).toEqual({ device: "web", client: null });
    expect(deviceOf("Tentacle TV - Desktop").device).toBe("desktop");
    expect(deviceOf("Tentacle TV - Mobile").device).toBe("mobile");
    expect(deviceOf("Tentacle TV - TV").device).toBe("tv");
    expect(deviceOf("Tentacle TV - webOS").device).toBe("webos");
  });

  it("garde le nom brut d'une autre application", () => {
    expect(deviceOf("Infuse-Direct")).toEqual({ device: "other", client: "Infuse-Direct" });
    expect(deviceOf(null)).toEqual({ device: "other", client: null });
  });
});

describe("le nom d'une langue", () => {
  it("se dit dans la langue du client, avec une majuscule", () => {
    expect(languageName("ja", "fr")).toBe("Japonais");
    expect(languageName("ko", "en")).toBe("Korean");
  });

  it("retombe sur le code pour une langue inconnue", () => {
    expect(languageName("xx", "fr")).toBe("XX");
  });
});
