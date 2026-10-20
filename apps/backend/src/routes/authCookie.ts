import type { FastifyReply } from "fastify";

/**
 * Cookie de session web. Source unique : le bloc `setCookie` était recopié à
 * l'identique dans /login, /refresh et /impersonate/stop, et une divergence
 * entre les trois se serait traduite par des déconnexions inexplicables.
 */

// 400 jours = plafond imposé par Chrome. Le refresh (proactif toutes les 12 h,
// et à chaque retour sur l'onglet) refait glisser cette fenêtre → la session
// n'expire jamais tant que l'utilisateur revient.
export const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export const SESSION_COOKIE = "tentacle_token";

/** Pose (ou renouvelle) le cookie de session. */
export function setSessionCookie(reply: FastifyReply, token: string, name = SESSION_COOKIE): void {
  reply.setCookie(name, token, {
    httpOnly: true,
    // `auto` plutôt que `NODE_ENV` : le drapeau Secure suit alors le PROTOCOLE
    // réel de la requête (Fastify tourne en `trustProxy`, donc
    // `X-Forwarded-Proto` est honoré). `NODE_ENV` n'était posé nulle part — ni
    // Dockerfile, ni docker-compose, ni entrypoint — ce cookie de session
    // partait donc SANS Secure en production.
    secure: "auto",
    sameSite: "strict",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearSessionCookie(reply: FastifyReply, name = SESSION_COOKIE): void {
  reply.clearCookie(name, { path: "/" });
}

/**
 * La RÉSERVE du compte pendant une session de profil du WEB (la Famille,
 * plateforme `web`, capacité `family.webProfiles`) : le jeton de la session
 * personnelle, mis de côté par le serveur quand le navigateur ouvre le profil
 * d'un autre — httpOnly, jamais rendu à la page tant que le profil dure. Il ne
 * revient au navigateur qu'en choisissant SON profil, derrière SON code PIN
 * (vérifié par le serveur) : un enfant devant le navigateur ne peut pas le lire
 * (outils de développement, extension) pour reprendre le compte de ses parents.
 * Le bureau et le mobile gardent leur réserve eux-mêmes (aucune page lisible).
 *
 * ⚠️ Nom traversé par une chaîne (navigateurs des utilisateurs) : jamais renommé.
 */
export const ACCOUNT_ESCROW_COOKIE = "tentacle_account_token";

export function setAccountEscrowCookie(reply: FastifyReply, token: string): void {
  setSessionCookie(reply, token, ACCOUNT_ESCROW_COOKIE);
}

export function clearAccountEscrowCookie(reply: FastifyReply): void {
  clearSessionCookie(reply, ACCOUNT_ESCROW_COOKIE);
}
