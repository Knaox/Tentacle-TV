import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEEN_IMAGES_MAX, isImageReady, markImageSeen, resetSeenImagesForTests, wasImageSeen } from "./seenImages";

beforeEach(() => resetSeenImagesForTests());
afterEach(() => vi.unstubAllGlobals());

describe("seenImages — les images déjà montrées", () => {
  it("retient une image chargée, ignore une adresse vide", () => {
    expect(wasImageSeen("/a.jpg")).toBe(false);
    markImageSeen("/a.jpg");
    markImageSeen("");
    markImageSeen(null);
    expect(wasImageSeen("/a.jpg")).toBe(true);
    expect(wasImageSeen("")).toBe(false);
    expect(wasImageSeen(undefined)).toBe(false);
  });

  it("borné : la plus ancienne sort, une image revue est rafraîchie", () => {
    markImageSeen("/premiere.jpg");
    markImageSeen("/revue.jpg");
    for (let i = 0; i < SEEN_IMAGES_MAX - 2; i += 1) markImageSeen(`/i${i}.jpg`);
    markImageSeen("/revue.jpg"); // revue : elle repasse en tête
    markImageSeen("/derniere.jpg"); // une de trop : la plus ancienne sort
    expect(wasImageSeen("/premiere.jpg")).toBe(false);
    expect(wasImageSeen("/revue.jpg")).toBe(true);
    expect(wasImageSeen("/derniere.jpg")).toBe(true);
  });
});

describe("isImageReady — affichable tout de suite ?", () => {
  /** Une image du navigateur : `complete` et dimensions dès l'affectation de `src` si l'adresse est en cache. */
  function stubImage(cached: ReadonlySet<string>) {
    vi.stubGlobal("Image", class {
      complete = false;
      naturalWidth = 0;
      set src(url: string) {
        this.complete = cached.has(url);
        this.naturalWidth = cached.has(url) ? 1920 : 0;
      }
    });
  }

  it("déjà montrée : oui, sans sonder", () => {
    stubImage(new Set());
    markImageSeen("/vue.jpg");
    expect(isImageReady("/vue.jpg")).toBe(true);
  });

  it("dans le cache mémoire du navigateur : oui, et retenue", () => {
    stubImage(new Set(["/cache.jpg"]));
    expect(isImageReady("/cache.jpg")).toBe(true);
    expect(wasImageSeen("/cache.jpg")).toBe(true);
  });

  it("à charger (première fois, réseau) : non", () => {
    stubImage(new Set());
    expect(isImageReady("/neuve.jpg")).toBe(false);
    expect(isImageReady(null)).toBe(false);
  });
});
