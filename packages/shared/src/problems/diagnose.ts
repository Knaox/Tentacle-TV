import type { FailureKind, Reachability, RawProblem } from "./classifyProblem";

/**
 * Le diagnostic d'un échec ambigu — un moteur qui dit « loading failed » sans
 * plus, un réseau qui tombe sans qu'on sache qui. Deux sondes, lancées par
 * la plateforme au moment de l'échec (jamais en lecture normale) :
 * - celle des SERVEURS (la sonde de connectivité de l'app) : qui ne répond
 *   pas, Tentacle, Jellyfin, ou le réseau de l'appareil ;
 * - celle du FLUX, un octet demandé à son adresse : un 404 (fichier
 *   introuvable), un 401 (session), un 500 (conversion), ou une réponse —
 *   le flux existe, c'est sa lecture qui a échoué.
 */

export interface StreamProbe {
  /** Le statut d'un refus (≥ 400). */
  status?: number;
  /** L'échec de transport de la sonde elle-même. */
  kind?: FailureKind;
  /** Une réponse 2xx : le flux existe. */
  answered?: boolean;
}

/** Faut-il interroger le flux ? Seulement quand le moteur n'a rien dit de décisif. */
export function shouldProbeStream(raw: RawProblem): boolean {
  if (raw.local || (raw.status !== undefined && raw.status > 0)) return false;
  return raw.kind === undefined || raw.kind === "network" || raw.kind === "timeout" || raw.kind === "notFound";
}

const STREAM_PROBE_TIMEOUT_MS = 5000;

/**
 * Un octet du flux (`Range: bytes=0-0`) : son statut sans le télécharger. Un
 * GET plutôt qu'un HEAD — tout relais le transmet —, borné par le délai.
 */
export async function probeStream(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = STREAM_PROBE_TIMEOUT_MS,
): Promise<StreamProbe> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: "GET", headers: { ...headers, Range: "bytes=0-0" }, signal: controller.signal });
    if (response.ok) return { answered: true };
    return { status: response.status };
  } catch {
    return { kind: controller.signal.aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

/** L'échec, complété de ce que les sondes ont appris. */
export function withProbes(raw: RawProblem, reachability: Reachability | null, stream: StreamProbe | null): RawProblem {
  const next: RawProblem = { ...raw };
  if (reachability) next.reachability = reachability;
  if (stream?.status !== undefined) next.status = stream.status;
  else if (stream?.answered) next.streamAnswered = true;
  else if (stream?.kind && next.kind === undefined) next.kind = stream.kind;
  return next;
}
