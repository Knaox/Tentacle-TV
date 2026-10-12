/**
 * L'adresse de CE PC sur le réseau local : celle qu'on ouvre dans le
 * navigateur pour l'assistant et l'administration.
 *
 * Jamais `localhost` : ouvert ainsi, l'assistant enregistrerait
 * `http://localhost:8096` comme adresse de Jellyfin pour les applications,
 * injoignable d'un téléphone (`setup/jellyfin/clientUrl.ts`), et l'adresse de
 * jumelage serait nulle.
 *
 * L'adresse de la route par défaut d'abord (un `connect` UDP n'envoie aucun
 * paquet), sauf si elle sort par une carte qu'on écarte : WSL et Hyper-V
 * (vEthernet), VPN, Tailscale. Sinon, la première adresse privée d'une vraie
 * carte.
 */
import { createSocket } from "node:dgram";
import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";

const EXCLUDED_NAMES =
  /vEthernet|WSL|Hyper-V|VirtualBox|VMware|Tailscale|ZeroTier|WireGuard|OpenVPN|NordLynx|ProtonVPN|TAP-|Wintun|Npcap|Loopback|Bluetooth/i;

export function isExcludedInterface(name: string): boolean {
  return EXCLUDED_NAMES.test(name);
}

/** RFC 1918 seulement : ni le CGNAT (Tailscale, 100.64/10), ni le lien local. */
export function isPrivateIPv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return false;
  const [a = -1, b = -1] = parts;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Rang de préférence quand la route par défaut ne tranche pas : la box d'abord. */
function rank(address: string): number {
  if (address.startsWith("192.168.")) return 0;
  if (address.startsWith("10.")) return 1;
  return 2;
}

export type InterfaceTable = Readonly<Record<string, readonly NetworkInterfaceInfo[] | undefined>>;

export function pickLanAddress(routeAddress: string | null, nics: InterfaceTable): string | null {
  const candidates: string[] = [];
  for (const [name, entries] of Object.entries(nics)) {
    if (isExcludedInterface(name) || entries === undefined) continue;
    for (const entry of entries) {
      if (entry.family === "IPv4" && !entry.internal && isPrivateIPv4(entry.address)) candidates.push(entry.address);
    }
  }
  if (routeAddress !== null && candidates.includes(routeAddress)) return routeAddress;
  return [...candidates].sort((x, y) => rank(x) - rank(y))[0] ?? null;
}

/** Le nom de la carte qui porte une adresse (le profil réseau se lit par ce nom). */
export function interfaceOf(address: string | null, nics: InterfaceTable): string | null {
  if (address === null) return null;
  for (const [name, entries] of Object.entries(nics)) {
    if (entries?.some((entry) => entry.address === address)) return name;
  }
  return null;
}

/** L'adresse source de la route par défaut ; `null` sans réseau. */
export function defaultRouteAddress(): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = createSocket("udp4");
    const done = (value: string | null): void => {
      socket.close();
      resolve(value);
    };
    socket.once("error", () => done(null));
    socket.connect(53, "1.1.1.1", () => {
      try {
        done(socket.address().address);
      } catch {
        done(null);
      }
    });
  });
}

export async function lanAddress(): Promise<string | null> {
  return pickLanAddress(await defaultRouteAddress(), networkInterfaces());
}

/** L'URL du serveur pour ce PC : l'adresse locale, sinon la boucle locale. */
export async function serverUrl(port: number, path = "/"): Promise<string> {
  const host = (await lanAddress()) ?? "127.0.0.1";
  return `http://${host}:${port}${path}`;
}
