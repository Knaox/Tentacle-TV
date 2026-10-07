import { describe, expect, it } from "vitest";
import { RELOAD_RETURN_MAX_CHARS, parseReloadReturn, serializeReloadReturn } from "./reloadReturn";

describe("l'écran à rouvrir après le rechargement", () => {
  const stack = { routes: [{ name: "Home", key: "h-1" }, { name: "Settings", key: "s-2", params: { tab: "account" } }] };

  it("garde la pile, sans ses clés, et complète l'écran du dessus (l'onglet ouvert)", () => {
    const raw = serializeReloadReturn(stack, { tab: "appearance" });
    expect(parseReloadReturn(raw)).toEqual({ index: 1, routes: [{ name: "Home" }, { name: "Settings", params: { tab: "appearance" } }] });
  });

  it("aller-retour sans complément", () => {
    expect(parseReloadReturn(serializeReloadReturn(stack))).toEqual({ index: 1, routes: [{ name: "Home" }, { name: "Settings", params: { tab: "account" } }] });
  });

  it("rien à garder : pas de navigation, pile vide", () => {
    expect(serializeReloadReturn(undefined)).toBeNull();
    expect(serializeReloadReturn({ routes: [] })).toBeNull();
  });

  it("des paramètres qui ne s'écrivent pas, ou trop lourds : rien (l'accueil, comme un lancement)", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(serializeReloadReturn({ routes: [{ name: "Detail", params: cyclic }] })).toBeNull();
    expect(serializeReloadReturn({ routes: [{ name: "Detail", params: { blob: "x".repeat(RELOAD_RETURN_MAX_CHARS) } }] })).toBeNull();
  });

  it("une pile gardée illisible ne rouvre rien", () => {
    for (const raw of [null, undefined, "", "{", "[]", '{"routes":[]}', '{"routes":[{"name":""}]}', '{"routes":[{"name":"A","params":3}]}']) {
      expect(parseReloadReturn(raw)).toBeNull();
    }
  });
});
