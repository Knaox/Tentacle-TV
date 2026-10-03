import { classifyProblem, type RawProblem } from "./problems/classifyProblem";
import type { ProblemCause } from "./problems/problemTypes";

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
  /**
   * La cause, dans le vocabulaire du modèle commun des erreurs (certificat
   * refusé, HTTP bloqué, adresse qui n'est pas un serveur Tentacle…) — plus
   * fine que `errorKey`, que les clients d'avant gardent.
   */
  cause?: ProblemCause;
}

/** Ce qu'une tentative a vu : de quoi classer son échec. */
interface HealthAttempt {
  ok: boolean;
  status?: number;
  isTimeout?: boolean;
  /** Une réponse 2xx qui n'est pas celle d'un serveur Tentacle (page HTML, Jellyfin…). */
  notTentacle?: boolean;
  message?: string;
  name?: string;
}

/** La cause d'une tentative manquée, pour le modèle commun. */
function causeOf(attempt: HealthAttempt): ProblemCause {
  if (attempt.notTentacle) return "notTentacle";
  const raw: RawProblem = {
    status: attempt.status, message: attempt.message, name: attempt.name, target: "health",
    kind: attempt.isTimeout ? "timeout" : undefined,
  };
  return classifyProblem(raw);
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
): Promise<HealthAttempt> {
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
    // Une page qui répond 200 sans être notre santé (HTML, Jellyfin) : pas un serveur Tentacle.
    const data: unknown = await res.json().catch(() => null);
    if (
      typeof data === "object" &&
      data !== null &&
      "status" in data &&
      (data as Record<string, unknown>).status === "ok"
    ) {
      return { ok: true };
    }
    return { ok: false, status: res.status, notTentacle: true };
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, isTimeout: true };
    }
    return { ok: false, message: err instanceof Error ? err.message : String(err), name: err instanceof Error ? err.name : undefined };
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
    return { success: false, url: normalized, ...err, cause: causeOf(result) };
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
  // La cause la plus parlante des deux essais : une réponse (statut, page
  // étrangère), puis un certificat refusé en HTTPS, puis ce qu'a vu le HTTP.
  const httpsCause = causeOf(httpsResult);
  const httpCause = causeOf(httpResult);
  const answered = (a: HealthAttempt) => a.status !== undefined || a.notTentacle;
  const cause = answered(httpsResult) ? httpsCause
    : answered(httpResult) ? httpCause
      : httpsCause === "certificate" ? httpsCause
        : httpCause;
  return { success: false, url: httpUrl, ...err, cause };
}
