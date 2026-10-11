import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ServerInstall, ServerUpdateReport } from "@tentacle-tv/shared";

/**
 * La carte « Serveur Tentacle » face à l'app Windows (canal `microsoft-store`) :
 * « Mises à jour automatiques », sans commande ni « conseillée » tirée des
 * tags de l'image ; l'obligatoire reste, avec le chemin du Store. Un serveur
 * qui ne déclare pas de canal garde la carte d'avant.
 */
const h = vi.hoisted(() => ({ report: undefined as ServerUpdateReport | undefined }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}${JSON.stringify(o)}` : key), i18n: { language: "fr" } }),
}));
vi.mock("../../../hooks/useServerCompat", () => ({ MIN_SERVER_VERSION: "1.20.0" }));
vi.mock("../../../pages/adminUtils", () => ({ cls: { bs: "bs", bp: "bp" } }));
vi.mock("./useRestartWatch", () => ({
  useWatchedServerUpdate: () => ({
    query: { data: h.report, isPending: false, isFetching: false, isError: false, error: null, refetch: () => undefined },
    outcome: null,
    start: () => undefined,
  }),
}));
vi.mock("./serverUpdateApi", () => ({
  useServerUpdateRefresh: () => ({ isPending: false, mutate: () => undefined }),
  isOutdatedUpdateServer: () => false,
}));

const { ServerUpdateCard } = await import("./ServerUpdateCard");
const html = () => renderToStaticMarkup(<ServerUpdateCard />);

const DOCKER: ServerInstall = { runtime: "docker", repository: "ghcr.io/knaox/tentacle-tv", tag: null };
const STORE: ServerInstall = { runtime: "none", repository: "ghcr.io/knaox/tentacle-tv", tag: null, channel: "microsoft-store" };
const report = (install: ServerInstall, over: Partial<ServerUpdateReport> = {}): ServerUpdateReport => ({
  current: "1.25.1",
  bootId: "b1",
  latest: { version: "1.25.2", tag: "server-v1.25.2", publishedAt: null, url: "", highlights: { fr: ["Une nouveauté"], en: ["A feature"] } },
  behind: 1,
  requiredByClients: null,
  checkedAt: null,
  error: "rate-limited",
  install,
  ...over,
});

describe("la carte du serveur et l'app Windows", () => {
  beforeEach(() => {
    h.report = undefined;
  });

  it("une plus récente publiée : « Mises à jour automatiques », ni commande, ni nouveautés, ni erreur de GitHub", () => {
    h.report = report(STORE);
    const out = html();
    expect(out).toContain("serverState_automatic");
    expect(out).toContain("serverAutomatic");
    expect(out).not.toMatch(/serverState_advised|updateCompose|docker|serverWhatsNew|serverCheckError|updateNoContainer/);
  });

  it("sous le minimum d'un client : l'obligatoire reste, avec le chemin du Store et sans commande", () => {
    h.report = report(STORE, { requiredByClients: "1.25.2" });
    const out = html();
    expect(out).toContain("serverState_mandatory");
    expect(out).toContain("updateStore");
    expect(out).not.toMatch(/updateCompose|docker|serverLatest/);
  });

  it("un serveur qui ne déclare pas de canal : la carte d'avant, conseillée et sa commande", () => {
    h.report = report(DOCKER);
    const out = html();
    expect(out).toContain("serverState_advised");
    expect(out).toContain("docker compose pull");
    expect(out).toContain("serverCheckError_rate-limited");
    expect(out).not.toMatch(/serverState_automatic|updateStore/);
  });
});
