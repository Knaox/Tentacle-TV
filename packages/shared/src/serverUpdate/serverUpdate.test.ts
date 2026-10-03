import { describe, expect, it } from "vitest";
import { SERVER_IMAGE_REPOSITORY, compareServerVersions, parseServerVersion, type ServerInstall } from "./serverUpdateContract";
import { resolveServerUpdate } from "./serverUpdateStatus";
import { buildUpdateCommands } from "./updateCommands";

const docker = (tag: string | null = null, repository = SERVER_IMAGE_REPOSITORY): ServerInstall => ({ runtime: "docker", repository, tag });

describe("versions du serveur", () => {
  it("lit x.y.z, avec ou sans v, et rien d'autre", () => {
    expect(parseServerVersion("1.22.3")).toEqual([1, 22, 3]);
    expect(parseServerVersion(" v1.22.10 ")).toEqual([1, 22, 10]);
    expect(parseServerVersion("1.22")).toBeNull();
    expect(parseServerVersion("1.22.3-beta")).toBeNull();
    expect(parseServerVersion(null)).toBeNull();
  });

  it("compare numériquement, l'illisible en dernier", () => {
    expect(compareServerVersions("1.22.10", "1.22.9")).toBeGreaterThan(0);
    expect(compareServerVersions("1.9.0", "1.22.0")).toBeLessThan(0);
    expect(compareServerVersions("v1.22.3", "1.22.3")).toBe(0);
    expect(compareServerVersions("n'importe", "0.0.1")).toBeLessThan(0);
  });
});

describe("ce que la carte dit de la version en service", () => {
  const base = { current: "1.22.3", latest: "1.22.3", requiredByClients: "1.22.1", clientMinimum: "1.22.1" };

  it("à jour : la dernière publiée tourne, et rien n'exige plus", () => {
    expect(resolveServerUpdate(base)).toEqual({ status: "up-to-date", required: null });
  });

  it("conseillée : une plus récente est publiée, aucun client ne l'exige", () => {
    expect(resolveServerUpdate({ ...base, latest: "1.22.4" })).toEqual({ status: "advised", required: null });
  });

  it("obligatoire : les clients publiés exigent plus que la version en service", () => {
    expect(resolveServerUpdate({ ...base, latest: "1.23.0", requiredByClients: "1.23.0" }))
      .toEqual({ status: "mandatory", required: "1.23.0" });
  });

  it("une exigence publiée AVANT le serveur qui la satisfait ne compte pas encore", () => {
    expect(resolveServerUpdate({ ...base, latest: "1.22.4", requiredByClients: "1.23.0" }))
      .toEqual({ status: "advised", required: null });
    expect(resolveServerUpdate({ ...base, latest: null, requiredByClients: "1.23.0" }))
      .toEqual({ status: "unknown", required: null });
  });

  it("le bureau, mis à jour à part, peut exiger plus : il le sait, ça compte toujours", () => {
    expect(resolveServerUpdate({ ...base, latest: null, clientMinimum: "1.23.0" }))
      .toEqual({ status: "mandatory", required: "1.23.0" });
    expect(resolveServerUpdate({ ...base, latest: "1.24.0", requiredByClients: "1.23.0", clientMinimum: "1.23.5" }))
      .toEqual({ status: "mandatory", required: "1.23.5" });
  });

  it("en avance sur la dernière publiée (développement) ; inconnue sans lecture", () => {
    expect(resolveServerUpdate({ ...base, current: "1.23.0" }).status).toBe("ahead");
    expect(resolveServerUpdate({ ...base, latest: null }).status).toBe("unknown");
  });
});

describe("la commande à copier", () => {
  it("hors conteneur : aucune commande", () => {
    expect(buildUpdateCommands({ runtime: "none", repository: SERVER_IMAGE_REPOSITORY, tag: null }, "1.22.4")).toBeNull();
  });

  it("étiquette inconnue : compose tel quel, et l'image officielle en :latest", () => {
    expect(buildUpdateCommands(docker(), "1.22.4")).toEqual({
      compose: "docker compose pull && docker compose up -d",
      run: "docker pull ghcr.io/knaox/tentacle-tv:latest",
      image: "ghcr.io/knaox/tentacle-tv:latest",
      pinned: null,
      assumedTag: true,
    });
  });

  it("étiquette figée : la dire, et viser la nouvelle, écrite comme l'ancienne", () => {
    expect(buildUpdateCommands(docker("v1.22.3"), "1.22.4")).toMatchObject({
      run: "docker pull ghcr.io/knaox/tentacle-tv:v1.22.4",
      pinned: { from: "v1.22.3", to: "v1.22.4" },
      assumedTag: false,
    });
    expect(buildUpdateCommands(docker("1.22.3"), "1.22.4")?.pinned).toEqual({ from: "1.22.3", to: "1.22.4" });
    expect(buildUpdateCommands(docker("v1.22.2-webos-1.0.1"), "1.22.4")?.pinned).toEqual({ from: "v1.22.2-webos-1.0.1", to: "v1.22.4" });
  });

  it("étiquette figée sans dernière connue : pas de cible inventée", () => {
    expect(buildUpdateCommands(docker("v1.22.3"), null)).toMatchObject({ pinned: { from: "v1.22.3", to: null } });
  });

  it("étiquette mobile déclarée (latest, main) : gardée telle quelle", () => {
    expect(buildUpdateCommands(docker("main", "registry.example.com/tentacle"), "1.22.4")).toMatchObject({
      run: "docker pull registry.example.com/tentacle:main",
      pinned: null,
      assumedTag: false,
    });
  });

  it("podman parle podman", () => {
    expect(buildUpdateCommands({ runtime: "podman", repository: SERVER_IMAGE_REPOSITORY, tag: null }, "1.22.4")).toMatchObject({
      compose: "podman compose pull && podman compose up -d",
      run: "podman pull ghcr.io/knaox/tentacle-tv:latest",
    });
  });
});
