import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import type { SetupContext, SetupTmdbState } from "@tentacle-tv/shared";

/**
 * L'écran de la clé TMDB, rendu à plat : sans clé, le champ, le lien pour en
 * obtenir une, « Vérifier et continuer » (qui attend une clé) et « Configurer
 * plus tard » ; une clé fournie par le serveur se dit, sans rien redemander ;
 * une clé gardée se dit, avec « Utiliser une autre clé ». Pas de page du site
 * pour cet écran : « Besoin d'aide ? » sans lien. Et sa ligne au
 * récapitulatif. `t()` rend la clé et ses paramètres.
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

const { TmdbScreen } = await import("./TmdbScreen");
const { RecapScreen } = await import("./RecapApplyScreens");
const { initialData } = await import("./wizardState");
type Wizard = import("./useWizard").Wizard;

function context(tmdb: SetupTmdbState | undefined): SetupContext {
  const selection = { url: "http://jellyfin:8096", serverId: "maison", serverName: "Maison", version: "12.1.0", inStack: true, path: "fresh" as const };
  return {
    deployment: "docker",
    stack: "full",
    provisioner: "docker-sibling",
    database: { configured: true, connected: true, fromEnv: true },
    jellyfin: { url: "http://jellyfin:8096", suggestedUrl: "http://jellyfin:8096", configured: true, claimed: false, joined: false, clientUrl: null },
    flow: { databasePending: false, selection, linked: true, noLibraries: false, ...(tmdb ? { tmdb } : {}) },
    mediaHostPath: null,
    mediaFolders: null,
    os: null,
    missingJellyfin: { kind: "compose", stack: "tentacle-full", docsUrl: "https://tentacletv.app/install/" },
    secure: false,
  };
}
function wizard(tmdb: SetupTmdbState | undefined, step: Wizard["step"] = "tmdb"): Wizard {
  const noop = () => undefined;
  return {
    step,
    position: 5,
    total: 9,
    server: null,
    data: { ...initialData({ language: "fr", country: "FR" }), context: context(tmdb) },
    patch: noop,
    next: noop,
    go: noop,
    enter: noop,
    choose: noop,
    back: noop,
  };
}
const html = (node: ReactNode) => renderToStaticMarkup(<>{node}</>).replaceAll("&quot;", '"');
const NONE: SetupTmdbState = { configured: false, source: null, last4: null, later: false };

describe("l'écran de la clé TMDB", () => {
  it("sans clé : ce qu'elle apporte, le champ, le lien pour l'obtenir, « Vérifier » qui attend une clé, « Configurer plus tard »", () => {
    const out = html(<TmdbScreen wizard={wizard(NONE)} />);
    expect(out).toContain("tmdbTitle");
    for (const id of ["reco", "sagas", "providers", "artwork"]) expect(out).toContain(`tmdbBenefit_${id}`);
    expect(out).toContain("tmdbWithout");
    expect(out).toMatch(/<label[^>]*>tmdbKeyLabel<\/label>/);
    expect(out).toMatch(/<input[^>]*type="password"[^>]*autoComplete="off"/);
    expect(out).toContain('href="https://www.themoviedb.org/settings/api"');
    expect(out).toMatch(/<button type="submit" disabled=""[^>]*>tmdbSave<\/button>/);
    expect(out).toMatch(/<button type="button"[^>]*>tmdbLater<\/button>/);
    expect(out).toContain("tmdbLaterHint");
    // « Besoin d'aide ? » : les questions de l'écran, et aucune page du site (elle n'existe pas encore).
    expect(out).toContain("help_tmdb_what_q");
    expect(out).toContain("help_tmdb_later_q");
    expect(out).not.toContain("helpDoc");
  });

  it("une clé fournie par le serveur (TMDB_API_KEY) : dite, rien à saisir, ni « plus tard » ni autre clé", () => {
    const out = html(<TmdbScreen wizard={wizard({ configured: true, source: "env", last4: "c0de", later: false })} />);
    expect(out).toContain('tmdbFromEnv{"last4":"c0de"}');
    expect(out).not.toContain("tmdbKeyLabel");
    expect(out).not.toContain("tmdbLater");
    expect(out).not.toContain("tmdbReplace");
    expect(out).toMatch(/<button[^>]*>next<\/button>/);
  });

  it("une clé déjà gardée (retour en arrière) : dite, « Continuer » ou « Utiliser une autre clé »", () => {
    const out = html(<TmdbScreen wizard={wizard({ configured: true, source: "db", last4: "cdef", later: false })} />);
    expect(out).toContain('tmdbSaved{"last4":"cdef"}');
    expect(out).toContain("tmdbReplace");
    expect(out).not.toContain("tmdbKeyLabel");
  });
});

describe("la clé TMDB au récapitulatif", () => {
  it("à poser plus tard, gardée, ou fournie par le serveur — et rien d'un serveur qui ne propose pas l'écran", () => {
    expect(html(<RecapScreen wizard={wizard({ ...NONE, later: true }, "recap")} />)).toContain("recapTmdbLater");
    expect(html(<RecapScreen wizard={wizard({ configured: true, source: "db", last4: "cdef", later: false }, "recap")} />)).toContain('recapTmdbSaved{"last4":"cdef"}');
    expect(html(<RecapScreen wizard={wizard({ configured: true, source: "env", last4: "c0de", later: false }, "recap")} />)).toContain('recapTmdbEnv{"last4":"c0de"}');
    expect(html(<RecapScreen wizard={wizard(undefined, "recap")} />)).not.toContain("recapTmdb");
  });
});
