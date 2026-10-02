/* ------------------------------------------------------------------ */
/*  Ce que yt-dlp rend d'une bande-annonce — le choix du flux, pur     */
/*                                                                     */
/*  Choix volontairement indifférent aux itags et aux clients : on lit */
/*  ce que YouTube sert CE JOUR-LÀ et l'on prend, dans l'ordre :       */
/*   1. un maître HLS avec de la vidéo H.264 (client `visionos` : des  */
/*      variantes vidéo et l'audio à part ; clients web : 91 à 96,     */
/*      muxés) — AVPlayer le lit nativement, débit adaptatif compris ; */
/*   2. sinon un MP4 progressif muxé H.264 + AAC (format 18, 360p),    */
/*      que le relais sert par plages.                                 */
/*  Mesuré le 2026-10-02 (yt-dlp 2026.08.19) : `visionos` donne le     */
/*  maître pour 15 bandes-annonces réelles sur 16 ; la 16ᵉ, « pour     */
/*  enfants », n'a que le format 18 (nightly : 91 à 96).               */
/* ------------------------------------------------------------------ */

/** Les champs d'un format de `yt-dlp -j` dont le choix dépend. */
export interface YtFormat {
  format_id?: string;
  protocol?: string;
  ext?: string;
  vcodec?: string | null;
  acodec?: string | null;
  height?: number | null;
  tbr?: number | null;
  url?: string;
  manifest_url?: string;
  http_headers?: Record<string, string>;
  has_drm?: boolean;
}

export type TrailerSource =
  | { kind: "hls"; masterUrl: string; headers: Record<string, string>; expiresAt: number }
  | { kind: "progressive"; url: string; headers: Record<string, string>; expiresAt: number };

/** Au-delà, un flux n'apporte rien à une bande-annonce et coûte au relais. */
const MAX_HEIGHT = 1080;

const isH264 = (codec: string | null | undefined) => !!codec && /^avc[13]\./i.test(codec);
const isAac = (codec: string | null | undefined) => !!codec && /^mp4a\./i.test(codec);

/**
 * L'échéance réelle d'une URL googlevideo signée ; repli à cinq heures.
 * Deux formes : `?expire=123` (progressif) et `/expire/123/` (manifeste HLS).
 */
export function parseExpiry(url: string, now = Date.now()): number {
  const m = /[?&/]expire[=/](\d+)/.exec(url);
  return m ? Number(m[1]) * 1000 : now + 5 * 60 * 60 * 1000;
}

/** Les en-têtes que yt-dlp emploierait : un User-Agent cohérent avec l'extraction. */
function headersOf(format: YtFormat): Record<string, string> {
  const ua = format.http_headers?.["User-Agent"];
  return ua ? { "User-Agent": ua } : {};
}

/** Le meilleur flux qu'un Apple TV lit sans faute, ou `null`. */
export function pickTrailerSource(formats: readonly YtFormat[], now = Date.now()): TrailerSource | null {
  const usable = formats.filter((f) => !f.has_drm);

  // 1. Les maîtres HLS, classés par la plus haute vidéo H.264 qu'ils portent.
  const masters = new Map<string, { height: number; format: YtFormat }>();
  for (const f of usable) {
    if (!f.manifest_url || !f.protocol?.startsWith("m3u8") || !isH264(f.vcodec)) continue;
    const height = Math.min(f.height ?? 0, MAX_HEIGHT);
    const known = masters.get(f.manifest_url);
    if (!known || height > known.height) masters.set(f.manifest_url, { height, format: f });
  }
  const bestMaster = [...masters.entries()].sort((a, b) => b[1].height - a[1].height)[0];
  if (bestMaster) {
    const [masterUrl, { format }] = bestMaster;
    return { kind: "hls", masterUrl, headers: headersOf(format), expiresAt: parseExpiry(masterUrl, now) };
  }

  // 2. Le progressif muxé H.264 + AAC le plus haut, jusqu'à 1080p.
  const progressive = usable
    .filter((f) => f.protocol === "https" && f.url && f.ext === "mp4" && isH264(f.vcodec) && isAac(f.acodec))
    .filter((f) => (f.height ?? 0) <= MAX_HEIGHT)
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.tbr ?? 0) - (a.tbr ?? 0))[0];
  if (progressive?.url) {
    return { kind: "progressive", url: progressive.url, headers: headersOf(progressive), expiresAt: parseExpiry(progressive.url, now) };
  }
  return null;
}

/**
 * Les passes d'extraction : `visionos` d'abord — sans défi JavaScript, donc
 * rapide (~2 s), et yt-dlp y ajoute de lui-même `web_embedded` pour une vidéo
 * « pour enfants » ou soumise à un âge. Si elle ne rend rien, les clients
 * par défaut de yt-dlp — ceux que ses mainteneurs tiennent à jour quand
 * YouTube change — et les deux qui servent du HLS muxé. Réglable sans
 * livraison : `TENTACLE_TRAILER_CLIENTS="visionos;default,web_safari"`
 * (passes séparées par `;`, clients par `,`).
 */
export const DEFAULT_CLIENT_PASSES = "visionos;default,web_safari,web_embedded";

export function clientPasses(env: string | undefined): string[][] {
  const passes = (env?.trim() || DEFAULT_CLIENT_PASSES)
    .split(";")
    .map((pass) => pass.split(",").map((c) => c.trim()).filter((c) => /^[\w.-]+$/.test(c)))
    .filter((pass) => pass.length > 0);
  return passes.length ? passes : clientPasses(DEFAULT_CLIENT_PASSES);
}

/**
 * Une vidéo qui n'existe pas pour ce serveur — retirée, privée, bloquée dans
 * le pays — ne se redemande pas avant longtemps ; une erreur de réseau ou un
 * délai, si : la suivante a toutes les chances de passer. « Try again later »
 * est la façon dont YouTube dit qu'il bride l'adresse : passager, lui aussi.
 */
export function isPermanentFailure(stderr: string): boolean {
  if (/try again later|not a bot/i.test(stderr)) return false;
  return /Video unavailable|Private video|has been removed|not available in your country|has been terminated|members-only|Join this channel/i.test(stderr);
}
