/**
 * L'adresse principale de la machine : la route par défaut si elle mène à la
 * maison, sinon une vraie carte — jamais WSL, Hyper-V, Docker ou un VPN.
 */

import type { NetworkInterfaceInfo } from "os";
import { describe, expect, it } from "vitest";
import { choosePrimaryLanAddress, type InterfaceTable } from "./primaryLanAddress";

function v4(address: string, internal = false): NetworkInterfaceInfo {
  return { address, family: "IPv4", internal, netmask: "255.255.255.0", mac: "00:00:00:00:00:00", cidr: `${address}/24` };
}

// Un PC Windows de salon : Wi-Fi, WSL, Hyper-V, Tailscale et un VPN d'entreprise.
const WINDOWS: InterfaceTable = {
  "vEthernet (WSL (Hyper-V firewall))": [v4("172.29.48.1")],
  "vEthernet (Default Switch)": [v4("172.20.112.1")],
  Tailscale: [v4("100.101.12.4")],
  "OpenVPN Data Channel Offload": [v4("10.8.0.6")],
  "Wi-Fi": [v4("192.168.1.42")],
  "Loopback Pseudo-Interface 1": [v4("127.0.0.1", true)],
};

describe("choosePrimaryLanAddress", () => {
  it("la source de la route par défaut, quand c'est la carte de la maison", () => {
    expect(choosePrimaryLanAddress(WINDOWS, "192.168.1.42")).toBe("192.168.1.42");
  });

  it("sans route connue : la vraie carte, pas WSL ni Hyper-V ni le VPN", () => {
    expect(choosePrimaryLanAddress(WINDOWS, null)).toBe("192.168.1.42");
  });

  it("un VPN qui prend la route par défaut ne passe pas pour la maison", () => {
    expect(choosePrimaryLanAddress(WINDOWS, "10.8.0.6")).toBe("192.168.1.42");
  });

  it("un commutateur Hyper-V externe qui porte la route est la vraie carte", () => {
    const table: InterfaceTable = { "vEthernet (External)": [v4("192.168.0.10")], "vEthernet (WSL)": [v4("172.29.48.1")] };
    expect(choosePrimaryLanAddress(table, "192.168.0.10")).toBe("192.168.0.10");
  });

  it("rien de privé : aucune adresse plutôt qu'une inventée", () => {
    expect(choosePrimaryLanAddress({ Tailscale: [v4("100.64.0.2")], lo: [v4("127.0.0.1", true)] }, "100.64.0.2")).toBeNull();
  });
});
