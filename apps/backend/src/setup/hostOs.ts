import { readFileSync } from "fs";
import type { HostOsFamily, MissingJellyfinGuide } from "./setupWizardContract";
import type { Deployment } from "./deployment";

/**
 * Le système de la machine (installation native seulement) et ce que
 * l'assistant propose quand Jellyfin manque. Rien n'est inventé : la seule
 * commande montrée est celle que Jellyfin publie pour Debian et Ubuntu
 * (vérifiée le 2026-10-05 sur jellyfin.org/docs/general/installation/linux) ;
 * partout ailleurs, sa documentation officielle.
 */
export interface HostOs {
  id: string;
  name: string;
  family: HostOsFamily;
}

const DOCS = {
  linux: "https://jellyfin.org/docs/general/installation/linux",
  macos: "https://jellyfin.org/docs/general/installation/macos",
  windows: "https://jellyfin.org/docs/general/installation/windows",
  any: "https://jellyfin.org/docs/general/installation/",
  // La page du site qui présente les trois piles (refaite avec elles).
  stacks: "https://tentacletv.app/install/",
} as const;

/** Téléchargée, vérifiée par sa somme, PUIS lancée : le `&&` arrête tout si la somme ne correspond pas. */
export const DEBIAN_INSTALL_COMMAND =
  "curl -s https://repo.jellyfin.org/install-debuntu.sh -O && " +
  "curl -s https://repo.jellyfin.org/install-debuntu.sh.sha256sum -O && " +
  "sha256sum -c install-debuntu.sh.sha256sum && " +
  "sudo bash install-debuntu.sh";

const DEBIAN_LIKE = new Set(["debian", "ubuntu", "raspbian", "linuxmint", "pop", "elementary", "zorin", "kali", "neon"]);

/** Lit `/etc/os-release` (format clé=valeur, valeurs éventuellement entre guillemets). */
export function parseOsRelease(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    out[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return out;
}

export function linuxOs(release: Record<string, string>): HostOs {
  const id = (release.ID || "linux").toLowerCase();
  const like = (release.ID_LIKE || "").toLowerCase().split(/\s+/);
  const debian = DEBIAN_LIKE.has(id) || like.includes("debian") || like.includes("ubuntu");
  return {
    id,
    name: release.PRETTY_NAME || release.NAME || "Linux",
    family: debian ? "debian" : "linux",
  };
}

export function detectHostOs(
  platform: NodeJS.Platform = process.platform,
  readOsRelease: () => string = () => readFileSync("/etc/os-release", "utf-8"),
): HostOs | null {
  if (platform === "darwin") return { id: "macos", name: "macOS", family: "macos" };
  if (platform === "win32") return { id: "windows", name: "Windows", family: "windows" };
  if (platform !== "linux") return null;
  try {
    return linuxOs(parseOsRelease(readOsRelease()));
  } catch {
    return { id: "linux", name: "Linux", family: "linux" };
  }
}

export function missingJellyfinGuide(deployment: Deployment, os: HostOs | null): MissingJellyfinGuide {
  // Dans Docker, l'assistant n'installe rien à côté de lui (aucun socket
  // Docker) : il montre la pile complète, qui apporte Jellyfin.
  if (deployment.deployment === "docker") return { kind: "compose", stack: "tentacle-full", docsUrl: DOCS.stacks };
  if (os?.family === "debian") return { kind: "command", os: os.name, command: DEBIAN_INSTALL_COMMAND, docsUrl: DOCS.linux };
  const docsUrl = os?.family === "macos" ? DOCS.macos : os?.family === "windows" ? DOCS.windows : os ? DOCS.linux : DOCS.any;
  return { kind: "docs", os: os?.name ?? null, family: os?.family ?? null, docsUrl };
}
