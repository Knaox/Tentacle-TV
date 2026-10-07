import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import type { SetupContext } from "@tentacle-tv/shared";

/**
 * L'écran des bibliothèques, rendu à plat : Jellyfin neuf (proposées
 * d'office), Jellyfin déjà configuré mais vide (proposées, FACULTATIVES, avec
 * la langue des métadonnées), et où sont les fichiers — le `/media` de la pile
 * et son dossier sur le serveur, ou des exemples de chemins. `t()` rend la clé
 * et ses paramètres.
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
vi.mock("../auth/AuthLayout", () => ({
  AuthLayout: ({ title, subtitle, header, children }: { title: string; subtitle?: ReactNode; header?: ReactNode; children: ReactNode }) => (
    <div>
      {header}
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}));

const { LibrariesScreen } = await import("./LibrariesScreen");
const { initialData } = await import("./wizardState");
type Wizard = import("./useWizard").Wizard;

const FOLDERS = { root: "/media", movies: "/media/films", tvshows: "/media/series" };
function context(path: "fresh" | "configured", inStack: boolean, over: Partial<SetupContext> = {}): SetupContext {
  const selection = { url: "http://jellyfin:8096", serverId: "maison", serverName: "Maison", version: "12.1.0", inStack, path, ...(path === "configured" ? { noLibraries: true } : {}) };
  return {
    deployment: "docker",
    stack: "full",
    provisioner: "docker-sibling",
    database: { configured: true, connected: true, fromEnv: true },
    jellyfin: { url: "http://jellyfin:8096", suggestedUrl: "http://jellyfin:8096", configured: true, claimed: false, joined: path === "configured", clientUrl: null },
    flow: { databasePending: false, selection, linked: true, noLibraries: path === "configured" },
    mediaHostPath: null,
    mediaFolders: FOLDERS,
    os: null,
    missingJellyfin: { kind: "compose", stack: "tentacle-full", docsUrl: "https://tentacletv.app/install/" },
    secure: false,
    ...over,
  };
}
function wizard(data: Partial<Wizard["data"]>): Wizard {
  const noop = () => undefined;
  return {
    step: "libraries",
    position: 4,
    total: 9,
    server: null,
    data: { ...initialData({ language: "fr", country: "FR" }), ...data },
    patch: noop,
    next: noop,
    go: noop,
    enter: noop,
    choose: noop,
    back: noop,
  };
}
const html = (node: ReactNode) => renderToStaticMarkup(<>{node}</>).replaceAll("&quot;", '"');
const noFolder = [{ name: "Films", type: "movies" as const, paths: [] }, { name: "Séries", type: "tvshows" as const, paths: [] }];

describe("l'écran des bibliothèques", () => {
  it("Jellyfin configuré mais VIDE : en créer est facultatif — « Passer », la langue, et « Continuer » attend un dossier", () => {
    const out = html(<LibrariesScreen wizard={wizard({ context: context("configured", false), plans: noFolder })} />);
    expect(out).toContain("librariesTitleEmpty");
    expect(out).toContain("librariesSkip");
    expect(out).toContain("localeLanguage");
    expect(out).toContain("libraryChooseFolder");
    expect(out).toContain("libraryFolderMissingUnnamed");
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>next<\/button>/);
    // Un autre Jellyfin que celui de la pile : des exemples de chemins, jamais le /media de la pile.
    expect(out).toContain("pathHint_posix");
    expect(out).not.toContain("mediaMapDocker");
  });

  it("Jellyfin NEUF : proposées d'office, sans « Passer » ni langue (elle est sous le compte)", () => {
    const plans = [{ name: "Films", type: "movies" as const, paths: ["/media/films"] }];
    const out = html(<LibrariesScreen wizard={wizard({ context: context("fresh", true), plans })} />);
    expect(out).toContain("librariesTitle");
    expect(out).not.toContain("librariesTitleEmpty");
    expect(out).not.toContain("librariesSkip");
    expect(out).not.toContain("localeLanguage");
    expect(out).not.toMatch(/<button[^>]*disabled=""[^>]*>next<\/button>/);
  });

  it("le Jellyfin de la pile : son /media est, sur le serveur, le dossier monté — ou MEDIA_PATH s'il n'est pas connu", () => {
    const known = html(<LibrariesScreen wizard={wizard({ context: context("fresh", true, { mediaHostPath: "/srv/medias/" }), plans: noFolder })} />);
    expect(known).toContain('mediaMapDocker{"inside":"/media","host":"/srv/medias"}');
    const unknown = html(<LibrariesScreen wizard={wizard({ context: context("fresh", true), plans: noFolder })} />);
    expect(unknown).toContain('mediaMapDockerUnknown{"inside":"/media"}');
    expect(unknown).toContain("mediaMapHostUnknown");
  });
});
