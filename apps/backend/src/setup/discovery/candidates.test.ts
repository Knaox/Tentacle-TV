import { describe, expect, it } from "vitest";
import { candidateHosts, parseDefaultGateway } from "./candidates";

const ROUTE = `Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT
eth0\t00000000\t010012AC\t0003\t0\t0\t0\t00000000\t0\t0\t0
eth0\t000012AC\t00000000\t0001\t0\t0\t0\t0000FFFF\t0\t0\t0`;

describe("où chercher un Jellyfin", () => {
  it("la passerelle du conteneur se lit dans la table de routage", () => {
    expect(parseDefaultGateway(ROUTE)).toBe("172.18.0.1");
    expect(parseDefaultGateway(null)).toBeNull();
    expect(parseDefaultGateway("Iface\tDestination\tGateway\n")).toBeNull();
  });

  it("Docker : l'hôte du navigateur, la passerelle, l'hôte Docker — jamais la boucle locale", () => {
    expect(candidateHosts({ browserHost: "172.16.1.30", gateway: "172.18.0.1", native: false, dockerHostAddresses: ["192.168.65.254"] }))
      .toEqual(["172.16.1.30", "172.18.0.1", "192.168.65.254"]);
    expect(candidateHosts({ browserHost: "localhost", gateway: null, native: false, dockerHostAddresses: ["127.0.0.1"] })).toEqual(["localhost"]);
    expect(candidateHosts({ browserHost: "127.0.0.1", gateway: null, native: false, dockerHostAddresses: [] })).toEqual([]);
  });

  it("natif : la machine elle-même en plus", () => {
    expect(candidateHosts({ browserHost: "192.168.1.5", gateway: null, native: true, dockerHostAddresses: [] })).toEqual(["192.168.1.5", "127.0.0.1"]);
  });

  it("jamais une adresse publique, de lien local ou de métadonnées, hors celle du navigateur", () => {
    const hosts = candidateHosts({ browserHost: "tentacle.example.com", gateway: "8.8.8.8", native: false, dockerHostAddresses: ["169.254.169.254", "100.64.0.1"] });
    expect(hosts).toEqual(["tentacle.example.com"]);
    expect(candidateHosts({ browserHost: "169.254.169.254", gateway: null, native: false, dockerHostAddresses: [] })).toEqual([]);
  });

  it("un en-tête Host piégé n'entre pas dans une URL", () => {
    expect(candidateHosts({ browserHost: "evil/../x@y", gateway: null, native: false, dockerHostAddresses: [] })).toEqual([]);
  });

  it("borné : quatre hôtes au plus", () => {
    const hosts = candidateHosts({ browserHost: "10.0.0.1", gateway: "10.0.0.2", native: true, dockerHostAddresses: ["10.0.0.3", "10.0.0.4", "10.0.0.5"] });
    expect(hosts).toHaveLength(4);
  });
});
