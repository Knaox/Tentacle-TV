/**
 * Shared server connection utilities.
 * Used by Desktop (Tauri), Mobile (Expo), and TV apps to verify
 * a Tentacle Web server URL with protocol auto-detection.
 */

/** Result of a server verification attempt */
export interface ServerCheckResult {
  success: boolean;
  /** The validated, working server URL (with correct protocol) */
  url: string;
  /** i18n key for the error message (without namespace prefix) */
  errorKey?: string;
  /** Interpolation params for the i18n error message */
  errorParams?: Record<string, string>;
}

/** Strip redundant default ports (:443 for HTTPS, :80 for HTTP) */
function stripDefaultPorts(url: string): string {
  return url
    .replace(/^(https:\/\/[^/:]+):443\b/, "$1")
    .replace(/^(http:\/\/[^/:]+):80\b/, "$1");
}

/**
 * Normalize a raw user-entered URL:
 * - Trim whitespace
 * - Remove trailing slashes
 * - Strip redundant default ports
 *
 * Does NOT add a protocol — that is handled by `verifyServer`.
 */
export function normalizeServerUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  return stripDefaultPorts(trimmed);
}

/** Try fetching /api/health on a fully-qualified URL. */
async function tryHealth(
  baseUrl: string,
  timeoutMs: number,
): Promise<{ ok: boolean; status?: number; isTimeout?: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/api/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, status: res.status };
    const data: unknown = await res.json();
    if (
      typeof data === "object" &&
      data !== null &&
      "status" in data &&
      (data as Record<string, unknown>).status === "ok"
    ) {
      return { ok: true };
    }
    return { ok: false, status: res.status };
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, isTimeout: true };
    }
    return { ok: false };
  }
}

/**
 * Classify a failed connection attempt into a specific i18n error key.
 */
function classifyError(
  status: number | undefined,
  isTimeout: boolean,
): { errorKey: string; errorParams?: Record<string, string> } {
  if (isTimeout) {
    return { errorKey: "connectionTimeout" };
  }
  if (status === 404) {
    return { errorKey: "apiNotFound" };
  }
  if (status !== undefined && status >= 400) {
    return { errorKey: "serverHttpError", errorParams: { status: String(status) } };
  }
  return { errorKey: "cannotReachServer" };
}

/**
 * Verify that a Tentacle Web server is reachable at the given URL.
 *
 * - If the user provided an explicit protocol (http:// or https://),
 *   only that protocol is tried.
 * - If no protocol is provided, HTTPS is tried first (5 s timeout),
 *   then HTTP as fallback (10 s timeout).
 * - Returns the working URL with the correct protocol on success.
 */
export async function verifyServer(rawUrl: string): Promise<ServerCheckResult> {
  const trimmed = rawUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return { success: false, url: "", errorKey: "invalidUrl" };
  }

  const hasProtocol = /^https?:\/\//i.test(trimmed);

  if (hasProtocol) {
    const normalized = stripDefaultPorts(trimmed);
    const result = await tryHealth(normalized, 10_000);
    if (result.ok) {
      return { success: true, url: normalized };
    }
    const err = classifyError(result.status, result.isTimeout === true);
    return { success: false, url: normalized, ...err };
  }

  // No protocol specified — try HTTPS first, then HTTP
  const httpsUrl = stripDefaultPorts(`https://${trimmed}`);
  const httpsResult = await tryHealth(httpsUrl, 5_000);
  if (httpsResult.ok) {
    return { success: true, url: httpsUrl };
  }

  const httpUrl = stripDefaultPorts(`http://${trimmed}`);
  const httpResult = await tryHealth(httpUrl, 10_000);
  if (httpResult.ok) {
    return { success: true, url: httpUrl };
  }

  // Both failed — return the most useful error
  // If HTTPS timed out but HTTP gave a clearer error, prefer HTTP error
  const err = classifyError(
    httpResult.status ?? httpsResult.status,
    httpResult.isTimeout === true && httpsResult.isTimeout === true,
  );
  return { success: false, url: httpUrl, ...err };
}
