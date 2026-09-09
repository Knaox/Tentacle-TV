/**
 * Quel pool pour quelle adresse.
 *
 * La règle de base est celle de la lecture directe : une adresse privée est
 * sur le réseau local, tout le reste est à l'extérieur. L'admin peut y AJOUTER
 * des adresses — un poste distant de confiance — traitées comme locales, quoi
 * qu'en dise leur plage, plafond posé ou non : si seul l'extérieur est limité,
 * elles ne le sont pas.
 */

import { isIP } from "node:net";
import { ipv4InCidr, isPrivateIp } from "../networkUtils";
import type { PoolId } from "./caps";

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const CIDR_RE = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/;

/** `::ffff:a.b.c.d` (IPv4 vue par une socket IPv6) → `a.b.c.d`. */
function unmap(ip: string): string {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return mapped ? mapped[1] : ip;
}

/** Une adresse IPv4 ou IPv6, ou une plage IPv4 `a.b.c.d/n` (n de 0 à 32). */
export function isValidIpOrCidr(entry: string): boolean {
  const cidr = entry.match(CIDR_RE);
  if (cidr) return isIP(cidr[1]) === 4 && Number(cidr[2]) <= 32;
  return isIP(entry) !== 0;
}

/** Forme canonique : sans espaces, IPv6 en minuscules, IPv4 mappée démappée. */
export function normalizeEntry(entry: string): string {
  return unmap(entry.trim()).toLowerCase();
}

function matches(ip: string, entry: string): boolean {
  const cidr = entry.match(CIDR_RE);
  if (cidr) return IPV4_RE.test(ip) && ipv4InCidr(ip, entry);
  return ip === entry;
}

/** L'adresse figure-t-elle dans la liste (adresses exactes et plages IPv4) ? */
export function isAllowlisted(ip: string, allowlist: readonly string[]): boolean {
  const client = normalizeEntry(ip);
  return allowlist.some((entry) => matches(client, normalizeEntry(entry)));
}

export function poolFor(ip: string, allowlist: readonly string[]): PoolId {
  return isPrivateIp(ip) || isAllowlisted(ip, allowlist) ? "internal" : "external";
}
