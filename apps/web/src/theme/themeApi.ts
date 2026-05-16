import type { PartialThemeTokens } from "@tentacle-tv/theme";
import type { BackendThemeState } from "./types";

const buildUrl = (backendUrl: string, path: string): string =>
  backendUrl ? `${backendUrl}${path}` : path;

export async function fetchThemeState(
  backendUrl: string,
): Promise<BackendThemeState> {
  // `cache: "no-store"` bypasses the browser HTTP cache — without this the
  // backend's max-age can serve stale theme metadata after a preset switch.
  const res = await fetch(buildUrl(backendUrl, "/api/theme"), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Theme fetch failed: HTTP ${res.status}`);
  }
  return (await res.json()) as BackendThemeState;
}

export async function fetchThemeCss(
  backendUrl: string,
  hash?: string | null,
): Promise<string> {
  // `?v=<hash>` makes the URL unique per CSS revision so the browser cannot
  // serve a previous preset's CSS from its 60s HTTP cache. The backend ignores
  // the query string — it always returns the currently-stored content.
  const path = hash
    ? `/api/theme/css?v=${encodeURIComponent(hash)}`
    : "/api/theme/css";
  const res = await fetch(buildUrl(backendUrl, path), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Theme CSS fetch failed: HTTP ${res.status}`);
  }
  return res.text();
}

/**
 * On web the cookie `tentacle_token` is httpOnly and same-origin, so
 * `credentials: "include"` is enough. On desktop (Tauri) the app runs on a
 * different origin (`tauri://localhost`) and the httpOnly cookie set during
 * web login is not in scope — so admin PUT/DELETE return 401. The token is
 * also mirrored in `localStorage` for non-cookie clients, so we forward it
 * as a `Bearer` header here. The backend accepts both transports.
 */
function adminAuthHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem("tentacle_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function adminFetch<T>(
  backendUrl: string,
  path: string,
  method: "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(buildUrl(backendUrl, path), init);
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.message) message = String(data.message);
    } catch {
      /* fallthrough — keep status-based message */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

interface AdminThemeResponse {
  ok: true;
  state: BackendThemeState;
}

export const updateThemeTokens = (
  backendUrl: string,
  tokens: PartialThemeTokens,
): Promise<AdminThemeResponse> =>
  adminFetch<AdminThemeResponse>(backendUrl, "/api/theme/tokens", "PUT", tokens);

export const clearThemeTokens = (
  backendUrl: string,
): Promise<AdminThemeResponse> =>
  adminFetch<AdminThemeResponse>(backendUrl, "/api/theme/tokens", "DELETE");

export type CustomCssPayload =
  | { source: "inline"; content: string }
  | { source: "url"; url: string };

export const updateThemeCustomCss = (
  backendUrl: string,
  payload: CustomCssPayload,
): Promise<AdminThemeResponse> =>
  adminFetch<AdminThemeResponse>(
    backendUrl,
    "/api/theme/custom-css",
    "PUT",
    payload,
  );

export const clearThemeCustomCss = (
  backendUrl: string,
): Promise<AdminThemeResponse> =>
  adminFetch<AdminThemeResponse>(
    backendUrl,
    "/api/theme/custom-css",
    "DELETE",
  );

export const updateThemeName = (
  backendUrl: string,
  name: string,
): Promise<AdminThemeResponse> =>
  adminFetch<AdminThemeResponse>(backendUrl, "/api/theme/name", "PUT", {
    name,
  });
