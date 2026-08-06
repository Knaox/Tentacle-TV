import type { FastifyRequest } from "fastify";

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
const CHEMIN_IMAGE = /^\/api\/jellyfin\/(Items\/[^/]+\/Images\/|items\/[^/]+\/trickplay\/)/i;

export function estUneImage(url: string): boolean {
  const chemin = url.split("?")[0];
  return CHEMIN_IMAGE.test(chemin);
}

/** Plafond d'API — celui que la variable d'environnement pilote. */
export const RATE_LIMIT_API = Number(process.env.RATE_LIMIT) || 1000;

/** Plafond d'images, réglable à part. Six mille par minute = cent par seconde. */
export const RATE_LIMIT_IMAGES = Number(process.env.RATE_LIMIT_IMAGES) || 6000;

/** Un seau par famille ET par client — le préfixe suffit à les séparer. */
export function cleDeDebit(request: FastifyRequest): string {
  return estUneImage(request.url) ? `img:${request.ip}` : request.ip;
}

export function plafondDeDebit(request: FastifyRequest): number {
  return estUneImage(request.url) ? RATE_LIMIT_IMAGES : RATE_LIMIT_API;
}
