import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import type { RemoteAccessState, RemoteCheckReport } from "@tentacle-tv/shared";

/**
 * L'accès à distance rendu à plat, comme les autres bancs de composants :
 * interrupteur coupé, les trois étapes selon le mandataire, le rapport du test
 * et les guides des box. `t()` rend la clé (et ses paramètres) ; l'API, la page
 * animée et `adminUtils` (qui démarre l'app par `main.tsx`) sont remplacés.
 */

const h = vi.hoisted(() => ({
  state: null as unknown as RemoteAccessState,
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
vi.mock("../admin/services/servicesModel", () => ({ SERVICES_KEYS: { publicUrl: ["admin", "services", "public-url"] } }));
vi.mock("../PageTransition", () => ({ PageTransition: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("./remoteAccessApi", () => ({
  REMOTE_ACCESS_KEY: ["admin", "remote-access"],
  RemoteAccessError: class extends Error {},
  useRemoteAccess: () => ({ isPending: false, isError: false, data: h.state, refetch: () => undefined }),
  useSaveRemoteAccess: () => ({ mutateAsync: async () => h.state }),
  useRunRemoteCheck: () => h.check,
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
    ...rest,
  };
}

beforeEach(() => {
  h.state = makeState();
  h.check = { data: undefined, isPending: false, error: null, mutate: () => undefined };
});

describe("le panneau de l'accès à distance", () => {
  it("coupé : l'interrupteur et le guide, aucune étape", () => {
    h.state = makeState({ enabled: false });
    const html = renderToStaticMarkup(<RemoteAccessPanel />);
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain("disabledHint");
    expect(html).not.toContain("step1Title");
    expect(html).toContain('id="guide"');
  });

  it("pile complète et Caddy : les trois étapes, les lignes du .env et la commande du profil", () => {
    const html = renderToStaticMarkup(<RemoteAccessPanel />);
    for (const key of ["step1Title", "step2Title", "step3Title", "planBTitle"]) expect(html).toContain(key);
    expect(html).toContain("TENTACLE_DOMAIN=tv.example.com");
    expect(html).toContain("docker compose --profile caddy up -d");
    // Derrière un mandataire : 443 et 80 vers l'adresse devinée depuis la page.
    expect(html).toContain("purpose_https");
    expect(html).toContain("192.168.1.20");
    expect(html).toContain("localHttpNotice");
  });

  it("sans mandataire : la mise en garde, et le port de Tentacle à rediriger", () => {
    h.state = makeState({ proxy: "none" });
    const html = renderToStaticMarkup(<RemoteAccessPanel />);
    expect(html).toContain("noneWarning");
    expect(html).toContain("purpose_tentacle");
    expect(html).toContain(">3471<");
  });

  it("assistant : les trois étapes seules, sans interrupteur ni guide", () => {
    h.state = makeState({ enabled: false });
    const html = renderToStaticMarkup(<RemoteAccessPanel variant="wizard" />);
    expect(html).toContain("step3Title");
    expect(html).not.toContain('role="switch"');
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
