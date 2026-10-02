import { describe, expect, it } from "vitest";
import { RELAY_TOKEN_TTL_MS, signRelayToken, verifyRelayToken } from "./relayToken";

const NOW = 1_790_000_000_000;

describe("jeton du relais", () => {
  it("ouvre les flux de la vidéo signée, jusqu'à son échéance", () => {
    const token = signRelayToken("Way9Dexny3w", NOW);
    expect(verifyRelayToken("Way9Dexny3w", token, NOW)).toBe(true);
    expect(verifyRelayToken("Way9Dexny3w", token, NOW + RELAY_TOKEN_TTL_MS - 1000)).toBe(true);
    expect(verifyRelayToken("Way9Dexny3w", token, NOW + RELAY_TOKEN_TTL_MS + 1000)).toBe(false);
  });

  it("n'ouvre pas une autre vidéo", () => {
    expect(verifyRelayToken("uYPbbksJxIg", signRelayToken("Way9Dexny3w", NOW), NOW)).toBe(false);
  });

  it("refuse un jeton absent, abîmé ou dont l'échéance a été retouchée", () => {
    const token = signRelayToken("Way9Dexny3w", NOW);
    const [expiry, signature] = token.split(".");
    const later = (parseInt(expiry, 36) + 3600).toString(36);
    expect(verifyRelayToken("Way9Dexny3w", undefined, NOW)).toBe(false);
    expect(verifyRelayToken("Way9Dexny3w", "", NOW)).toBe(false);
    expect(verifyRelayToken("Way9Dexny3w", `${expiry}.`, NOW)).toBe(false);
    expect(verifyRelayToken("Way9Dexny3w", `${later}.${signature}`, NOW)).toBe(false);
  });
});
