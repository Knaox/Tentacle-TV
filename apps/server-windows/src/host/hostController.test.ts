import { describe, expect, it } from "vitest";
import { STRINGS } from "../i18n/strings";
import type { HostState } from "../data/hostState";
import type { ServerState } from "../supervisor/supervisor";
import type { MenuCommand, MenuEntry, StartupState } from "../tray/menuModel";
import { HostController, type HostDeps, type SupervisorLike } from "./hostController";

class FakeSupervisor implements SupervisorLike {
  serverState: ServerState = { kind: "stopped" };
  calls: string[] = [];
  start(): void {
    this.calls.push("start");
    this.serverState = { kind: "starting" };
  }
  async stop(reason: string): Promise<void> {
    this.calls.push(`stop:${reason}`);
    this.serverState = { kind: "stopped" };
  }
  async restart(reason: string): Promise<void> {
    this.calls.push(`restart:${reason}`);
  }
}

function harness(options: { freePort?: boolean; confirm?: boolean; state?: HostState; startup?: StartupState; pick?: MenuCommand } = {}) {
  const supervisor = new FakeSupervisor();
  const events: string[] = [];
  let saved: HostState = options.state ?? { port: 3000, wizardOpened: false };
  let menu: readonly MenuEntry[] = [];
  const deps: HostDeps = {
    strings: STRINGS.fr,
    dataDir: "C:\\ProgramData\\Tentacle Server",
    ui: {
      setTooltip: (text) => events.push(`tip:${text}`),
      notify: (_title, text) => events.push(`notify:${text}`),
      showMenu: (entries) => {
        menu = entries;
        return options.pick ?? null;
      },
      open: (target) => events.push(`open:${target}`),
      info: (text) => events.push(`info:${text}`),
      error: (text) => events.push(`error:${text}`),
      confirm: (text) => {
        events.push(`confirm:${text.split("\n")[0]}`);
        return options.confirm ?? true;
      },
    },
    supervisor: () => supervisor,
    startup: {
      read: async () => options.startup ?? "disabled",
      set: async (enabled) => (enabled ? "enabled" : "disabled"),
    },
    log: () => undefined,
    logFile: () => "C:\\log.log",
    isPortFree: async () => options.freePort ?? true,
    suggestPorts: async () => [3100],
    serverUrl: async (port, path) => `http://192.168.1.20:${port}${path}`,
    state: { read: () => saved, write: (state) => (saved = state) },
    setupCode: () => null,
    setupPending: () => true,
    deleteData: () => {
      events.push("deleted");
      return true;
    },
    publicNetwork: async () => false,
    exit: (code) => events.push(`exit:${code}`),
  };
  return { controller: new HostController(deps), supervisor, events, saved: () => saved, menu: () => menu };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("HostController", () => {
  it("ne lance rien sur un port pris, et le dit une seule fois", async () => {
    const h = harness({ freePort: false });
    await h.controller.startServer();
    h.controller.onServerState({ kind: "stopped" });
    expect(h.supervisor.calls).toEqual([]);
    expect(h.events.filter((e) => e.startsWith("notify:"))).toEqual([
      "notify:Le port 3000 est déjà utilisé par une autre application. Choisissez un autre port dans le menu de l'icône Tentacle.",
    ]);
    expect(h.events).toContain("tip:Tentacle Server : Port 3000 déjà utilisé");
  });

  it("ouvre l'assistant une seule fois, sur l'adresse locale", async () => {
    const h = harness();
    h.controller.onServerState({ kind: "running", port: 3000, version: "1", appState: "setup_jellyfin" });
    await flush();
    h.controller.onServerState({ kind: "running", port: 3000, version: "1", appState: "setup_jellyfin" });
    await flush();
    expect(h.events.filter((e) => e.startsWith("open:"))).toEqual(["open:http://192.168.1.20:3000/"]);
    expect(h.saved().wizardOpened).toBe(true);
  });

  it("n'ouvre pas l'assistant d'une installation déjà faite", async () => {
    const h = harness();
    h.controller.onServerState({ kind: "running", port: 3000, version: "1", appState: "running" });
    await flush();
    expect(h.events.some((e) => e.startsWith("open:"))).toBe(false);
    expect(h.saved().wizardOpened).toBe(true);
  });

  it("change de port après confirmation : arrêt, port gardé, relance", async () => {
    const h = harness({ pick: { kind: "change-port", port: 3100 } });
    await h.controller.openMenu(0, 0);
    expect(h.events.some((e) => e.startsWith("confirm:Tentacle Server va redémarrer sur le port 3100"))).toBe(true);
    expect(h.supervisor.calls).toEqual(["stop:port-change", "start"]);
    expect(h.saved().port).toBe(3100);
  });

  it("ne change rien si l'utilisateur refuse", async () => {
    const h = harness({ confirm: false, pick: { kind: "change-port", port: 3100 } });
    await h.controller.openMenu(0, 0);
    expect(h.supervisor.calls).toEqual([]);
    expect(h.saved().port).toBe(3000);
  });

  it("supprime les données seulement après confirmation, serveur arrêté, puis quitte", async () => {
    const h = harness({ pick: { kind: "delete-data" } });
    await h.controller.openMenu(0, 0);
    expect(h.supervisor.calls).toEqual(["stop:quit"]);
    expect(h.events.slice(-2)).toEqual(["deleted", "exit:0"]);

    const refused = harness({ confirm: false, pick: { kind: "delete-data" } });
    await refused.controller.openMenu(0, 0);
    expect(refused.events).not.toContain("deleted");
    expect(refused.supervisor.calls).toEqual([]);
  });

  it("renvoie aux Paramètres un démarrage coupé par l'utilisateur", async () => {
    const h = harness({ startup: "disabled-by-user", pick: { kind: "toggle-startup" } });
    await h.controller.openMenu(0, 0);
    expect(h.events).toContain("open:ms-settings:startupapps");
  });

  it("arrête proprement le serveur avant de quitter", async () => {
    const h = harness({ pick: { kind: "quit" } });
    await h.controller.openMenu(0, 0);
    expect(h.supervisor.calls).toEqual(["stop:quit"]);
    expect(h.events.at(-1)).toBe("exit:0");
  });

  it("ouvre l'administration sur l'adresse locale", async () => {
    const h = harness();
    await h.controller.openAdmin();
    expect(h.events).toContain("open:http://192.168.1.20:3000/admin");
  });
});
