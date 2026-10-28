/**
 * Octave — la porte réseau de la source `tentacle` : lire le DOCUMENT public d'un lien de partage d'un autre
 * serveur Tentacle. L'hôte vient de l'utilisateur (le lien collé) : le serveur ne doit pas devenir un relais
 * vers ce qu'il est seul à joindre (SSRF). Donc :
 * - une seule adresse, construite (`sharedDocumentUrl`) : `<origine du lien>/api/music/share/<jeton>`, en GET,
 *   sans cookie ni jeton, JSON attendu ;
 * - HTTPS, et l'hôte résolu UNE fois, adresse par adresse, à la connexion même (`lookup`) : jamais la boucle
 *   locale, un réseau privé (RFC 1918, ULA), le lien local (métadonnées des clouds), la multidiffusion ;
 * - aucune redirection suivie, délai et taille bornés : l'inactivité (`TIMEOUT_MS`) ET la durée totale
 *   (`DEADLINE_MS` — un serveur qui égrène un octet de temps en temps ne retient pas la requête) ;
 * - aucune connexion gardée d'une requête à l'autre (`agent: false`) : une socket du pool commun, ouverte
 *   vers le même nom sans cette garde, ne serait jamais repassée par `lookup`.
 * Le port est libre : il ne mène qu'aux adresses déjà permises (un serveur Tentacle écoute où il veut).
 * `TENTACLE_SHARE_IMPORT_PRIVATE=on` lève la garde des adresses privées et permet HTTP (deux serveurs d'une
 * même maison, bancs) — jamais le lien local ni les adresses non spécifiées.
 */

import { lookup as dnsLookup, type LookupAddress } from "dns";
import http from "http";
import https from "https";
import type { LookupFunction } from "net";
import { classifyAddress } from "../../setup/jellyfin/addressGuard";
import { isPrivateAddress } from "../../setup/localAccess/privateAddress";
import { sharedDocumentUrl } from "../contract/musicShare";
import { ImportFetchError } from "./importFetch";

const TIMEOUT_MS = 12_000;
const DEADLINE_MS = 30_000;
const MAX_BYTES = 2 * 1024 * 1024;
const USER_AGENT = "TentacleTV/1.40 (Octave shared playlist import; +https://tentacletv.app)";

export type ShareFetcher = (link: string) => Promise<{ status: number; body: string }>;

export function privateShareImportAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return ["on", "1", "true"].includes((env.TENTACLE_SHARE_IMPORT_PRIVATE ?? "").trim().toLowerCase());
}

/** Cette adresse IP peut-elle être jointe pour un lien de partage ? */
export function shareAddressAllowed(ip: string, allowPrivate: boolean): boolean {
  const kind = classifyAddress(ip);
  if (kind === "forbidden") return false;
  if (allowPrivate) return true;
  return kind === "ok" && !isPrivateAddress(ip);
}

/** Le `lookup` de la connexion : chaque adresse rendue par le DNS est jugée, la première permise est prise. */
export function guardedLookup(allowPrivate: boolean, resolve: typeof dnsLookup = dnsLookup): LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) return callback(error, "", 4);
      const list = (Array.isArray(addresses) ? addresses : [addresses]) as LookupAddress[];
      const chosen = list.find((a) => shareAddressAllowed(a.address, allowPrivate));
      if (!chosen) return callback(new ImportFetchError("host"), "", 4);
      if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, [chosen]);
      callback(null, chosen.address, chosen.family);
    });
  };
}

/** L'adresse du document, si le lien est permis (protocole, identifiants, port) ; `null` sinon. */
export function shareDocumentTarget(link: string, allowPrivate: boolean): URL | null {
  const raw = sharedDocumentUrl(link);
  if (!raw) return null;
  const url = new URL(raw);
  if (url.protocol !== "https:" && !(allowPrivate && url.protocol === "http:")) return null;
  // Une IP littérale ne passe pas par `lookup` : jugée ici.
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
  if (/^[\d.]+$|:/.test(host) && !shareAddressAllowed(host, allowPrivate)) return null;
  return url;
}

export function createShareFetcher(allowPrivate = privateShareImportAllowed(), deadlineMs = DEADLINE_MS): ShareFetcher {
  return (link) =>
    new Promise((resolve, reject) => {
      const url = shareDocumentTarget(link, allowPrivate);
      if (!url) return reject(new ImportFetchError("host"));
      const client = url.protocol === "https:" ? https : http;
      const request = client.get(
        url,
        {
          agent: false,
          lookup: guardedLookup(allowPrivate),
          timeout: TIMEOUT_MS,
          headers: { "user-agent": USER_AGENT, accept: "application/json" },
        },
        (response) => {
          const declared = Number(response.headers["content-length"] ?? "0");
          if (declared > MAX_BYTES) {
            response.destroy();
            return reject(new ImportFetchError("tooLarge"));
          }
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_BYTES) {
              response.destroy();
              reject(new ImportFetchError("tooLarge"));
            } else chunks.push(chunk);
          });
          response.on("end", () => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
          response.on("error", () => reject(new ImportFetchError("network")));
        },
      );
      const deadline = setTimeout(() => request.destroy(new ImportFetchError("network")), deadlineMs);
      request.on("close", () => clearTimeout(deadline));
      request.on("timeout", () => request.destroy(new ImportFetchError("network")));
      request.on("error", (error) => reject(error instanceof ImportFetchError ? error : new ImportFetchError("network")));
    });
}
