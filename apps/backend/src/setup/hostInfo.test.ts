import { describe, expect, it } from "vitest";
import { readHostInfo, type HostProbe } from "./hostInfo";

/**
 * Ce que le serveur dit de lui-même à l'écran du code : lu dans son
 * environnement et ses propres fichiers, jamais auprès de Docker.
 */
const LONG = "3f9c2a7b1d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8";

function probe(over: Partial<HostProbe> & { files?: Record<string, string> } = {}): HostProbe {
  const files = over.files ?? {};
  return {
    env: over.env ?? {},
    exists: over.exists ?? ((path) => path in files),
    read: over.read ?? ((path) => files[path] ?? null),
  };
}

describe("le serveur se décrit, sans parler à Docker", () => {
  it("image Docker : l'identifiant court vient de HOSTNAME, la pile de TENTACLE_STACK", () => {
    const info = readHostInfo(probe({ env: { TENTACLE_DEPLOYMENT: "docker", TENTACLE_STACK: "full", HOSTNAME: "3f9c2a7b1d4e" } }));
    expect(info).toEqual({ deployment: "docker", stack: "full", containerized: true, containerId: "3f9c2a7b1d4e" });
  });

  it("un `hostname:` posé : l'identifiant est relu dans le montage de /etc/hostname", () => {
    const mountinfo = [
      "600 590 0:52 / / rw,relatime - overlay overlay rw",
      `612 600 254:1 /var/lib/docker/containers/${LONG}/hostname /etc/hostname rw,relatime - ext4 /dev/vda1 rw`,
    ].join("\n");
    const info = readHostInfo(probe({ env: { TENTACLE_DEPLOYMENT: "docker", HOSTNAME: "media-box" }, files: { "/proc/self/mountinfo": mountinfo } }));
    expect(info.containerId).toBe(LONG.slice(0, 12));
    expect(info.stack).toBeNull();
  });

  it("Podman : le chemin overlay-containers", () => {
    const mountinfo = `700 690 0:60 /containers/storage/overlay-containers/${LONG}/userdata/hostname /etc/hostname rw - tmpfs tmpfs rw`;
    const info = readHostInfo(probe({ env: { HOSTNAME: "tentacle" }, files: { "/run/.containerenv": "", "/proc/self/mountinfo": mountinfo } }));
    expect(info).toMatchObject({ deployment: "native", containerized: true, containerId: LONG.slice(0, 12) });
  });

  it("rien de lisible : conteneur sans identifiant, plutôt qu'un identifiant inventé", () => {
    const info = readHostInfo(probe({ env: { TENTACLE_DEPLOYMENT: "docker", HOSTNAME: "media-box" } }));
    expect(info).toMatchObject({ containerized: true, containerId: null });
  });

  it("natif : pas de conteneur, et le nom de la machine n'est jamais pris pour un identifiant", () => {
    const info = readHostInfo(probe({ env: { HOSTNAME: "abcdef012345" } }));
    expect(info).toEqual({ deployment: "native", stack: null, containerized: false, containerId: null });
  });
});
