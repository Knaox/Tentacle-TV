import type { LookupAddress } from "dns";
import { describe, expect, it } from "vitest";
import { createGuardedLookup } from "./guardedFetch";
import { hostsFileAddresses, isGatewayLinkLocal, isHostGatewayException } from "./hostGateway";

// Le /etc/hosts d'un conteneur Podman 5.8 sans racine (pasta), relevé le 2026-10-08.
const PODMAN_HOSTS = `169.254.1.2\thost.docker.internal
127.0.0.1\tlocalhost localhost.localdomain localhost4 localhost4.localdomain4
::1\tlocalhost localhost.localdomain localhost6 localhost6.localdomain6
169.254.1.2\thost.containers.internal
172.16.1.183\t32ed4edc1f4d thirsty_darwin
`;

describe("l'hôte vu par Podman sans racine (lien local)", () => {
  it("lit les adresses d'un nom dans un fichier hosts, alias et commentaires compris", () => {
    expect(hostsFileAddresses(PODMAN_HOSTS, "host.docker.internal")).toEqual(["169.254.1.2"]);
    expect(hostsFileAddresses(PODMAN_HOSTS, "HOST.CONTAINERS.INTERNAL.")).toEqual(["169.254.1.2"]);
    expect(hostsFileAddresses("10.0.0.1 a b # host.docker.internal\n", "host.docker.internal")).toEqual([]);
    expect(hostsFileAddresses(null, "host.docker.internal")).toEqual([]);
  });

  it("accepte le nom tapé qui mène à l'adresse écrite par le moteur", () => {
    expect(isHostGatewayException("host.docker.internal", "169.254.1.2", PODMAN_HOSTS)).toBe(true);
    expect(isHostGatewayException("host.containers.internal", "169.254.1.2", PODMAN_HOSTS)).toBe(true);
  });

  it("jamais une IP littérale, un autre nom, ni une adresse que /etc/hosts ne donne pas", () => {
    expect(isHostGatewayException("169.254.1.2", "169.254.1.2", PODMAN_HOSTS)).toBe(false);
    expect(isHostGatewayException("jellyfin", "169.254.1.2", PODMAN_HOSTS)).toBe(false);
    expect(isHostGatewayException("evil.host.docker.internal.example", "169.254.1.2", PODMAN_HOSTS)).toBe(false);
    // Le nom résolu par DNS vers une autre adresse de lien local : refusé.
    expect(isHostGatewayException("host.docker.internal", "169.254.1.3", PODMAN_HOSTS)).toBe(false);
    expect(isHostGatewayException("host.docker.internal", "169.254.1.2", null)).toBe(false);
  });

  it("jamais les métadonnées des clouds, même écrites dans /etc/hosts", () => {
    const trapped = "169.254.169.254 host.docker.internal\n169.254.170.2 host.containers.internal\n";
    expect(isHostGatewayException("host.docker.internal", "169.254.169.254", trapped)).toBe(false);
    expect(isHostGatewayException("host.containers.internal", "169.254.170.2", trapped)).toBe(false);
    for (const ip of ["169.254.169.254", "169.254.169.253", "169.254.170.2", "169.254.170.23", "10.0.0.1", "fe80::1"]) {
      expect(isGatewayLinkLocal(ip), ip).toBe(false);
    }
    expect(isGatewayLinkLocal("169.254.1.2")).toBe(true);
  });
});

describe("la résolution gardée", () => {
  function resolveTo(addresses: string[]) {
    return (_name: string, _options: unknown, callback: (err: NodeJS.ErrnoException | null, list: LookupAddress[]) => void) =>
      callback(null, addresses.map((address) => ({ address, family: 4 })));
  }
  function run(hostname: string, addresses: string[], hostsFile: string | null): Promise<{ err: Error | null; address: unknown }> {
    const guarded = createGuardedLookup(resolveTo(addresses), () => hostsFile);
    return new Promise((resolve) => guarded(hostname, {}, (err, address) => resolve({ err, address })));
  }

  it("host.docker.internal → 169.254.1.2 sous Podman : la connexion est permise", async () => {
    expect(await run("host.docker.internal", ["169.254.1.2"], PODMAN_HOSTS)).toEqual({ err: null, address: "169.254.1.2" });
  });

  it("un autre nom vers la même adresse, ou ce nom vers les métadonnées : refusés", async () => {
    expect((await run("jellyfin.example", ["169.254.1.2"], PODMAN_HOSTS)).err?.name).toBe("BlockedAddressError");
    expect((await run("host.docker.internal", ["169.254.169.254"], "169.254.169.254 host.docker.internal")).err?.name).toBe("BlockedAddressError");
  });

  it("parmi plusieurs réponses, seule celle du moteur passe", async () => {
    expect(await run("host.docker.internal", ["169.254.169.254", "169.254.1.2"], PODMAN_HOSTS)).toEqual({ err: null, address: "169.254.1.2" });
  });
});
