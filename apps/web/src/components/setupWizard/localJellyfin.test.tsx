import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SetupJellyfinInstall, SetupLocalJellyfin } from "@tentacle-tv/shared";
import type { LocalJellyfin as LocalJellyfinHost } from "./useLocalJellyfin";

/**
 * Le Jellyfin de CE PC (app Windows), rendu à plat pour chaque état simulé de
 * l'hôte : à droite, le panneau dit l'ÉTAT (ce qui se passe, la progression) ;
 * à gauche, les trois étapes et ce qu'on attend de l'administrateur pendant
 * que l'installateur est ouvert. La fin se dit (prêt, installateur fermé,
 * muet, introuvable). `t()` rend la clé.
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

const { LocalJellyfin } = await import("./LocalJellyfin");
const { JellyfinInstallProgress } = await import("./JellyfinInstallProgress");
const { JellyfinStepAside } = await import("./JellyfinStepAside");
const { localJellyfinView } = await import("./localJellyfinModel");

const local = (over: Partial<SetupLocalJellyfin> = {}): SetupLocalJellyfin => ({
  state: "absent", mode: null, version: null, url: "http://127.0.0.1:8096", canStart: false,
  installer: "available", installing: false, docsUrl: "https://jellyfin.org/downloads/windows", ...over,
});
const install = (over: Partial<SetupJellyfinInstall> = {}): SetupJellyfinInstall => ({
  phase: "idle", version: "12.1.0", receivedBytes: 0, totalBytes: null, failure: null, docsUrl: "https://jellyfin.org/downloads/windows", ...over,
});

interface State {
  local?: SetupLocalJellyfin | null;
  install?: SetupJellyfinInstall | null;
  starting?: boolean;
}

/** Le panneau de droite et la colonne de gauche, pour un même état de l'hôte. */
function render(state: State): { panel: string; aside: string } {
  const host: LocalJellyfinHost = {
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
  const view = localJellyfinView(host.local, host.install, { starting: host.starting });
  return {
    panel: renderToStaticMarkup(<LocalJellyfin host={host} view={view} />),
    aside: renderToStaticMarkup(<JellyfinStepAside chosen={null} state={null} previous={null} local={view} />),
  };
}

describe("le Jellyfin de ce PC pendant son installation", () => {
  it("installateur ouvert : l'état en grand à droite ; les étapes et ce qui bloque d'habitude à gauche", () => {
    const { panel, aside } = render({ install: install({ phase: "installing" }) });
    expect(panel).toContain("installStageInstallerTitle");
    expect(panel).toContain("installStageInstallerLead");
    expect(panel).not.toContain("installTipConsent");
    for (const tip of ["installTipConsent", "installAdvice", "installTipHidden", "installTipClosed"]) expect(aside).toContain(tip);
    // Téléchargement fait, installation en cours, démarrage à venir.
    expect(aside).toMatch(/aria-current="step"[^>]*>.*installStepInstaller/);
    expect(aside).toContain("installStepDone");
    expect(panel).not.toContain("installButton");
  });

  it("téléchargement : la barre dit le pourcentage, aucun conseil de l'installateur", () => {
    const { panel, aside } = render({ install: install({ phase: "downloading", receivedBytes: 30, totalBytes: 100 }) });
    expect(panel).toContain('role="progressbar"');
    expect(panel).toContain('aria-valuenow="30"');
    expect(panel).toContain("installStageDownloadTitle");
    expect(aside).not.toContain("installTipConsent");
    expect(aside).toMatch(/aria-current="step"[^>]*>.*installStepDownload/);
  });

  it("avant l'installation : le bouton à droite, les trois étapes à venir et le conseil à gauche", () => {
    const { panel, aside } = render({});
    expect(panel).toContain("installButton");
    expect(panel).not.toContain("installAdvice");
    expect(aside).toContain("jfInstallStepsTitle");
    expect(aside).toContain("installAdvice");
    expect(aside).not.toContain('aria-current="step"');
  });

  it("installateur fini : « Démarrage de Jellyfin… », puis « prêt »", () => {
    const stopped = local({ state: "stopped", mode: "tray", canStart: true });
    expect(render({ local: stopped, install: install({ phase: "done" }), starting: true }).panel).toContain("installStageStartTitle");
    const ready = render({ local: local({ state: "running" }), install: install({ phase: "done" }) }).panel;
    expect(ready).toContain("installReadyTitle");
    expect(ready).toContain("installReadyBody");
  });

  it("Jellyfin muet après l'installation : « Démarrer Jellyfin » revient, avec la raison", () => {
    const { panel } = render({ local: local({ state: "stopped", mode: "tray", canStart: true }), install: install({ phase: "done" }), starting: false });
    expect(panel).toContain("installLateTitle");
    expect(panel).toContain("localStart");
  });

  it("installateur fermé : ce qui s'est passé, relancer, et la recherche continue", () => {
    const { panel } = render({ install: install({ phase: "failed", failure: "cancelled" }) });
    expect(panel).toContain("installCancelledTitle");
    expect(panel).toContain("installFailed_cancelled");
    expect(panel).toContain("installCancelledFound");
    expect(panel).toContain("installRetry");
  });

  it("installateur fini mais Jellyfin introuvable : quoi faire", () => {
    const { panel } = render({ install: install({ phase: "done" }), starting: false });
    expect(panel).toContain("installNotFoundTitle");
    expect(panel).toContain("installRetry");
  });

  it("un Jellyfin déjà en marche ne montre rien à droite ; à gauche, les deux sortes de Jellyfin", () => {
    const { panel, aside } = render({ local: local({ state: "running" }) });
    expect(panel).toBe("");
    expect(aside).toContain("jfKindsTitle");
    expect(aside).toContain("jfNextBlank");
    expect(aside).toContain("jfNextConfigured");
  });

  it("l'état seul : le titre de l'étape en cours, sans liste d'étapes", () => {
    const html = renderToStaticMarkup(<JellyfinInstallProgress progress={{ stage: "start", message: { key: "install_done" }, percent: null }} />);
    expect(html).toContain("installStageStartLead");
    expect(html).not.toContain("aria-current");
  });
});
