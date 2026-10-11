import type { NetworkInterfaceInfo } from "node:os";
import { describe, expect, it } from "vitest";
import { isExcludedInterface, isPrivateIPv4, pickLanAddress } from "./lanAddress";

function v4(address: string, internal = false): NetworkInterfaceInfo {
  return { address, family: "IPv4", internal, netmask: "255.255.255.0", mac: "00:00:00:00:00:00", cidr: `${address}/24` };
}

describe("pickLanAddress", () => {
  const nics = {
    "Ethernet": [v4("192.168.1.20")],
    "vEthernet (WSL (Hyper-V firewall))": [v4("172.24.16.1")],
    "Tailscale": [v4("100.101.3.4")],
    "Loopback Pseudo-Interface 1": [v4("127.0.0.1", true)],
  };

  it("prend l'adresse de la route par défaut quand c'est une vraie carte", () => {
    expect(pickLanAddress("192.168.1.20", nics)).toBe("192.168.1.20");
  });

  it("écarte WSL et Tailscale même s'ils portent la route", () => {
    expect(pickLanAddress("172.24.16.1", nics)).toBe("192.168.1.20");
    expect(pickLanAddress("100.101.3.4", nics)).toBe("192.168.1.20");
  });

  it("préfère le réseau de la box sans route connue", () => {
    expect(pickLanAddress(null, { "Wi-Fi": [v4("10.0.0.5")], "Ethernet 2": [v4("192.168.0.9")] })).toBe("192.168.0.9");
  });

  it("rend null sans carte utilisable", () => {
    expect(pickLanAddress("127.0.0.1", { Loopback: [v4("127.0.0.1", true)] })).toBeNull();
  });
});

describe("filtres", () => {
  it("ne tient pour privées que les plages RFC 1918", () => {
    expect(isPrivateIPv4("172.16.0.1")).toBe(true);
    expect(isPrivateIPv4("172.32.0.1")).toBe(false);
    expect(isPrivateIPv4("100.64.0.1")).toBe(false);
    expect(isPrivateIPv4("169.254.3.3")).toBe(false);
    expect(isPrivateIPv4("192.168.1")).toBe(false);
  });

  it("reconnaît les cartes virtuelles", () => {
    expect(isExcludedInterface("vEthernet (Default Switch)")).toBe(true);
    expect(isExcludedInterface("Wi-Fi")).toBe(false);
  });
});
