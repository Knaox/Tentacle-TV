import { describe, expect, it } from "vitest";
import { detectJellyfin, type DetectDeps } from "./detect";
import { modeOf, parseNetworkXml } from "./jellyfinFiles";
import { parseRegKey, parseServiceState, processListed, type ToolResult } from "./systemTools";

const REG_SERVER = `
HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Jellyfin\\Server
    InstallFolder    REG_SZ    C:\\Program Files\\Jellyfin\\Server
    DataFolder    REG_SZ    C:\\ProgramData\\Jellyfin\\Server
    ServiceAccountType    REG_SZ    None
`;
const REG_UNINSTALL = `
HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\JellyfinServer
    DisplayVersion    REG_SZ    12.1.0
`;
const NETWORK = `<?xml version="1.0"?><NetworkConfiguration><BaseUrl>/jf/</BaseUrl><InternalHttpPort>8920</InternalHttpPort></NetworkConfiguration>`;

function deps(overrides: Partial<DetectDeps> & { reg?: Record<string, string>; service?: ToolResult; tasks?: string } = {}): DetectDeps {
  const reg = overrides.reg ?? {};
  return {
    run: async (tool, args) => {
      if (tool === "reg") {
        const key = args[1] ?? "";
        return key in reg ? { code: 0, stdout: reg[key] ?? "" } : { code: 1, stdout: "" };
      }
      if (tool === "sc") return overrides.service ?? { code: 1060, stdout: "" };
      return { code: 0, stdout: overrides.tasks ?? "INFO: No tasks are running which match the specified criteria." };
    },
    env: { ProgramData: "C:\\ProgramData", LOCALAPPDATA: "C:\\Users\\a\\AppData\\Local" },
    readText: overrides.readText ?? (() => null),
    exists: overrides.exists ?? (() => true),
    probe: overrides.probe ?? (async () => null),
    installer: () => ({ offer: "available", installing: false }),
  };
}

const INSTALLED = {
  "HKLM\\SOFTWARE\\WOW6432Node\\Jellyfin\\Server": REG_SERVER,
  "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\JellyfinServer": REG_UNINSTALL,
};

describe("détection de Jellyfin", () => {
  it("lit le registre, la sortie de sc et de tasklist", () => {
    expect(parseRegKey(REG_SERVER)).toEqual({
      InstallFolder: "C:\\Program Files\\Jellyfin\\Server",
      DataFolder: "C:\\ProgramData\\Jellyfin\\Server",
      ServiceAccountType: "None",
    });
    expect(parseServiceState({ code: 0, stdout: "        STATE              : 4  RUNNING" })).toBe("running");
    expect(parseServiceState({ code: 0, stdout: "        STATE              : 1  STOPPED" })).toBe("stopped");
    expect(parseServiceState({ code: 1060, stdout: "" })).toBe("absent");
    expect(parseServiceState({ code: 0, stdout: "        ÉTAT              : 4  RUNNING" })).toBe("running");
    expect(processListed('"jellyfin.exe","4242","Console","1","180 000 K"', "jellyfin.exe")).toBe(true);
    expect(modeOf("NetworkService")).toBe("service");
    expect(modeOf(undefined)).toBeNull();
  });

  it("network.xml donne le port et le BaseUrl", () => {
    expect(parseNetworkXml(NETWORK)).toEqual({ port: 8920, baseUrl: "/jf" });
    expect(parseNetworkXml("<NetworkConfiguration/>")).toEqual({ port: null, baseUrl: "" });
  });

  it("rien nulle part : absent, sur le port par défaut", async () => {
    expect(await detectJellyfin(deps())).toEqual({
      state: "absent", mode: null, version: null, url: "http://127.0.0.1:8096", port: 8096, canStart: false, installer: "available", installing: false,
    });
  });

  it("installation simple arrêtée : « Démarrer Jellyfin » possible, sur le port de network.xml", async () => {
    const found = await detectJellyfin(deps({ reg: INSTALLED, readText: (path) => (path.startsWith("C:\\ProgramData\\Jellyfin\\Server") ? NETWORK : null) }));
    expect(found).toMatchObject({ state: "stopped", mode: "tray", version: "12.1.0", url: "http://127.0.0.1:8920/jf", port: 8920, canStart: true });
  });

  it("le lanceur absent : pas de « Démarrer »", async () => {
    expect(await detectJellyfin(deps({ reg: INSTALLED, exists: () => false }))).toMatchObject({ state: "stopped", canStart: false });
  });

  it("un service, même arrêté, n'est jamais démarré par nous", async () => {
    const found = await detectJellyfin(deps({ reg: INSTALLED, service: { code: 0, stdout: "STATE : 1  STOPPED" } }));
    expect(found).toMatchObject({ state: "stopped", mode: "service", canStart: false });
  });

  it("il répond : en marche, avec la version qu'il rend", async () => {
    const found = await detectJellyfin(deps({ reg: INSTALLED, probe: async () => ({ version: "12.1.0" }) }));
    expect(found).toMatchObject({ state: "running", version: "12.1.0", canStart: false });
  });

  it("un ZIP lancé à la main, sans registre : vu par son processus", async () => {
    const found = await detectJellyfin(deps({ tasks: '"jellyfin.exe","77","Console","1","90 000 K"' }));
    expect(found).toMatchObject({ state: "stopped", mode: null, canStart: false });
  });
});
