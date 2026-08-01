/**
 * Le code d'erreur du changement de racine doit survivre AUX DEUX coquilles.
 *
 * Ce test existe parce que la migration vers Electron l'a cassé sans bruit :
 * Tauri rejette une chaine nue, Electron un objet `Error` au message prefixe
 * par le canal. Le lecteur ne reconnaissait que la chaine, si bien que toute
 * panne devenait `unknown` — et l'interface annoncait « dossier non
 * inscriptible » meme quand la vraie raison etait tout autre.
 */

import { describe, expect, it } from "vitest";
import { readRootError } from "./api";

describe("code d'erreur du changement de racine", () => {
  it("lit la chaine nue rendue par Tauri", () => {
    expect(readRootError("root-not-empty")).toEqual({ code: "root-not-empty" });
  });

  it("lit l'objet Error prefixe rendu par Electron", () => {
    const electron = new Error(
      "Error invoking remote method 'tentacle:downloads_set_root': Error: root-not-empty",
    );

    expect(readRootError(electron)).toEqual({ code: "root-not-empty" });
  });

  it("garde la cause systeme quand le natif la donne", () => {
    const electron = new Error(
      "Error invoking remote method 'tentacle:downloads_set_root': Error: root-not-writable: EPERM D:\\Films",
    );

    expect(readRootError(electron)).toEqual({
      code: "root-not-writable",
      detail: "EPERM D:\\Films",
    });
  });

  it("ne confond pas les deux codes", () => {
    expect(readRootError("root-not-writable").code).toBe("root-not-writable");
  });

  it("rend `unknown` sur un rejet qui ne porte aucun code", () => {
    expect(readRootError(new Error("canal refuse: downloads_set_root"))).toEqual({
      code: "unknown",
    });
    expect(readRootError(undefined)).toEqual({ code: "unknown" });
  });
});
