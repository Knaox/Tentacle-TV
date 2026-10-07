import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import type { PublicIpReport, RemoteAccessState, RemoteCheckReport } from "@tentacle-tv/shared";

/**
 * L'accès à distance rendu à plat, comme les autres bancs de composants :
 * l'état en tête, le formulaire des adresses prérempli (les clés de 1.23.0),
 * le guide replié « En savoir plus » et ce qu'il montre une fois ouvert, le
 * rapport du test et les guides des box. `t()` rend la clé (et ses
 * paramètres) ; l'API, les requêtes et `adminUtils` (qui démarre l'app par
 * `main.tsx`) sont remplacés.
 */

const h = vi.hoisted(() => ({
  state: null as unknown as RemoteAccessState,
  exposure: true,
  publicIpEnabled: null as boolean | null,
  publicIp: { data: undefined as PublicIpReport | undefined, isPending: false },
  check: { data: undefined as RemoteCheckReport | undefined, isPending: false, error: null as unknown, mutate: () => undefined },
  publicConfig: { publicUrl: "https://poulpy.example.ch", effectiveUrl: "https://poulpy.example.ch", envFallback: "" },
  direct: { enabled: true, privateUrl: "http://192.168.1.50:8096", publicUrl: "https://poulpy.example.ch/jellyfin" },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}${JSON.stringify(opts)}` : key),
    i18n: { language: "fr" },
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: async () => undefined }),
  useMutation: () => ({ mutate: () => undefined, isPending: false }),
}));
vi.mock("../../pages/adminUtils", () => ({
  cls: new Proxy({}, { get: (_target, name) => `cls-${String(name)}` }),
  BACKEND: "",
  creds: () => undefined,
  hdrs: () => ({}),
}));
vi.mock("../../contexts/ToastContext", () => ({ useToast: () => ({ show: () => undefined }) }));
vi.mock("../serverLinks/useServerLinks", () => ({ SERVER_LINKS_KEY: ["admin", "server-links"] }));
vi.mock("../admin/services/useUnsavedGuard", () => ({ useUnsavedGuard: () => undefined }));
vi.mock("../admin/services/useServicesData", () => ({
  usePublicUrlConfig: () => ({ data: h.publicConfig, isError: false, isPending: false, refetch: async () => undefined }),
  useDirectStreamingConfig: () => ({ data: h.direct, isError: false, isPending: false, refetch: async () => undefined }),
  useExplainFailure: () => () => "échec",
}));
vi.mock("../admin/services/servicesApi", () => ({ servicesApi: { savePublicUrl: async () => undefined } }));
vi.mock("../admin/services/servicesModel", () => ({ SERVICES_KEYS: { publicUrl: ["admin", "services", "public-url"], directStreaming: ["admin", "services", "direct"] } }));
vi.mock("@tentacle-tv/api-client", () => ({ useServerCapability: () => h.exposure }));
vi.mock("../PageTransition", () => ({ PageTransition: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("./remoteAccessApi", () => ({
  REMOTE_ACCESS_KEY: ["admin", "remote-access"],
  RemoteAccessError: class extends Error {},
  useRemoteAccess: () => ({ isPending: false, isError: false, data: h.state, refetch: () => undefined }),
  useSaveRemoteAccess: () => ({ mutateAsync: async () => h.state }),
  useRunRemoteCheck: () => h.check,
  usePublicIp: (enabled: boolean) => {
    h.publicIpEnabled = enabled;
    return h.publicIp;
  },
}));

const page = { protocol: "http:", hostname: "192.168.1.20", host: "192.168.1.20:3471", hash: "" };
vi.stubGlobal("window", { location: page });

const { RemoteAccessPanel } = await import("./RemoteAccessPanel");
const { CheckResults } = await import("./CheckResults");
const { RouterGuideCard } = await import("./RouterGuideCard");
const { AddressTestResults } = await import("./AddressTestResults");
const { guessLanUrl, homeTentacleUrl, hostPortOf, isLocalHttp, isValidLocalUrl, parseHostPort } = await import("./lanAddress");

/** L'état d'un serveur venu de 1.23.0 : Tentacle et Jellyfin sous le même domaine, Jellyfin sur /jellyfin. */
function makeState(over: Partial<RemoteAccessState["settings"]> = {}, rest: Partial<RemoteAccessState> = {}): RemoteAccessState {
  return {
    settings: { enabled: true, proxy: "none", localUrl: null, routerId: null, ...over },
    publicUrl: "https://poulpy.example.ch",
    jellyfinPublicUrl: "https://poulpy.example.ch/jellyfin",
    hostPort: 3471,
    jellyfinHostPort: 8096,
    deployment: "docker",
    stack: null,
    checkServiceUrl: "https://check.tentacletv.app",
    lastCheck: null,
    directPlay: { enabled: true, privateUrl: "http://192.168.1.50:8096", publicUrl: "https://poulpy.example.ch/jellyfin" },
    derivedLocalUrl: "http://192.168.1.20:3471",
    jellyfinCors: { status: "ready", origins: ["https://poulpy.example.ch", "http://192.168.1.20:3471", "tentacle://app", "tauri://localhost"], added: [] },
    ...rest,
  };
}

const render = (variant?: "admin" | "wizard") => renderToStaticMarkup(<RemoteAccessPanel variant={variant} />).replaceAll("&quot;", '"');

beforeEach(() => {
  h.state = makeState();
  h.exposure = true;
  h.publicIpEnabled = null;
  h.publicIp = { data: { outcome: "found", v4: "203.0.113.5", v6: null, source: "echo", detectedAt: "2026-10-07T10:00:00.000Z" }, isPending: false };
  h.check = { data: undefined, isPending: false, error: null, mutate: () => undefined };
  h.publicConfig = { publicUrl: "https://poulpy.example.ch", effectiveUrl: "https://poulpy.example.ch", envFallback: "" };
  h.direct = { enabled: true, privateUrl: "http://192.168.1.50:8096", publicUrl: "https://poulpy.example.ch/jellyfin" };
  Object.assign(page, { protocol: "http:", hostname: "192.168.1.20", host: "192.168.1.20:3471", hash: "" });
});

describe("le panneau de l'accès à distance", () => {
  it("un serveur de 1.23.0, repris tel quel : l'état en tête, le formulaire prérempli, aucun interrupteur d'exposition, aucun mandataire à choisir", () => {
    const html = render();
    // L'état : chez soi et dehors, Tentacle et les vidéos.
    expect(html.indexOf("overviewTitle")).toBeLessThan(html.indexOf("addressesTitle"));
    expect(html).toContain(">https://poulpy.example.ch/jellyfin<");
    expect(html).toContain(">http://192.168.1.50:8096<");
    expect(html).toContain(">http://192.168.1.20:3471<");
    expect(html).toContain("overviewHttps");
    // Le formulaire : les trois adresses de 1.23.0, et la lecture directe allumée — le seul interrupteur.
    expect(html).toContain('value="https://poulpy.example.ch"');
    expect(html).toContain('value="http://192.168.1.50:8096"');
    expect(html).toContain('value="https://poulpy.example.ch/jellyfin"');
    expect(html.match(/role="switch"/g)).toHaveLength(1);
    expect(html).toContain('aria-checked="true"');
    // Le mandataire n'est demandé nulle part : il attend dans « En savoir plus », replié.
    expect(html).toContain("moreLabel");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("proxy_none_title");
    expect(html).not.toContain('id="guide"');
    expect(html).not.toContain("noneWarning");
    // L'adresse publique de la box est située : il y a un lien public.
    expect(h.publicIpEnabled).toBe(true);
    expect(html).toContain('overviewPublicIp{"ip":"203.0.113.5"}');
  });

  it("le CORS de Jellyfin en mots : ce que Tentacle y inscrit, l'application de bureau en une seule mention", () => {
    const html = render();
    expect(html).toContain("cors_ready");
    expect(html).toContain('corsOrigins{"list":"https://poulpy.example.ch, http://192.168.1.20:3471, corsDesktop"}');
    h.state = makeState({}, { jellyfinCors: { status: "open", origins: [], added: [] } });
    expect(render()).toContain("corsOpenBody");
  });

  it("sans lien public : Tentacle ne répond qu'à la maison, et l'adresse de la box n'est pas demandée", () => {
    h.state = makeState({}, { publicUrl: null });
    const html = render();
    expect(html).toContain("overviewNoPublic");
    expect(html).not.toContain("overviewHttps");
    expect(h.publicIpEnabled).toBe(false);
  });

  it("« En savoir plus » ouvert : l'exemple de NPM pour Jellyfin sous /jellyfin, prérempli d'après les adresses réglées", () => {
    page.hash = "#proxy";
    h.state = makeState({ proxy: "other" });
    const html = render();
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("proxyNotIncluded");
    // Jellyfin sous un chemin du domaine de Tentacle : le chemin vers Jellyfin, le reste vers Tentacle, sans CORS.
    expect(html).toMatch(/value="path"[^>]*checked=""|checked=""[^>]*value="path"/);
    expect(html).toContain("location /jellyfin/ {\n    proxy_pass http://192.168.1.50:8096;");
    expect(html).toContain("location / {\n    proxy_pass http://192.168.1.20:3471;");
    expect(html).not.toContain("add_header Access-Control-Allow-Origin");
    expect(html).toContain('npmHintPath{"domain":"poulpy.example.ch","target":"http://192.168.1.20:3471","path":"/jellyfin","jellyfin":"http://192.168.1.50:8096"}');
    for (const key of ["portsSectionTitle", "checkSectionTitle", "planBTitle", "security_default"]) expect(html).toContain(key);
    // Le guide écrit, dans l'administration, est rangé là aussi.
    expect(html).toContain('id="guide"');
  });

  it("Caddy, Jellyfin sur son domaine : les en-têtes CORS de Tentacle sur Jellyfin", () => {
    page.hash = "#proxy";
    h.state = makeState({ proxy: "caddy" }, { directPlay: { enabled: true, privateUrl: "http://192.168.1.50:8096", publicUrl: "https://jf.example.com" } });
    const html = render();
    expect(html).toContain("caddyHint");
    expect(html).toContain("poulpy.example.ch {\n  reverse_proxy 192.168.1.20:3471\n}");
    expect(html).toContain("jf.example.com {\n  reverse_proxy 192.168.1.50:8096 {");
    expect(html).toContain('header_down Access-Control-Allow-Origin "https://poulpy.example.ch"');
  });

  it("dans l'application de bureau, l'adresse vue par le mandataire vient du serveur (la page n'a pas d'adresse réseau)", () => {
    Object.assign(page, { protocol: "tentacle:", hostname: "app", host: "app", hash: "#proxy" });
    h.state = makeState({ proxy: "traefik" });
    const html = render();
    expect(html).toContain('value="192.168.1.20:3471"');
    expect(html).toContain('servers: [{ url: "http://192.168.1.20:3471" }]');
    expect(html).toContain("rule: Host(`poulpy.example.ch`) &amp;&amp; PathPrefix(`/jellyfin`)");
  });

  it("sans mandataire, dans le guide : l'adresse publique proposée, les DEUX ports avec leurs numéros", () => {
    page.hash = "#ports";
    h.state = makeState({}, { publicUrl: null, jellyfinPublicUrl: null, directPlay: { enabled: true, privateUrl: "http://192.168.1.50:8096", publicUrl: null }, jellyfinHostPort: 47896, hostPort: 47300 });
    const html = render();
    expect(html.indexOf("proxy_none_title")).toBeLessThan(html.indexOf("proxy_caddy_title"));
    expect(html).toContain("http://203.0.113.5:47300");
    expect(html).toContain("publicLinkUse");
    expect(html).toContain(">47300<");
    expect(html).toContain(">47896<");
    expect(html).toContain("portOptional");
  });

  it("un serveur sans la capacité d'exposition : pas d'adresse publique détectée, rien d'autre ne manque", () => {
    h.exposure = false;
    page.hash = "#check";
    const html = render();
    expect(h.publicIpEnabled).toBe(false);
    expect(html).not.toContain("publicIpTitle");
    expect(html).toContain("checkSectionTitle");
  });

  it("assistant : le lien public seulement — la lecture directe se règle à la fin de l'installation —, sans le guide écrit", () => {
    const html = render("wizard");
    expect(html).toContain('value="https://poulpy.example.ch"');
    expect(html).toContain("wizardJellyfinLater");
    expect(html).not.toContain('role="switch"');
    expect(html).not.toContain("addressesTest");
    expect(html).not.toContain('id="guide"');
    expect(html).toContain("moreLabel");
  });
});

describe("le résultat du test des adresses", () => {
  it("même domaine : pas de CORS ; ce que Tentacle vient d'ajouter est dit ; la publique muette n'est qu'une remarque", () => {
    const html = renderToStaticMarkup(
      <AddressTestResults
        result={{
          private: { ok: true, version: "10.11.11", error: null, corsOk: true, sameOrigin: false },
          public: { ok: false, version: null, error: "fetch failed", corsOk: null, sameOrigin: false },
          cors: { status: "updated", origins: [], added: ["http://192.168.1.20:3471", "tentacle://app"] },
        }}
      />,
    ).replaceAll("&quot;", '"');
    expect(html).toContain("testCorsOk");
    expect(html).toContain('testCorsAdded{"list":"http://192.168.1.20:3471, corsDesktop"}');
    expect(html).toContain('testPublicUnreachable{"error":"fetch failed"}');
    expect(html).not.toContain("testCorsRefusedBody");
    const same = renderToStaticMarkup(
      <AddressTestResults result={{ private: null, public: { ok: true, version: "10.11.11", error: null, corsOk: true, sameOrigin: true }, cors: null }} />,
    );
    expect(same).toContain("testSameOrigin");
  });
});

describe("le rapport du test", () => {
  const base: RemoteCheckReport = { checkedAt: "2026-10-06T01:00:00.000Z", outcome: "done", publicIp: { v4: "203.0.113.5", v6: null }, items: [] };

  it("HTTP clair joignable : l'état en mots, en rouge, avec sa cause", () => {
    const report: RemoteCheckReport = {
      ...base,
      items: [
        { service: "tentacle", scheme: "http", port: 3471, host: null, family: 4, verdict: "open", httpStatus: 200, certificateExpires: null },
        { service: "tentacle", scheme: "http", port: 3471, host: null, family: 6, verdict: "not_testable", httpStatus: null, certificateExpires: null },
      ],
    };
    const html = renderToStaticMarkup(<CheckResults report={report} wanIp="" />);
    expect(html).toContain("state_exposed_http");
    expect(html).toContain("border-danger-border");
    expect(html).toContain("http://203.0.113.5:3471");
    expect(html).toContain("cause_ipv6_not_testable");
  });

  it("service injoignable : rien n'est jugé, on le dit", () => {
    const html = renderToStaticMarkup(<CheckResults report={{ ...base, outcome: "service_unavailable" }} wanIp="" />);
    expect(html).toContain("outcome_service_unavailable");
    expect(html).not.toContain("state_");
  });
});

describe("les guides des box", () => {
  it("un guide vérifié : son lien officiel et son chemin de menus", () => {
    const html = renderToStaticMarkup(<RouterGuideCard routerId="free" onChange={() => undefined} />);
    expect(html).toContain("https://assistance.free.fr/articles/1395");
    expect(html).toContain('lang="fr"');
    expect(html).toContain("sharedIpv4_full_stack");
  });

  it("un opérateur non vérifié : la mise en garde, aucun lien", () => {
    const html = renderToStaticMarkup(<RouterGuideCard routerId="sfr" onChange={() => undefined} />);
    expect(html).toContain("routerUnverified");
    expect(html).not.toContain("routerGuideLink");
  });
});

describe("l'adresse locale", () => {
  it("d'où qu'on ouvre la page : réglée, sinon celle que le serveur voit (IP privée), sinon celle de la page", () => {
    const settings = { enabled: false, proxy: "none" as const, localUrl: null, routerId: null };
    const desktop = { protocol: "tentacle:", hostname: "app", host: "app" };
    expect(homeTentacleUrl({ settings: { ...settings, localUrl: "http://10.0.0.2:3000" }, derivedLocalUrl: "http://192.168.1.20:3471" }, desktop)).toBe("http://10.0.0.2:3000");
    expect(homeTentacleUrl({ settings, derivedLocalUrl: "http://192.168.1.20:3471" }, desktop)).toBe("http://192.168.1.20:3471");
    expect(homeTentacleUrl({ settings, derivedLocalUrl: "https://poulpy.example.ch" }, desktop)).toBeNull();
    expect(homeTentacleUrl({ settings, derivedLocalUrl: null }, { protocol: "http:", hostname: "192.168.1.9", host: "192.168.1.9:3000" })).toBe("http://192.168.1.9:3000");
  });

  it("hôte:port — lu, écrit, port par défaut compris", () => {
    expect(hostPortOf("http://192.168.1.50:8096/jellyfin")).toBe("192.168.1.50:8096");
    expect(hostPortOf("https://nas.local")).toBe("nas.local:443");
    expect(parseHostPort("tentacle:3000")).toEqual({ host: "tentacle", port: 3000 });
    expect(parseHostPort("[fd00::20]:3000")).toEqual({ host: "[fd00::20]", port: 3000 });
    expect(parseHostPort("192.168.1.20")).toBeNull();
    expect(parseHostPort("192.168.1.20:70000")).toBeNull();
    expect(parseHostPort("1.2.3.4:80\n}")).toBeNull();
  });

  it("devinée depuis une page servie par une adresse privée, et seulement elle", () => {
    expect(guessLanUrl({ protocol: "http:", hostname: "192.168.1.20", host: "192.168.1.20:3471" })).toBe("http://192.168.1.20:3471");
    expect(guessLanUrl({ protocol: "https:", hostname: "tv.example.com", host: "tv.example.com" })).toBeNull();
    expect(isLocalHttp({ protocol: "http:", hostname: "localhost" })).toBe(true);
    expect(isLocalHttp({ protocol: "https:", hostname: "192.168.1.20" })).toBe(false);
    expect(isValidLocalUrl("http://192.168.1.20:3000")).toBe(true);
    expect(isValidLocalUrl("http://u:p@192.168.1.20")).toBe(false);
    expect(isValidLocalUrl("192.168.1.20")).toBe(false);
  });
});
