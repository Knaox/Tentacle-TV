import { JELLYFIN_AUTH_HEADER, JELLYFIN_TOKEN_HEADER } from "@tentacle-tv/shared";
import { isOfflineHinted, reportNetworkSuspect, requestTimeoutMs } from "../net/requestPolicy";
import { JellyfinError } from "./types";

export interface FetchWithRetryOptions {
  baseUrl: string;
  path: string;
  init?: RequestInit;
  accessToken: string | null;
  useCredentials: boolean;
  authHeader: string;
  /** Called once when the consecutive 401 threshold is hit (token expired). */
  onAuthExpired?: () => void | Promise<void>;
  /** Suppresses 401 → onAuthExpired handling (e.g. during an active login). */
  isLoggingIn?: boolean;
  /** Telemetry/fire-and-forget calls (playback reporting): a 401 must NOT count
   *  toward the auth-expired threshold nor log the user out. */
  noAuthExpiry?: boolean;
}

export interface FetchWithRetryState {
  consecutive401Count: number;
  authRefreshInProgress: boolean;
}

/* Nombre de 401 CONSÉCUTIFS avant de demander un verdict à `onAuthExpired`.
 *
 * Ce seuil ne protège de rien : ce n'est pas lui qui décide de déconnecter,
 * c'est `onAuthExpired`, qui interroge /api/auth/refresh (lequel tranche en
 * consultant Jellyfin) et ne purge la session qu'après DEUX refus confirmés à
 * 5 s d'intervalle. Le seuil ne fait que retarder cette consultation.
 *
 * Il était à 5, et c'était nuisible : le compteur est remis à zéro par toute
 * réponse 200 (plus bas), y compris celles servies par le cache du proxy
 * (Views 5 min, Latest 30 s…). Une session morte pouvait donc alterner
 * indéfiniment 401 et 200-depuis-le-cache sans jamais atteindre 5 d'affilée —
 * l'utilisateur restait « connecté » devant des pages vides. */
const AUTH_EXPIRE_THRESHOLD = 2;
/* Timeout par requête : sans ça, un Jellyfin qui « pend » (TCP ouvert, aucune
 * réponse) laisse le fetch en attente INDÉFINIE → query bloquée en loading.
 * IMPORTANT : on N'utilise PAS AbortController/signal (passer un signal au
 * `fetch` cassait/annulait la requête PlaybackInfo POST sur certains runtimes RN
 * → le flux ne se résolvait jamais, lecteur figé au chargement). À la place,
 * `Promise.race` : le fetch tourne INTACT, on arrête juste d'attendre après le
 * délai. La valeur vient de `net/requestPolicy` (relue à CHAQUE tentative) :
 * 30 s par défaut — très généreux, borne les vrais hangs — et 12 s poussés par
 * le desktop, qui préfère échouer vite vers son catalogue local. Le fetch
 * sous-jacent continue mais son résultat est ignoré (inoffensif). */

/** Échoue si `fetch` n'a pas répondu dans `timeoutMs`, SANS toucher au fetch
 *  lui-même (pas de signal/abort). */
function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("RequestTimeout")), timeoutMs);
    fetch(url, init).then(
      (r) => { clearTimeout(timer); resolve(r); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** HTTP fetch with transparent retry for backend restarts (5-15 s typical):
 *  502/503/504 + network errors → retry with short exponential backoff.
 *  401 → NEVER retry (would mask a real auth issue), but bump consecutive
 *  counter and trigger onAuthExpired after AUTH_EXPIRE_THRESHOLD hits.
 *  Mutations (POST/PUT/PATCH/DELETE) → single retry max to avoid duplicates. */
export async function fetchWithRetry<T>(
  opts: FetchWithRetryOptions,
  state: FetchWithRetryState,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [JELLYFIN_AUTH_HEADER]: opts.authHeader,
    ...(opts.accessToken ? { [JELLYFIN_TOKEN_HEADER]: opts.accessToken } : {}),
    ...(opts.init?.headers as Record<string, string>),
  };

  const method = (opts.init?.method ?? "GET").toUpperCase();
  const isMutation = method !== "GET" && method !== "HEAD";
  const RETRY_DELAYS_MS = isMutation ? [400] : [300, 700, 1500, 4000];

  let response: Response | null = null;
  let networkError: unknown = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      response = await fetchWithTimeout(`${opts.baseUrl}${opts.path}`, {
        ...opts.init,
        headers,
        credentials: opts.useCredentials ? "include" : undefined,
      }, requestTimeoutMs());
      networkError = null;
      // "Backend restarting" codes — retry silently
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        if (attempt < RETRY_DELAYS_MS.length) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
          continue;
        }
      }
      break;
    } catch (err) {
      networkError = err;
      // Suspicion de panne signalée DÈS la première tentative en échec : la
      // sonde de connectivité (côté app) tranche pendant que les retries
      // continuent — sans attendre la fin de l'échelle.
      reportNetworkSuspect();
      // Erreurs réseau + timeout : retry avec backoff (connexion refusée =
      // backend en redémarrage, récupération rapide typique). Sauf si l'app se
      // SAIT hors ligne : dérouler l'échelle ne ferait que retarder l'échec
      // qui libère l'écran (le catalogue local prend le relais).
      if (attempt < RETRY_DELAYS_MS.length && !isOfflineHinted()) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      break;
    }
  }

  if (!response) {
    throw networkError instanceof Error ? networkError : new Error("Network error");
  }

  if (!response.ok) {
    if (response.status === 401 && opts.accessToken && !opts.isLoggingIn && !opts.noAuthExpiry) {
      state.consecutive401Count++;
      if (state.consecutive401Count >= AUTH_EXPIRE_THRESHOLD && !state.authRefreshInProgress) {
        state.consecutive401Count = 0;
        state.authRefreshInProgress = true;
        // Fire-and-forget: the JellyfinError is still thrown below for the caller.
        // authRefreshInProgress is reset when the callback resolves/rejects.
        Promise.resolve(opts.onAuthExpired?.()).finally(() => {
          state.authRefreshInProgress = false;
        });
      }
    }
    throw new JellyfinError(response.status, response.statusText, opts.path);
  }
  state.consecutive401Count = 0;
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return text ? JSON.parse(text) : (undefined as T);
}
