import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isArtworkDecoded, isArtworkFailed, preloadArtwork, resetArtworkPreloadForTests } from "./artworkPreload";

/** Une fausse image : `decode()` réussit, sauf pour une adresse « absente » (404 servi par l'extension). */
class FakeImage {
  decoding = "auto";
  src = "";
  decode(): Promise<void> {
    return this.src.includes("absente") ? Promise.reject(new Error("EncodingError")) : Promise.resolve();
  }
}

describe("pochettes préchargées (Octave)", () => {
  beforeEach(() => {
    resetArtworkPreloadForTests();
    vi.stubGlobal("Image", FakeImage);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("une pochette décodée est retenue ; une absente aussi, pour que sa rangée naisse avec son repli", async () => {
    await preloadArtwork(["/art/ok", "/art/absente"], 250);
    expect(isArtworkDecoded("/art/ok")).toBe(true);
    expect(isArtworkFailed("/art/ok")).toBe(false);
    expect(isArtworkDecoded("/art/absente")).toBe(false);
    expect(isArtworkFailed("/art/absente")).toBe(true);
  });

  it("l'échec n'est retenu qu'une minute (une panne passagère n'est pas condamnée)", async () => {
    await preloadArtwork(["/art/absente"], 250);
    expect(isArtworkFailed("/art/absente", Date.now() + 61_000)).toBe(false);
  });
});
