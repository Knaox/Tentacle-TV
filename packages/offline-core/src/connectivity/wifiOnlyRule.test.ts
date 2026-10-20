import { describe, expect, it } from "vitest";
import { preferDefaultNetwork, wifiOnlyAction } from "./wifiOnlyRule";

describe("quel réseau croire", () => {
  it("le réseau par défaut suivi par le natif l'emporte sur un type figé d'expo-network", () => {
    // Le Wi-Fi est arrivé après les données mobiles : expo-network dit encore « cellulaire ».
    expect(preferDefaultNetwork("wifi", "cellular")).toBe("wifi");
    expect(preferDefaultNetwork("cellular", "wifi")).toBe("cellular");
  });

  it("sans natif, ou natif qui ne sait pas : expo-network", () => {
    expect(preferDefaultNetwork(null, "wifi")).toBe("wifi");
    expect(preferDefaultNetwork("unknown", "cellular")).toBe("cellular");
  });
});

describe("« Wi-Fi seulement »", () => {
  const base = { wifiOnly: true, networkType: "wifi" as const, cellularAck: false, reachable: true };

  it("en Wi-Fi, ce qui attendait repart — même avant la première sonde du serveur", () => {
    expect(wifiOnlyAction(base)).toBe("resume");
    expect(wifiOnlyAction({ ...base, reachable: null })).toBe("resume");
    expect(wifiOnlyAction({ ...base, reachable: undefined })).toBe("resume");
  });

  it("en données mobiles, tout se met de côté — sauf « continuer en données mobiles »", () => {
    expect(wifiOnlyAction({ ...base, networkType: "cellular" })).toBe("suspend");
    expect(wifiOnlyAction({ ...base, networkType: "cellular", cellularAck: true })).toBe("resume");
  });

  it("réglage coupé : les données mobiles ne retiennent rien", () => {
    expect(wifiOnlyAction({ ...base, wifiOnly: false, networkType: "cellular" })).toBe("resume");
  });

  it("serveur su injoignable : rien à relever, son retour s'en chargera", () => {
    expect(wifiOnlyAction({ ...base, reachable: false })).toBe("none");
  });
});
