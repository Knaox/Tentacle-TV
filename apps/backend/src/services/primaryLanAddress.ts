import { createSocket } from "dgram";
import { networkInterfaces } from "os";

/**
 * L'adresse de CETTE machine sur le réseau de la maison — celle qu'un
 * téléphone ou une TV joint. Elle sert là où le navigateur ne la donne pas :
 * l'assistant ouvert sur `localhost`, sur la machine même du serveur (l'app
 * Windows, une installation à la main). Jamais dans un conteneur : la sienne
 * ne vaut que sur le pont Docker.
 *
 * D'abord l'adresse source de la route par défaut (une « connexion » UDP vers
 * une adresse publique, sans aucun paquet envoyé), si elle est privée et pas
 * celle d'un VPN ; sinon la première adresse privée d'une carte réelle — ni
 * WSL, ni Hyper-V, ni VirtualBox, ni VPN. IPv4 seulement, RFC 1918 seulement
 * (le CGNAT de Tailscale n'est pas la maison).
 */

const VPN = /tailscale|zerotier|wireguard|^wg\d|openvpn|vpn|^tap|^tun|^utun|^ppp/i;
const VIRTUAL = /vethernet|wsl|hyper-v|virtualbox|vbox|vmware|docker|^br-|^veth|^virbr|npcap|loopback/i;
const ROUTE_PROBE = { address: "1.1.1.1", port: 53 };
const ROUTE_TTL_MS = 60_000;

export type InterfaceTable = ReturnType<typeof networkInterfaces>;

function isRfc1918(address: string): boolean {
  const [a, b] = address.split(".").map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

interface LanAddress {
  name: string;
  address: string;
}

function privateIpv4(table: InterfaceTable): LanAddress[] {
  const found: LanAddress[] = [];
  for (const [name, entries] of Object.entries(table)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal && isRfc1918(entry.address)) found.push({ name, address: entry.address });
    }
  }
  return found;
}

/** Le choix, pur : la source de la route par défaut si elle tient, sinon une carte réelle. */
export function choosePrimaryLanAddress(table: InterfaceTable, routeSource: string | null): string | null {
  const all = privateIpv4(table);
  // La route par défaut peut passer par un commutateur Hyper-V « externe » : c'est la vraie carte.
  const routed = routeSource ? all.find((entry) => entry.address === routeSource && !VPN.test(entry.name)) : undefined;
  if (routed) return routed.address;
  return all.find((entry) => !VPN.test(entry.name) && !VIRTUAL.test(entry.name))?.address ?? null;
}

let routeSource: string | null = null;
let routeCheckedAt = 0;
let probing = false;

function probeRoute(): void {
  if (probing) return;
  probing = true;
  const socket = createSocket("udp4");
  const done = (address: string | null) => {
    routeSource = address;
    routeCheckedAt = Date.now();
    probing = false;
    socket.close();
  };
  socket.on("error", () => done(null));
  try {
    socket.connect(ROUTE_PROBE.port, ROUTE_PROBE.address, () => {
      try {
        done(socket.address().address);
      } catch {
        done(null);
      }
    });
  } catch {
    done(null);
  }
}

/**
 * L'adresse principale, tout de suite ; la route par défaut est relue en fond
 * au plus toutes les minutes (le Wi-Fi change), la carte réelle sert d'ici là.
 */
export function primaryLanAddress(table: InterfaceTable = networkInterfaces()): string | null {
  if (Date.now() - routeCheckedAt > ROUTE_TTL_MS) probeRoute();
  return choosePrimaryLanAddress(table, routeSource);
}
