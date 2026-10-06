import { describe, expect, it } from "vitest";
import { checkSiblingNetwork } from "./siblingCheck";

const iface = (cidr: string, internal = false) => ({
  address: cidr.split("/")[0],
  netmask: "",
  family: cidr.includes(":") ? ("IPv6" as const) : ("IPv4" as const),
  mac: "",
  internal,
  cidr,
  ...(cidr.includes(":") ? { scopeid: 0 } : {}),
});
// Le conteneur de Tentacle : le réseau de sa pile (172.20.0.0/16), sa boucle locale, un lien local IPv6.
const container = () => ({ lo: [iface("127.0.0.1/8", true)], eth0: [iface("172.20.0.4/16"), iface("fe80::1/64")] });
const deps = (addresses: string[]) => ({ resolve: async () => addresses, interfaces: container });

describe("le Jellyfin de la pile est bien sur le réseau de la pile", () => {
  it("le nom se résout dans le réseau du conteneur : c'est le voisin", async () => {
    expect(await checkSiblingNetwork("http://jellyfin:8096", deps(["172.20.0.3"]))).toBe("same-network");
  });

  it("le nom part au DNS du réseau local et mène à une machine du domicile : refusé", async () => {
    expect(await checkSiblingNetwork("http://jellyfin:8096", deps(["172.16.1.30"]))).toBe("elsewhere");
  });

  it("une seule adresse hors de la pile suffit à refuser", async () => {
    expect(await checkSiblingNetwork("http://jellyfin:8096", deps(["172.20.0.3", "192.168.1.9"]))).toBe("elsewhere");
  });

  it("la boucle locale et le lien local ne prouvent rien", async () => {
    expect(await checkSiblingNetwork("http://localhost:8096", deps(["127.0.0.1"]))).toBe("elsewhere");
    expect(await checkSiblingNetwork("http://jellyfin:8096", deps(["fe80::2"]))).toBe("elsewhere");
  });

  it("nom pas encore résolu (Jellyfin démarre) : on ne conclut pas", async () => {
    const failing = { resolve: async () => Promise.reject(new Error("ENOTFOUND")), interfaces: container };
    expect(await checkSiblingNetwork("http://jellyfin:8096", failing)).toBe("unresolved");
  });

  it("une IP littérale est jugée sans résolution", async () => {
    expect(await checkSiblingNetwork("http://172.20.0.9:8096", deps([]))).toBe("same-network");
  });
});
