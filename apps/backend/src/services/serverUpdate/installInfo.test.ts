import { describe, expect, it } from "vitest";
import { detectRuntime, parseImageReference, readInstall } from "./installInfo";

const none = () => false;
const only = (marker: string) => (path: string) => path === marker;

describe("le moteur, sans parler à Docker", () => {
  it("lit les marques que Docker et Podman posent dans le conteneur", () => {
    expect(detectRuntime({}, only("/.dockerenv"))).toBe("docker");
    expect(detectRuntime({}, only("/run/.containerenv"))).toBe("podman");
    expect(detectRuntime({}, none)).toBe("none");
  });

  it("TENTACLE_INSTALL_RUNTIME force la réponse ; une valeur inconnue ne force rien", () => {
    expect(detectRuntime({ TENTACLE_INSTALL_RUNTIME: "Docker" }, none)).toBe("docker");
    expect(detectRuntime({ TENTACLE_INSTALL_RUNTIME: "none" }, only("/.dockerenv"))).toBe("none");
    expect(detectRuntime({ TENTACLE_INSTALL_RUNTIME: "k8s" }, none)).toBe("none");
  });
});

describe("l'image déclarée (TENTACLE_IMAGE)", () => {
  it("sépare le dépôt et l'étiquette, port de registre compris", () => {
    expect(parseImageReference("ghcr.io/knaox/tentacle-tv:v1.22.3")).toEqual({ repository: "ghcr.io/knaox/tentacle-tv", tag: "v1.22.3" });
    expect(parseImageReference("registry.lan:5000/tentacle")).toEqual({ repository: "registry.lan:5000/tentacle", tag: null });
    expect(parseImageReference("registry.lan:5000/tentacle:latest")).toEqual({ repository: "registry.lan:5000/tentacle", tag: "latest" });
  });

  it("un condensé ne dit pas d'étiquette", () => {
    expect(parseImageReference("ghcr.io/knaox/tentacle-tv@sha256:abc")).toEqual({ repository: "ghcr.io/knaox/tentacle-tv", tag: null });
  });

  it("refuse ce qu'un shell interpréterait : la référence finit dans une commande copiée", () => {
    expect(parseImageReference("ghcr.io/x/y:latest; rm -rf /")).toBeNull();
    expect(parseImageReference("ghcr.io/x/$(id):latest")).toBeNull();
    expect(parseImageReference("")).toBeNull();
    expect(parseImageReference(undefined)).toBeNull();
  });

  it("sans déclaration : l'image officielle, étiquette inconnue", () => {
    expect(readInstall({}, only("/.dockerenv"))).toEqual({ runtime: "docker", repository: "ghcr.io/knaox/tentacle-tv", tag: null });
    expect(readInstall({ TENTACLE_IMAGE: "ghcr.io/knaox/tentacle-tv:v1.22.3" }, only("/.dockerenv")))
      .toEqual({ runtime: "docker", repository: "ghcr.io/knaox/tentacle-tv", tag: "v1.22.3" });
  });
});
