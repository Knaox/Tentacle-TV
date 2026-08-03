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
