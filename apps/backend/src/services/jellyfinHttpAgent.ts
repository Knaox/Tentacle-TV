import { Agent } from "undici";

/** Singleton undici Agent for all backend→Jellyfin HTTP traffic.
 *
 *  Why a dedicated dispatcher:
 *  - Default Node fetch dispatcher closes the TCP connection after each request,
 *    forcing a full TCP + TLS handshake on every HLS segment (~30-50 ms per call).
 *    On a 2-hour movie that's 1000+ segments × 50 ms = ~1 minute of pure handshake.
 *  - Keep-alive pool reuses connections for the full session → handshake amortized
 *    to one cost per origin per minute.
 *
 *  Tuning rationale:
 *  - keepAliveTimeout 60 000 ms: HLS players typically request segments every
 *    6-10 s; 60 s window keeps connections warm across pauses/seek.
 *  - connections 50: enough headroom for parallel HLS + image + API requests
 *    from multiple concurrent viewers.
 *  - bodyTimeout 4 h: progressive remux streams can last the whole movie. */
let agent: Agent | null = null;

export function getJellyfinDispatcher(): Agent {
  if (!agent) {
    agent = new Agent({
      keepAliveTimeout: 60_000,
      keepAliveMaxTimeout: 600_000,
      connections: 50,
      pipelining: 1,
      headersTimeout: 30_000,
      bodyTimeout: 4 * 60 * 60 * 1000,
    });
  }
  return agent;
}

/** Tests-only helper: drop the pool. Useful for graceful shutdowns too. */
export async function closeJellyfinDispatcher(): Promise<void> {
  if (agent) {
    await agent.close();
    agent = null;
  }
}
