import { describe, expect, it } from "vitest";
import { allowedUrl, checkClientFetchRequest, CLIENT_FETCH_LIMITS, hostAllowed, isDeclarableHost, readClientFetchManifest } from "./pluginClientFetch";

const manifest = { hosts: ["music.example.com", "www.example.com"], mediaHosts: ["*.media.example.net"] };
const ok = { method: "POST" as const, url: "https://music.example.com/api/search?x=1", headers: { "Content-Type": "application/json" }, body: "{}" };

describe("requêtes déléguées — le manifeste", () => {
  it("garde des noms publics exacts, un joker en tête pour les flux seulement", () => {
    expect(readClientFetchManifest({ hosts: ["music.example.com"], mediaHosts: ["*.media.example.net"] })).toEqual({ hosts: ["music.example.com"], mediaHosts: ["*.media.example.net"] });
    expect(readClientFetchManifest({ hosts: ["music.example.com"] })).toEqual({ hosts: ["music.example.com"], mediaHosts: [] });
  });

  it("refuse le manifeste entier pour un seul hôte douteux", () => {
    for (const bad of ["localhost", "127.0.0.1", "192.168.1.10", "nas.local", "printer.lan", "*.example.com", "Example.com", "example", "a..b.com", "exa mple.com", "[::1]"]) {
      expect(readClientFetchManifest({ hosts: ["ok.example.com", bad] }), bad).toBeNull();
    }
    expect(readClientFetchManifest({ hosts: [] })).toBeNull();
    expect(readClientFetchManifest({ hosts: ["ok.example.com"], mediaHosts: ["*.local"] })).toBeNull();
    expect(readClientFetchManifest({ hosts: Array.from({ length: CLIENT_FETCH_LIMITS.maxHosts + 1 }, (_, i) => `h${i}.example.com`) })).toBeNull();
    expect(readClientFetchManifest(null)).toBeNull();
  });

  it("isDeclarableHost : ni IP, ni domaine local", () => {
    expect(isDeclarableHost("music.youtube-like.com")).toBe(true);
    expect(isDeclarableHost("10.0.0.1")).toBe(false);
    expect(isDeclarableHost("router.home")).toBe(false);
  });
});

describe("requêtes déléguées — l'adresse", () => {
  it("joker : tout sous-domaine, jamais le domaine nu ni un suffixe collé", () => {
    expect(hostAllowed("rr1---sn-x.media.example.net", manifest.mediaHosts)).toBe(true);
    expect(hostAllowed("media.example.net", manifest.mediaHosts)).toBe(false);
    expect(hostAllowed("evilmedia.example.net", manifest.mediaHosts)).toBe(false);
    expect(hostAllowed("music.example.com", manifest.hosts)).toBe(true);
    expect(hostAllowed("sub.music.example.com", manifest.hosts)).toBe(false);
  });

  it("https seul, sans identifiants ni port", () => {
    expect(allowedUrl("https://music.example.com/x", manifest.hosts)).not.toBeNull();
    for (const bad of ["http://music.example.com/x", "https://u:p@music.example.com/x", "https://music.example.com:8443/x", "file:///etc/passwd", "https://music.example.com.evil.org/x", "pas une adresse"]) {
      expect(allowedUrl(bad, manifest.hosts), bad).toBeNull();
    }
  });
});

describe("requêtes déléguées — la requête", () => {
  it("permet une requête ordinaire", () => {
    expect(checkClientFetchRequest(ok, manifest)).toBeNull();
    expect(checkClientFetchRequest({ method: "GET", url: "https://www.example.com/" }, manifest)).toBeNull();
  });

  it("refuse hôte, méthode, corps, délai et taille hors bornes", () => {
    expect(checkClientFetchRequest({ ...ok, url: "https://other.example.org/" }, manifest)).toMatch(/hôtes/);
    expect(checkClientFetchRequest({ ...ok, method: "PUT" }, manifest)).toMatch(/méthode/);
    expect(checkClientFetchRequest({ method: "GET", url: ok.url, body: "x" }, manifest)).toMatch(/corps/);
    expect(checkClientFetchRequest({ ...ok, body: "é".repeat(CLIENT_FETCH_LIMITS.maxRequestBody) }, manifest)).toMatch(/corps/);
    expect(checkClientFetchRequest({ ...ok, timeoutMs: 60_000 }, manifest)).toMatch(/délai/);
    expect(checkClientFetchRequest({ ...ok, maxBytes: 50 * 1024 * 1024 }, manifest)).toMatch(/taille/);
    expect(checkClientFetchRequest(null, manifest)).not.toBeNull();
  });

  it("refuse les en-têtes de connexion, d'authentification et du cœur", () => {
    for (const name of ["Cookie", "authorization", "Host", "Proxy-Authorization", "Sec-Fetch-Site", "X-Tentacle-User-Id", "X-Emby-Token", "Content-Length", "X-Forwarded-For"]) {
      expect(checkClientFetchRequest({ ...ok, headers: { [name]: "x" } }, manifest), name).toMatch(/interdit/);
    }
    expect(checkClientFetchRequest({ ...ok, headers: { "X-A": "a\r\nCookie: b" } }, manifest)).toMatch(/valeur/);
    const many = Object.fromEntries(Array.from({ length: CLIENT_FETCH_LIMITS.maxHeaders + 1 }, (_, i) => [`X-H${i}`, "v"]));
    expect(checkClientFetchRequest({ ...ok, headers: many }, manifest)).toMatch(/trop/);
  });
});

describe("requêtes déléguées — la nature (geste ou fond)", () => {
  it("accepte `play`, `prefetch` ou rien ; refuse le reste", () => {
    expect(checkClientFetchRequest({ ...ok, kind: "play" }, manifest)).toBeNull();
    expect(checkClientFetchRequest({ ...ok, kind: "prefetch" }, manifest)).toBeNull();
    expect(checkClientFetchRequest(ok, manifest)).toBeNull();
    expect(checkClientFetchRequest({ ...ok, kind: "urgent" }, manifest)).toBe("nature refusée");
  });
});
