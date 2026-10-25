import { describe, expect, it } from "vitest";
import { octaveRightsPath, parseOctaveRightsBody, resolveOctaveAccess } from "./octaveRightsContract";

describe("« Accès à Octave » — la règle", () => {
  it("un compte sans ligne est permis (allumé par défaut)", () => {
    expect(resolveOctaveAccess({ guest: false, own: null, creator: null })).toBe(true);
  });

  it("un compte suit SA ligne", () => {
    expect(resolveOctaveAccess({ guest: false, own: { access: false }, creator: { access: true } })).toBe(false);
    expect(resolveOctaveAccess({ guest: false, own: { access: true }, creator: { access: false } })).toBe(true);
  });

  it("un invité de la Famille suit son créateur, jamais une ligne à lui", () => {
    expect(resolveOctaveAccess({ guest: true, own: { access: true }, creator: { access: false } })).toBe(false);
    expect(resolveOctaveAccess({ guest: true, own: { access: false }, creator: null })).toBe(true);
  });
});

describe("« Accès à Octave » — le correctif", () => {
  it("n'accepte que `access` en booléen", () => {
    expect(parseOctaveRightsBody({ access: false })).toEqual({ access: false });
    expect(parseOctaveRightsBody({ access: "false" })).toBeNull();
    expect(parseOctaveRightsBody({ access: true, admin: true })).toBeNull();
    expect(parseOctaveRightsBody({})).toBeNull();
    expect(parseOctaveRightsBody(null)).toBeNull();
    expect(parseOctaveRightsBody([true])).toBeNull();
  });

  it("encode le compte dans le chemin", () => {
    expect(octaveRightsPath("read", "a/b")).toBe("/api/admin/users/a%2Fb/octave");
    expect(() => octaveRightsPath("update", "")).toThrow();
  });
});
