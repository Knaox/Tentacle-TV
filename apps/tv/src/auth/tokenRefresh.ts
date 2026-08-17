/**
 * Helper pur (sans React, sans hooks) pour rafraîchir le token d'authentification
 * du backend Tentacle, avec gestion robuste des erreurs réseau.
 *
 * Pourquoi : la TV souffrait de déconnexions intempestives parce qu'elle ne
 * faisait qu'un seul retry avant logout. Ce helper centralise une stratégie
 * de retry à backoff exponentiel et distingue les vraies expirations (401)
 * des erreurs réseau transitoires (timeout/503/réseau coupé).
 */

export interface RefreshAttempt {
  serverUrl: string;
  token: string;
  /** Nombre de tentatives total (incluant la première). 3 par défaut. */
  attempts?: number;
  /** Timeout par tentative en millisecondes. 10 s par défaut. */
  timeoutMs?: number;
  /** Signal externe pour annuler tout le processus. */
  signal?: AbortSignal;
}

export type RefreshResult =
  | { ok: true; accessToken: string }
  /** `revoked` : le 401 portait `revoked:true` (ligne paired_devices supprimée —
   *  verdict de DB). C'est le SEUL cas où l'appelant a le droit de déjumeler ;
   *  un 401 nu (Jellyfin qui refuse, secret en avarie) conserve la session. */
  | { ok: false; reason: "expired" | "network" | "server"; revoked?: boolean };

/** AbortSignal.timeout polyfill compatible React Native. */
function timeoutSignal(ms: number, parent?: AbortSignal): AbortSignal {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  if (parent) {
    if (parent.aborted) {
      clearTimeout(timer);
      ctrl.abort();
    } else {
      parent.addEventListener("abort", () => {
        clearTimeout(timer);
        ctrl.abort();
      }, { once: true });
    }
  }
  return ctrl.signal;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    }, { once: true });
  });
}

/**
 * Tente un refresh du token avec backoff exponentiel.
 *
 * Backoff : 0 ms (immédiat) → 2 s → 5 s → 10 s entre tentatives.
 * - 200 OK : succès, retourne le nouveau token.
 * - 401 confirmé sur la dernière tentative : token vraiment expiré.
 * - Toute autre erreur (timeout, 5xx, réseau) sur toutes les tentatives :
 *   retourne "network" — l'appelant DOIT conserver la session.
 */
export async function refreshWithRetry(opts: RefreshAttempt): Promise<RefreshResult> {
  const { serverUrl, token } = opts;
  const attempts = opts.attempts ?? 3;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const delays = [0, 2_000, 5_000, 10_000];

  let lastReason: "network" | "server" = "network";

  for (let i = 0; i < attempts; i++) {
    if (opts.signal?.aborted) return { ok: false, reason: "network" };

    if (delays[i] > 0) {
      try { await sleep(delays[i], opts.signal); }
      catch { return { ok: false, reason: "network" }; }
    }

    try {
      const res = await fetch(`${serverUrl}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        signal: timeoutSignal(timeoutMs, opts.signal),
      });

      if (res.ok) {
        const data = await res.json() as { AccessToken?: string };
        if (data.AccessToken) return { ok: true, accessToken: data.AccessToken };
        // Réponse OK mais sans token — anormal, on traite comme erreur serveur
        lastReason = "server";
        continue;
      }

      // 401 = token invalide côté serveur — mais seul `revoked:true` (verdict de
      // DB : l'appareil a été révoqué) est immédiatement cru. Pas besoin de
      // re-tentative de confirmation dans ce cas : ce n'est pas un aléa Jellyfin.
      if (res.status === 401) {
        const body = await res.json().catch(() => null) as { revoked?: boolean } | null;
        if (body?.revoked === true) return { ok: false, reason: "expired", revoked: true };
        // 401 nu : Jellyfin redémarre peut-être. On retente une fois pour confirmer.
        if (i === 0 && attempts > 1) {
          lastReason = "server";
          continue;
        }
        return { ok: false, reason: "expired" };
      }

      // 5xx ou autre — backend KO, on retente
      lastReason = "server";
    } catch {
      // timeout / réseau coupé — on retente
      lastReason = "network";
    }
  }

  return { ok: false, reason: lastReason };
}

export interface ReAuthAttempt {
  serverUrl: string;
  username: string;
  password: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Login complet en dernier recours (credentials sauvés). N'est tenté qu'après
 * échec confirmé de refreshWithRetry avec reason: "expired".
 *
 * Retourne le nouveau token Tentacle si succès, ou null sinon. Ne loggue
 * aucune erreur — l'appelant gère la suite.
 */
export async function attemptReAuth(opts: ReAuthAttempt): Promise<string | null> {
  const { serverUrl, username, password } = opts;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  try {
    const res = await fetch(`${serverUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: timeoutSignal(timeoutMs, opts.signal),
    });
    if (!res.ok) return null;
    const data = await res.json() as { AccessToken?: string };
    return data.AccessToken ?? null;
  } catch {
    return null;
  }
}
