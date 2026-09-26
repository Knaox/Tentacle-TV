import { describe, expect, it } from "vitest";
import { isPlayerPath } from "./route";

describe("route du lecteur", () => {
  it("reconnaît la lecture d'un média", () => {
    expect(isPlayerPath("/tv/watch/db4c1708cbb5dd1676284a40f2950aba")).toBe(true);
  });

  it("reconnaît la racine du lecteur, sans identifiant", () => {
    expect(isPlayerPath("/tv/watch")).toBe(true);
  });

  it("ne prend pas Ma liste pour le lecteur", () => {
    // Le piège du préfixe nu : « /tv/watch » est le début de « /tv/watchlist ».
    expect(isPlayerPath("/tv/watchlist")).toBe(false);
  });

  it("ignore les autres écrans", () => {
    expect(isPlayerPath("/tv/")).toBe(false);
    expect(isPlayerPath("/tv/media/050252a1ec1cb92ad13bf575a6cdc8ac")).toBe(false);
  });

  it("n'accepte pas la route du web hors de la base du portage", () => {
    expect(isPlayerPath("/watch/db4c1708cbb5dd1676284a40f2950aba")).toBe(false);
  });
});
