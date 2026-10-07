import { describe, expect, it } from "vitest";
import { isPrivateIpv4, lanAddressOf, planPorts } from "./portPlan";

describe("planPorts", () => {
  it("un mandataire : 443 et 80, rien d'autre — Jellyfin passe par lui", () => {
    const rules = planPorts({ proxy: "caddy", hostPort: 3000, jellyfinHostPort: 8096, directPlayPublic: true });
    expect(rules.map((r) => [r.external, r.internal, r.target, r.purpose])).toEqual([
      [443, 443, "proxy", "https"],
      [80, 80, "proxy", "http_redirect"],
    ]);
  });

  it("sans mandataire : les DEUX ports, avec leurs vrais numéros — Jellyfin facultatif tant que la lecture directe extérieure est coupée", () => {
    expect(planPorts({ proxy: "none", hostPort: 47300, jellyfinHostPort: 47896, directPlayPublic: false }).map((r) => [r.external, r.target, !!r.optional])).toEqual([
      [47300, "tentacle", false],
      [47896, "jellyfin", true],
    ]);
    expect(planPorts({ proxy: "none", hostPort: 3000, jellyfinHostPort: 8096, directPlayPublic: true }).map((r) => [r.external, !!r.optional])).toEqual([[3000, false], [8096, false]]);
    expect(planPorts({ proxy: "none", hostPort: 3000, jellyfinHostPort: null, directPlayPublic: true }).map((r) => r.external)).toEqual([3000]);
  });
});

describe("lanAddressOf", () => {
  it("l'adresse IPv4 privée de l'adresse locale, sinon rien", () => {
    expect(lanAddressOf("http://192.168.1.20:3000")).toBe("192.168.1.20");
    expect(lanAddressOf("http://10.0.0.4")).toBe("10.0.0.4");
    expect(lanAddressOf("http://172.31.2.3:3000")).toBe("172.31.2.3");
    expect(lanAddressOf("http://172.32.2.3:3000")).toBeNull();
    expect(lanAddressOf("http://nas.local:3000")).toBeNull();
    expect(lanAddressOf("https://tv.example.com")).toBeNull();
    expect(lanAddressOf("pas une adresse")).toBeNull();
    expect(lanAddressOf(null)).toBeNull();
  });

  it("refuse ce qui n'est pas une IPv4", () => {
    expect(isPrivateIpv4("192.168.1")).toBe(false);
    expect(isPrivateIpv4("192.168.1.256")).toBe(false);
    expect(isPrivateIpv4("192.168.01.x")).toBe(false);
  });
});
