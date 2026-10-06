import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { httpCall, httpsCall } from "./https";
import { REPO, Stack, waitFor } from "./stack";

/**
 * Les profils `caddy` et `traefik` de la pile complète : HTTPS vers Tentacle,
 * Jellyfin avec UN SEUL en-tête CORS (celui de Tentacle, jamais en double),
 * préambule compris, et le port 80 qui renvoie vers HTTPS.
 *
 * Sur un banc, aucune autorité publique ne signe `*.localtest.me` : Caddy
 * reçoit son autorité interne (`tls internal`, ajouté au Caddyfile LIVRÉ, rien
 * d'autre ne change), Traefik sert son certificat par défaut — et aucun des
 * deux ne s'adresse à Let's Encrypt.
 */
const TENTACLE = "tentacle.localtest.me";
const JELLYFIN = "jellyfin.localtest.me";
const ORIGIN = `https://${TENTACLE}`;
const SERVER_ENV = "services:\n  tentacle:\n    environment:\n      REMOTE_CHECK_URL: \"off\"\n";

const SHIPPED = readFileSync(join(REPO, "stacks/tentacle-full/compose.yaml"), "utf8");

/** Les lignes qui suivent `marker` dans la pile livrée, tant qu'elles restent sous l'indentation donnée. */
function shippedBlock(marker: string, indent: string): string[] {
  const lines: string[] = [];
  for (const line of SHIPPED.slice(SHIPPED.indexOf(marker) + marker.length).split("\n")) {
    if (line.trim() !== "" && !line.startsWith(indent)) break;
    lines.push(line);
  }
  return lines;
}

/** Le Caddyfile de la pile livrée, tel quel, avec l'autorité interne sur chaque site. */
function caddyOverride(): string {
  const lines = shippedBlock("  caddyfile:\n    content: |\n", "      ").flatMap((line) =>
    /^ {6}\$\{[A-Z_]+:-[^}]+\} \{$/.test(line) ? [line, "        tls internal"] : [line],
  );
  return `configs:\n  caddyfile:\n    content: |\n${lines.join("\n")}\n${SERVER_ENV}`;
}

/**
 * La commande livrée de Traefik, plus une autorité ACME injoignable : sur le
 * banc, aucune commande ne part chez Let's Encrypt (Traefik sert alors son
 * certificat par défaut). Ses redirections et sa config restent celles livrées.
 */
function traefikOverride(): string {
  const command = shippedBlock("  traefik:\n", "    ").join("\n");
  const flags = [...command.slice(command.indexOf("    command:\n")).matchAll(/^ {6}- (--\S+)$/gm)].map((m) => m[1]);
  flags.push("--certificatesresolvers.letsencrypt.acme.caserver=https://127.0.0.1:9/directory");
  return `${SERVER_ENV}  traefik:\n    command:\n${flags.map((f) => `      - ${f}`).join("\n")}\n`;
}

(["caddy", "traefik"] as const).forEach((proxy, index) => {
  const ports = { tentacle: 3501 + index, jellyfin: 9001 + index, discovery: 7363 + index, http: 8484 + index, https: 8447 + index };
  const stack = new Stack({
    stack: "full",
    project: `wiz-e2e-${proxy}`,
    env: {
      TENTACLE_PORT: String(ports.tentacle),
      JELLYFIN_PORT: String(ports.jellyfin),
      JELLYFIN_DISCOVERY_PORT: String(ports.discovery),
      HTTP_PORT: String(ports.http),
      HTTPS_PORT: String(ports.https),
      TENTACLE_DOMAIN: TENTACLE,
      JELLYFIN_DOMAIN: JELLYFIN,
    },
    override: proxy === "caddy" ? caddyOverride() : traefikOverride(),
    profiles: [proxy],
  });

  describe(`profil ${proxy}`, () => {
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
