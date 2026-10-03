import { afterEach, describe, expect, it, vi } from "vitest";
import { userIdFrom } from "./useUserId";

afterEach(() => vi.restoreAllMocks());

describe("Id de l'utilisateur lu dans le stockage", () => {
  it("rend l'Id du compte, null sans compte ou s'il est illisible", () => {
    expect(userIdFrom(JSON.stringify({ Id: "u1", Name: "Banc" }))).toBe("u1");
    expect(userIdFrom(null)).toBeNull();
    expect(userIdFrom("{pas du json")).toBeNull();
    expect(userIdFrom(JSON.stringify({ Name: "sans Id" }))).toBeNull();
  });

  it("ne relit pas un compte inchangé : un seul JSON.parse pour mille lectures", () => {
    const raw = JSON.stringify({ Id: "u2", Policy: { IsAdministrator: false } });
    userIdFrom(null);
    const parse = vi.spyOn(JSON, "parse");
    for (let i = 0; i < 1000; i++) expect(userIdFrom(raw)).toBe("u2");
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("suit un changement de compte", () => {
    expect(userIdFrom(JSON.stringify({ Id: "a" }))).toBe("a");
    expect(userIdFrom(JSON.stringify({ Id: "b" }))).toBe("b");
  });
});
