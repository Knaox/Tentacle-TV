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
const { JellyfinList } = await import("./JellyfinList");
const { RecapScreen } = await import("./RecapApplyScreens");
const { ApplyScreen } = await import("./ApplyScreen");
const { AdviceRow, RecommendedScreen } = await import("./RecommendedScreen");
const { DoneScreen } = await import("./FinishScreens");
const { QrCode } = await import("./QrCode");
type Wizard = import("./useWizard").Wizard;

function context(over: Partial<SetupContext> = {}): SetupContext {
  return {
    deployment: "docker",
    stack: "db",
    provisioner: "existing-instance",
    database: { configured: true, connected: true, fromEnv: true },
    jellyfin: { url: null, suggestedUrl: "http://host.docker.internal:8096", configured: false, claimed: false, joined: false, clientUrl: null },
    mediaHostPath: null,
    mediaFolders: null,
    os: null,
    missingJellyfin: { kind: "compose", stack: "tentacle-full", docsUrl: "https://tentacletv.app/install/" },
    flow: { databasePending: false, selection: null, linked: false },
    secure: false,
    ...over,
  };
}

type Path = "fresh" | "configured";
/** Un contexte où le serveur a fixé le parcours : le Jellyfin choisi, relié ou non. */
function chosen(path: Path, linked = false, over: Partial<SetupContext> = {}): SetupContext {
  const selection = { url: "http://jellyfin:8096", serverId: "maison", serverName: "Maison", version: "12.1.0", inStack: true, path };
  return context({ ...over, flow: { databasePending: false, selection, linked } });
}

function wizard(data: Partial<Wizard["data"]> = {}, server: Wizard["server"] = null): Wizard {
  return {
    step: "welcome",
    position: 1,
    total: 10,
    server,
    data: {
      context: context(),
      credentials: null,
      locale: { language: "fr", country: "CH" },
      existing: [],
      plans: [],
      outcomes: null,
      advice: null,
      adviceOutcomes: null,
      segments: undefined,
      session: null,
      needsCode: true,
      codeReason: null,
      clientUrl: "",
      ...data,
    },
    patch: () => undefined,
    next: () => undefined,
    go: () => undefined,
    enter: () => undefined,
    choose: () => undefined,
    back: () => undefined,
  };
}

const html = (node: ReactNode) => renderToStaticMarkup(<>{node}</>);

describe("les écrans de l'assistant", () => {
  it("bienvenue : la question, la progression, et l'avis HTTP sur le réseau local", () => {
    const out = html(<WelcomeScreen wizard={wizard()} />);
    expect(out).toContain("welcomeTitle");
    // Tant qu'on ne sait pas si le code sera demandé, le total n'est pas juste : il n'est pas dit.
    expect(out).not.toContain("progress{");
    expect(out).toContain('role="progressbar"');
    expect(out).toContain("httpNotice");
  });

  it("le code repris du lien des journaux", () => {
    const out = html(<CodeScreen wizard={wizard()} />);
    expect(out).toContain('value="2YK6-BXZ1-D0D4"');
    expect(out).toContain("codePrefilled");
    expect(out).toContain("docker compose logs tentacle");
  });

  it("Jellyfin existant : la recherche part seule, aucune adresse supposée", () => {
    const out = html(<JellyfinScreen wizard={wizard()} />);
    expect(out).toContain("jfSubtitleExisting");
    expect(out).toContain("jfSearching");
    expect(out).not.toContain("host.docker.internal:8096\"");
    expect(out).not.toContain('value="http');
  });

  it("Jellyfin déjà choisi (retour en arrière) : la liste le garde, coché — c'était un geste", () => {
    const selection = { url: "http://172.16.1.30:47896", version: "12.1.0", serverName: "Neuf", serverId: "neuf", inStack: false, path: "fresh" as const };
    const out = html(<JellyfinScreen wizard={wizard({ context: context({ flow: { databasePending: false, selection, linked: false } }) })} />);
    expect(out).toContain('role="radiogroup"');
    expect(out).toMatch(/type="radio"[^>]*checked=""[^>]*value="http:\/\/172\.16\.1\.30:47896"/);
    expect(out).toContain("jfState_blank");
    expect(out).toContain("jfUseBlank");
  });

  it("Jellyfin voisin : pas d'adresse à saisir, la recherche part seule", () => {
    const out = html(<JellyfinScreen wizard={wizard({ context: context({ stack: "full", provisioner: "docker-sibling" }) })} />);
    expect(out).toContain("jfSubtitleSibling");
    expect(out).not.toContain("jfUrlHint");
  });

  it("la liste : celui de la pile en tête, puis les neufs, puis les déjà configurés — chacun avec son état et son adresse", () => {
    const entry = (url: string, blank: boolean, inStack = false) => ({
      url, serverId: url, version: "10.11.11", serverName: url.split(":")[1].slice(2), blank, inStack, compatible: true, clientUrl: url,
    });
    const out = html(
      <JellyfinList
        servers={[entry("http://jellyfin:8096", true, true), entry("http://salon:8096", false), entry("http://neuf:8097", true)]}
        selected="http://jellyfin:8096"
        recommended="http://jellyfin:8096"
        onSelect={() => undefined}
        stackStarting={false}
      />,
    );
    const order = ["jfInStack", "jfGroup_fresh", "http://neuf:8097", "jfGroup_configured", "http://salon:8096"].map((needle) => out.indexOf(needle));
    expect(order.every((index, i) => index >= 0 && (i === 0 || index > order[i - 1]))).toBe(true);
    expect(out).toMatch(/type="radio"[^>]*checked=""[^>]*value="http:\/\/jellyfin:8096"/);
    expect(out).toContain("jfState_configured");
    expect(out.replaceAll("&quot;", '"')).toContain('jfOptionLine{"host":"salon","port":"8096","version":"10.11.11"}');
  });

  it("le Jellyfin de la pile qui démarre garde sa place en tête", () => {
    const out = html(<JellyfinList servers={[]} selected={null} recommended={null} onSelect={() => undefined} stackStarting />);
    expect(out).toContain("jfStackStarting");
  });

  it("le récapitulatif dit tout ce qui va être fait", () => {
    const out = html(
      <RecapScreen
        wizard={wizard({
          context: chosen("fresh", true),
          credentials: { username: "Knaoxtest", password: "x" },
          clientUrl: "http://172.16.1.30:47896",
          plans: [{ name: "Films", type: "movies", paths: ["/media/films"] }],
        })}
      />,
    );
    expect(out).toContain("recapJellyfinLine");
    expect(out).toContain("&quot;name&quot;:&quot;Maison&quot;");
    expect(out).toContain("&quot;host&quot;:&quot;jellyfin&quot;");
    // L'adresse des applications : jamais le nom Docker, modifiable.
    expect(out).toContain('value="http://172.16.1.30:47896"');
    expect(out).toContain("recapClientUrl");
    expect(out).toContain("Knaoxtest");
    expect(out).toContain("Films (/media/films)");
    expect(out).not.toContain("value=\"x\"");
  });

  it("Jellyfin déjà configuré : l'écran des réglages conseillés, facultatifs, avec « Passer »", () => {
    const out = html(<RecommendedScreen wizard={wizard({ context: chosen("configured", true) })} />);
    expect(out).toContain("recTitle");
    expect(out).toContain("recSkip");
    expect(out).not.toContain("libraryAdd");
  });

  it("un conseil dit la valeur en place et la conseillée ; réglé autrement, il n'est pas coché et le dit", () => {
    const language = { id: "metadataLanguage" as const, gesture: "setMetadataLanguage" as const, current: "en · US", recommended: "fr · FR", preselected: false, targets: [] };
    const other = html(<AdviceRow advice={language} checked={false} onToggle={() => undefined} />).replaceAll("&quot;", '"');
    // Les codes deviennent des mots : la langue et le pays, de chaque côté de la flèche.
    expect(other).toMatch(/recChange\{"current":"lang_en.* · country_US.*","recommended":"lang_fr.* · country_FR/);
    expect(other).toContain("recSetOtherwise");
    expect(other).not.toContain('checked=""');
    const trickplay = { id: "trickplay" as const, gesture: "enableTrickplay" as const, current: "off", recommended: "on", preselected: true, targets: ["Séries"] };
    const fixed = html(<AdviceRow advice={trickplay} checked onToggle={() => undefined} />).replaceAll("&quot;", '"');
    expect(fixed).toMatch(/type="checkbox"[^>]*checked=""/);
    expect(fixed).toContain('recChange{"current":"recValue_off","recommended":"recValue_on"}');
    expect(fixed).toContain('recTargetsLibraries{"names":"Séries"}');
    expect(fixed).not.toContain("recSetOtherwise");
  });

  it("le récapitulatif d'un Jellyfin déjà configuré : rien de créé, les réglages cochés", () => {
    const out = html(
      <RecapScreen
        wizard={wizard({
          context: chosen("configured", true),
          credentials: { username: "Knaoxtest", password: "x" },
          existing: [{ name: "Films", type: "movies", paths: ["/m"] }, { name: "Séries", type: "tvshows", paths: ["/s"] }],
          advice: { segments: true, actions: ["enableTrickplay"], ids: ["segmentsProvider", "trickplay"] },
        })}
      />,
    ).replaceAll("&quot;", '"');
    expect(out).toContain('recapLibrariesExisting{"names":"Films · Séries"}');
    const empty = html(<RecapScreen wizard={wizard({ context: chosen("configured", true), credentials: { username: "Knaoxtest", password: "x" } })} />);
    expect(empty).toContain("recapLibrariesNoneYet");
    expect(out).toContain("rec_segmentsProvider · rec_trickplay");
    expect(out).not.toContain("recapLocale");
  });

  it("l'installation d'un Jellyfin déjà configuré : seulement ce qui est coché, aucune bibliothèque", () => {
    const joined = html(<ApplyScreen wizard={wizard({ context: chosen("configured", true), advice: { segments: false, actions: ["enableTrickplay"], ids: ["trickplay"] } })} onSession={() => undefined} />);
    expect(joined).not.toContain("segmentPlugins:wizardLine");
    expect(joined).toContain("applyAdvice");
    expect(joined).not.toContain("applyLibraries");
    const withSegments = html(<ApplyScreen wizard={wizard({ context: chosen("configured", true), advice: { segments: true, actions: [], ids: ["segmentsProvider"] } })} onSession={() => undefined} />);
    expect(withSegments.indexOf("segmentPlugins:wizardLine")).toBeLessThan(withSegments.indexOf("applyAdvice"));
  });

  it("l'installation règle d'abord la détection des passages ; un échec se dit et n'arrête rien", () => {
    const first = html(<ApplyScreen wizard={wizard({ step: "apply" } as never)} onSession={() => undefined} />);
    expect(first.indexOf("segmentPlugins:wizardLine")).toBeGreaterThan(-1);
    expect(first.indexOf("segmentPlugins:wizardLine")).toBeLessThan(first.indexOf("applyLibraries"));
    const skipped = html(<ApplyScreen wizard={wizard({ segments: null })} onSession={() => undefined} />);
    expect(skipped).toContain("segmentPlugins:wizardSkipped");
    const run = {
      phase: "done" as const, running: false, startedAt: "t", finishedAt: "t", restart: "done" as const, configured: true, error: null,
      plugins: [{ key: "introSkipper" as const, outcome: "installed" as const }, { key: "theIntroDb" as const, outcome: "repo-offline" as const }, { key: "skipMeDb" as const, outcome: "present" as const }],
    };
    const done = html(<ApplyScreen wizard={wizard({ segments: run })} onSession={() => undefined} />);
    expect(done).toContain("outcome_repo-offline");
    expect(done).toContain("restart_done");
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
