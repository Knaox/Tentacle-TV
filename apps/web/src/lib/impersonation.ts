/**
 * Mode impersonation admin — un admin navigue dans l'app comme un autre
 * utilisateur Jellyfin (JWT court signé par le backend, jamais admin).
 *
 * État côté client (localStorage) :
 *  - tentacle_impersonation : { adminName, targetUserId, targetName } — pilote
 *    l'affichage du bandeau "Quitter le mode".
 *  - tentacle_admin_user / tentacle_admin_token : sauvegarde de la session
 *    admin, restaurée à la sortie. Sur web le cookie httpOnly est basculé
 *    côté serveur ; le localStorage suit pour les consommateurs Bearer.
 *
 * Chaque bascule fait un location.assign : repart d'un état mémoire vierge
 * (React Query, contextes) — aucun risque de fuite de données entre comptes.
 */

// Import dynamique OBLIGATOIRE : adminUtils lit `backendUrl` depuis main.tsx au
// niveau module. Ce fichier étant atteignable statiquement depuis App.tsx (via
// ImpersonationBanner), un import statique créerait le cycle
// main → App → ImpersonationBanner → impersonation → adminUtils → main
// et planterait le boot (TDZ sur backendUrl) → fenêtre desktop transparente.
async function adminApi() {
  return import("../pages/adminUtils");
}

const FLAG_KEY = "tentacle_impersonation";
const ADMIN_USER_BACKUP = "tentacle_admin_user";
const ADMIN_TOKEN_BACKUP = "tentacle_admin_token";
const QUERY_CACHE_KEY = "tentacle_query_cache_v1";

export interface ImpersonationState {
  adminName: string;
  targetUserId: string;
  targetName: string;
}

export function getImpersonationState(): ImpersonationState | null {
  try {
    const raw = localStorage.getItem(FLAG_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as ImpersonationState;
    // Garde anti-état périmé : si la session courante ne correspond plus à la
    // cible (ex: token expiré → logout → re-login admin), on nettoie tout.
    const userRaw = localStorage.getItem("tentacle_user");
    const currentId = userRaw ? (JSON.parse(userRaw)?.Id as string | undefined) : undefined;
    if (!currentId || currentId !== state.targetUserId) {
      clearImpersonationKeys();
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

function clearImpersonationKeys(): void {
  localStorage.removeItem(FLAG_KEY);
  localStorage.removeItem(ADMIN_USER_BACKUP);
  localStorage.removeItem(ADMIN_TOKEN_BACKUP);
}

export async function startImpersonation(userId: string): Promise<void> {
  const { BACKEND, hdrs, creds } = await adminApi();
  const res = await fetch(`${BACKEND}/api/admin/impersonate`, {
    method: "POST",
    headers: hdrs(),
    credentials: creds(),
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Impersonation failed" }));
    throw new Error(err.message || "Impersonation failed");
  }
  const { token, user } = (await res.json()) as {
    token: string;
    user: { Id: string; Name: string };
  };

  const adminUser = localStorage.getItem("tentacle_user") ?? "";
  const adminName = (() => {
    try { return JSON.parse(adminUser)?.Name ?? ""; } catch { return ""; }
  })();

  localStorage.setItem(ADMIN_USER_BACKUP, adminUser);
  const adminToken = localStorage.getItem("tentacle_token");
  if (adminToken) localStorage.setItem(ADMIN_TOKEN_BACKUP, adminToken);

  localStorage.setItem("tentacle_token", token);
  localStorage.setItem("tentacle_user", JSON.stringify(user));
  localStorage.setItem(
    FLAG_KEY,
    JSON.stringify({ adminName, targetUserId: user.Id, targetName: user.Name } satisfies ImpersonationState),
  );

  // Le cache persisté de la home appartient à l'admin — il ne doit pas
  // s'hydrater dans la session impersonée (et inversement à la sortie).
  localStorage.removeItem(QUERY_CACHE_KEY);
  window.location.assign("/");
}

export async function stopImpersonation(): Promise<void> {
  const { BACKEND, hdrs, creds } = await adminApi();
  // Restaure le cookie httpOnly côté serveur (no-op utile pour desktop).
  try {
    await fetch(`${BACKEND}/api/auth/impersonate/stop`, {
      method: "POST",
      headers: hdrs(),
      credentials: creds(),
    });
  } catch {
    // Réseau down : on restaure quand même la session locale — le cookie
    // sera incohérent jusqu'au prochain refresh mais l'admin n'est pas bloqué.
  }

  const adminUser = localStorage.getItem(ADMIN_USER_BACKUP);
  const adminToken = localStorage.getItem(ADMIN_TOKEN_BACKUP);
  if (adminUser) localStorage.setItem("tentacle_user", adminUser);
  if (adminToken) localStorage.setItem("tentacle_token", adminToken);
  else localStorage.removeItem("tentacle_token");
  clearImpersonationKeys();
  localStorage.removeItem(QUERY_CACHE_KEY);
  window.location.assign("/admin");
}
