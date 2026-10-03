import type { FailureKind, Reachability, RawProblem } from "./classifyProblem";

/**
 * Le diagnostic d'un échec ambigu — un moteur qui dit « loading failed » sans
 * plus, un réseau qui tombe sans qu'on sache qui. Trois sondes, lancées par
 * la plateforme au moment de l'échec (jamais en lecture normale) :
 * - celle des SERVEURS (la sonde de connectivité de l'app) : qui ne répond
 *   pas, Tentacle, Jellyfin, ou le réseau de l'appareil ;
 * - celle du FLUX, un octet demandé à son adresse : un 404 (fichier
 *   introuvable), un 401 (session), un 500 (conversion), ou une réponse —
 *   le flux existe, c'est sa lecture qui a échoué ;
 * - celle du FICHIER source (flux statique, un octet) : une conversion sert
 *   son maître HLS même sans fichier, seul le statique dit qu'il manque.
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

async function fetchProbe(url: string, headers: Record<string, string>, timeoutMs: number): Promise<{ response?: Response; kind?: FailureKind }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: "GET", headers: { ...headers, Range: "bytes=0-0" }, signal: controller.signal });
    return { response };
  } catch {
    return { kind: controller.signal.aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Une adresse de liste HLS résolue sur la liste — à la main : le `URL` de
 * React Native colle la base et l'entrée sans les résoudre.
 */
export function resolvePlaylistEntry(entry: string, base: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(entry)) return entry;
  const origin = /^([a-z][a-z0-9+.-]*:)\/\/[^/?#]+/i.exec(base);
  if (!origin) return entry;
  if (entry.startsWith("//")) return `${origin[1]}${entry}`;
  if (entry.startsWith("/")) return `${origin[0]}${entry}`;
  const path = base.split(/[?#]/)[0];
  return `${path.slice(0, path.lastIndexOf("/") + 1)}${entry}`;
}

/** La première adresse d'une liste HLS (variante ou segment), résolue sur la liste. */
export function firstPlaylistEntry(playlist: string, playlistUrl: string): string | null {
  const line = playlist.split(/\r?\n/).map((entry) => entry.trim()).find((entry) => entry !== "" && !entry.startsWith("#"));
  return line ? resolvePlaylistEntry(line, playlistUrl) : null;
}

/**
 * Un octet du flux (`Range: bytes=0-0`) : son statut sans le télécharger. Un
 * GET plutôt qu'un HEAD — tout relais le transmet —, borné par le délai. Une
 * liste HLS se suit jusqu'au premier SEGMENT : une conversion sert son maître
 * même quand ffmpeg échoue, le segment seul le dit (500) ; un segment qui
 * tarde (serveur occupé) ne conclut rien.
 */
export async function probeStream(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = STREAM_PROBE_TIMEOUT_MS,
): Promise<StreamProbe> {
  let target = url;
  for (let depth = 0; depth < 3; depth++) {
    const { response, kind } = await fetchProbe(target, headers, timeoutMs);
    if (!response) return depth === 0 ? { kind } : { answered: true };
    if (!response.ok) return { status: response.status };
    const isPlaylist = /\.m3u8(\?|$)/i.test(target) || /mpegurl/i.test(response.headers.get("content-type") ?? "");
    if (!isPlaylist) return { answered: true };
    const next = firstPlaylistEntry(await response.text(), target);
    if (!next) return { answered: true };
    target = next;
  }
  return { answered: true };
}

/** Faut-il interroger le fichier source ? Pas pour un refus de session ou de droits, déjà clair. */
export function shouldProbeSource(raw: RawProblem): boolean {
  return !raw.local && raw.status !== 401 && raw.status !== 403 && raw.marker !== "engineFailed";
}

/** L'échec, complété de ce que les sondes ont appris. */
export function withProbes(
  raw: RawProblem,
  reachability: Reachability | null,
  stream: StreamProbe | null,
  source: StreamProbe | null = null,
): RawProblem {
  const next: RawProblem = { ...raw };
  if (reachability) next.reachability = reachability;
  if (source?.status === 404 || source?.status === 410) next.sourceMissing = true;
  // Le refus vient du FLUX : un 500 y est une conversion, un 404 un fichier.
  if (stream?.status !== undefined) Object.assign(next, { status: stream.status, target: "stream" });
  else if (stream?.answered) next.streamAnswered = true;
  else if (stream?.kind && next.kind === undefined) next.kind = stream.kind;
  return next;
}
