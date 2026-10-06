import { describe, expect, it } from "vitest";
import {
  SERVER_CAPABILITIES, SERVER_CAPABILITY_KEYS, isServerCapability, missingServerCapabilities, newestMissingSince,
  resolveServerCapabilities,
} from "./serverCapabilities";

describe("capacités du serveur", () => {
  it("un serveur qui déclare : sa liste fait foi, réduite aux clés connues", () => {
    const caps = resolveServerCapabilities({ version: "9.9.9", capabilities: ["admin.remoteAccess", "future.thing", 42] });
    expect([...caps]).toEqual(["admin.remoteAccess"]);
  });

  it("une liste vide déclarée vaut « rien », même pour une version récente", () => {
    expect(resolveServerCapabilities({ version: "9.9.9", capabilities: [] }).size).toBe(0);
  });

  it("un serveur 1.23.0 (sans déclaration) n'a aucune capacité récente", () => {
    expect(resolveServerCapabilities({ version: "1.23.0" }).size).toBe(0);
    expect(resolveServerCapabilities({ version: "1.23.9" }).size).toBe(0);
  });

  it("sans déclaration, une version qui atteint `since` a la clé (serveurs d'avant la liste)", () => {
    const caps = resolveServerCapabilities({ version: "v1.24.0" });
    expect(caps.size).toBe(SERVER_CAPABILITY_KEYS.length);
  });

  it("pas de réponse, réponse illisible : aucune capacité, jamais d'erreur", () => {
    expect(resolveServerCapabilities(null).size).toBe(0);
    expect(resolveServerCapabilities(undefined).size).toBe(0);
    expect(resolveServerCapabilities({}).size).toBe(0);
    expect(resolveServerCapabilities({ version: 3 }).size).toBe(0);
    expect(resolveServerCapabilities("x" as never).size).toBe(0);
  });

  it("ce qui manque, et la version qui l'apporte", () => {
    const none = resolveServerCapabilities({ version: "1.23.0" });
    expect(missingServerCapabilities(none)).toEqual(SERVER_CAPABILITY_KEYS);
    expect(newestMissingSince(none)).toBe("1.24.0");
    const all = resolveServerCapabilities({ capabilities: SERVER_CAPABILITY_KEYS });
    expect(missingServerCapabilities(all)).toEqual([]);
    expect(newestMissingSince(all)).toBeNull();
  });

  it("chaque clé porte une version lisible, et n'est reconnue que si elle existe", () => {
    for (const key of SERVER_CAPABILITY_KEYS) expect(SERVER_CAPABILITIES[key]).toMatch(/^\d+\.\d+\.\d+$/);
    expect(isServerCapability("toString")).toBe(false);
    expect(isServerCapability("jellyfin.health")).toBe(true);
  });
});
