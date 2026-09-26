import { describe, it, expect } from "vitest";
import { imageCacheControl, skipResponseHeader } from "./headers";

const IMAGE = { media: false, image: true };
const API = { media: false, image: false };
const MEDIA = { media: true, image: false };

describe("skipResponseHeader", () => {
  it("écarte l'Age de l'amont sur une image : il se soustrairait à NOTRE max-age", () => {
    expect(skipResponseHeader("age", IMAGE)).toBe(true);
  });

  it("garde l'Age hors des images — le proxy n'y pose pas sa propre fraîcheur", () => {
    expect(skipResponseHeader("age", API)).toBe(false);
    expect(skipResponseHeader("age", MEDIA)).toBe(false);
  });

  it("garde de quoi revalider une image", () => {
    expect(skipResponseHeader("last-modified", IMAGE)).toBe(false);
    expect(skipResponseHeader("etag", IMAGE)).toBe(false);
    expect(skipResponseHeader("content-type", IMAGE)).toBe(false);
  });

  it("écarte toujours les en-têtes de saut", () => {
    for (const kind of [IMAGE, API, MEDIA]) {
      expect(skipResponseHeader("transfer-encoding", kind)).toBe(true);
      expect(skipResponseHeader("connection", kind)).toBe(true);
    }
  });

  it("ne transmet la longueur et l'encodage que pour les flux", () => {
    expect(skipResponseHeader("content-length", API)).toBe(true);
    expect(skipResponseHeader("content-encoding", IMAGE)).toBe(true);
    expect(skipResponseHeader("content-length", MEDIA)).toBe(false);
  });
});

describe("imageCacheControl", () => {
  it("met en cache les images, et elles seules", () => {
    expect(imageCacheControl("Items/abc/Images/Primary")).toMatch(/max-age=86400/);
    expect(imageCacheControl("Users/abc/Items")).toBeNull();
  });
});
