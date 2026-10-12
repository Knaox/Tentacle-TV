import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SetupJellyfinInstall, SetupLocalJellyfin } from "@tentacle-tv/shared";
import type { LocalJellyfin as LocalJellyfinHost } from "./useLocalJellyfin";

/**
 * Le panneau du Jellyfin de CE PC (app Windows), rendu à plat pour chaque
 * état simulé de l'hôte : l'installation se suit en trois étapes, avec ce
 * qu'on attend de l'administrateur pendant que l'installateur est ouvert ; la
 * fin se dit (prêt, installateur fermé, muet, introuvable). `t()` rend la clé.
 */
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}${JSON.stringify(opts)}` : key),
    i18n: { language: "fr", changeLanguage: async () => undefined },
  }),
}));
vi.mock("../../pages/adminUtils", () => ({
  cls: new Proxy({}, { get: (_target, name) => `cls-${String(name)}` }),
  BACKEND: "",
  creds: () => undefined,
  hdrs: () => ({}),
}));

let host: LocalJellyfinHost;
vi.mock("./useLocalJellyfin", () => ({ useLocalJellyfin: () => host }));

const { LocalJellyfin } = await import("./LocalJellyfin");
const { JellyfinInstallProgress } = await import("./JellyfinInstallProgress");

const local = (over: Partial<SetupLocalJellyfin> = {}): SetupLocalJellyfin => ({
  state: "absent", mode: null, version: null, url: "http://127.0.0.1:8096", canStart: false,
  installer: "available", installing: false, docsUrl: "https://jellyfin.org/downloads/windows", ...over,
});
const install = (over: Partial<SetupJellyfinInstall> = {}): SetupJellyfinInstall => ({
  phase: "idle", version: "12.1.0", receivedBytes: 0, totalBytes: null, failure: null, docsUrl: "https://jellyfin.org/downloads/windows", ...over,
});

function render(state: { local?: SetupLocalJellyfin | null; install?: SetupJellyfinInstall | null; starting?: boolean }): string {
  host = {
    local: state.local === undefined ? local() : state.local,
    install: state.install ?? null,
    starting: state.starting ?? false,
    startRefusal: null,
    error: null,
    busy: false,
    refresh: async () => undefined,
    startInstall: async () => undefined,
    start: async () => undefined,
  };
  return renderToStaticMarkup(<LocalJellyfin onFound={() => undefined} />);
}

describe("le Jellyfin de ce PC pendant son installation", () => {
  it("installateur ouvert : le dit en grand, avec les étapes et ce qui bloque d'habitude", () => {
    const html = render({ install: install({ phase: "installing" }) });
    expect(html).toContain("installStageInstallerTitle");
    expect(html).toContain("installStageInstallerLead");
    for (const tip of ["installTipConsent", "installAdvice", "installTipHidden", "installTipClosed"]) expect(html).toContain(tip);
    // Téléchargement fait, installation en cours, démarrage à venir.
    expect(html).toMatch(/aria-current="step"[^>]*>.*installStepInstaller/);
    expect(html).toContain("installStepDone");
    expect(html).not.toContain("installButton");
  });

  it("téléchargement : la barre dit le pourcentage, aucun conseil de l'installateur", () => {
    const html = render({ install: install({ phase: "downloading", receivedBytes: 30, totalBytes: 100 }) });
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="30"');
    expect(html).toContain("installStageDownloadTitle");
    expect(html).not.toContain("installTipConsent");
  });

  it("installateur fini : « Démarrage de Jellyfin… », puis « prêt »", () => {
    const stopped = local({ state: "stopped", mode: "tray", canStart: true });
    expect(render({ local: stopped, install: install({ phase: "done" }), starting: true })).toContain("installStageStartTitle");
    const ready = render({ local: local({ state: "running" }), install: install({ phase: "done" }) });
    expect(ready).toContain("installReadyTitle");
    expect(ready).toContain("installReadyBody");
  });

  it("Jellyfin muet après l'installation : « Démarrer Jellyfin » revient, avec la raison", () => {
    const html = render({ local: local({ state: "stopped", mode: "tray", canStart: true }), install: install({ phase: "done" }), starting: false });
    expect(html).toContain("installLateTitle");
    expect(html).toContain("localStart");
  });

  it("installateur fermé : ce qui s'est passé, relancer, et la recherche continue", () => {
    const html = render({ install: install({ phase: "failed", failure: "cancelled" }) });
    expect(html).toContain("installCancelledTitle");
    expect(html).toContain("installFailed_cancelled");
    expect(html).toContain("installCancelledFound");
    expect(html).toContain("installRetry");
  });

  it("installateur fini mais Jellyfin introuvable : quoi faire", () => {
    const html = render({ install: install({ phase: "done" }), starting: false });
    expect(html).toContain("installNotFoundTitle");
    expect(html).toContain("installRetry");
  });

  it("un Jellyfin déjà en marche ne montre rien : il est dans la liste", () => {
    expect(render({ local: local({ state: "running" }) })).toBe("");
  });

  it("le composant d'étapes seul : une seule étape en cours", () => {
    const html = renderToStaticMarkup(<JellyfinInstallProgress progress={{ stage: "start", message: { key: "install_done" }, percent: null }} />);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toContain("installStageStartLead");
  });
});
