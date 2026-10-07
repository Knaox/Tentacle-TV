import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import type { PublicIpReport, RemoteAccessState, RemoteCheckReport } from "@tentacle-tv/shared";

/**
 * L'accès à distance rendu à plat, comme les autres bancs de composants :
 * interrupteur coupé, les trois étapes selon le mandataire, le rapport du test
 * et les guides des box. `t()` rend la clé (et ses paramètres) ; l'API, la page
 * animée et `adminUtils` (qui démarre l'app par `main.tsx`) sont remplacés.
 */

const h = vi.hoisted(() => ({
  state: null as unknown as RemoteAccessState,
  exposure: true,
  publicIp: { data: undefined as PublicIpReport | undefined, isPending: false },
  check: { data: undefined as RemoteCheckReport | undefined, isPending: false, error: null as unknown, mutate: () => undefined },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}${JSON.stringify(opts)}` : key),
    i18n: { language: "fr" },
  }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: async () => undefined }) }));
vi.mock("../../pages/adminUtils", () => ({
  cls: new Proxy({}, { get: (_target, name) => `cls-${String(name)}` }),
  BACKEND: "",
  creds: () => undefined,
  hdrs: () => ({}),
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
  usePublicIp: () => h.publicIp,
  remoteAccessApi: { saveDirectPlay: async () => ({ success: true }) },
}));

vi.stubGlobal("window", { location: { protocol: "http:", hostname: "192.168.1.20", host: "192.168.1.20:3471" } });

const { RemoteAccessPanel } = await import("./RemoteAccessPanel");
const { CheckResults } = await import("./CheckResults");
const { RouterGuideCard } = await import("./RouterGuideCard");
const { guessLanUrl, isLocalHttp, isValidLocalUrl } = await import("./lanAddress");

function makeState(over: Partial<RemoteAccessState["settings"]> = {}, rest: Partial<RemoteAccessState> = {}): RemoteAccessState {
  return {
    settings: { enabled: true, proxy: "caddy", localUrl: null, routerId: null, ...over },
    publicUrl: "https://tv.example.com",
    jellyfinPublicUrl: null,
    hostPort: 3471,
    jellyfinHostPort: 8096,
    deployment: "docker",
    stack: "full",
    checkServiceUrl: "https://check.tentacletv.app",
    lastCheck: null,
    directPlay: { enabled: true, privateUrl: "http://192.168.1.20:8096", publicUrl: null },
    ...rest,
  };
}

beforeEach(() => {
  h.state = makeState();
  h.exposure = true;
  h.publicIp = { data: { outcome: "found", v4: "203.0.113.5", v6: null, source: "echo", detectedAt: "2026-10-07T10:00:00.000Z" }, isPending: false };
  h.check = { data: undefined, isPending: false, error: null, mutate: () => undefined };
});

describe("le panneau de l'accès à distance", () => {
  it("coupé (le défaut) : privé ou public en deux schémas, l'adresse sur le réseau pré-remplie, l'interrupteur — et aucune étape", () => {
    h.state = makeState({ enabled: false });
    const html = renderToStaticMarkup(<RemoteAccessPanel />);
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain("exposureOff");
    // Les deux schémas, et le réglage en cours dit en toutes lettres (le privé).
    expect(html.match(/<svg[^>]*role="img"/g)).toHaveLength(2);
    expect(html.indexOf("modeCurrent")).toBeLessThan(html.indexOf("modePublicTitle"));
    // L'adresse de ce serveur sur le réseau : celle de la page, modifiable, avec un exemple.
    expect(html).toContain('value="http://192.168.1.20:3471"');
    expect(html).toContain("lanExample");
    expect(html).not.toContain("step1Title");
    expect(html).not.toContain("public-ip");
    expect(html).toContain("security_default");
    expect(html).toContain('id="guide"');
  });

  it("Caddy : les trois étapes, et le Caddyfile à poser dans SON mandataire (aucun profil de pile)", () => {
    h.state = makeState({ localUrl: "http://192.168.1.20:3471" });
    const html = renderToStaticMarkup(<RemoteAccessPanel />);
    for (const key of ["step1Title", "step2Title", "step3Title", "planBTitle"]) expect(html).toContain(key);
    expect(html).toContain("snippetIntro");
    expect(html).toContain("caddyHint");
    expect(html).toContain("tv.example.com {\n  reverse_proxy 192.168.1.20:3471\n}");
    expect(html).not.toContain("--profile");
    expect(html).not.toContain("TENTACLE_DOMAIN");
    // Derrière un mandataire : 443 et 80 vers l'adresse devinée depuis la page.
    expect(html).toContain("purpose_https");
    expect(html).toContain("192.168.1.20");
    expect(html).toContain("localHttpNotice");
  });

  it("Traefik ou Nginx : l'onglet du mandataire choisi s'ouvre d'abord", () => {
    h.state = makeState({ proxy: "traefik" });
    let html = renderToStaticMarkup(<RemoteAccessPanel />);
    expect(html).toContain("traefikHint");
    expect(html).toContain("rule: Host(`tv.example.com`)");
    h.state = makeState({ proxy: "other" });
    html = renderToStaticMarkup(<RemoteAccessPanel />);
    expect(html).toContain("npmHint");
    expect(html).not.toContain("--profile");
  });

  it("sans mandataire (le défaut, en tête, et dit « ni inclus ni installés » pour les autres) : l'adresse publique proposée, les DEUX ports avec leurs numéros", () => {
    h.state = makeState({ proxy: "none" }, { publicUrl: null, jellyfinHostPort: 47896, hostPort: 47300 });
    const html = renderToStaticMarkup(<RemoteAccessPanel />).replaceAll("&quot;", '"');
    expect(html).toContain("proxyWhat");
    expect(html).toContain("proxyNotIncluded");
    expect(html.indexOf("proxy_none_title")).toBeLessThan(html.indexOf("proxy_caddy_title"));
    expect(html).toContain("defaultChoice");
    expect(html).toContain("noneWarning");
    expect(html).toContain("http://203.0.113.5:47300");
    expect(html).toContain("publicLinkUse");
    expect(html).toContain("purpose_tentacle");
    expect(html).toContain(">47300<");
    expect(html).toContain(">47896<");
    // Jellyfin : facultatif tant que la lecture directe hors de la maison est coupée.
    expect(html).toContain("portOptional");
  });

  it("l'adresse publique détectée ; le test d'ouverture pas encore en ligne : comment vérifier soi-même", () => {
    h.state = makeState({ proxy: "none" }, { publicUrl: null, lastCheck: { checkedAt: "2026-10-07T10:00:00.000Z", outcome: "service_unavailable", publicIp: { v4: null, v6: null }, items: [] } });
    const html = renderToStaticMarkup(<RemoteAccessPanel />).replaceAll("&quot;", '"');
    expect(html).toContain(">203.0.113.5<");
    expect(html).toContain("publicIpDetected");
    expect(html).toContain('reach_no_service{"url":"http://203.0.113.5:3471"}');
    expect(html).toContain('modePublicBody{"ip":"203.0.113.5"}');
  });

  it("le service de test pas encore en ligne : dit d'avance, avant tout test, avec l'adresse à essayer en 4G", () => {
    h.state = makeState({ proxy: "none" }, { publicUrl: null, lastCheck: null });
    h.publicIp = { data: { outcome: "found", v4: "203.0.113.5", v6: null, source: "echo", detectedAt: "2026-10-07T10:00:00.000Z", checkService: "offline" }, isPending: false };
    const html = renderToStaticMarkup(<RemoteAccessPanel />).replaceAll("&quot;", '"');
    expect(html).toContain('reach_no_service{"url":"http://203.0.113.5:3471"}');
    expect(html).not.toContain("reach_unknown");
  });

  it("la lecture directe hors de la maison : une étape à elle, facultative, coupée tant qu'aucune adresse publique", () => {
    const html = renderToStaticMarkup(<RemoteAccessPanel />).replaceAll("&quot;", '"');
    expect(html).toContain("directTitle");
    expect(html).toContain('directHome{"url":"http://192.168.1.20:8096"}');
    expect(html).toContain("directOff");
    expect(html).toContain('stepOf{"n":4,"total":4}');
  });

  it("un serveur sans la capacité : ni adresse publique détectée, ni lecture directe extérieure — trois étapes", () => {
    h.exposure = false;
    const html = renderToStaticMarkup(<RemoteAccessPanel />).replaceAll("&quot;", '"');
    expect(html).not.toContain("publicIpTitle");
    expect(html).not.toContain("directTitle");
    expect(html).toContain('stepOf{"n":3,"total":3}');
  });

  it("assistant : le même panneau, interrupteur compris (coupé par défaut), sans le guide", () => {
    h.state = makeState({ enabled: false });
    const html = renderToStaticMarkup(<RemoteAccessPanel variant="wizard" />);
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).not.toContain("step3Title");
    expect(html).not.toContain('id="guide"');
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
