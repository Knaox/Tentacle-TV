import { describe, expect, it } from "vitest";
import { classifyAddress, expandIpv6, isLoopbackName } from "./addressGuard";

describe("adresses où chercher un Jellyfin", () => {
  it("réseau local et Internet : acceptés", () => {
    for (const ip of ["10.0.0.5", "172.18.0.3", "192.168.1.10", "100.64.1.1", "8.8.8.8", "fd12:3456::1", "2001:db8::1", "::ffff:192.168.1.1"]) {
      expect(classifyAddress(ip), ip).toBe("ok");
    }
  });

  it("la machine elle-même : à part (refusée dans Docker seulement)", () => {
    for (const ip of ["127.0.0.1", "127.8.9.10", "::1", "[::1]", "::ffff:127.0.0.1"]) {
      expect(classifyAddress(ip), ip).toBe("loopback");
    }
  });

  it("métadonnées des clouds, lien local, non spécifiée, multidiffusion, réservée : jamais", () => {
    for (const ip of [
      "169.254.169.254", "169.254.0.1", "0.0.0.0", "0.1.2.3", "224.0.0.1", "239.255.255.250", "240.0.0.1", "255.255.255.255",
      "::", "fe80::1", "fe80::1%eth0", "ff02::1", "::ffff:169.254.169.254", "64:ff9b::a9fe:a9fe", "fd00:ec2::254",
      "pas-une-ip", "",
    ]) {
      expect(classifyAddress(ip), ip).toBe("forbidden");
    }
  });

  it("déplie une IPv6, IPv4 finale comprise", () => {
    expect(expandIpv6("::1")).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(expandIpv6("fd00:ec2::254")).toEqual([0xfd00, 0xec2, 0, 0, 0, 0, 0, 0x254]);
    expect(expandIpv6("::ffff:10.1.2.3")).toEqual([0, 0, 0, 0, 0, 0xffff, 0x0a01, 0x0203]);
    expect(expandIpv6("1::2::3")).toBeNull();
    expect(expandIpv6("1:2:3:4:5:6:7:8:9")).toBeNull();
  });

  it("reconnaît les noms de la machine sans les résoudre", () => {
    for (const name of ["localhost", "LOCALHOST.", "jellyfin.localhost", "127.0.0.1", "[::1]"]) expect(isLoopbackName(name), name).toBe(true);
    for (const name of ["jellyfin", "host.docker.internal", "192.168.1.10", "localhost.example.com"]) expect(isLoopbackName(name), name).toBe(false);
  });
});
