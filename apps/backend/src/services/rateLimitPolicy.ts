import { isIPv4, isIPv6 } from "net";
import type { FastifyRequest } from "fastify";
import { getRealClientIp } from "./networkUtils";

/**
 * Deux compteurs, pas un seul.
 *
 * Il n'y avait qu'un seau — `max: 1000` par minute et par IP, tous chemins
 * confondus. Or une vignette proxifiée compte pour une requête au même titre
 * qu'un `POST /auth/login`, et une grille de bibliothèque, c'est UNE REQUÊTE
 * PAR AFFICHE : défiler vite en épuise plusieurs centaines en quelques
 * secondes. Le seau vidé, TOUT tombait en 429 — notifications, épisodes,
 * catalogue — alors qu'il ne manquait que des vignettes. Constaté en
 * production, journal à l'appui.
 *
 * Les deux natures n'ont rien à voir :
 *
 *  - une image, c'est un transfert d'octets que le proxy se contente de
 *    relayer, servi ensuite par le cache du navigateur pendant 24 h
 *    (cf. `jellyfinProxy/headers.ts`) — son volume est celui de l'affichage,
 *    par nature massif et sans risque ;
 *  - un appel d'API, c'est du travail : base de données, Jellyfin, jetons.
 *    C'est LUI que la limite protège.
 *
 * D'où un compteur propre à chaque famille. Le plafond des images reste un
 * plafond — on ne les exempte pas, un flot déraisonnable doit toujours être
 * freiné — mais il est dimensionné pour ce qu'elles sont : ~100/s, soit de quoi
 * parcourir n'importe quelle bibliothèque sans jamais le voir.
 *
 * Les limites déclarées PAR ROUTE (login 5/min, inscription 3/min, jumelage
 * 10/h…) ne sont pas concernées : elles écrasent le plafond global, et aucune
 * ne porte sur un chemin d'image.
 */

/** Affiches, backdrops, logos et vignettes de trickplay servis par le proxy. */
const IMAGE_PATH = /^\/api\/jellyfin\/(Items\/[^/]+\/Images\/|items\/[^/]+\/trickplay\/)/i;

/**
 * Les flux relayés des bandes-annonces (Apple TV) : même nature — des octets
 * relayés, déjà protégés par leur jeton. Une seule bande-annonce, c'est cent
 * à deux cent cinquante listes et segments en une ou deux minutes (mesuré le
 * 2026-10-02) : dans le seau de l'API, quelques lancements d'affilée le
 * videraient, et tout le reste tomberait en 429 avec eux.
 */
const TRAILER_MEDIA_PATH = /^\/api\/trailers\/(hls|file)\//;

export function isImage(url: string): boolean {
  const path = url.split("?")[0];
  return IMAGE_PATH.test(path) || TRAILER_MEDIA_PATH.test(path);
}

/** Plafond d'API — celui que la variable d'environnement pilote. */
export const RATE_LIMIT_API = Number(process.env.RATE_LIMIT) || 1000;

/** Plafond d'images, réglable à part. Six mille par minute = cent par seconde. */
export const RATE_LIMIT_IMAGES = Number(process.env.RATE_LIMIT_IMAGES) || 6000;

/**
 * Un seau par famille ET par client — le préfixe suffit à les séparer. Le
 * client, c'est son adresse RÉELLE : derrière Cloudflare, `request.ip` serait
 * le relais de Cloudflare, partagé par des milliers de visiteurs.
 */
export function rateLimitKey(request: FastifyRequest): string {
  const client = clientBucket(getRealClientIp(request));
  return isImage(request.url) ? `img:${client}` : client;
}

/**
 * Le client d'un compteur. En IPv6, un abonné reçoit un /64 entier — des
 * milliards d'adresses : compter par adresse, c'était lui laisser changer
 * d'adresse à chaque essai et passer sous tous les plafonds (connexion,
 * jumelage). Le compteur est donc celui du /64. Une IPv4 écrite en IPv6
 * (`::ffff:a.b.c.d`) reste l'IPv4 qu'elle est.
 */
export function clientBucket(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped && isIPv4(mapped[1])) return mapped[1];
  if (!isIPv6(ip)) return ip;
  const hextets = expandIPv6(ip.split("%")[0] ?? ip);
  return hextets ? `${hextets.slice(0, 4).join(":")}::/64` : ip;
}

/** Les huit groupes d'une IPv6, `::` déplié ; null si l'écriture surprend. */
function expandIPv6(ip: string): string[] | null {
  const [head, tail] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  // Une IPv4 en queue (`::1.2.3.4`) compte pour deux groupes : seul le /64 nous importe.
  const width = (parts: string[]) => parts.reduce((n, part) => n + (part.includes(".") ? 2 : 1), 0);
  const missing = 8 - width(left) - width(right);
  if (tail === undefined && missing !== 0) return null;
  const groups = [...left, ...Array<string>(Math.max(missing, 0)).fill("0"), ...right];
  return groups.map((group) => (group.includes(".") ? group : group.toLowerCase().replace(/^0+(?=.)/, "")));
}

export function rateLimitMax(request: FastifyRequest): number {
  return isImage(request.url) ? RATE_LIMIT_IMAGES : RATE_LIMIT_API;
}
