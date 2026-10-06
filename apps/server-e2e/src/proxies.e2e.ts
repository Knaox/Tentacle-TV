import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { caddySnippet, traefikSnippet, type ProxySnippetInput } from "../../../packages/shared/src/remoteAccess/proxySnippets";
import { httpCall, httpsCall } from "./https";
import { Stack, waitFor } from "./stack";

/**
 * Le mandataire de l'UTILISATEUR devant la pile complète — les piles livrées
 * n'en embarquent aucun. Un Caddy ou un Traefik propre au banc
 * (`apps/server-e2e/proxies/compose.yaml`) reçoit l'extrait EXACT que donne
 * l'administration (`proxySnippets`), visant les ports publiés de l'hôte comme
 * chez l'utilisateur : HTTPS vers Tentacle, Jellyfin avec UN SEUL en-tête CORS
 * (celui de Tentacle, jamais en double), préambule compris, et le port 80 qui
 * renvoie vers HTTPS.
 *
 * Sur un banc, aucune autorité publique ne signe `*.localtest.me` : Caddy
 * reçoit son autorité interne (`tls internal` ajouté à chaque site de
 * l'extrait, rien d'autre ne change), Traefik sert son certificat par défaut —
 * et aucun des deux ne s'adresse à Let's Encrypt.
 */
const TENTACLE = "tentacle.localtest.me";
const JELLYFIN = "jellyfin.localtest.me";
const ORIGIN = `https://${TENTACLE}`;
const SERVER_ENV = "services:\n  tentacle:\n    environment:\n      REMOTE_CHECK_URL: \"off\"\n";
const UPSTREAM = "host.docker.internal";

/** Le Caddyfile de l'administration, avec l'autorité interne sur chaque site. */
function caddyfile(input: ProxySnippetInput): string {
  return caddySnippet(input)
    .split("\n")
    .flatMap((line) => (/^\S+ \{$/.test(line) ? [line, "  tls internal"] : [line]))
    .join("\n") + "\n";
}

(["caddy", "traefik"] as const).forEach((proxy, index) => {
  const ports = { tentacle: 3501 + index, jellyfin: 9001 + index, discovery: 7363 + index, http: 8484 + index, https: 8447 + index };
  const input: ProxySnippetInput = {
    tentacleDomain: TENTACLE,
    jellyfinDomain: JELLYFIN,
    upstreamHost: UPSTREAM,
    tentaclePort: ports.tentacle,
    jellyfinPort: ports.jellyfin,
  };
  const stack = new Stack({
    stack: "full",
    project: `wiz-e2e-${proxy}`,
    env: {
      TENTACLE_PORT: String(ports.tentacle),
      JELLYFIN_PORT: String(ports.jellyfin),
      JELLYFIN_DISCOVERY_PORT: String(ports.discovery),
      PROXY_HTTP_PORT: String(ports.http),
      PROXY_HTTPS_PORT: String(ports.https),
    },
    override: SERVER_ENV,
    extraComposeFiles: ["apps/server-e2e/proxies/compose.yaml"],
    files: proxy === "caddy" ? { "proxy/Caddyfile": caddyfile(input) } : { "proxy/traefik-dynamic.yml": `${traefikSnippet(input)}\n` },
    profiles: [proxy],
  });

  describe(`mandataire ${proxy}`, () => {
    beforeAll(() => stack.up());
    afterAll(() => stack.down());

    it("Tentacle répond en HTTPS sous son domaine", async () => {
      const reply = await waitFor("Tentacle en HTTPS", async () => {
        const r = await httpsCall(TENTACLE, ports.https, "/api/health");
        return r.status === 200 ? r : null;
      }, 180_000, 3_000);
      expect(reply.status).toBe(200);
    });

    it("Jellyfin : un seul Access-Control-Allow-Origin, celui de Tentacle", async () => {
      const reply = await waitFor("Jellyfin en HTTPS", async () => {
        const r = await httpsCall(JELLYFIN, ports.https, "/System/Info/Public", { headers: { origin: ORIGIN } });
        return r.status === 200 ? r : null;
      }, 180_000, 3_000);
      expect(reply.header("access-control-allow-origin")).toEqual([ORIGIN]);
      expect(reply.header("access-control-allow-credentials")).toEqual(["true"]);
    });

    it("préambule CORS : accepté, sans doublon, l'en-tête Authorization permis", async () => {
      const reply = await httpsCall(JELLYFIN, ports.https, "/System/Info/Public", {
        method: "OPTIONS",
        headers: { origin: ORIGIN, "access-control-request-method": "GET", "access-control-request-headers": "authorization" },
      });
      expect(reply.status).toBeLessThan(300);
      expect(reply.header("access-control-allow-origin")).toEqual([ORIGIN]);
      expect(reply.header("access-control-allow-headers").join(",").toLowerCase()).toContain("authorization");
    });

    it("le port 80 renvoie vers HTTPS", async () => {
      const reply = await httpCall(TENTACLE, ports.http, "/");
      expect(reply.status).toBeGreaterThanOrEqual(300);
      expect(reply.status).toBeLessThan(400);
      expect(reply.header("location")[0]).toMatch(/^https:\/\//);
    });
  });
});
