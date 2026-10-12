/**
 * L'installateur officiel de Jellyfin sur `repo.jellyfin.org` — la SEULE
 * source (les Releases GitHub de Jellyfin n'ont aucun fichier) :
 *
 *   <base>/v<nom>/amd64/jellyfin_<nom>_windows-x64.exe
 *
 * L'adresse redirige vers un miroir (mirrorbits). L'empreinte et la taille se
 * lisent sur l'ORIGINE, jamais sur le miroir : `<url>?sha256` (« <hex>  <nom> »)
 * et `<url>?mirrorlist` (page HTML : « (208318088 bytes) », et le SHA-256 —
 * recoupé). Une redirection sur ces deux lectures est refusée : elles doivent
 * venir de l'origine.
 *
 * L'installateur n'est PAS signé : l'empreinte est la seule garantie, et elle
 * est bloquante (`download.ts`). Elle protège d'un miroir altéré, pas d'une
 * origine compromise — limite connue, dite dans l'étude.
 */

export const JELLYFIN_REPO_BASE = "https://repo.jellyfin.org/files/server/windows/stable";

export function installerUrl(base: string, repoName: string): string {
  return `${base}/v${repoName}/amd64/jellyfin_${repoName}_windows-x64.exe`;
}

export function installerFileName(repoName: string): string {
  return `jellyfin_${repoName}_windows-x64.exe`;
}

const SHA256 = /\b([0-9a-f]{64})\b/i;

/** `?sha256` rend « <hex>  <fichier> ». */
export function parseSha256(text: string): string | null {
  return SHA256.exec(text)?.[1]?.toLowerCase() ?? null;
}

/** `?mirrorlist` : la taille (« (208318088 bytes) ») et le SHA-256 du tableau. */
export function parseMirrorlist(html: string): { size: number | null; sha256: string | null } {
  const size = /\((\d{4,12}) bytes\)/.exec(html)?.[1];
  const sha = /SHA256<\/td>\s*<td[^>]*>\s*([0-9a-f]{64})\s*</i.exec(html)?.[1];
  return { size: size ? Number(size) : null, sha256: sha?.toLowerCase() ?? null };
}

export interface ResolvedInstaller {
  repoName: string;
  url: string;
  sha256: string;
  /** `null` : la page du miroir ne l'a pas dite ; la taille reste alors plafonnée. */
  size: number | null;
}

export type FetchText = (url: string) => Promise<{ status: number; text: string }>;

export type ResolveOutcome = { ok: true; installer: ResolvedInstaller } | { ok: false; failure: "no_version" | "network" | "checksum" };

/**
 * Le premier nom que le dépôt connaît (404 : on essaie le suivant). Une
 * empreinte de la page miroir qui contredit `?sha256` : refus.
 */
export async function resolveInstaller(fetchText: FetchText, base: string, repoNames: readonly string[]): Promise<ResolveOutcome> {
  for (const repoName of repoNames) {
    const url = installerUrl(base, repoName);
    let shaReply: { status: number; text: string };
    try {
      shaReply = await fetchText(`${url}?sha256`);
    } catch {
      return { ok: false, failure: "network" };
    }
    if (shaReply.status === 404) continue;
    const sha256 = shaReply.status === 200 ? parseSha256(shaReply.text) : null;
    if (!sha256) return { ok: false, failure: "network" };
    const listed = await fetchText(`${url}?mirrorlist`).then(
      (reply) => (reply.status === 200 ? parseMirrorlist(reply.text) : { size: null, sha256: null }),
      () => ({ size: null, sha256: null }),
    );
    if (listed.sha256 !== null && listed.sha256 !== sha256) return { ok: false, failure: "checksum" };
    return { ok: true, installer: { repoName, url, sha256, size: listed.size } };
  }
  return { ok: false, failure: "no_version" };
}

const TEXT_LIMIT = 512 * 1024;

/** La lecture réelle : origine seulement (aucune redirection suivie), bornée en temps et en taille. */
export const fetchOriginText: FetchText = async (url) => {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15_000) });
  const text = await response.text();
  return { status: response.status, text: text.slice(0, TEXT_LIMIT) };
};
