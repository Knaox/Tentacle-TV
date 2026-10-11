import { describe, expect, it } from "vitest";
import { boxText } from "./runCli";
import { CLI_MARKER, cliArguments, isCliInvocation } from "./cliMode";

const exe = "C:\\Program Files\\WindowsApps\\TentacleServer_1.0.0.0_x64__abc\\Tentacle Server.exe";

describe("mode ligne de commande", () => {
  it("se reconnaît au marqueur de l'alias, placé après « -- » par le manifeste", () => {
    expect(isCliInvocation([exe, CLI_MARKER, "setup", "token"], exe)).toBe(true);
    expect(cliArguments([exe, CLI_MARKER, "setup", "token"])).toEqual(["setup", "token"]);
  });

  it("se reconnaît au nom tapé si l'alias ne portait pas ses paramètres", () => {
    expect(isCliInvocation([exe, "setup", "token"], "tentacle")).toBe(true);
    expect(isCliInvocation([exe], "C:\\Users\\x\\AppData\\Local\\Microsoft\\WindowsApps\\tentacle.exe")).toBe(true);
    expect(cliArguments([exe, "web", "off"])).toEqual(["web", "off"]);
  });

  it("le menu Démarrer et la tâche de démarrage restent l'hôte", () => {
    expect(isCliInvocation([exe], exe)).toBe(false);
    expect(isCliInvocation([exe, "--app-root", "C:\\app"], exe)).toBe(false);
  });

  it("ne passe pas les options de l'hôte à la commande", () => {
    expect(cliArguments([exe, "--app-root", "C:\\app", CLI_MARKER, "db", "query", "--app-root", "x"])).toEqual(["db", "query"]);
  });

  it("borne une sortie recueillie pour une boîte de message", () => {
    expect(boxText("  court \n")).toBe("court");
    expect(boxText("x".repeat(20), 10)).toBe(`${"x".repeat(10)}\n…`);
  });
});
