import { describe, expect, it } from "vitest";
import { estUnJwt } from "./fragmentToken";

/**
 * Le discriminant entre les deux jetons que `tentacle_token` peut porter.
 *
 * Ce qui se joue derrière ces quelques lignes : un jeton Jellyfin pris pour un
 * JWT d'appareil part à `/api/auth/refresh`, s'y fait refuser, et le refus est
 * lu comme une session expirée — le client se déconnecte tout seul.
 */
describe("estUnJwt", () => {
  it("reconnaît un JWT à ses trois segments", () => {
    expect(estUnJwt("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl")).toBe(true);
  });

  it("refuse un jeton Jellyfin, qui est une chaîne opaque sans point", () => {
    expect(estUnJwt("a1b2c3d4e5f60718293a4b5c6d7e8f90")).toBe(false);
  });

  it("refuse un segment vide, un point isolé ne faisant pas un JWT", () => {
    expect(estUnJwt("eyJhbGciOiJIUzI1NiJ9..c2lnbmF0dXJl")).toBe(false);
    expect(estUnJwt("..")).toBe(false);
  });

  it("refuse un nombre de segments différent de trois", () => {
    expect(estUnJwt("un.deux")).toBe(false);
    expect(estUnJwt("un.deux.trois.quatre")).toBe(false);
  });

  it("refuse la chaîne vide", () => {
    expect(estUnJwt("")).toBe(false);
  });
});
