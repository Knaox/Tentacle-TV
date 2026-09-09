/**
 * La perte de lien se juge sur un type CONNU : « aucun réseau » associé, ou un
 * réseau nommé sans données. Un type inconnu, même annoncé sans internet, ne
 * bascule jamais — c'est le chemin d'exception d'expo-network.
 */

import { describe, expect, it } from "vitest";
import { isLinkLost, mapNetworkType } from "./networkLink";

describe("isLinkLost", () => {
  it("aucun réseau associé : perdu", () => {
    expect(isLinkLost({ type: "NONE", isConnected: false })).toBe(true);
  });

  it("un type inconnu n'est jamais une bascule, même annoncé sans internet", () => {
    expect(isLinkLost({ type: "UNKNOWN", isConnected: false, isInternetReachable: false })).toBe(false);
    expect(isLinkLost({})).toBe(false);
  });

  it("un Wi-Fi qui passe des données — ou dont on ne sait rien — tient", () => {
    expect(isLinkLost({ type: "WIFI", isConnected: true })).toBe(false);
    expect(isLinkLost({ type: "WIFI", isConnected: true, isInternetReachable: null })).toBe(false);
    expect(isLinkLost({ type: "WIFI", isConnected: true, isInternetReachable: true })).toBe(false);
  });

  it("un Wi-Fi annoncé sans données est perdu (association en cours, Android 9)", () => {
    expect(isLinkLost({ type: "WIFI", isConnected: true, isInternetReachable: false })).toBe(true);
    expect(isLinkLost({ type: "CELLULAR", isConnected: false })).toBe(true);
  });
});

describe("mapNetworkType", () => {
  it("nomme le réseau, et « aucun » ce qui ne passe pas de données", () => {
    expect(mapNetworkType({ type: "WIFI", isConnected: true })).toBe("wifi");
    expect(mapNetworkType({ type: "CELLULAR", isConnected: true })).toBe("cellular");
    expect(mapNetworkType({ type: "ETHERNET", isConnected: true })).toBe("other");
    expect(mapNetworkType({ type: "WIFI", isConnected: true, isInternetReachable: false })).toBe("none");
    expect(mapNetworkType({ type: "NONE", isConnected: false })).toBe("none");
    expect(mapNetworkType({ type: "UNKNOWN" })).toBe("unknown");
    expect(mapNetworkType({})).toBe("unknown");
  });
});
