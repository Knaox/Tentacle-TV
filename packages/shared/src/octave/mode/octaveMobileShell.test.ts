import { describe, expect, it } from "vitest";
import { isOctaveTabRoot, octaveTabOf } from "./octaveTabs";

describe("octaveTabOf : l'onglet allumé par une adresse", () => {
  it("les racines des onglets", () => {
    expect(octaveTabOf("/octave")).toBe("home");
    expect(octaveTabOf("/octave/")).toBe("home");
    expect(octaveTabOf("/octave/search?q=daft")).toBe("search");
    expect(octaveTabOf("/octave/library")).toBe("library");
  });

  it("les pages de la bibliothèque allument « Bibliothèque »", () => {
    for (const p of ["/octave/liked", "/octave/playlists", "/octave/playlist/abc"]) expect(octaveTabOf(p, "search")).toBe("library");
  });

  it("« Sur cet appareil » allume « Hors ligne », sa racine", () => {
    expect(octaveTabOf("/octave/device", "library")).toBe("offline");
    expect(isOctaveTabRoot("/octave/device")).toBe(true);
  });

  it("une page empilée garde l'onglet d'où l'on vient", () => {
    expect(octaveTabOf("/octave/album/a1", "search")).toBe("search");
    expect(octaveTabOf("/octave/artist/ext%3Asillon%3Ax", "library")).toBe("library");
    expect(octaveTabOf("/octave/mood/chill")).toBe("home");
    expect(octaveTabOf("/media/123", "library")).toBe("library");
  });

  it("racine d'onglet ou page empilée", () => {
    expect(isOctaveTabRoot("/octave")).toBe(true);
    expect(isOctaveTabRoot("/octave/search?q=x")).toBe(true);
    expect(isOctaveTabRoot("/octave/liked")).toBe(false);
    expect(isOctaveTabRoot("/octave/album/a")).toBe(false);
  });
});
