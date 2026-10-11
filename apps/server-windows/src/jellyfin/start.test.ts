import { describe, expect, it } from "vitest";
import { startJellyfin, type StartDeps } from "./start";

const REG_SIMPLE = "    InstallFolder    REG_SZ    C:\\Program Files\\Jellyfin\\Server\n    ServiceAccountType    REG_SZ    None\n";

function deps(options: { service?: boolean; registry?: string | null; launcher?: boolean; opens?: boolean }): StartDeps & { opened: string[] } {
  const opened: string[] = [];
  return {
    run: async (tool, args) => {
      if (tool === "sc") return options.service ? { code: 0, stdout: "STATE : 1  STOPPED" } : { code: 1060, stdout: "" };
      if (tool === "reg" && options.registry && args[1]?.endsWith("Jellyfin\\Server")) return { code: 0, stdout: options.registry };
      return { code: 1, stdout: "" };
    },
    exists: () => options.launcher ?? true,
    openWithExplorer: async (path) => {
      opened.push(path);
      return options.opens ?? true;
    },
    opened,
  };
}

describe("« Démarrer Jellyfin »", () => {
  it("installation simple : son lanceur, par l'Explorateur", async () => {
    const d = deps({ registry: REG_SIMPLE });
    expect(await startJellyfin(d)).toEqual({ started: true });
    expect(d.opened).toEqual(["C:\\Program Files\\Jellyfin\\Server\\jellyfin-windows-tray\\Jellyfin.Windows.Tray.exe"]);
  });

  it("un service n'est jamais démarré par nous", async () => {
    const d = deps({ service: true, registry: REG_SIMPLE });
    expect(await startJellyfin(d)).toEqual({ started: false, reason: "service" });
    expect(d.opened).toEqual([]);
  });

  it("rien d'installé, lanceur absent, lancement refusé", async () => {
    expect(await startJellyfin(deps({ registry: null }))).toEqual({ started: false, reason: "not_installed" });
    expect(await startJellyfin(deps({ registry: REG_SIMPLE, launcher: false }))).toEqual({ started: false, reason: "launcher_missing" });
    expect(await startJellyfin(deps({ registry: REG_SIMPLE, opens: false }))).toEqual({ started: false, reason: "failed" });
  });
});
