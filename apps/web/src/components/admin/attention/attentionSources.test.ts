import { describe, expect, it } from "vitest";
import { readAdminKeyCheck, readServicesAttention } from "./attentionSources";

const db = { status: "connected" };

describe("l'état des services, résumé pour « À régler »", () => {
  it("Jellyfin relié, base en marche : rien à dire", () => {
    expect(readServicesAttention({ jellyfin: { status: "connected", url: "http://jf:8096" }, database: db }))
      .toEqual({ jellyfin: { state: "connected" }, jellyfinUrl: "http://jf:8096", databaseDown: false });
  });

  it("« disconnected » : la clé quand l'adresse est là, l'adresse sinon (et la clé si le serveur le dit)", () => {
    const missing = (jellyfin: object) => readServicesAttention({ jellyfin, database: db })?.jellyfin;
    expect(missing({ status: "disconnected", url: "http://jf:8096", apiKeyConfigured: false })).toEqual({ state: "not-configured", missing: ["key"] });
    expect(missing({ status: "disconnected", url: "", apiKeyConfigured: true })).toEqual({ state: "not-configured", missing: ["url"] });
    expect(missing({ status: "disconnected", url: "", apiKeyConfigured: false })).toEqual({ state: "not-configured", missing: ["url", "key"] });
    // Un serveur d'avant la clé facultative ne dit rien d'elle : avec une adresse, c'est forcément elle.
    expect(missing({ status: "disconnected", url: "http://jf:8096" })).toEqual({ state: "not-configured", missing: ["key"] });
  });

  it("un refus de Jellyfin : la clé, sans droits (403) ou plus reconnue ; tout autre échec : injoignable", () => {
    const state = (jellyfin: object) => readServicesAttention({ jellyfin, database: db })?.jellyfin;
    expect(state({ status: "error", error: "jellyfin-rejected", httpStatus: 403 })).toEqual({ state: "rejected", reason: "no-rights" });
    expect(state({ status: "error", error: "jellyfin-rejected", httpStatus: 401 })).toEqual({ state: "rejected", reason: "revoked" });
    expect(state({ status: "error", error: "jellyfin-unreachable" })).toEqual({ state: "unreachable" });
    expect(state({ status: "bizarre" })).toBeNull();
  });

  it("la base en panne se dit ; une autre forme de réponse ne se lit pas", () => {
    expect(readServicesAttention({ jellyfin: { status: "connected" }, database: { status: "error" } })?.databaseDown).toBe(true);
    expect(readServicesAttention({ jellyfin: "ok" })).toBeNull();
  });
});

describe("la clé d'administration", () => {
  it("traduit le contrat en français vers le modèle", () => {
    expect(readAdminKeyCheck("revoquee")).toBe("revoked");
    expect(readAdminKeyCheck("sansDroits")).toBe("no-rights");
    expect(readAdminKeyCheck("ok")).toBe("ok");
    expect(readAdminKeyCheck(null)).toBeNull();
  });
});
