import { describe, it, expect } from "vitest";
import { genreDeChemin, ligneFlux, raisonCoupure } from "./journalFlux";

describe("genreDeChemin", () => {
  it("distingue un segment de son manifeste sur la même route hls1", () => {
    expect(genreDeChemin("Videos/abc/hls1/main/12.mp4")).toBe("segment");
    expect(genreDeChemin("Videos/abc/hls1/main/12.ts")).toBe("segment");
    expect(genreDeChemin("Videos/abc/hls1/main/main.m3u8")).toBe("manifeste");
  });

  it("reconnaît le manifeste maître, servi hors de hls1", () => {
    expect(genreDeChemin("Videos/abc/master.m3u8")).toBe("manifeste");
  });

  it("reconnaît le flux progressif, video comme audio", () => {
    expect(genreDeChemin("Videos/abc/stream.mp4")).toBe("flux");
    expect(genreDeChemin("Audio/abc/universal")).toBe("flux");
  });

  it("reconnaît une image", () => {
    expect(genreDeChemin("Items/abc/Images/Primary")).toBe("image");
    expect(genreDeChemin("Users/abc/Images/Primary")).toBe("image");
  });

  it("range tout le reste en api", () => {
    expect(genreDeChemin("Users/abc/Items/Latest")).toBe("api");
    expect(genreDeChemin("Items/abc/PlaybackInfo")).toBe("api");
  });
});

describe("raisonCoupure", () => {
  it("nomme le délai absolu du signal fetch", () => {
    expect(raisonCoupure(new DOMException("timed out", "TimeoutError"))).toBe("delai-absolu");
  });

  it("nomme une annulation, la nôtre comme celle de Node", () => {
    expect(raisonCoupure(new DOMException("client parti", "AbortError"))).toBe("annule");
  });

  it("creuse la cause qu'undici enveloppe dans « fetch failed »", () => {
    const enveloppe = new TypeError("fetch failed");
    (enveloppe as { cause?: unknown }).cause = Object.assign(new Error("Headers Timeout Error"), {
      code: "UND_ERR_HEADERS_TIMEOUT",
    });
    expect(raisonCoupure(enveloppe)).toBe("UND_ERR_HEADERS_TIMEOUT");
  });

  it("rend les codes système des ruptures de socket", () => {
    for (const code of ["UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET", "ECONNRESET", "ECONNREFUSED"]) {
      const enveloppe = new TypeError("fetch failed");
      (enveloppe as { cause?: unknown }).cause = Object.assign(new Error("x"), { code });
      expect(raisonCoupure(enveloppe)).toBe(code);
    }
  });

  it("voit le délai à travers l'enveloppe, quand la cause le porte", () => {
    const enveloppe = new TypeError("fetch failed");
    (enveloppe as { cause?: unknown }).cause = new DOMException("t", "TimeoutError");
    expect(raisonCoupure(enveloppe)).toBe("delai-absolu");
  });

  it("se rabat sur le message d'une erreur nue", () => {
    expect(raisonCoupure(new Error("socket hang up"))).toBe("socket hang up");
  });

  it("ne casse pas sur ce qui n'est pas une erreur", () => {
    expect(raisonCoupure("boum")).toBe("boum");
    expect(raisonCoupure(null)).toBe("null");
    expect(raisonCoupure(undefined)).toBe("undefined");
  });
});

describe("ligneFlux", () => {
  it("classe le chemin et arrondit la durée", () => {
    const l = ligneFlux({ chemin: "Videos/a/hls1/main/3.mp4", methode: "GET", ms: 1234.7, statut: 200 });
    expect(l).toMatchObject({ evt: "flux", genre: "segment", ms: 1235, statut: 200, methode: "GET" });
  });

  it("n'écrit pas les champs absents", () => {
    const l = ligneFlux({ chemin: "Items/a/PlaybackInfo", methode: "POST", ms: 12 });
    expect(l).not.toHaveProperty("statut");
    expect(l).not.toHaveProperty("attendus");
    expect(l).not.toHaveProperty("cause");
    expect(l).not.toHaveProperty("annule");
  });

  it("porte la taille annoncée, jusqu'à zéro, mais pas un content-length absent", () => {
    expect(ligneFlux({ chemin: "x", methode: "GET", ms: 1, attendus: 0 })).toHaveProperty("attendus", 0);
    expect(ligneFlux({ chemin: "x", methode: "GET", ms: 1, attendus: null })).not.toHaveProperty("attendus");
  });

  it("marque une annulation, qui n'est pas une panne", () => {
    expect(ligneFlux({ chemin: "x", methode: "GET", ms: 1, annule: true })).toHaveProperty("annule", true);
  });
});
