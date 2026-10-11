import { describe, expect, it } from "vitest";
import { STRINGS } from "../i18n/strings";
import { buildMenu, tooltip, type MenuEntry, type MenuInput } from "./menuModel";

const base: MenuInput = {
  strings: STRINGS.fr,
  state: { kind: "running", port: 3000, version: "1.25.1", appState: "running" },
  port: 3000,
  startup: "enabled",
  freePorts: [3100, 8080],
  hasSetupCode: false,
};

function texts(entries: readonly MenuEntry[]): string[] {
  return entries.flatMap((entry) => {
    if (entry.kind === "separator") return ["---"];
    if (entry.kind === "submenu") return [`${entry.text} >`, ...texts(entry.entries).map((t) => `  ${t}`)];
    return [entry.text];
  });
}

describe("buildMenu", () => {
  it("dit l'état, puis l'administration, les réglages, et les gestes lourds en bas", () => {
    expect(texts(buildMenu(base))).toEqual([
      "En marche, port 3000",
      "---",
      "Ouvrir l'administration",
      "---",
      "Démarrer avec Windows",
      "Changer de port >",
      "  Port 3000",
      "  Port 3100",
      "  Port 8080",
      "Ouvrir le journal",
      "---",
      "Supprimer les données du serveur…",
      "Quitter",
    ]);
  });

  it("propose de redémarrer un serveur bloqué, et grise l'administration", () => {
    const menu = buildMenu({ ...base, state: { kind: "blocked", cause: "port_in_use" }, freePorts: [] });
    expect(texts(menu)).toContain("Redémarrer le serveur");
    expect(texts(menu)[0]).toBe("Port 3000 déjà utilisé");
    expect(texts(menu)).toContain("  Aucun port libre proposé");
    const admin = menu.find((e) => e.kind === "item" && e.command.kind === "open-admin");
    expect(admin).toMatchObject({ enabled: false });
  });

  it("montre le code d'installation tant qu'il existe", () => {
    expect(texts(buildMenu({ ...base, hasSetupCode: true }))).toContain("Code d'installation");
  });

  it("coche le démarrage selon l'état de Windows, et le grise s'il ne se règle pas", () => {
    const startup = (state: MenuInput["startup"]): MenuEntry | undefined =>
      buildMenu({ ...base, startup: state }).find((e) => e.kind === "item" && e.command.kind === "toggle-startup");
    expect(startup("enabled")).toMatchObject({ checked: true, enabled: true });
    expect(startup("disabled-by-user")).toMatchObject({ checked: false, enabled: true });
    expect(startup("enabled-by-policy")).toMatchObject({ checked: true, enabled: false });
    expect(startup("unavailable")).toMatchObject({ enabled: false });
  });

  it("parle anglais quand on le lui demande", () => {
    expect(texts(buildMenu({ ...base, strings: STRINGS.en }))).toContain("Open administration");
  });
});

describe("tooltip", () => {
  it("préfixe le nom de l'app et tient dans la limite de Windows", () => {
    expect(tooltip(STRINGS.fr, { kind: "starting" }, 3000)).toBe("Tentacle Server : Démarrage…");
    expect(tooltip(STRINGS.en, { kind: "blocked", cause: "crash_loop" }, 3000).length).toBeLessThan(128);
  });
});
