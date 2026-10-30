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
    expect([...caps]).toEqual(SERVER_CAPABILITY_KEYS.filter((key) => SERVER_CAPABILITIES[key] === "1.24.0"));
    // Une clé venue plus tard (1.25.0 : la migration de la base) n'y est pas.
    expect(caps.has("server.databaseMigration")).toBe(false);
    expect(resolveServerCapabilities({ version: "1.25.0" }).has("server.databaseMigration")).toBe(true);
    expect(resolveServerCapabilities({ version: "1.25.0" }).has("trailers.player")).toBe(false);
    // Celles de l'app Windows (1.27.0) n'y sont pas encore en 1.26.0, ni
    // « Films pour vous » (1.27.1) en 1.27.0, ni l'aperçu au survol ni les profils
    // du bureau (1.30.0) en 1.27.1, ni le catalogue des bandes-annonces (1.30.0) en 1.29.0.
    const since = (versions: string[]) => SERVER_CAPABILITY_KEYS.filter((key) => !versions.includes(SERVER_CAPABILITIES[key]));
    expect(resolveServerCapabilities({ version: "1.26.0" }).size).toBe(since(["1.27.0", "1.27.1", "1.29.0", "1.30.0", "1.31.0", "1.31.1", "1.40.0", "1.41.0"]).length);
    expect(resolveServerCapabilities({ version: "1.27.0" }).size).toBe(since(["1.27.1", "1.29.0", "1.30.0", "1.31.0", "1.31.1", "1.40.0", "1.41.0"]).length);
    expect(resolveServerCapabilities({ version: "1.27.1" }).size).toBe(since(["1.29.0", "1.30.0", "1.31.0", "1.31.1", "1.40.0", "1.41.0"]).length);
    expect(resolveServerCapabilities({ version: "1.27.1" }).has("trailers.preview")).toBe(false);
    expect(resolveServerCapabilities({ version: "1.27.1" }).has("family.desktopProfiles")).toBe(false);
    expect(resolveServerCapabilities({ version: "1.28.0" }).size).toBe(since(["1.29.0", "1.30.0", "1.31.0", "1.31.1", "1.40.0", "1.41.0"]).length);
    expect(resolveServerCapabilities({ version: "1.29.0" }).size).toBe(since(["1.30.0", "1.31.0", "1.31.1", "1.40.0", "1.41.0"]).length);
    expect(resolveServerCapabilities({ version: "1.29.0" }).has("trailers.catalog")).toBe(false);
    // « Tendances actuelles » (1.31.0) n'est pas dans un 1.30.0 qui ne déclarerait rien.
    expect(resolveServerCapabilities({ version: "1.30.0" }).size).toBe(since(["1.31.0", "1.31.1", "1.40.0", "1.41.0"]).length);
    expect(resolveServerCapabilities({ version: "1.30.0" }).has("reco.trending")).toBe(false);
    // L'adhésion par appareil et « tous prêts » de Watch Together (1.31.1) non plus en 1.31.0.
    expect(resolveServerCapabilities({ version: "1.31.0" }).size).toBe(since(["1.31.1", "1.40.0", "1.41.0"]).length);
    expect(resolveServerCapabilities({ version: "1.31.0" }).has("watchTogether.deviceMembership")).toBe(false);
    // « Qui regarde ? » sur le mobile (1.31.1) n'est pas dans un 1.31.0 qui ne déclarerait rien.
    expect(resolveServerCapabilities({ version: "1.31.0" }).has("family.mobileProfiles")).toBe(false);
    // La synchro des notifications du téléphone (1.31.1) non plus en 1.31.0.
    expect(resolveServerCapabilities({ version: "1.31.0" }).has("notifications.pushSync")).toBe(false);
    // Les profils du mobile et du web (1.31.1) ne sont pas dans un 1.31.0 qui ne déclarerait rien.
    expect(resolveServerCapabilities({ version: "1.31.0" }).has("family.webProfiles")).toBe(false);
    // Le runtime isolé et les suggestions d'Octave (1.40.0) non plus en 1.31.1.
    expect(resolveServerCapabilities({ version: "1.31.1" }).size).toBe(since(["1.40.0", "1.41.0"]).length);
    // L'ajout en tête d'Octave (1.41.0, lot fl) non plus en 1.40.0.
    expect(resolveServerCapabilities({ version: "1.40.0" }).size).toBe(since(["1.41.0"]).length);
    expect(resolveServerCapabilities({ version: "1.40.0" }).has("music.addOnTop")).toBe(false);
    expect(resolveServerCapabilities({ version: "1.41.0" }).size).toBe(SERVER_CAPABILITY_KEYS.length);
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
    // La plus récente des versions qui apportent ce qui manque.
    expect(newestMissingSince(none)).toBe("1.41.0");
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
