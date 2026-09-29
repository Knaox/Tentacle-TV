import { describe, expect, it } from "vitest";
import { readServerLinksReport } from "./serverLinksReader";

/**
 * La réponse de `/api/admin/server-links`, lue champ par champ : le bureau
 * parle à des serveurs de toutes versions, un champ inconnu vaut « non
 * sondé » et ne fait jamais tomber la vue d'ensemble.
 */
describe("readServerLinksReport", () => {
  it("lit un rapport complet", () => {
    const report = readServerLinksReport({
      checkedAt: "2026-09-29T12:00:00.000Z",
      tentacle: { url: "https://tv.example.com", source: "config", probe: { result: "ok", httpStatus: 200, version: null, cors: null, detail: null } },
      direct: {
        enabled: true,
        publicUrl: "https://jf.example.com",
        privateUrl: "http://192.168.1.50:8096",
        publicProbe: { result: "ok", httpStatus: 200, version: "10.11.8", cors: false, detail: null },
        privateProbe: { result: "timeout", httpStatus: null, version: null, cors: null, detail: null },
      },
      legacyClientsRelayed: true,
      jellyfinUrl: "http://jellyfin:8096",
    });
    expect(report?.direct.publicProbe).toEqual({ result: "ok", httpStatus: 200, version: "10.11.8", cors: false, detail: null });
    expect(report?.direct.privateProbe?.result).toBe("timeout");
    expect(report?.legacyClientsRelayed).toBe(true);
  });

  it("une sonde au résultat inconnu vaut « non sondé »", () => {
    const report = readServerLinksReport({
      tentacle: { url: "https://tv.example.com", source: "db", probe: { result: "quantique" } },
      direct: { enabled: "oui" },
    });
    expect(report?.tentacle).toEqual({ url: "https://tv.example.com", source: null, probe: null });
    expect(report?.direct.enabled).toBe(false);
    expect(report?.legacyClientsRelayed).toBeNull();
  });

  it("autre chose qu'un rapport : rien", () => {
    expect(readServerLinksReport(null)).toBeNull();
    expect(readServerLinksReport({ tentacle: {} })).toBeNull();
  });
});
