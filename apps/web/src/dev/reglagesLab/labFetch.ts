/**
 * Le FAUX SERVEUR du labo : tant que le labo est monté, `fetch` répond aux adresses de sa table
 * par des données factices. Les vrais écrans tournent donc avec leurs vrais crochets — rien n'y
 * est simulé —, sans serveur ni Jellyfin.
 *
 * Une adresse hors de la table :
 * - `strict` (le banc de capture) : 404, et elle est notée dans `window.__labMisses` — le banc
 *   la liste, pour qu'un écran ne soit jamais capturé sur une requête muette sans qu'on le sache ;
 * - sinon (le labo ouvert DANS l'application) : elle part au vrai `fetch`.
 */

export type LabHandler = (request: { url: URL; method: string; body: unknown }) => unknown;

export interface LabRoute {
  method?: string;
  /** Le chemin exact (`/api/config`) ou un motif. */
  path: string | RegExp;
  /**
   * La réponse (JSON), ou ce qui la calcule. `undefined` rendu : 204. (`object` plutôt
   * qu'`unknown` : une fonction écrite ici reçoit ainsi le type de sa requête.)
   */
  reply: LabHandler | object | string | number | boolean | null;
  status?: number;
}

declare global {
  interface Window { __labMisses?: string[] }
}

const json = (body: unknown, status = 200): Response =>
  body === undefined
    ? new Response(null, { status: 204 })
    : new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function parseBody(init?: RequestInit): unknown {
  if (typeof init?.body !== "string") return undefined;
  try { return JSON.parse(init.body); } catch { return init.body; }
}

/** Pose le faux serveur ; rend ce qui le retire. */
export function installLabFetch(routes: readonly LabRoute[], options: { strict: boolean }): () => void {
  const real = window.fetch.bind(window);
  window.__labMisses = [];

  const fake: typeof window.fetch = async (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const route = routes.find((r) =>
      (r.method ?? "GET") === method
      && (typeof r.path === "string" ? r.path === url.pathname : r.path.test(url.pathname)));
    if (route) {
      const body = typeof route.reply === "function"
        ? (route.reply as LabHandler)({ url, method, body: parseBody(init) })
        : route.reply;
      return json(body, route.status);
    }
    const local = url.origin === window.location.origin;
    if (!local || !url.pathname.startsWith("/api/")) return real(input, init);
    if (!options.strict) return real(input, init);
    window.__labMisses?.push(`${method} ${url.pathname}${url.search}`);
    return json({ error: "lab_no_fixture" }, 404);
  };

  window.fetch = fake;
  return () => { if (window.fetch === fake) window.fetch = real; };
}
