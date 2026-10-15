/**
 * Les droits d'un compte — les ROUTES. Une seule table : le serveur en tire ses
 * chemins, l'administration (web, bureau) ses URL. Toutes exigent une session
 * PERSONNELLE d'administrateur (`requirePersonalAdmin`) : jamais une TV jumelée,
 * jamais une session de profil, jamais « voir en tant que ».
 *
 * MIROIR : `apps/backend/src/userRights/userRightsRoutes.ts`, octet pour octet
 * (voir l'en-tête de `userRightsContract.ts`).
 */

export interface UserRightsRouteSpec {
  method: "GET" | "PATCH";
  /** Chemin complet ; les paramètres en `:nom`. */
  path: string;
  /** Borne par adresse IP ; absente : la borne générale du serveur. */
  rateLimit?: { max: number; windowMs: number };
}

const MINUTE = 60_000;

export const USER_RIGHTS_ROUTES = {
  /** → `UserRightsOptions`. */
  options: { method: "GET", path: "/api/admin/users/rights/options" },
  /** → `UserRightsDto`. */
  read: { method: "GET", path: "/api/admin/users/:userId/rights" },
  /** `UserRightsPatch` → `UserRightsDto` (relu dans Jellyfin après l'écriture). */
  update: { method: "PATCH", path: "/api/admin/users/:userId/rights", rateLimit: { max: 60, windowMs: MINUTE } },
} as const satisfies Record<string, UserRightsRouteSpec>;

export type UserRightsRouteName = keyof typeof USER_RIGHTS_ROUTES;

/** Le chemin d'une route, paramètres remplis (encodés). Un paramètre manquant
 *  est une faute de programmation : on lève plutôt que d'appeler `/undefined`. */
export function userRightsPath(name: UserRightsRouteName, params: Record<string, string> = {}): string {
  return USER_RIGHTS_ROUTES[name].path.replace(/:([A-Za-z]+)/g, (_match, key: string) => {
    const value = params[key];
    if (value === undefined || value === "") throw new Error(`userRightsPath(${name}) : paramètre « ${key} » manquant`);
    return encodeURIComponent(value);
  });
}
