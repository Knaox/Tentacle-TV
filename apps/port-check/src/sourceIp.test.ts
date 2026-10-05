import { describe, expect, it } from "vitest";
import { buildBlockList, normalizeIp, sourceIpOf } from "./sourceIp";

describe("normalizeIp", () => {
  it("une IPv4 vue en IPv6 redevient IPv4 ; le reste doit être une adresse", () => {
    expect(normalizeIp("::ffff:203.0.113.5")).toBe("203.0.113.5");
    expect(normalizeIp("[2001:DB8::5]")).toBe("2001:db8::5");
    expect(normalizeIp("pas une ip")).toBeNull();
    expect(normalizeIp(undefined)).toBeNull();
  });
});

describe("sourceIpOf", () => {
  const trusted = buildBlockList(["10.0.0.0/8", "172.16.0.5"]);

  it("sans mandataire de confiance, X-Forwarded-For est ignoré", () => {
    expect(sourceIpOf("198.51.100.20", "1.2.3.4", trusted)).toBe("198.51.100.20");
  });

  it("derrière un mandataire de confiance, le dernier saut qui n'en est pas un", () => {
    expect(sourceIpOf("10.0.0.2", "1.2.3.4, 198.51.100.20", trusted)).toBe("198.51.100.20");
    expect(sourceIpOf("10.0.0.2", "198.51.100.20, 172.16.0.5", trusted)).toBe("198.51.100.20");
    expect(sourceIpOf("10.0.0.2", ["1.2.3.4", "198.51.100.21"], trusted)).toBe("198.51.100.21");
  });

  it("un saut illisible arrête tout ; sans en-tête, l'adresse du mandataire", () => {
    expect(sourceIpOf("10.0.0.2", "1.2.3.4, n'importe quoi", trusted)).toBeNull();
    expect(sourceIpOf("10.0.0.2", undefined, trusted)).toBe("10.0.0.2");
  });
});
