/* ------------------------------------------------------------------ */
/*  Lire chez googlevideo — pour le relais des bandes-annonces          */
/* ------------------------------------------------------------------ */

import { Agent, fetch as undiciFetch } from "undici";

/**
 * Connexions maintenues vers googlevideo : un segment ne repaie pas TCP + TLS
 * à chaque fois. Le `fetch` du paquet `undici`, pas le global : le `fetch` de
 * Node embarque sa propre version d'undici et refuse un `Agent` du paquet
 * (« fetch failed ») — même choix que le proxy Jellyfin.
 */
const upstreamDispatcher = new Agent({ keepAliveTimeout: 30_000, connections: 16, headersTimeout: 15_000 });

/** Lit une ressource amont ; `refused` pour une URL que googlevideo ne sert plus. */
export async function fetchUpstream(url: string, headers: Record<string, string>, init: { signal?: AbortSignal; range?: string } = {}) {
  const res = await undiciFetch(url, {
    headers: { ...headers, ...(init.range ? { Range: init.range } : {}) },
    signal: init.signal ?? AbortSignal.timeout(15_000),
    dispatcher: upstreamDispatcher,
  });
  return { res, refused: res.status === 403 || res.status === 404 || res.status === 410 };
}

/**
 * Le MP4 progressif se laisse-t-il lire jusqu'au bout ? Le format 18 d'un
 * client sans jeton PO (`android_vr`) ne sert que son premier mégaoctet
 * (mesuré le 2026-10-01) : on demande ce que demande AVPlayer après ses deux
 * premiers octets — le fichier entier, par une plage ouverte —, et l'on n'en
 * lit que les en-têtes.
 */
export async function isReadable(url: string, headers: Record<string, string> = {}): Promise<boolean> {
  try {
    const { res } = await fetchUpstream(url, headers, { range: "bytes=0-", signal: AbortSignal.timeout(5_000) });
    await res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}
