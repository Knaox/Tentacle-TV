import { describe, expect, it } from "vitest";
import { directPlayIssues, reachabilityOf, suggestedPublicUrls } from "./exposurePlan";
import type { RemoteCheckReport } from "./remoteAccessContract";

const report = (over: Partial<RemoteCheckReport>): RemoteCheckReport => ({
  checkedAt: "2026-10-07T10:00:00.000Z",
  outcome: "done",
  publicIp: { v4: "203.0.113.5", v6: null },
  items: [],
  ...over,
});
const item = (verdict: RemoteCheckReport["items"][number]["verdict"]) => ({ service: "tentacle" as const, scheme: "http" as const, port: 47300, host: null, family: 4 as const, verdict, httpStatus: 200, certificateExpires: null });

describe("joignable depuis Internet ?", () => {
  it("dit ce que le test a vu, sans rien supposer", () => {
    expect(reachabilityOf(null, true)).toBe("unknown");
    expect(reachabilityOf(report({ outcome: "service_unavailable" }), true)).toBe("no_service");
    expect(reachabilityOf(report({ items: [item("open")] }), true)).toBe("open");
    expect(reachabilityOf(report({ items: [item("timeout")] }), true)).toBe("closed");
    expect(reachabilityOf(report({ items: [item("open")] }), false)).toBe("disabled");
  });
});

describe("les adresses publiques proposées", () => {
  it("sans mandataire : l'adresse de la box et les VRAIS ports", () => {
    expect(suggestedPublicUrls({ proxy: "none", publicIp: "203.0.113.5", hostPort: 47300, jellyfinPort: 47896 })).toEqual({
      tentacle: "http://203.0.113.5:47300",
      jellyfin: "http://203.0.113.5:47896",
    });
    expect(suggestedPublicUrls({ proxy: "none", publicIp: "2001:db8::5", hostPort: 3000, jellyfinPort: null })).toEqual({ tentacle: "http://[2001:db8::5]:3000", jellyfin: null });
  });

  it("avec un mandataire, ou sans adresse connue : rien d'inventé", () => {
    expect(suggestedPublicUrls({ proxy: "caddy", publicIp: "203.0.113.5", hostPort: 3000, jellyfinPort: 8096 })).toEqual({ tentacle: null, jellyfin: null });
    expect(suggestedPublicUrls({ proxy: "none", publicIp: null, hostPort: 3000, jellyfinPort: 8096 })).toEqual({ tentacle: null, jellyfin: null });
  });
});

describe("la lecture directe réglée", () => {
  it("l'adresse privée suffit ; la publique n'est exigée que si l'extérieur est allumé", () => {
    expect(directPlayIssues({ enabled: true, privateUrl: "http://192.168.1.20:8096", publicEnabled: false, publicUrl: "" })).toEqual([]);
    expect(directPlayIssues({ enabled: true, privateUrl: "", publicEnabled: false, publicUrl: "" })).toEqual(["private_missing"]);
    expect(directPlayIssues({ enabled: true, privateUrl: "http://x", publicEnabled: true, publicUrl: " " })).toEqual(["public_missing"]);
    expect(directPlayIssues({ enabled: false, privateUrl: "", publicEnabled: true, publicUrl: "" })).toEqual([]);
  });
});
