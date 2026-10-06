import { describe, expect, it } from "vitest";
import { caddySnippet, isValidDomain, nginxSnippet, traefikSnippet } from "./proxySnippets";

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

describe("le mandataire de l'utilisateur", () => {
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

  it("vise l'hôte donné, jamais un service d'une pile (aucun mandataire n'y est embarqué)", () => {
    for (const out of [caddySnippet(input), nginxSnippet(input), traefikSnippet(input)]) {
      expect(out).not.toMatch(/tentacle:3000|jellyfin:8096|--profile/);
    }
    // Un mandataire posé dans le même réseau Docker vise les services par leur nom.
    expect(caddySnippet({ ...input, upstreamHost: "tentacle" })).toContain("reverse_proxy tentacle:3000");
  });

  it("refuse une entrée qui casserait la configuration", () => {
    expect(() => caddySnippet({ ...input, upstreamHost: "1.2.3.4\n}" })).toThrow();
    expect(() => nginxSnippet({ ...input, tentaclePort: 70000 })).toThrow();
    expect(() => traefikSnippet({ ...input, jellyfinDomain: "jf" })).toThrow();
  });
});
