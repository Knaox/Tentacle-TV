import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEV_IDENTITY, checkPackageVersion, renderManifest } from "./manifest.mts";
import { HOST_COPIES } from "./layout.mts";
import { SERVER_EXE } from "./runtimes.mts";

const app = resolve(import.meta.dirname, "..", "..");
const template = readFileSync(join(app, "msix", "Package.appxmanifest"), "utf8");
// Les commentaires ne comptent pas : seul ce que Windows lit est vérifié.
const manifest = renderManifest(template, DEV_IDENTITY, "1.2.3.0").replace(/<!--[\s\S]*?-->/g, "");
const source = (path: string): string => readFileSync(join(app, "src", path), "utf8");

/** La valeur d'une constante `export const NOM = "…"` lue dans les sources de l'hôte (sans charger koffi). */
function constant(path: string, name: string): string {
  const value = new RegExp(`export const ${name} = "([^"]+)"`).exec(source(path))?.[1];
  if (value === undefined) throw new Error(`${name} introuvable dans ${path}`);
  return value;
}

describe("manifeste MSIX", () => {
  it("ne laisse aucun jeton et porte l'identité et la version demandées", () => {
    expect(manifest).not.toMatch(/\{\{/);
    expect(manifest).toContain('Name="TentacleServer.Dev"');
    expect(manifest).toContain('Publisher="CN=Tentacle Server Dev"');
    expect(manifest).toContain('Version="1.2.3.0"');
  });

  it("déclare la tâche de démarrage que l'hôte lit, sans enregistrement immédiat", () => {
    expect(manifest).toContain(`TaskId="${constant("startup/startupTask.ts", "STARTUP_TASK_ID")}"`);
    expect(manifest).toMatch(/<desktop:StartupTask [^>]*Enabled="true"/);
    expect(manifest).not.toContain("ImmediateRegistration");
  });

  it("lance l'hôte depuis l'exe, jamais par un chemin relatif au dossier courant", () => {
    const host = HOST_COPIES.find((step) => step.to.endsWith("main.js"))?.to ?? "";
    const parts = host.split("/").map((part) => `'${part}'`).join(",");
    const bootstrap = `-e &quot;require(require('path').join(require('path').dirname(process.execPath),${parts}))&quot; --`;
    expect(manifest).toContain(`Executable="${SERVER_EXE}"`);
    expect(manifest).toContain(`uap10:Parameters="${bootstrap}"`);
    expect(manifest).toContain(`uap10:Parameters="${bootstrap} ${constant("cli/cliMode.ts", "CLI_MARKER")}"`);
    expect(manifest).toContain(`Alias="${constant("cli/cliMode.ts", "CLI_ALIAS")}"`);
  });

  it("relance l'hôte après une mise à jour avec les mêmes paramètres que le manifeste", () => {
    const declared = /export const HOST_BOOTSTRAP =\s*"((?:[^"\\]|\\.)*)";/.exec(source("update/restart.ts"))?.[1];
    expect(declared).toBeDefined();
    const restart = JSON.parse(`"${declared ?? ""}"`) as string;
    expect(manifest).toContain(`uap10:Parameters="${restart.replace(/"/g, "&quot;")}"`);
  });

  it("ouvre le pare-feu à notre exe seul, sans port, hors réseau public", () => {
    expect(manifest).toContain(`<desktop2:FirewallRules Executable="${SERVER_EXE}">`);
    const rules = manifest.match(/<desktop2:Rule [^>]*\/>/g) ?? [];
    expect(rules.map((rule) => /IPProtocol="(\w+)"/.exec(rule)?.[1]).sort()).toEqual(["TCP", "UDP"]);
    for (const rule of rules) {
      expect(rule).toContain('Direction="in"');
      expect(rule).toContain('Profile="domainAndPrivate"');
      expect(rule).not.toMatch(/Port/);
    }
  });

  it("garde le filet de mise à jour et les bornes de version de Windows", () => {
    expect(manifest).toContain("<uap17:UpdateWhileInUse>defer</uap17:UpdateWhileInUse>");
    expect(manifest).toContain('MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0"');
    expect(manifest).toContain('<rescap:Capability Name="runFullTrust" />');
  });

  it("refuse une version hors du format du Store", () => {
    expect(() => checkPackageVersion("1.0.0.1")).toThrow();
    expect(() => checkPackageVersion("70000.0.0.0")).toThrow();
    expect(checkPackageVersion("1.0.0.0")).toBe("1.0.0.0");
  });
});
