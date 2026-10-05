import { describe, expect, it } from "vitest";
import { DEBIAN_INSTALL_COMMAND, detectHostOs, missingJellyfinGuide, parseOsRelease } from "./hostOs";
import { readDeployment } from "./deployment";

const UBUNTU = `PRETTY_NAME="Ubuntu 24.04.3 LTS"
NAME="Ubuntu"
VERSION_ID="24.04"
ID=ubuntu
ID_LIKE=debian
`;
const MINT = `NAME="Linux Mint"\nID=linuxmint\nID_LIKE="ubuntu debian"\nPRETTY_NAME="Linux Mint 22"`;
const FEDORA = `NAME="Fedora Linux"\nID=fedora\nPRETTY_NAME="Fedora Linux 42 (Workstation Edition)"`;

describe("système de la machine", () => {
  it("lit /etc/os-release, guillemets compris", () => {
    expect(parseOsRelease(UBUNTU)).toMatchObject({ ID: "ubuntu", ID_LIKE: "debian", PRETTY_NAME: "Ubuntu 24.04.3 LTS" });
  });

  it("Ubuntu, Mint : famille Debian ; Fedora : Linux", () => {
    expect(detectHostOs("linux", () => UBUNTU)).toEqual({ id: "ubuntu", name: "Ubuntu 24.04.3 LTS", family: "debian" });
    expect(detectHostOs("linux", () => MINT)?.family).toBe("debian");
    expect(detectHostOs("linux", () => FEDORA)?.family).toBe("linux");
  });

  it("macOS, Windows ; un os-release illisible reste « Linux »", () => {
    expect(detectHostOs("darwin")?.family).toBe("macos");
    expect(detectHostOs("win32")?.family).toBe("windows");
    expect(detectHostOs("linux", () => { throw new Error("ENOENT"); })).toEqual({ id: "linux", name: "Linux", family: "linux" });
  });
});

describe("sans Jellyfin", () => {
  const native = readDeployment({});

  it("Debian, Ubuntu : la commande officielle, vérifiée par sa somme AVANT d'être lancée", () => {
    const guide = missingJellyfinGuide(native, detectHostOs("linux", () => UBUNTU));
    expect(guide).toMatchObject({ kind: "command", os: "Ubuntu 24.04.3 LTS" });
    expect(DEBIAN_INSTALL_COMMAND).toMatch(/sha256sum -c install-debuntu\.sh\.sha256sum && sudo bash install-debuntu\.sh$/);
  });

  it("ailleurs : la documentation officielle, jamais une commande inventée", () => {
    expect(missingJellyfinGuide(native, detectHostOs("linux", () => FEDORA))).toEqual({
      kind: "docs", os: "Fedora Linux 42 (Workstation Edition)", family: "linux",
      docsUrl: "https://jellyfin.org/docs/general/installation/linux",
    });
    expect(missingJellyfinGuide(native, detectHostOs("darwin"))).toMatchObject({ kind: "docs", docsUrl: expect.stringMatching(/\/macos$/) });
    expect(missingJellyfinGuide(native, detectHostOs("win32"))).toMatchObject({ kind: "docs", docsUrl: expect.stringMatching(/\/windows$/) });
  });

  it("dans Docker : la pile complète, qui apporte Jellyfin", () => {
    const guide = missingJellyfinGuide(readDeployment({ TENTACLE_DEPLOYMENT: "docker", TENTACLE_STACK: "db" }), null);
    expect(guide).toMatchObject({ kind: "compose", stack: "tentacle-full" });
  });
});
