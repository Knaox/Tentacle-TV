import { describe, expect, it } from "vitest";
import { isOctaveTabRoot, octaveTabOf } from "./octaveTabs";
import { octaveStayVerdict } from "./octaveStay";

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

describe("octaveStayVerdict : rester dans Octave", () => {
  const settled = (available: boolean) => ({ available, settled: true });
  const pending = { available: false, settled: false };

  it("disponible : ouvert", () => {
    expect(octaveStayVerdict({ fresh: settled(true), failed: false, mirrorAvailable: false })).toBe("open");
  });

  it("une panne n'est jamais une absence : on reste (hors ligne)", () => {
    expect(octaveStayVerdict({ fresh: settled(false), failed: true, mirrorAvailable: false })).toBe("open");
  });

  it("en attente : ouvert si le miroir le dit, sinon on attend", () => {
    expect(octaveStayVerdict({ fresh: pending, failed: false, mirrorAvailable: true })).toBe("open");
    expect(octaveStayVerdict({ fresh: pending, failed: false, mirrorAvailable: false })).toBe("wait");
  });

  it("une absence ÉTABLIE rend la main à Tentacle", () => {
    expect(octaveStayVerdict({ fresh: settled(false), failed: false, mirrorAvailable: true })).toBe("leave");
  });
});
