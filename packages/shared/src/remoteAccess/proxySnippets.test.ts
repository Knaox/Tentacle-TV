import { describe, expect, it } from "vitest";
import { caddySnippet, isValidDomain, nginxSnippet, stackEnvLines, stackProxyCommand, traefikSnippet } from "./proxySnippets";

const input = { tentacleDomain: "tv.example.com", jellyfinDomain: "jf.example.com", upstreamHost: "192.168.1.20", tentaclePort: 3000, jellyfinPort: 8096 };

describe("isValidDomain", () => {
  it("un domaine complet, rien qui casse une ligne", () => {
    expect(isValidDomain("tv.example.com")).toBe(true);
    expect(isValidDomain("TV.Example.com.")).toBe(true);
    expect(isValidDomain("localhost")).toBe(false);
    expect(isValidDomain("192.168.1.20")).toBe(false);
    expect(isValidDomain("tv.example.com\nreverse_proxy evil:80")).toBe(false);
    expect(isValidDomain("-tv.example.com")).toBe(false);
    expect(isValidDomain("tv .example.com")).toBe(false);
  });
});

describe("piles livrées", () => {
  it("les lignes du .env et la commande du profil", () => {
    expect(stackEnvLines("tv.example.com", "jf.example.com")).toBe("TENTACLE_DOMAIN=tv.example.com\nJELLYFIN_DOMAIN=jf.example.com");
    expect(stackEnvLines("tv.example.com", null)).toBe("TENTACLE_DOMAIN=tv.example.com");
    expect(stackProxyCommand("traefik")).toBe("docker compose --profile traefik up -d");
    expect(() => stackEnvLines("tv.example.com\nX=1", null)).toThrow();
  });
});

describe("mandataire existant", () => {
  it("Caddy : Tentacle, puis Jellyfin avec l'origine de Tentacle", () => {
    const out = caddySnippet(input);
    expect(out).toContain("tv.example.com {\n  reverse_proxy 192.168.1.20:3000\n}");
    expect(out).toContain('header_down Access-Control-Allow-Origin "https://tv.example.com"');
    expect(caddySnippet({ ...input, jellyfinDomain: null })).not.toContain("jf.example.com");
  });

  it("Nginx : websockets, et les en-têtes CORS de Jellyfin remplacés, jamais doublés", () => {
    const out = nginxSnippet(input);
    expect(out).toContain('proxy_set_header Connection "upgrade";');
    expect(out).toContain("proxy_pass http://192.168.1.20:3000;");
    expect(out).toContain("proxy_hide_header Access-Control-Allow-Origin;");
    expect(out.match(/add_header Access-Control-Allow-Origin/g)).toHaveLength(1);
  });

  it("Traefik : fournisseur de fichier, sans socket Docker", () => {
    const out = traefikSnippet(input);
    expect(out).toContain("rule: Host(`tv.example.com`)");
    expect(out).toContain('servers: [{ url: "http://192.168.1.20:8096" }]');
    expect(out).not.toContain("docker.sock");
  });

  it("refuse une entrée qui casserait la configuration", () => {
    expect(() => caddySnippet({ ...input, upstreamHost: "1.2.3.4\n}" })).toThrow();
    expect(() => nginxSnippet({ ...input, tentaclePort: 70000 })).toThrow();
    expect(() => traefikSnippet({ ...input, jellyfinDomain: "jf" })).toThrow();
  });
});
