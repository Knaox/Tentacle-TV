import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import type { SetupContext } from "@tentacle-tv/shared";

/**
 * Les écrans de l'assistant rendus à plat : chacun dit sa question, les
 * étapes s'adaptent à la pile, l'écran final donne les chemins, le QR code et
 * les applications. `t()` rend la clé (et ses paramètres) ; le cadre de
 * connexion, l'api-client et le panneau d'accès à distance sont remplacés.
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
vi.mock("../auth/LanguageToggle", () => ({ LanguageToggle: () => <div>langues</div> }));
vi.mock("@tentacle-tv/api-client", () => ({
  useJellyfinClient: () => ({ getLoginDeviceId: () => "d", getClientName: () => "c", getDeviceName: () => "n" }),
  useTentacleConfig: () => ({ storage: { setItem: () => undefined } }),
}));
vi.mock("../remoteAccess/RemoteAccessPanel", () => ({ RemoteAccessPanel: () => <div>panneau</div> }));
vi.mock("../remoteAccess/remoteAccessApi", () => ({ useRemoteAccess: () => ({ data: undefined }) }));

vi.stubGlobal("window", { location: { protocol: "http:", hostname: "192.168.1.20", host: "192.168.1.20:3471", hash: "#code=2yk6-bxz1-d0d4", origin: "http://192.168.1.20:3471", pathname: "/", search: "" } });
vi.stubGlobal("history", { replaceState: () => undefined });

const { WelcomeScreen, CodeScreen } = await import("./IntroScreens");
const { JellyfinScreen } = await import("./JellyfinScreen");
const { AccountScreen } = await import("./AccountScreen");
const { RecapScreen } = await import("./RecapApplyScreens");
const { DoneScreen } = await import("./FinishScreens");
const { QrCode } = await import("./QrCode");
type Wizard = import("./useWizard").Wizard;

function context(over: Partial<SetupContext> = {}): SetupContext {
  return {
    deployment: "docker",
    stack: "db",
    provisioner: "existing-instance",
    database: { configured: true, connected: true, fromEnv: true },
    jellyfin: { url: null, suggestedUrl: "http://host.docker.internal:8096", configured: false, claimed: false },
    mediaHostPath: null,
    mediaFolders: null,
    os: null,
    missingJellyfin: { kind: "compose", stack: "tentacle-full", docsUrl: "https://tentacletv.app/install/" },
    secure: false,
    ...over,
  };
}

function wizard(data: Partial<Wizard["data"]> = {}): Wizard {
  return {
    step: "welcome",
    position: 1,
    total: 10,
    data: {
      context: context(),
      jellyfinUrl: "",
      probe: null,
      mode: null,
      credentials: null,
      locale: { language: "fr", country: "CH" },
      existing: [],
      plans: [],
      outcomes: null,
      session: null,
      resumed: false,
      ...data,
    },
    patch: () => undefined,
    next: () => undefined,
    go: () => undefined,
    back: () => undefined,
  };
}

const html = (node: ReactNode) => renderToStaticMarkup(<>{node}</>);

describe("les écrans de l'assistant", () => {
  it("bienvenue : la question, la progression, et l'avis HTTP sur le réseau local", () => {
    const out = html(<WelcomeScreen wizard={wizard()} />);
    expect(out).toContain("welcomeTitle");
    expect(out).toContain("progress{&quot;n&quot;:1,&quot;total&quot;:10}");
    expect(out).toContain('role="progressbar"');
    expect(out).toContain("httpNotice");
  });

  it("le code repris du lien des journaux", () => {
    const out = html(<CodeScreen wizard={wizard()} />);
    expect(out).toContain('value="2YK6-BXZ1-D0D4"');
    expect(out).toContain("codePrefilled");
    expect(out).toContain("docker compose logs tentacle");
  });

  it("Jellyfin existant : l'adresse proposée et le guide de la pile complète", () => {
    const out = html(<JellyfinScreen wizard={wizard({ jellyfinUrl: "http://host.docker.internal:8096" })} />);
    expect(out).toContain("jfSubtitleExisting");
    expect(out).toContain('value="http://host.docker.internal:8096"');
    expect(out).toContain("jfMissingCompose");
  });

  it("Jellyfin voisin : pas d'adresse à saisir, la recherche part seule", () => {
    const out = html(<JellyfinScreen wizard={wizard({ context: context({ stack: "full", provisioner: "docker-sibling" }) })} />);
    expect(out).toContain("jfSubtitleSibling");
    expect(out).not.toContain("jfUrlHint");
  });

  it("le compte : créé (avec confirmation) ou vérifié (avec la clé en recours)", () => {
    const create = html(<AccountScreen wizard={wizard({ mode: "initialize" })} />);
    expect(create).toContain("accountPasswordConfirm");
    expect(create).not.toContain("accountUseKey");
    const login = html(<AccountScreen wizard={wizard({ mode: "connect" })} />);
    expect(login).toContain("accountUseKey");
    expect(login).not.toContain("accountPasswordConfirm");
  });

  it("le récapitulatif dit tout ce qui va être fait", () => {
    const out = html(
      <RecapScreen
        wizard={wizard({
          jellyfinUrl: "http://jellyfin:8096",
          probe: { url: "http://jellyfin:8096", version: "12.1.0", serverName: "Maison", blank: true, compatible: true },
          credentials: { username: "Knaoxtest", password: "x" },
          plans: [{ name: "Films", type: "movies", paths: ["/media/films"] }],
        })}
      />,
    );
    expect(out).toContain("Maison · 12.1.0 · http://jellyfin:8096");
    expect(out).toContain("Knaoxtest");
    expect(out).toContain("Films (/media/films)");
    expect(out).not.toContain("value=\"x\"");
  });

  it("et maintenant : les dossiers de l'hôte, le QR code, les applications", () => {
    const out = html(
      <DoneScreen
        wizard={wizard({ context: context({ mediaHostPath: "./media", mediaFolders: { root: "/media", movies: "/media/films", tvshows: "/media/series" } }) })}
        onFinish={() => undefined}
      />,
    );
    expect(out).toContain("./media/films");
    expect(out).toContain("./media/series");
    expect(out).toContain('role="img"');
    expect(out).toContain("http://192.168.1.20:3471");
    expect(out.match(/target="_blank"/g)).toHaveLength(8);
    expect(out).toContain("doneRemote_off");
  });

  it("le QR code se dessine module par module, sans HTML injecté", () => {
    const out = html(<QrCode value="https://tv.example.com" label="QR" />);
    expect(out).toMatch(/<path d="M\d+ \d+h1v1h-1z/);
    expect(out).not.toContain("<script");
  });
});
