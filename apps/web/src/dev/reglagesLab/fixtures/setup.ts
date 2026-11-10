/**
 * L'assistant d'installation sur le faux serveur (`/api/setup/*`) : une pile complète, ouverte
 * SANS code depuis le réseau local, qui voit son propre Jellyfin (neuf), un autre déjà
 * configuré et un trop ancien. Le PARCOURS est tenu ici comme par le serveur (le choix du
 * Jellyfin, le compte, la clé TMDB) : on avance d'écran en écran jusqu'à la fin, dans les deux
 * parcours. Formes : `packages/shared/src/setupWizard/`, `components/setupWizard/setupApi.ts`.
 *
 * `?assistant=code` dans l'adresse de la page : ce navigateur doit donner le code (l'écran du
 * code et ses onglets) ; tout code de douze caractères est accepté.
 */

import type {
  JellyfinDiscoveryResponse, LibraryOutcome, SetupAdviceOutcome, SetupCompleteResponse, SetupContext, SetupFlowState,
  SetupHostInfo, SetupJellyfinInstall, SetupLocalJellyfin, SetupStatusResponse,
} from "@tentacle-tv/shared";
import { pathForServer, SETUP_DOCS_BASE } from "@tentacle-tv/shared";
import type { LabRoute } from "../labFetch";
import type { LabView } from "../labViews";
import { LAB_USER } from "./base";
import { browse, DISCOVERED, EXISTING_LIBRARIES, probeOf, recommendedReport, segmentRun, STACK_JELLYFIN } from "./setupJellyfin";

const JELLYFIN_DOCS = "https://jellyfin.org/downloads/server";

/** Ce que le serveur tient du parcours : rien de choisi à l'ouverture. */
const flow: SetupFlowState = {
  databasePending: false,
  selection: null,
  linked: false,
  tmdb: { configured: false, source: null, last4: null, later: false },
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const field = (body: unknown, name: string): string | null => (isRecord(body) && typeof body[name] === "string" ? (body[name] as string) : null);

function context(): SetupContext {
  const chosen = flow.selection;
  return {
    deployment: "docker",
    stack: "full",
    provisioner: "docker-sibling",
    database: { configured: true, connected: true, fromEnv: true },
    jellyfin: {
      url: chosen?.url ?? null,
      suggestedUrl: STACK_JELLYFIN.url,
      configured: flow.linked,
      claimed: true,
      joined: flow.linked && chosen?.path === "configured",
      clientUrl: chosen ? probeOf(chosen.url).clientUrl : null,
    },
    flow: { ...flow, tmdb: flow.tmdb ? { ...flow.tmdb } : undefined },
    mediaHostPath: null,
    mediaFolders: { root: "/media", movies: "/media/films", tvshows: "/media/series" },
    os: null,
    missingJellyfin: { kind: "compose", stack: "tentacle-full", docsUrl: `${SETUP_DOCS_BASE}install/` },
    secure: false,
    webUi: true,
  };
}

/** Le Jellyfin choisi : le serveur le sonde et en tire le parcours ; un autre choix oublie l'ancien. */
function select(url: string): SetupContext {
  const probe = probeOf(url);
  if (flow.selection?.serverId !== probe.serverId) flow.linked = false;
  flow.selection = {
    url: probe.url, serverId: probe.serverId, serverName: probe.serverName, version: probe.version, inStack: probe.inStack,
    path: pathForServer(probe),
  };
  flow.noLibraries = false;
  return context();
}

function link(): { success: true } {
  flow.linked = true;
  return { success: true };
}

function tmdb(body: unknown): SetupContext {
  const key = field(body, "apiKey");
  flow.tmdb = key
    ? { configured: true, source: "db", last4: key.slice(-4), later: false }
    : { configured: false, source: null, last4: null, later: true };
  return context();
}

function host(): SetupHostInfo {
  const codeRequired = new URLSearchParams(window.location.search).get("assistant") === "code";
  return { deployment: "docker", stack: "full", containerized: true, containerId: "3f9a1c7b2e4d", codeRequired };
}

function status(open: boolean): SetupStatusResponse {
  return { state: open ? "setup_jellyfin" : "running", hasDbUrl: true, dbFromEnv: true, dbConnected: true, setupOpen: open };
}

const discovery: JellyfinDiscoveryResponse = { servers: [...DISCOVERED], udp: "answered", bridged: false };

/** L'app Windows seulement (jamais demandé par cette pile) : des réponses plausibles, sans installation en cours. */
const localJellyfin: SetupLocalJellyfin = {
  state: "absent", mode: null, version: null, url: "http://127.0.0.1:8096", canStart: false, installer: "available", installing: false,
  docsUrl: JELLYFIN_DOCS,
};
const install: SetupJellyfinInstall = { phase: "idle", version: null, receivedBytes: 0, totalBytes: null, failure: null, docsUrl: JELLYFIN_DOCS };

function complete(): SetupCompleteResponse {
  return {
    success: true,
    AccessToken: "lab-access-token",
    User: { ...LAB_USER, ServerId: "lab-server", HasPassword: true, HasConfiguredPassword: true, EnableAutoLogin: false },
    ServerId: "lab-server",
    DeviceId: "lab-device",
  };
}

function libraryOutcomes(body: unknown): LibraryOutcome[] {
  const plans = isRecord(body) && Array.isArray(body.libraries) ? body.libraries : [];
  return plans.flatMap((plan) => (isRecord(plan) && typeof plan.name === "string" ? [{ name: plan.name, status: "created" as const }] : []));
}

function adviceOutcomes(body: unknown): SetupAdviceOutcome[] {
  const actions = isRecord(body) && Array.isArray(body.actions) ? body.actions : [];
  return actions.map((action) => ({ action: action as SetupAdviceOutcome["action"], status: "applied" as const }));
}

const session = { session: "lab-setup-session" };
const at = (path: string) => `/api/setup${path}`;

export function setupRoutes(view: LabView): readonly LabRoute[] {
  return [
    { path: at("/status"), reply: status(view.id === "assistant") },
    { path: at("/host"), reply: host },
    { method: "POST", path: at("/session"), reply: session },
    { method: "POST", path: at("/session/local"), reply: session },
    { path: at("/context"), reply: context },

    { path: at("/jellyfin/discover"), reply: discovery },
    { method: "POST", path: at("/jellyfin/probe"), reply: ({ body }) => probeOf(field(body, "url") ?? STACK_JELLYFIN.url) },
    { method: "POST", path: at("/jellyfin/prepare"), reply: { success: true } },
    { method: "POST", path: at("/jellyfin/select"), reply: ({ body }) => select(field(body, "url") ?? STACK_JELLYFIN.url) },
    { method: "POST", path: at("/jellyfin/initialize"), reply: link },
    { method: "POST", path: at("/jellyfin/connect"), reply: link },
    { method: "POST", path: at("/jellyfin/verify"), reply: { success: true } },

    { path: at("/jellyfin/browse"), reply: ({ url }) => browse(url.searchParams.get("path")) },
    { path: at("/jellyfin/libraries"), reply: () => (flow.selection?.path === "configured" ? EXISTING_LIBRARIES : []) },
    { method: "POST", path: at("/jellyfin/libraries"), reply: ({ body }) => libraryOutcomes(body) },
    { path: at("/jellyfin/recommended"), reply: recommendedReport },
    { method: "POST", path: at("/jellyfin/recommended"), reply: ({ body }) => adviceOutcomes(body) },
    { path: at("/jellyfin/segments"), reply: segmentRun },
    { method: "POST", path: at("/jellyfin/segments"), reply: segmentRun },

    { path: at("/jellyfin/local"), reply: localJellyfin },
    { path: at("/jellyfin/install"), reply: install },
    { method: "POST", path: at("/jellyfin/install"), reply: install },
    { method: "POST", path: at("/jellyfin/start"), reply: { started: false, reason: "not_installed" } },
    { method: "POST", path: at("/jellyfin/pick-folder"), reply: { status: "cancelled" } },

    { method: "POST", path: at("/tmdb"), reply: ({ body }) => tmdb(body) },
    { method: "POST", path: at("/complete"), reply: complete },
  ];
}
