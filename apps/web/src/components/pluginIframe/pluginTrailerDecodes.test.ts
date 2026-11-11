/**
 * L'hôte déclare les décodeurs de l'appareil pour les bandes-annonces qu'une
 * extension demande : rien pour un lecteur qui lit le H.264, `dec=vp9,opus`
 * pour le bureau CEF — et jamais hors des routes du relais.
 */
import { describe, expect, it } from "vitest";
import { declareHostTrailerDecodes } from "./pluginTrailerDecodes";

const BASE = "http://127.0.0.1:3001";
const CEF = ["vp9", "opus"] as const;
const CHROME = ["h264", "aac", "vp9", "opus"] as const;

describe("declareHostTrailerDecodes", () => {
  it("un lecteur qui lit le H.264 et l'AAC : la requête de l'extension part telle quelle", () => {
    const request = { target: `${BASE}/api/trailers/preview?tmdbId=603&mediaType=movie&lang=fr&dm=1`, body: undefined };
    expect(declareHostTrailerDecodes(request, CHROME)).toBe(request);
    expect(declareHostTrailerDecodes(request, null)).toBe(request);
  });

  it("le bureau CEF : l'aperçu, la lecture et sa préparation portent `dec=vp9,opus`", () => {
    for (const path of ["/api/trailers/preview?tmdbId=603&mediaType=movie", "/api/trailers/resolve?ytId=abcdefghijk", "/api/trailers/prepare?ytId=abcdefghijk"]) {
      expect(declareHostTrailerDecodes({ target: BASE + path, body: undefined }, CEF).target).toBe(`${BASE}${path}&dec=vp9,opus`);
    }
  });

  it("une extension qui déclare elle-même garde sa parole", () => {
    const request = { target: `${BASE}/api/trailers/preview?tmdbId=603&mediaType=movie&dec=vp9`, body: undefined };
    expect(declareHostTrailerDecodes(request, CEF)).toBe(request);
  });

  it("la préparation des aperçus à l'écran : la déclaration entre dans le corps, objet ou texte", () => {
    const target = `${BASE}/api/trailers/preview/warm`;
    const items = [{ tmdbId: "603", mediaType: "movie" }];
    expect(declareHostTrailerDecodes({ target, body: { items, lang: "fr" } }, CEF).body).toEqual({ items, lang: "fr", decodes: ["vp9", "opus"] });
    expect(declareHostTrailerDecodes({ target, body: JSON.stringify({ items }) }, CEF).body).toEqual({ items, decodes: ["vp9", "opus"] });
    const own = { target, body: { items, decodes: ["vp9"] } };
    expect(declareHostTrailerDecodes(own, CEF)).toBe(own);
    const unreadable = { target, body: "pas du JSON" };
    expect(declareHostTrailerDecodes(unreadable, CEF)).toBe(unreadable);
  });

  it("rien hors des routes du relais : ni le catalogue, ni une route d'extension, ni un chemin illisible", () => {
    for (const target of [`${BASE}/api/trailers/catalog?tmdbId=603`, `${BASE}/api/plugins/seer/discover`, `${BASE}/api/trailers/previewX`, "pas une adresse"]) {
      const request = { target, body: undefined };
      expect(declareHostTrailerDecodes(request, CEF)).toBe(request);
    }
  });
});
