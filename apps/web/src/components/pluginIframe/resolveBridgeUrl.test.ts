/**
 * Les quatre formes d'échappement ont été CONSTATÉES avec `new URL()`, pas
 * imaginées : deux d'entre elles produisent une URL parfaitement valide vers un
 * hôte tiers. Le test les rejoue une à une, parce qu'une régression ici
 * n'échouerait jamais bruyamment — elle enverrait simplement le jeton ailleurs.
 */

import { describe, expect, it } from "vitest";
import { resolveBridgeUrl } from "./resolveBridgeUrl";

const APP = "https://app.local";
const BACKEND = "https://tentacle.exemple";

describe("appels legitimes", () => {
  it("laisse passer un chemin d'API avec une base distante (bureau)", () => {
    expect(resolveBridgeUrl(BACKEND, "/api/plugins/seer/status", APP)).toBe(
      "https://tentacle.exemple/api/plugins/seer/status",
    );
  });

  it("laisse passer un chemin d'API en meme origine (web deploye)", () => {
    expect(resolveBridgeUrl("", "/api/plugins/seer/status", APP)).toBe(
      "https://app.local/api/plugins/seer/status",
    );
  });

  it("conserve la chaine de requete", () => {
    expect(resolveBridgeUrl(BACKEND, "/api/x?a=1&b=2", APP)).toBe(
      "https://tentacle.exemple/api/x?a=1&b=2",
    );
  });
});

describe("detournements refuses", () => {
  it("refuse une URL absolue quand la base est vide", () => {
    // Cas du web deploye en meme origine : `base` vaut "".
    expect(resolveBridgeUrl("", "https://pirate.exemple/collect", APP)).toBeNull();
  });

  it("refuse le userinfo, qui rend la base inoffensive", () => {
    // `https://tentacle.exemple` + `@pirate.exemple/x` donne une URL VALIDE
    // dont l'hote est pirate.exemple : la base devient un simple userinfo.
    expect(resolveBridgeUrl(BACKEND, "@pirate.exemple/collect", APP)).toBeNull();
  });

  it("refuse le suffixe de domaine", () => {
    // `.pirate.exemple` accole donne l'hote tentacle.exemple.pirate.exemple,
    // que l'attaquant controle.
    expect(resolveBridgeUrl(BACKEND, ".pirate.exemple/collect", APP)).toBeNull();
  });

  it("refuse l'URL protocole-relative", () => {
    expect(resolveBridgeUrl("", "//pirate.exemple/collect", APP)).toBeNull();
  });

  it("refuse un chemin qui n'est pas une chaine", () => {
    for (const valeur of [undefined, null, 42, {}, ["/api/x"]]) {
      expect(resolveBridgeUrl(BACKEND, valeur, APP)).toBeNull();
    }
  });

  it("refuse un chemin relatif sans barre de tete", () => {
    expect(resolveBridgeUrl(BACKEND, "api/x", APP)).toBeNull();
  });
});

describe("le jeton ne peut pas sortir", () => {
  it("aucune forme connue n'atteint un hote tiers", () => {
    const tentatives = [
      "https://pirate.exemple/c",
      "http://pirate.exemple/c",
      "@pirate.exemple/c",
      ".pirate.exemple/c",
      "//pirate.exemple/c",
      "\\\\pirate.exemple/c",
      "https:/pirate.exemple/c",
      "/\\pirate.exemple/c",
      "/api/../..//pirate.exemple/c",
    ];
    for (const base of ["", BACKEND]) {
      for (const path of tentatives) {
        const url = resolveBridgeUrl(base, path, APP);
        if (url === null) continue;
        // Si quelque chose passe, ce doit être sur l'origine attendue.
        expect(new URL(url).host, `${base} + ${path}`).not.toContain("pirate");
      }
    }
  });
});
