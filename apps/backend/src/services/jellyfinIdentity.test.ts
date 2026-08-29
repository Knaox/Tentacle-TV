import { describe, expect, it } from "vitest";
import { buildAuthHeader, buildDeviceId, buildOpaqueDiscriminant } from "./jellyfinIdentity";

describe("buildDeviceId", () => {
  it("est stable pour un même couple installation / appareil", () => {
    const a = buildDeviceId("a1b2c3d4e5f6", "web", "uuid-navigateur");
    const b = buildDeviceId("a1b2c3d4e5f6", "web", "uuid-navigateur");
    expect(a).toBe(b);
  });

  it("sépare deux installations — le bug d'origine (dev et prod sur le même Jellyfin)", () => {
    const dev = buildDeviceId("aaaaaaaaaaaa", "web", "uuid-navigateur");
    const prod = buildDeviceId("bbbbbbbbbbbb", "web", "uuid-navigateur");
    expect(dev).not.toBe(prod);
  });

  it("sépare deux appareils d'une même installation", () => {
    const pc = buildDeviceId("a1b2c3d4e5f6", "web", "uuid-pc");
    const portable = buildDeviceId("a1b2c3d4e5f6", "web", "uuid-portable");
    expect(pc).not.toBe(portable);
  });

  it("sépare les usages d'une même installation", () => {
    const install = "a1b2c3d4e5f6";
    const ids = (["web", "setup", "provisioning", "backend"] as const).map((k) =>
      buildDeviceId(install, k),
    );
    expect(new Set(ids).size).toBe(4);
  });

  it("reste ASCII avec un nom de compte accentué (repli sans appareil client)", () => {
    const id = buildDeviceId("a1b2c3d4e5f6", "provisioning", "Mélissa");
    expect(id).toMatch(/^[\x20-\x7E]+$/);
    expect(id).not.toContain("é");
  });

  it("neutralise un discriminant contenant un guillemet", () => {
    const id = buildDeviceId("a1b2c3d4e5f6", "web", 'evil" Device="x');
    expect(id).not.toContain('"');
  });
});

describe("buildOpaqueDiscriminant", () => {
  const SECRET = "secret-d-instance";

  it("est stable pour un même couple appareil / compte", () => {
    const a = buildOpaqueDiscriminant(SECRET, ["uuid-navigateur", "damien"]);
    const b = buildOpaqueDiscriminant(SECRET, ["uuid-navigateur", "damien"]);
    expect(a).toBe(b);
  });

  // LE test du vecteur de déconnexion ciblée : un utilisateur qui rejoue
  // l'appareil d'un autre ne doit pas retomber sur l'identifiant de sa victime,
  // sans quoi Jellyfin révoquerait la session de celle-ci.
  it("sépare deux comptes rejouant le MÊME appareil", () => {
    const victim = buildOpaqueDiscriminant(SECRET, ["uuid-de-la-victime", "victime"]);
    const attacker = buildOpaqueDiscriminant(SECRET, ["uuid-de-la-victime", "attaquant"]);
    expect(attacker).not.toBe(victim);
  });

  it("sépare deux appareils d'un même compte", () => {
    const pc = buildOpaqueDiscriminant(SECRET, ["uuid-pc", "damien"]);
    const portable = buildOpaqueDiscriminant(SECRET, ["uuid-portable", "damien"]);
    expect(pc).not.toBe(portable);
  });

  it("n'est pas reproductible sans le secret du serveur", () => {
    const withSecret = buildOpaqueDiscriminant(SECRET, ["uuid", "damien"]);
    const withoutSecret = buildOpaqueDiscriminant("autre-secret", ["uuid", "damien"]);
    expect(withSecret).not.toBe(withoutSecret);
  });

  // Sans séparateur, ("ab","c") et ("a","bc") donneraient le même haché — donc
  // un compte nommé « c » pourrait viser l'appareil « ab » d'un compte « bc ».
  it("ne confond pas deux découpages de la même concaténation", () => {
    expect(buildOpaqueDiscriminant(SECRET, ["ab", "c"]))
      .not.toBe(buildOpaqueDiscriminant(SECRET, ["a", "bc"]));
  });

  it("produit un identifiant hexadécimal court et ASCII", () => {
    const d = buildOpaqueDiscriminant(SECRET, ["uuid", "Mélissa"]);
    expect(d).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("buildAuthHeader", () => {
  it("produit un en-tête MediaBrowser complet", () => {
    const header = buildAuthHeader({ device: "Web", deviceId: "tentacle-abc-web-42" });
    expect(header).toContain('Client="Tentacle TV"');
    expect(header).toContain('Device="Web"');
    expect(header).toContain('DeviceId="tentacle-abc-web-42"');
    expect(header).toContain("Version=");
    expect(header).not.toContain("Token=");
  });

  it("ajoute le token quand il est fourni", () => {
    const header = buildAuthHeader({
      device: "Tentacle Backend",
      deviceId: "tentacle-abc-backend",
      client: "Tentacle Server",
      token: "abc123",
    });
    expect(header).toContain('Token="abc123"');
    expect(header).toContain('Client="Tentacle Server"');
    // Les espaces d'un nom lisible sont conservés (valides entre guillemets).
    expect(header).toContain('Device="Tentacle Backend"');
  });

  it("empêche une injection d'en-tête par le nom d'appareil", () => {
    const header = buildAuthHeader({ device: 'X", Token="vole', deviceId: "tentacle-abc-web" });
    expect(header).not.toContain('Token="vole"');
  });

  // Défense en profondeur : les appelants passent tous par buildDeviceId, qui
  // encode déjà. Cette garde couvre le futur appelant qui l'oublierait.
  it("empêche une injection d'en-tête par un DeviceId brut", () => {
    const header = buildAuthHeader({ device: "Web", deviceId: 'x", Token="vole' });
    expect(header).not.toContain('Token="vole"');
    expect(header.match(/"/g)?.length).toBe(8); // 4 paires, aucun guillemet en trop
  });

  it("retire les caractères non-ASCII des libellés", () => {
    const header = buildAuthHeader({ device: "Café", deviceId: "tentacle-abc-web" });
    expect(header).toMatch(/^[\x20-\x7E]+$/);
  });
});
