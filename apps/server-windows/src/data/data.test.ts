import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { dataLayout } from "./dataLayout";
import { aclArgs, isUserSid, parseWhoamiSid } from "./folderAcl";
import { DEFAULT_STATE, parseHostState, readHostState, writeHostState } from "./hostState";
import { deleteDataFolder } from "./dataFolder";

const SID = "S-1-5-21-1111111111-2222222222-3333333333-1001";

describe("dataLayout", () => {
  it("range tout sous %ProgramData%\\Tentacle Server", () => {
    const layout = dataLayout("C:\\ProgramData");
    expect(layout.root).toBe(join("C:\\ProgramData", "Tentacle Server"));
    expect(layout.setupToken).toBe(join(layout.root, "setup-token.txt"));
  });
});

describe("droits du dossier", () => {
  it("coupe l'héritage et ne laisse que SYSTEM, les Administrateurs et le compte", () => {
    expect(aclArgs("D:\\x", SID)).toEqual([
      "D:\\x",
      "/inheritance:r",
      "/grant:r",
      "*S-1-5-18:(OI)(CI)F",
      "*S-1-5-32-544:(OI)(CI)F",
      `*${SID}:(OI)(CI)F`,
    ]);
  });

  it("lit le SID dans la sortie de whoami, quelle que soit la langue", () => {
    expect(parseWhoamiSid(`"desktop-ab\\damien rouge","${SID}"\r\n`)).toBe(SID);
    expect(parseWhoamiSid("Accès refusé")).toBeNull();
    expect(isUserSid(SID)).toBe(true);
    expect(isUserSid("S-1-5-18")).toBe(false);
  });
});

describe("host.json", () => {
  let dir = "";
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("rend les défauts champ par champ pour un fichier abîmé", () => {
    expect(parseHostState(null)).toEqual(DEFAULT_STATE);
    expect(parseHostState({ port: 80, wizardOpened: "oui" })).toEqual(DEFAULT_STATE);
    expect(parseHostState({ port: 8080 })).toEqual({ port: 8080, wizardOpened: false });
  });

  it("relit ce qu'il a écrit, et tolère un JSON cassé", () => {
    dir = mkdtempSync(join(tmpdir(), "host-state-"));
    const file = join(dir, "host.json");
    expect(readHostState(file)).toEqual(DEFAULT_STATE);
    writeHostState(file, { port: 8090, wizardOpened: true });
    expect(readHostState(file)).toEqual({ port: 8090, wizardOpened: true });
    writeFileSync(file, "{ cassé");
    expect(readHostState(file)).toEqual(DEFAULT_STATE);
    expect(readFileSync(file, "utf8")).toBe("{ cassé");
  });

  it("supprime tout le dossier de données", () => {
    dir = mkdtempSync(join(tmpdir(), "host-data-"));
    const layout = dataLayout(dir);
    mkdirSync(join(layout.root, "plugins"), { recursive: true });
    writeHostState(layout.hostState, DEFAULT_STATE);
    writeFileSync(join(layout.root, "plugins", "x.js"), "");
    expect(deleteDataFolder(layout)).toBe(true);
    expect(existsSync(layout.root)).toBe(false);
    expect(existsSync(dir)).toBe(true);
  });
});
