import { describe, expect, it } from "vitest";
import { isLocalAddress, parseAddress } from "./localAddress";

describe("isLocalAddress — la règle de Jellyfin", () => {
  it("sans réseaux donnés : les réseaux privés et la boucle locale", () => {
    for (const ip of ["192.168.1.20", "10.1.2.3", "172.20.0.5", "127.0.0.1", "::1", "::ffff:192.168.1.20", "fd12::5", "fec0::1"]) {
      expect(isLocalAddress(ip, [])).toBe(true);
    }
    for (const ip of ["8.8.8.8", "100.64.0.1", "169.254.1.1", "2a01:e0a::1", "172.32.0.1"]) {
      expect(isLocalAddress(ip, [])).toBe(false);
    }
  });

  it("avec les réseaux de l'administrateur : eux seuls, moins les exclus", () => {
    const subnets = ["192.168.1.0/24", "!192.168.1.128/25"];
    expect(isLocalAddress("192.168.1.20", subnets)).toBe(true);
    expect(isLocalAddress("192.168.1.200", subnets)).toBe(false);
    expect(isLocalAddress("10.0.0.2", subnets)).toBe(false);
    expect(isLocalAddress("127.0.0.1", subnets)).toBe(true);
  });

  it("une adresse illisible est distante", () => {
    expect(isLocalAddress("", [])).toBe(false);
    expect(isLocalAddress("pas-une-ip", [])).toBe(false);
    expect(parseAddress("1:2:3")).toBeNull();
  });

  it("IPv6 abrégée et crochets", () => {
    expect(parseAddress("[fd00::1]")?.width).toBe(128);
    expect(isLocalAddress("2001:db8::1", ["2001:db8::/32"])).toBe(true);
  });
});
