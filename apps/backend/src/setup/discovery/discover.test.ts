import { describe, expect, it } from "vitest";
import type { Deployment } from "../deployment";
import { SetupError } from "../setupErrors";
import { discoverJellyfins, type DiscoveryDeps } from "./discover";

const dbStack: Deployment = {
  deployment: "docker", stack: "db", provisioner: "existing-instance", siblingUrl: null,
  mediaFolders: null, mediaHostPath: null, jellyfinHostPort: null,
};

// La machine de Damien : un Jellyfin déjà configuré sur 8096, un vierge sur 8097 ; le même vu par la passerelle.
const servers: Record<string, { id: string; blank: boolean; name: string }> = {
  "http://172.16.1.30:8096": { id: "configured", blank: false, name: "Salon" },
  "http://172.16.1.30:8097": { id: "blank", blank: true, name: "Neuf" },
  "http://172.18.0.1:8096": { id: "configured", blank: false, name: "Salon" },
  "http://172.16.1.30:47896": { id: "udp-only", blank: false, name: "Bureau" },
};

function deps(over: Partial<DiscoveryDeps> = {}): DiscoveryDeps & { probed: string[] } {
  const probed: string[] = [];
  return {
    probed,
    udp: async () => ({ outcome: "answered", candidates: [{ host: "172.16.1.30", port: 47896, protocol: "http:" }, { host: "8.8.8.8", port: 8096, protocol: "http:" }] }),
    probe: async (url) => {
      probed.push(url);
      const s = servers[url];
      if (!s) throw new SetupError("jf_unreachable");
      return { url, id: s.id, version: "10.11.11", serverName: s.name, blank: s.blank, compatible: true };
    },
    gateway: () => "172.18.0.1",
    dockerHostAddresses: async () => [],
    ownAddresses: () => ["127.0.0.1", "172.18.0.5"],
    checkSibling: async () => undefined,
    ...over,
  };
}

describe("la découverte des Jellyfin", () => {
  it("liste chacun une fois, le vierge d'abord, avec ce que les applications recevraient", async () => {
    const d = deps();
    const result = await discoverJellyfins({ deployment: dbStack, browserHost: "172.16.1.30", containerized: true }, d);
    expect(result.servers.map((s) => [s.url, s.blank, s.source])).toEqual([
      ["http://172.16.1.30:8097", true, "scan"],
      ["http://172.16.1.30:8096", false, "scan"],
      ["http://172.16.1.30:47896", false, "udp"],
    ]);
    expect(result.servers[0].clientUrl).toBe("http://172.16.1.30:8097");
    expect(result).toMatchObject({ udp: "answered", bridged: true });
  });

  it("borné : quelques hôtes, quelques ports, jamais une adresse publique annoncée par UDP", async () => {
    const d = deps();
    await discoverJellyfins({ deployment: dbStack, browserHost: "172.16.1.30", containerized: true }, d);
    expect(d.probed.length).toBeLessThanOrEqual(48);
    expect(d.probed.some((url) => url.includes("8.8.8.8"))).toBe(false);
  });

  it("le réseau de l'hôte : pas de pont à signaler", async () => {
    const result = await discoverJellyfins({ deployment: dbStack, browserHost: "172.16.1.30", containerized: true }, deps({ ownAddresses: () => ["172.16.1.30"] }));
    expect(result.bridged).toBe(false);
  });

  it("pile complète dont le nom mène ailleurs : son Jellyfin n'est pas listé (l'écran le dit), les autres restent", async () => {
    const full: Deployment = { ...dbStack, stack: "full", provisioner: "docker-sibling", siblingUrl: "http://jellyfin:8096", jellyfinHostPort: 47896 };
    const d = deps({ checkSibling: async () => Promise.reject(new SetupError("jf_sibling_elsewhere")) });
    const result = await discoverJellyfins({ deployment: full, browserHost: "172.16.1.30", containerized: true }, d);
    expect(d.probed).not.toContain("http://jellyfin:8096");
    expect(result.servers.some((s) => s.inStack)).toBe(false);
    expect(result.servers.map((s) => s.url)).toContain("http://172.16.1.30:8096");
  });

  it("pile complète : son Jellyfin EN TÊTE (neuf tant qu'il est verrouillé), puis les autres, chacun une fois", async () => {
    const full: Deployment = { ...dbStack, stack: "full", provisioner: "docker-sibling", siblingUrl: "http://jellyfin:8096", jellyfinHostPort: 47896 };
    // Le Jellyfin de la pile, verrouillé par Tentacle, aussi publié sur 8096 de l'hôte : même identifiant.
    const stackServers = { ...servers, "http://jellyfin:8096": { id: "configured", blank: false, name: "Pile" } };
    const d = deps({
      probe: async (url) => {
        d.probed.push(url);
        const s = stackServers[url as keyof typeof stackServers];
        if (!s) throw new SetupError("jf_unreachable");
        return { url, id: s.id, version: "10.11.11", serverName: s.name, blank: s.blank, compatible: true };
      },
    });
    const result = await discoverJellyfins({ deployment: full, browserHost: "172.16.1.30", containerized: true, claimed: true }, d);
    expect(result.servers.map((s) => [s.url, s.inStack, s.blank, s.serverId])).toEqual([
      ["http://jellyfin:8096", true, true, "configured"],
      ["http://172.16.1.30:8097", false, true, "blank"],
      ["http://172.16.1.30:47896", false, false, "udp-only"],
    ]);
    expect(result.servers[0]).toMatchObject({ source: "stack", clientUrl: "http://172.16.1.30:47896" });
    expect(result.servers[1].clientUrl).toBe("http://172.16.1.30:8097");
  });
});
