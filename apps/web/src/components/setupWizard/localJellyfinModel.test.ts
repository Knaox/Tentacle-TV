import { describe, expect, it } from "vitest";
import type { SetupJellyfinInstall, SetupLocalJellyfin } from "@tentacle-tv/shared";
import { installMessage, installProgress, localJellyfinView, stageStatus, type InstallStage } from "./localJellyfinModel";

const local = (over: Partial<SetupLocalJellyfin> = {}): SetupLocalJellyfin => ({
  state: "absent", mode: null, version: null, url: "http://127.0.0.1:8096", canStart: false,
  installer: "available", installing: false, docsUrl: "https://jellyfin.org/downloads/windows", ...over,
});
const install = (over: Partial<SetupJellyfinInstall> = {}): SetupJellyfinInstall => ({
  phase: "idle", version: "12.1.0", receivedBytes: 0, totalBytes: null, failure: null, docsUrl: "https://jellyfin.org/downloads/windows", ...over,
});

describe("le Jellyfin de ce PC, vu par l'assistant", () => {
  it("en marche : son adresse ; installé pendant l'écran, « prêt » d'abord", () => {
    expect(localJellyfinView(local({ state: "running", url: "http://127.0.0.1:8920" }), null)).toEqual({ kind: "running", url: "http://127.0.0.1:8920" });
    expect(localJellyfinView(local({ state: "running", url: "http://127.0.0.1:8920" }), install({ phase: "done" }))).toEqual({ kind: "ready", url: "http://127.0.0.1:8920" });
  });

  it("arrêté : démarrer l'installation simple, renvoyer un service vers Services", () => {
    expect(localJellyfinView(local({ state: "stopped", mode: "tray", canStart: true }), null)).toEqual({ kind: "stoppedTray", afterInstall: false });
    expect(localJellyfinView(local({ state: "stopped", mode: "service" }), null)).toEqual({ kind: "stoppedService" });
    expect(localJellyfinView(local({ state: "stopped", mode: null }), null)).toEqual({ kind: "stoppedUnknown" });
  });

  it("absent : l'installation guidée, sinon la page officielle (ARM, coupée)", () => {
    expect(localJellyfinView(local(), null)).toEqual({ kind: "installOffer" });
    expect(localJellyfinView(local({ installer: "unsupported_arch" }), null)).toEqual({ kind: "manual", reason: "unsupported_arch" });
    expect(localJellyfinView(local({ installer: "disabled" }), null)).toEqual({ kind: "manual", reason: "disabled" });
    expect(localJellyfinView(null, null)).toEqual({ kind: "checking" });
  });

  it("installation finie : un Jellyfin arrêté n'est jamais masqué — on attend son démarrage, puis le bouton revient", () => {
    const stopped = local({ state: "stopped", mode: "tray", canStart: true });
    expect(localJellyfinView(stopped, install({ phase: "done" }), { starting: true })).toMatchObject({ kind: "install", progress: { stage: "start" } });
    expect(localJellyfinView(stopped, install({ phase: "done" }), { starting: false })).toEqual({ kind: "stoppedTray", afterInstall: true });
    expect(localJellyfinView(local({ state: "stopped", mode: "service" }), install({ phase: "done" }), { starting: true })).toEqual({ kind: "stoppedService" });
    // Un démarrage demandé par le bouton, hors installation : l'attente simple.
    expect(localJellyfinView(stopped, null, { starting: true })).toEqual({ kind: "starting" });
  });

  it("l'installateur a fini mais rien n'est trouvé : on attend, puis on dit quoi faire", () => {
    expect(localJellyfinView(local(), install({ phase: "done" }), { starting: true })).toMatchObject({ kind: "install", progress: { stage: "start" } });
    expect(localJellyfinView(local(), install({ phase: "done" }), { starting: false })).toEqual({ kind: "installedNotFound" });
  });

  it("l'installation en cours ou en échec prend la place de l'offre, une page rechargée la reprend", () => {
    expect(localJellyfinView(local(), install({ phase: "installing" }))).toEqual({
      kind: "install",
      progress: { stage: "installer", message: { key: "install_installing" }, percent: null },
    });
    expect(localJellyfinView(local(), install({ phase: "failed", failure: "cancelled" }))).toEqual({ kind: "installFailed", failure: "cancelled" });
    expect(localJellyfinView(local(), install({ phase: "failed", failure: "checksum" }))).toEqual({ kind: "installFailed", failure: "checksum" });
    expect(localJellyfinView(local({ installing: true }), null)).toMatchObject({ kind: "install", progress: { stage: "download" } });
  });

  it("trois étapes, toujours dans le même ordre", () => {
    expect(installProgress(install({ phase: "resolving" })).stage).toBe("download");
    expect(installProgress(install({ phase: "verifying" })).stage).toBe("download");
    expect(installProgress(install({ phase: "downloading", receivedBytes: 50, totalBytes: 200 }))).toMatchObject({ stage: "download", percent: 25 });
    expect(installProgress(install({ phase: "installing" })).stage).toBe("installer");
    expect(installProgress(install({ phase: "done" })).stage).toBe("start");
    const stages: InstallStage[] = ["download", "installer", "start"];
    expect(stages.map((stage) => stageStatus("installer", stage))).toEqual(["done", "active", "pending"]);
  });

  it("le téléchargement dit son pourcentage quand la taille est connue", () => {
    expect(installMessage(install({ phase: "downloading", receivedBytes: 52, totalBytes: 208 }))).toEqual({ key: "install_downloading", values: { version: "12.1.0", percent: 25 } });
    expect(installMessage(install({ phase: "downloading", receivedBytes: 52 }))).toEqual({ key: "install_downloadingUnknown", values: { version: "12.1.0" } });
  });
});
