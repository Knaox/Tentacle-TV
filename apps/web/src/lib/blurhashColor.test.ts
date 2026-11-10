import { describe, expect, it } from "vitest";

import { blurhashAverageColor, imageColorOf } from "./blurhashColor";

describe("la couleur moyenne d'un blurhash", () => {
  it("lit la composante continue — les caractères 2 à 5 — sans décoder le reste", () => {
    // L'exemple de référence du format (github.com/woltapp/blurhash). « HV6n » en base 83 :
    // 17·83³ + 31·83² + 6·83 + 49 = 9 934 485 = 0x979695.
    expect(blurhashAverageColor("LEHV6nWB2yk8pyo0adR*.7kCMdnj")).toBe("rgb(151, 150, 149)");
    // Noir et blanc purs : 0 et 16 777 215 en base 83.
    expect(blurhashAverageColor("L00000fQfQfQfQfQfQfQfQfQfQfQ")).toBe("rgb(0, 0, 0)");
  });

  it("refuse ce qui n'est pas un blurhash", () => {
    expect(blurhashAverageColor(null)).toBeNull();
    expect(blurhashAverageColor("")).toBeNull();
    expect(blurhashAverageColor("L0é00")).toBeNull();
    expect(blurhashAverageColor("L0 000fQ")).toBeNull();
    // Hors des 24 bits : `~~~~` vaut 47 458 320.
    expect(blurhashAverageColor("L0~~~~fQ")).toBeNull();
  });

  it("d'un titre : le blurhash de l'image demandée, sinon le premier de son type", () => {
    const hashes = { Primary: { a: "L00000fQfQfQ", b: "LEHV6nWB2yk8pyo0adR*.7kCMdnj" } };
    expect(imageColorOf(hashes, "Primary", "b")).toBe("rgb(151, 150, 149)");
    expect(imageColorOf(hashes, "Primary", "inconnu")).toBe("rgb(0, 0, 0)");
    expect(imageColorOf(hashes, "Primary")).toBe("rgb(0, 0, 0)");
    expect(imageColorOf(hashes, "Backdrop")).toBeNull();
    expect(imageColorOf(undefined, "Primary")).toBeNull();
  });
});
