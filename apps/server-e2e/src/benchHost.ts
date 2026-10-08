import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { networkInterfaces, platform } from "node:os";
import { hostCall } from "./lanClient";

/**
 * Ce que le banc doit savoir de la machine qui le fait tourner — macOS +
 * colima, Linux + Docker, Linux + Podman sans racine —, déduit, ou donné :
 *
 *   E2E_HOST_ADDRESS  le nom par lequel un conteneur de la pile joint l'hôte
 *                     (défaut `host.docker.internal` : colima, Docker Desktop,
 *                     Podman — qui le fait mener à 169.254.1.2 —, et toute pile
 *                     qui déclare `host-gateway`)
 *   E2E_LAN_IP        l'adresse de la machine sur le réseau local (défaut :
 *                     déduite — `en0`/`en1` sur macOS, l'interface de la route
 *                     par défaut sur Linux)
 *   E2E_HOST_CODE     `required` ou `none` : ce que l'assistant répond au
 *                     navigateur de l'hôte (défaut : demandé à Tentacle,
 *                     `GET /api/setup/host`)
 */
export const HOST_ADDRESS = process.env.E2E_HOST_ADDRESS?.trim() || "host.docker.internal";

/** Les interfaces des moteurs de conteneurs et des tunnels : jamais l'adresse du réseau local. */
const VIRTUAL = /^(lo|docker|br-|veth|podman|cni|virbr|vnet|tun|tap|tailscale|wg|zt|utun|bridge|vmnet|flannel|kube)/;

/** L'interface de la route par défaut, lue dans `/proc/net/route` ; `null` hors Linux. */
export function defaultRouteInterface(routeTable: string | null): string | null {
  for (const line of (routeTable ?? "").split("\n").slice(1)) {
    const [iface, destination] = line.trim().split(/\s+/);
    if (destination === "00000000" && iface) return iface;
  }
  return null;
}

function ipv4Of(iface: string): string | null {
  return networkInterfaces()[iface]?.find((entry) => entry.family === "IPv4" && !entry.internal)?.address ?? null;
}

function readRouteTable(): string | null {
  try {
    return readFileSync("/proc/net/route", "utf8");
  } catch {
    return null;
  }
}

function macosLanIp(): string | null {
  for (const iface of ["en0", "en1"]) {
    try {
      const ip = execFileSync("ipconfig", ["getifaddr", iface], { encoding: "utf8" }).trim();
      if (ip) return ip;
    } catch {
      // interface absente : la suivante
    }
  }
  return null;
}

/** L'adresse de la machine sur le réseau de la maison : c'est par elle qu'un navigateur ouvre l'assistant. */
export function lanIp(): string {
  const given = process.env.E2E_LAN_IP?.trim();
  if (given) return given;
  const routed = platform() === "darwin" ? macosLanIp() : (() => {
    const iface = defaultRouteInterface(readRouteTable());
    return iface ? ipv4Of(iface) : null;
  })();
  if (routed) return routed;
  for (const [name, entries] of Object.entries(networkInterfaces())) {
    if (VIRTUAL.test(name)) continue;
    const ip = entries?.find((entry) => entry.family === "IPv4" && !entry.internal)?.address;
    if (ip) return ip;
  }
  throw new Error("aucune adresse locale : donnez-la par E2E_LAN_IP");
}

/**
 * L'assistant demande-t-il le code au navigateur de l'HÔTE, pour cet hôte
 * tapé ? Oui sous tout moteur qui cache l'adresse du navigateur : la
 * passerelle de colima / Docker Desktop, le relais de Docker pour
 * `127.0.0.1`, rootlessport sous Podman sans racine (`setup-security.md`).
 */
export async function hostGetsCode(port: number, host: string): Promise<boolean> {
  const given = process.env.E2E_HOST_CODE?.trim();
  if (given === "required") return true;
  if (given === "none") return false;
  const reply = await hostCall(port, { path: "/host", host });
  const required = (reply.body as { codeRequired?: unknown } | null)?.codeRequired;
  if (typeof required !== "boolean") throw new Error(`GET /api/setup/host sans « codeRequired » : ${JSON.stringify(reply)}`);
  return required;
}

/**
 * Les parcours au navigateur relèvent l'écran du code dans la liste EXACTE de
 * leurs écrans : ils supposent que l'hôte le reçoit. Ailleurs (Tentacle en
 * natif, réseau de l'hôte…), ils s'arrêtent tout de suite, en le disant — au
 * lieu d'attendre trois minutes un écran qui ne viendra pas.
 */
export async function requireHostCode(port: number, host: string): Promise<void> {
  if (await hostGetsCode(port, host)) return;
  throw new Error(
    `Tentacle ouvre ici l'assistant SANS code au navigateur de l'hôte (${host}) : ce parcours suppose l'écran du code ` +
      "(un relais de ports qui cache l'adresse — colima, Docker, Podman sans racine). Lancez-le sur une telle machine.",
  );
}
