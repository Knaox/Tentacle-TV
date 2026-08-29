import { getJellyfinApiKey, getJellyfinUrl } from "./configStore";

/**
 * Santé de la CLÉ ADMIN Jellyfin.
 *
 * Cette clé ne sert jamais à la navigation : le proxy voyage avec le jeton de
 * l'utilisateur connecté. Elle ne porte que le travail sans personne derrière —
 * notifications d'ajouts en bibliothèque, invitations, création de comptes,
 * écrans d'administration. D'où le angle mort : quand elle est révoquée côté
 * Jellyfin, l'interface continue de fonctionner à l'écran pendant que tout ce
 * pan-là est mort, et le seul témoin est une ligne de journal toutes les
 * trente secondes — un `403` sur le WebSocket que personne ne lit.
 *
 * Ce module donne à l'administrateur un moyen de l'apprendre autrement.
 */

export type AdminKeyState = "ok" | "revoquee" | "sansDroits" | "absente" | "injoignable";

/**
 * ⚠️ Ces noms de champs, et les valeurs de `AdminKeyState`, SONT le corps de
 * `GET /api/admin/jellyfin-key` : `apps/web/src/components/AdminKeyBanner.tsx`
 * les lit tels quels. Ils restent donc en français.
 */
export interface AdminKeyHealth {
  etat: AdminKeyState;
  /** Horodatage du dernier contrôle réel, pas de la lecture du cache. */
  verifieA: string;
}

/**
 * Cinq minutes : assez court pour que l'alerte apparaisse dans la minute qui
 * suit une révocation, assez long pour ne pas interroger Jellyfin à chaque
 * chargement de page d'un administrateur.
 */
const TTL_MS = 5 * 60_000;

let cache: { health: AdminKeyHealth; a: number } | null = null;
let inFlight: Promise<AdminKeyHealth> | null = null;

/**
 * `/Users` et non `/System/Info` : le premier exige les droits
 * d'administration, le second se contente d'une clé valide. On veut distinguer
 * « la clé n'existe plus » de « la clé existe mais ne peut plus rien faire ».
 */
async function check(): Promise<AdminKeyHealth> {
  const checkedAt = new Date().toISOString();
  const url = getJellyfinUrl();
  const key = getJellyfinApiKey();
  if (!url || !key) return { etat: "absente", verifieA: checkedAt };

  try {
    const res = await fetch(`${url}/Users`, {
      headers: { "X-Emby-Token": key },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) return { etat: "ok", verifieA: checkedAt };
    if (res.status === 401) return { etat: "revoquee", verifieA: checkedAt };
    if (res.status === 403) return { etat: "sansDroits", verifieA: checkedAt };
    return { etat: "injoignable", verifieA: checkedAt };
  } catch {
    return { etat: "injoignable", verifieA: checkedAt };
  }
}

/**
 * Un seul contrôle en vol à la fois : deux administrateurs qui ouvrent
 * l'application en même temps ne déclenchent qu'un appel.
 */
export async function adminKeyHealth(force = false): Promise<AdminKeyHealth> {
  if (!force && cache && Date.now() - cache.a < TTL_MS) return cache.health;
  if (inFlight) return inFlight;

  inFlight = check()
    .then((health) => {
      cache = { health, a: Date.now() };
      return health;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** À appeler dès que la configuration Jellyfin change : le verdict est périmé. */
export function invalidateAdminKeyHealth(): void {
  cache = null;
}
