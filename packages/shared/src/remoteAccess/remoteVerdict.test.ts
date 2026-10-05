import { describe, expect, it } from "vitest";
import type { RemoteCheckItem, RemoteCheckReport } from "./remoteAccessContract";
import { cgnatFromRouterWan, remoteVerdict } from "./remoteVerdict";

function item(over: Partial<RemoteCheckItem>): RemoteCheckItem {
  return {
    service: "tentacle",
    scheme: "https",
    port: 443,
    host: "tv.example.com",
    family: 4,
    verdict: "open",
    httpStatus: 200,
    certificateExpires: "2027-01-01T00:00:00.000Z",
    ...over,
  };
}

function report(items: RemoteCheckItem[], v4: string | null = "203.0.113.5"): RemoteCheckReport {
  return { checkedAt: "2026-10-06T00:00:00.000Z", outcome: "done", publicIp: { v4, v6: null }, items };
}

describe("remoteVerdict", () => {
  it("HTTPS valide et port 80 qui redirige : sûr, sans remarque", () => {
    const v = remoteVerdict(report([item({}), item({ scheme: "http", port: 80, verdict: "redirect", httpStatus: 308 })]));
    expect(v.services).toHaveLength(1);
    expect(v.services[0]).toMatchObject({ state: "secure", tone: "success", causes: [] });
  });

  it("HTTP clair joignable d'Internet : rouge, même si HTTPS marche", () => {
    const v = remoteVerdict(report([item({}), item({ scheme: "http", port: 80, verdict: "open" })]));
    expect(v.services[0]).toMatchObject({ state: "exposed_http", tone: "danger" });
  });

  it("rien ne répond : port non redirigé", () => {
    const v = remoteVerdict(report([item({ scheme: "http", port: 3000, host: null, verdict: "timeout", httpStatus: null })]));
    expect(v.services[0]).toMatchObject({ state: "unreachable", causes: ["port_not_forwarded"] });
  });

  it("le port 80 fermé alors que HTTPS marche : une remarque à part", () => {
    const v = remoteVerdict(report([item({}), item({ scheme: "http", port: 80, verdict: "timeout", httpStatus: null })]));
    expect(v.services[0]).toMatchObject({ state: "secure", causes: ["http_port_closed"] });
  });

  it("refusé : la box vise le mauvais appareil ; 502 : le mandataire ne joint pas Tentacle", () => {
    expect(remoteVerdict(report([item({ verdict: "refused", httpStatus: null })])).services[0].causes).toEqual(["wrong_target"]);
    const v = remoteVerdict(report([item({ verdict: "http_error", httpStatus: 502 })]));
    expect(v.services[0]).toMatchObject({ state: "attention", causes: ["proxy_upstream"] });
  });

  it("certificat refusé : attention, cause certificat", () => {
    const v = remoteVerdict(report([item({ verdict: "tls_self_signed", httpStatus: null, certificateExpires: null })]));
    expect(v.services[0]).toMatchObject({ state: "attention", causes: ["certificate"] });
  });

  it("IPv4 joignable, IPv6 muet sur la même cible : le pare-feu IPv6 de la box", () => {
    const v = remoteVerdict(report([item({}), item({ family: 6, verdict: "timeout", httpStatus: null })]));
    expect(v.services[0]).toMatchObject({ state: "secure", causes: ["ipv6_firewall"] });
  });

  it("IPv6 que le serveur n'a pas : dit, sans assombrir le verdict", () => {
    const v = remoteVerdict(report([item({}), item({ family: 6, verdict: "not_testable", httpStatus: null })]));
    expect(v.services[0]).toMatchObject({ state: "secure", causes: ["ipv6_not_testable"] });
  });

  it("le domaine désigne une autre adresse (CDN) ou ne se résout pas", () => {
    expect(remoteVerdict(report([item({ verdict: "dns_mismatch", httpStatus: null })])).services[0].causes).toEqual(["dns_elsewhere"]);
    expect(remoteVerdict(report([item({ verdict: "dns_error", httpStatus: null })])).services[0].causes).toEqual(["dns_missing"]);
  });

  it("Jellyfin n'apparaît que s'il avait une cible", () => {
    const v = remoteVerdict(report([item({}), item({ service: "jellyfin", host: "jf.example.com", verdict: "wrong_service" })]));
    expect(v.services.map((s) => [s.service, s.state])).toEqual([
      ["tentacle", "secure"],
      ["jellyfin", "attention"],
    ]);
  });

  it("sans test, ou service injoignable : rien n'est jugé", () => {
    expect(remoteVerdict(null).services[0].state).toBe("not_checked");
    const down: RemoteCheckReport = { ...report([]), outcome: "service_unavailable" };
    expect(remoteVerdict(down).services[0].state).toBe("not_checked");
  });

  it("CGNAT soupçonné : ajouté aux causes d'un port muet", () => {
    const v = remoteVerdict(report([item({ verdict: "timeout", httpStatus: null })]), "100.72.10.4");
    expect(v.cgnat).toBe("cgnat_suspected");
    expect(v.services[0].causes).toEqual(["port_not_forwarded", "cgnat_suspected"]);
  });
});

describe("cgnatFromRouterWan", () => {
  it("compare l'adresse WAN de la box à celle vue d'Internet", () => {
    expect(cgnatFromRouterWan("203.0.113.5", null)).toBeNull();
    expect(cgnatFromRouterWan("203.0.113.5", "203.0.113.5")).toBe("none");
    expect(cgnatFromRouterWan("203.0.113.5", "198.51.100.7")).toBe("cgnat_suspected");
    expect(cgnatFromRouterWan("203.0.113.5", "100.64.0.1")).toBe("cgnat_suspected");
    expect(cgnatFromRouterWan("203.0.113.5", "100.128.0.1")).toBe("cgnat_suspected");
    expect(cgnatFromRouterWan(null, "100.127.255.1")).toBe("cgnat_suspected");
    expect(cgnatFromRouterWan("203.0.113.5", "192.168.1.1")).toBe("double_nat");
    expect(cgnatFromRouterWan(null, "203.0.113.5")).toBeNull();
  });
});
