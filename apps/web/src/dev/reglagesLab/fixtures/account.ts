/**
 * Le compte, vu du faux serveur : le jumelage et le code de provisionnement
 * (`accountPairing.ts`), les tickets de l'Aide (`accountTickets.ts`), le diagnostic des
 * bandes-annonces et l'inscription. La page de connexion et celle d'inscription ne lisent
 * rien à l'ouverture (l'invitation n'est validée qu'à l'envoi du formulaire).
 */

import type { LabRoute } from "../labFetch";
import type { LabView } from "../labViews";
import { labAgo, pairingRoutes } from "./accountPairing";
import { ticketRoutes } from "./accountTickets";
import { LAB_USER } from "./base";

/**
 * `GET /api/trailers/readiness` : réglé d'ordinaire ; dans l'état « recommandations », un
 * serveur où peu de titres ont une bande-annonce (le guide en dit alors la cause).
 */
function trailerReadiness(view: LabView) {
  return view.state === "advice"
    ? { state: "misconfigured", reasons: ["tmdb-fetcher-disabled", "few-trailers"], coverage: 0.31, checkedAt: labAgo(4 * 60_000) }
    : { state: "ready", reasons: [], coverage: 0.86, checkedAt: labAgo(4 * 60_000) };
}

/** La session de `POST /api/auth/login`, telle que Jellyfin la rend (un clic sur « Se connecter » ne casse rien). */
const session = {
  AccessToken: "lab-access-token",
  ServerId: "lab-server",
  DeviceId: "lab-device",
  User: {
    ...LAB_USER,
    ServerId: "lab-server",
    HasPassword: true,
    HasConfiguredPassword: true,
    EnableAutoLogin: false,
  },
};

export function accountRoutes(view: LabView): readonly LabRoute[] {
  return [
    ...pairingRoutes,
    ...ticketRoutes,
    { path: "/api/trailers/readiness", reply: trailerReadiness(view) },
    // L'inscription : toute clé est acceptée (une route du labo n'a qu'un statut) — la page revient à la connexion.
    { method: "POST", path: "/api/auth/register", reply: { success: true } },
    { method: "POST", path: "/api/auth/password-reset-request", reply: { success: true } },
    { method: "POST", path: "/api/auth/login", reply: session },
    { method: "POST", path: "/api/auth/logout", reply: { success: true } },
  ];
}
