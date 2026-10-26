/**
 * Octave — le service des pochettes sur l'origine `tentacle://art` (bureau) :
 *
 * - `GET tentacle://art/?o=<identité>&u=<adresse>` : la pochette, depuis le
 *   disque si elle y est (`artCache.ts`), sinon demandée une fois par le
 *   processus principal (`net.fetch` : même pile réseau que la page) ;
 * - `POST tentacle://art/clear` : la déconnexion efface tout.
 *
 * Une origine du schéma privilégié n'est atteignable que par nos propres
 * pages ; seules des adresses http(s) sont demandées, et seule une vraie image
 * (lue dans ses octets, 6 Mo au plus) est gardée et rendue.
 */

import path from "node:path";
import { app, net } from "electron";
import { createArtCache, type ArtCache } from "./artCache";

export const ART_HOST = "art";
/** Au-delà, la source est tenue pour morte (une pochette, pas un média). */
const FETCH_TIMEOUT_MS = 15_000;

let cache: ArtCache | null = null;

function artCache(): ArtCache {
  return (cache ??= createArtCache({
    root: path.join(app.getPath("userData"), "octave-art"),
    fetchUpstream: async (url, maxBytes) => {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await net.fetch(url, { signal: abort.signal, credentials: "omit" });
        if (!response.ok) return null;
        const bytes = new Uint8Array(await response.arrayBuffer());
        return bytes.byteLength > maxBytes ? null : bytes;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
  }));
}

export async function serveOctaveArt(request: Request, appOrigin: string): Promise<Response> {
  const url = new URL(request.url);
  const cors = { "Access-Control-Allow-Origin": appOrigin };
  if (request.method === "POST" && url.pathname === "/clear") {
    await artCache().clear().catch(() => undefined);
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "GET") return new Response(null, { status: 405, headers: cors });
  const upstream = url.searchParams.get("u");
  if (!upstream) return new Response(null, { status: 400, headers: cors });
  const art = await artCache().serve(url.searchParams.get("o"), upstream);
  if (!art) return new Response(null, { status: 404, headers: cors });
  return new Response(new Uint8Array(art.bytes), {
    status: 200,
    headers: { ...cors, "Content-Type": art.type, "Cache-Control": "private, max-age=31536000, immutable", "X-Octave-Art": art.fromDisk ? "disk" : "network" },
  });
}
