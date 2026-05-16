import { JELLYFIN_AUTH_HEADER, JELLYFIN_TOKEN_HEADER } from "@tentacle-tv/shared";
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
}

export interface FetchWithRetryState {
  consecutive401Count: number;
  authRefreshInProgress: boolean;
}

const AUTH_EXPIRE_THRESHOLD = 5;

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
      response = await fetch(`${opts.baseUrl}${opts.path}`, {
        ...opts.init,
        headers,
        credentials: opts.useCredentials ? "include" : undefined,
      });
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
      if (attempt < RETRY_DELAYS_MS.length) {
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
    if (response.status === 401 && opts.accessToken && !opts.isLoggingIn) {
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
