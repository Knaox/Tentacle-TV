/**
 * Le pot à cookies de React Native, rejoué sous Node. Ce que le serveur pose
 * (`Set-Cookie`), le téléphone le GARDE et le RENVOIE avec chaque requête vers
 * lui ET chaque poignée de main WebSocket — iOS : stockage partagé
 * (`RCTNetworking.mm`, `RCTWebSocketModule.mm`) ; Android : pot d'OkHttp
 * (`NetworkingModule.kt`, `WebSocketModule.kt`) ; aucun SameSite appliqué.
 *
 * Node n'a pas de pot : sans ce rejeu, un banc ne voit jamais le cookie du
 * COMPTE (posé par `/api/auth/login`) qui suit le téléphone pendant une session
 * de profil — c'est ce qui avait laissé passer le défaut de l'alpha mobile.
 */

export class CookieJar {
  private readonly cookies = new Map<string, string>();

  /** Range ce qu'une réponse pose (une valeur vide ou `Max-Age=0` efface). */
  absorb(res: Response): void {
    for (const line of res.headers.getSetCookie()) {
      const pair = line.split(";")[0] ?? "";
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!value || /max-age=0(?:;|$)/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  /** L'en-tête `Cookie` que le téléphone enverrait, ou rien. */
  header(): string | undefined {
    return this.cookies.size > 0 ? [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ") : undefined;
  }

  /** Un `fetch` du téléphone : vers `origin`, le pot part avec et garde ce qui revient. */
  fetchFor(origin: string, base: typeof fetch): typeof fetch {
    return (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!url.startsWith(origin)) return base(input, init);
      const headers = new Headers(init?.headers);
      const cookie = this.header();
      if (cookie) headers.set("cookie", cookie);
      const res = await base(input, { ...init, headers });
      this.absorb(res);
      return res;
    }) as typeof fetch;
  }

  /** Une WebSocket du téléphone : le pot part avec la poignée de main. */
  socket(url: string): WebSocket {
    const cookie = this.header();
    // Extension d'undici (la WebSocket de Node) : des en-têtes à la poignée de main.
    return cookie ? new WebSocket(url, { headers: { cookie } } as unknown as string[]) : new WebSocket(url);
  }
}

/** Le téléphone dont les MODULES du client tournent ici (socket partagée, REST de
 *  Watch Together) : `fetch` et `WebSocket` globaux passent par son pot, comme
 *  sous React Native. Rend de quoi tout remettre. */
export function installReactNativeJar(jar: CookieJar, origin: string): () => void {
  const realFetch = globalThis.fetch;
  const RealWebSocket = globalThis.WebSocket;
  globalThis.fetch = jar.fetchFor(origin, realFetch);
  globalThis.WebSocket = class extends RealWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      const cookie = String(url).startsWith(origin.replace(/^http/, "ws")) ? jar.header() : undefined;
      super(url, cookie ? ({ protocols, headers: { cookie } } as unknown as string[]) : protocols);
    }
  } as typeof WebSocket;
  return () => {
    globalThis.fetch = realFetch;
    globalThis.WebSocket = RealWebSocket;
  };
}
