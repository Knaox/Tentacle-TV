/**
 * Le chemin que le ROUTEUR de Fastify voit : il décode l'URL avant de choisir
 * la route (`/api/%70air/tv-token` EST `/api/pair/tv-token`). Toute garde qui
 * juge un chemin par préfixe doit juger CELUI-LÀ, jamais l'URL brute — sinon un
 * simple encodage la contourne. Un encodage illisible : le routeur ne
 * l'atteindrait pas non plus, l'URL brute suffit.
 */
export function routedPath(url: string): string {
  const raw = url.split("?")[0] ?? "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
