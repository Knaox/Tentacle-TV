import { mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ServerStatus } from "../protocol";
import { backupDatabase, backupName } from "./backups";
import { UpdateCoordinator, isCalm, type UpdateDeps, type UpdateNotice } from "./updateCoordinator";
import { installOutcome, type InstallOutcome, type StoreUpdateInfo } from "./updateTypes";

const status = (playbackActive: boolean | null, restartPending = false): ServerStatus =>
  ({ bootId: "b", appState: "running", playbackActive, restartPending }) as ServerStatus;
const at = (hour: number): Date => new Date(2026, 9, 11, hour, 30);

describe("moment calme", () => {
  it("aucune lecture et rien en attente : calme ; une lecture : non", () => {
    expect(isCalm(status(false), true, at(15))).toBe(true);
    expect(isCalm(status(true), true, at(4))).toBe(false);
    expect(isCalm(status(false, true), true, at(4))).toBe(false);
  });

  it("sans avis de Jellyfin, la nuit seulement ; sans réponse du serveur, jamais", () => {
    expect(isCalm(status(null), true, at(4))).toBe(true);
    expect(isCalm(status(null), true, at(21))).toBe(false);
    expect(isCalm(null, true, at(4))).toBe(false);
    expect(isCalm(null, false, at(21))).toBe(true);
  });
});

function harness(info: StoreUpdateInfo | null, options: { install?: InstallOutcome; status?: ServerStatus | null; backupFails?: boolean } = {}) {
  const events: string[] = [];
  const notices: UpdateNotice[] = [];
  const deps: UpdateDeps = {
    store: {
      check: async () => info,
      download: async () => (events.push("download"), "completed"),
      install: async (silent) => (events.push(`install:${silent ? "silent" : "dialog"}`), options.install ?? "completed"),
    },
    server: {
      status: async () => (options.status === undefined ? status(false) : options.status),
      running: () => true,
      version: () => "1.25.1",
      stop: async () => void events.push("stop"),
      start: async () => void events.push("start"),
    },
    backup: (version) => {
      events.push(`backup:${version}`);
      if (options.backupFails) throw new Error("disque plein");
      return { kind: "saved", file: "x", removed: [] };
    },
    registerRestart: () => (events.push("restart-registered"), true),
    notify: (notice) => void notices.push(notice),
    log: () => undefined,
    now: () => at(15),
  };
  return { coordinator: new UpdateCoordinator(deps), events, notices };
}

describe("mise à jour pilotée par l'hôte", () => {
  it("voie silencieuse : télécharge, puis au calme arrête, sauvegarde, enregistre la relance, installe — dans cet ordre", async () => {
    const { coordinator, events } = harness({ available: true, mandatory: false, canSilent: true });
    await coordinator.checkNow();
    expect(events).toEqual(["download", "stop", "backup:1.25.1", "restart-registered", "install:silent", "start"]);
  });

  it("n'installe pas pendant une lecture", async () => {
    const { coordinator, events } = harness({ available: true, mandatory: false, canSilent: true }, { status: status(true) });
    await coordinator.checkNow();
    expect(events).toEqual(["download"]);
    expect(coordinator.updatePending).toBe(true);
  });

  it("sans voie silencieuse, ne touche à rien seul : prévient, et le menu installe par le dialogue", async () => {
    const { coordinator, events, notices } = harness({ available: true, mandatory: false, canSilent: false });
    await coordinator.checkNow();
    expect(events).toEqual([]);
    expect(notices).toEqual(["available"]);
    await coordinator.installNow();
    expect(events).toEqual(["stop", "backup:1.25.1", "restart-registered", "install:dialog", "start"]);
  });

  it("sans sauvegarde, pas d'installation : le serveur repart", async () => {
    const { coordinator, events, notices } = harness({ available: true, mandatory: false, canSilent: false }, { backupFails: true });
    await coordinator.checkNow();
    await coordinator.installNow();
    expect(events).toEqual(["stop", "backup:1.25.1", "start"]);
    expect(notices).toEqual(["available", "failed"]);
  });

  it("une installation refusée relance le serveur et le dit ; une annulation se tait", async () => {
    const failed = harness({ available: true, mandatory: false, canSilent: false }, { install: "failed" });
    await failed.coordinator.checkNow();
    await failed.coordinator.installNow();
    expect(failed.events.at(-1)).toBe("start");
    expect(failed.notices).toEqual(["available", "failed"]);
    const canceled = harness({ available: true, mandatory: false, canSilent: false }, { install: "canceled" });
    await canceled.coordinator.checkNow();
    await canceled.coordinator.installNow();
    expect(canceled.notices).toEqual(["available"]);
  });

  it("toujours vivant après une installation réussie : différée, il faut relancer l'app", async () => {
    const { coordinator, notices } = harness({ available: true, mandatory: false, canSilent: true });
    await coordinator.checkNow();
    expect(notices).toEqual(["restart-needed"]);
    expect(coordinator.updatePending).toBe(false);
  });

  it("hors paquet ou Store muet : rien", async () => {
    const { coordinator, events } = harness(null);
    await coordinator.checkNow();
    expect(events).toEqual([]);
  });

  it("lit l'état final du Store : Completed vaut 3, pas 0", () => {
    expect(installOutcome(3)).toBe("completed");
    expect(installOutcome(0)).toBe("failed");
    expect(installOutcome(4)).toBe("canceled");
    expect(installOutcome(null)).toBe("failed");
  });
});

describe("sauvegarde de la base", () => {
  let dir = "";
  afterEach(() => {
    if (dir !== "") rmSync(dir, { recursive: true, force: true });
  });

  it("copie tentacle.db sous le nom de la version et garde les trois plus récentes", () => {
    dir = mkdtempSync(join(tmpdir(), "backup-"));
    const backups = join(dir, "backups");
    expect(backupDatabase(dir, backups, "1.0.0")).toEqual({ kind: "no-database" });
    writeFileSync(join(dir, "tentacle.db"), "base");
    for (const [index, version] of ["1.22.0", "1.23.0", "1.24.0", "1.25.0"].entries()) {
      backupDatabase(dir, backups, version);
      const when = new Date(2026, 0, 1 + index);
      utimesSync(join(backups, backupName(version)), when, when);
    }
    const result = backupDatabase(dir, backups, "1.25.1");
    // 1.22.0 est parti à la quatrième sauvegarde, 1.23.0 à la cinquième.
    expect(result.kind === "saved" ? result.removed : []).toEqual(["tentacle-1.23.0.db"]);
    expect(readdirSync(backups).sort()).toEqual(["tentacle-1.24.0.db", "tentacle-1.25.0.db", "tentacle-1.25.1.db"]);
  });

  it("emporte un -wal resté là", () => {
    dir = mkdtempSync(join(tmpdir(), "backup-wal-"));
    writeFileSync(join(dir, "tentacle.db"), "base");
    writeFileSync(join(dir, "tentacle.db-wal"), "journal");
    backupDatabase(dir, join(dir, "backups"), "1.25.1");
    expect(readdirSync(join(dir, "backups")).sort()).toEqual(["tentacle-1.25.1.db", "tentacle-1.25.1.db-wal"]);
    expect(backupName("1/2 x")).toBe("tentacle-1_2_x.db");
  });
});
