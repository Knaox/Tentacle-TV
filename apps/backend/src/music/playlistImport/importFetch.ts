/**
 * Octave — la SEULE porte réseau de l'import : des hôtes d'une liste FERMÉE,
 * en HTTPS, redirections suivies À LA MAIN (chaque étape revérifiée, trois au
 * plus), délai et taille bornés, User-Agent honnête. Jamais une adresse
 * venue de l'utilisateur telle quelle (SSRF) : les lecteurs construisent
 * leurs URL depuis un identifiant reconnu (`recognizeImportUrl`).
 */

export const IMPORT_HOSTS: ReadonlySet<string> = new Set([
  "open.spotify.com",
  "spotify.link",
  "music.apple.com",
  "api.deezer.com",
  "www.deezer.com",
  "deezer.com",
  "link.deezer.com",
  "deezer.page.link",
]);

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 12_000;
const MAX_BYTES = 6 * 1024 * 1024;
const USER_AGENT = "TentacleTV/1.40 (Octave playlist import; +https://tentacletv.app)";

export interface FetchedPage {
  status: number;
  /** L'adresse de la DERNIÈRE réponse (après les redirections suivies). */
  url: string;
  body: string;
}

/** Ce que les lecteurs appellent : remplaçable dans les tests (fixtures, aucun réseau). */
export type ImportFetcher = (url: string, accept: "html" | "json") => Promise<FetchedPage>;

export class ImportFetchError extends Error {
  constructor(readonly reason: "host" | "network" | "tooLarge") {
    super(`import fetch refused: ${reason}`);
  }
}

/** L'adresse est-elle permise (HTTPS, hôte de la liste, port par défaut, sans identifiants) ? */
export function allowedImportUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username !== "" || url.password !== "") return null;
  return IMPORT_HOSTS.has(url.hostname) ? url : null;
}

async function readBounded(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) throw new ImportFetchError("tooLarge");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new ImportFetchError("tooLarge");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export const networkFetcher: ImportFetcher = async (start, accept) => {
  let current = allowedImportUrl(start);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!current) throw new ImportFetchError("host");
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": USER_AGENT, accept: accept === "json" ? "application/json" : "text/html", "accept-language": "en" },
      });
    } catch {
      throw new ImportFetchError("network");
    }
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      current = allowedImportUrl(new URL(location, current).toString());
      continue;
    }
    return { status: response.status, url: current.toString(), body: await readBounded(response) };
  }
  throw new ImportFetchError("host");
};
