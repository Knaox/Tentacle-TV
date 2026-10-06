import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import type { SetupContext } from "@tentacle-tv/shared";

/**
 * Les écrans PROPRES à chaque parcours, rendus à plat : Jellyfin neuf (le
 * compte créé, puis rappelé sans rien recréer), Jellyfin déjà configuré (la
 * connexion seule), la liste sans rien de coché d'office, et le Jellyfin
 * choisi rappelé en tête. `t()` rend la clé et ses paramètres.
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

const { JellyfinScreen } = await import("./JellyfinScreen");
const { JellyfinList } = await import("./JellyfinList");
const { AccountScreen } = await import("./AccountScreen");
const { SignInScreen } = await import("./SignInScreen");
const { initialData } = await import("./wizardState");
type Wizard = import("./useWizard").Wizard;

type Path = "fresh" | "configured";
function context(flow: SetupContext["flow"] = { databasePending: false, selection: null, linked: false }): SetupContext {
  return {
    deployment: "docker",
    stack: "full",
    provisioner: "docker-sibling",
    database: { configured: true, connected: true, fromEnv: true },
    jellyfin: { url: null, suggestedUrl: "http://jellyfin:8096", configured: false, claimed: false, joined: false, clientUrl: null },
    flow,
    mediaHostPath: null,
    mediaFolders: null,
    os: null,
    missingJellyfin: { kind: "compose", stack: "tentacle-full", docsUrl: "https://tentacletv.app/install/" },
    secure: false,
  };
}
function chosen(path: Path, linked = false): SetupContext {
  const selection = { url: "http://jellyfin:8096", serverId: "maison", serverName: "Maison", version: "12.1.0", inStack: true, path };
  return context({ databasePending: false, selection, linked });
}
function wizard(data: Partial<Wizard["data"]> = {}, server: Wizard["server"] = null): Wizard {
  const noop = () => undefined;
  return {
    step: "jellyfin",
    position: 2,
    total: 8,
    server,
    data: { ...initialData({ language: "fr", country: "FR" }), context: context(), ...data },
    patch: noop,
    next: noop,
    go: noop,
    enter: noop,
    choose: noop,
    back: noop,
  };
}
const html = (node: ReactNode) => renderToStaticMarkup(<>{node}</>);

describe("les écrans de chaque parcours", () => {
  it("rien n'est coché d'office : le conseillé porte un badge, pas une coche", () => {
    const entry = (url: string, blank: boolean, inStack = false) => ({ url, serverId: url, version: "12.1.0", serverName: "x", blank, inStack, compatible: true, clientUrl: url });
    const out = html(
      <JellyfinList servers={[entry("http://jellyfin:8096", true, true), entry("http://salon:8096", false)]} selected={null} recommended="http://jellyfin:8096" onSelect={() => undefined} stackStarting={false} />,
    );
    expect(out).not.toContain('checked=""');
    expect(out.match(/jfRecommended/g)).toHaveLength(1);
    expect(out.indexOf("jfRecommended")).toBeLessThan(out.indexOf("http://salon:8096"));
  });

  it("Jellyfin NEUF : le compte est CRÉÉ (avec confirmation et la langue)", () => {
    const create = html(<AccountScreen wizard={wizard({ context: chosen("fresh") })} />);
    expect(create).toContain("accountTitleCreate");
    expect(create).toContain("accountPasswordConfirm");
    // La langue des métadonnées n'a plus d'écran : elle est là, proposée d'office.
    expect(create).toContain("localeLanguage");
    expect(create).toContain("localePrepare");
    expect(create).not.toContain("accountUseKey");
  });

  it("Jellyfin NEUF, compte déjà créé (retour en arrière) : il le dit et ne recrée rien", () => {
    const done = html(<AccountScreen wizard={wizard({ context: chosen("fresh", true), credentials: { username: "Knaoxtest", password: "x" } })} />).replaceAll("&quot;", '"');
    expect(done).toContain('accountDone{"name":"Knaoxtest"}');
    expect(done).not.toContain("accountPasswordConfirm");
    expect(done).not.toContain('type="password"');
    // Rechargé : le mot de passe n'est plus en mémoire, Jellyfin le revérifie.
    const reloaded = html(<AccountScreen wizard={wizard({ context: chosen("fresh", true) })} />);
    expect(reloaded).toContain("accountDoneAnonymous");
    expect(reloaded).toContain("accountVerify");
    expect(reloaded).not.toContain("accountPasswordConfirm");
    expect(reloaded).not.toContain("localeLanguage");
  });

  it("Jellyfin DÉJÀ configuré : on s'y CONNECTE — ni création, ni confirmation, ni langue, ni clé", () => {
    const login = html(<SignInScreen wizard={wizard({ context: chosen("configured") })} />);
    expect(login).toContain("signInTitle");
    expect(login).toContain("signInNothingCreated");
    expect(login).toContain("accountConnect");
    for (const absent of ["accountPasswordConfirm", "localeLanguage", "accountUseKey", "localePrepare"]) expect(login).not.toContain(absent);
    const signedIn = html(<SignInScreen wizard={wizard({ context: chosen("configured", true), credentials: { username: "Knaoxtest", password: "x" } })} />).replaceAll("&quot;", '"');
    expect(signedIn).toContain('signInDone{"name":"Knaoxtest"}');
    expect(signedIn).toContain("signInOther");
  });

  it("le Jellyfin choisi est rappelé en tête, en toutes lettres", () => {
    const server = { url: "http://192.168.1.20:8096", serverId: "salon", serverName: "Salon", version: "10.11.11", inStack: false, path: "configured" as const };
    const out = html(<SignInScreen wizard={wizard({ context: chosen("configured") }, server)} />).replaceAll("&quot;", '"');
    expect(out).toContain('data-testid="setup-chosen-server"');
    expect(out).toContain('chosenServer{"name":"Salon","state":"chosenState_configured"}');
    expect(html(<JellyfinScreen wizard={wizard()} />)).not.toContain("setup-chosen-server");
  });

});
