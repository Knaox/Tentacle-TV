import { describe, expect, it } from "vitest";
import type { SetupJellyfinInstall, SetupLocalJellyfin } from "@tentacle-tv/shared";
import { installMessage, localJellyfinView } from "./localJellyfinModel";

const local = (over: Partial<SetupLocalJellyfin> = {}): SetupLocalJellyfin => ({
  state: "absent", mode: null, version: null, url: "http://127.0.0.1:8096", canStart: false,
  installer: "available", installing: false, docsUrl: "https://jellyfin.org/downloads/windows", ...over,
});
const install = (over: Partial<SetupJellyfinInstall> = {}): SetupJellyfinInstall => ({
  phase: "idle", version: "12.1.0", receivedBytes: 0, totalBytes: null, failure: null, docsUrl: "https://jellyfin.org/downloads/windows", ...over,
});

describe("le Jellyfin de ce PC, vu par l'assistant", () => {
  it("en marche : son adresse, quoi que dise une installation passée", () => {
    expect(localJellyfinView(local({ state: "running", url: "http://127.0.0.1:8920" }), install({ phase: "done" }))).toEqual({ kind: "running", url: "http://127.0.0.1:8920" });
  });

  it("arrêté : démarrer l'installation simple, renvoyer un service vers Services", () => {
    expect(localJellyfinView(local({ state: "stopped", mode: "tray", canStart: true }), null)).toEqual({ kind: "stoppedTray" });
    expect(localJellyfinView(local({ state: "stopped", mode: "service" }), null)).toEqual({ kind: "stoppedService" });
    expect(localJellyfinView(local({ state: "stopped", mode: null }), null)).toEqual({ kind: "stoppedUnknown" });
  });

  it("absent : l'installation guidée, sinon la page officielle (ARM, coupée)", () => {
    expect(localJellyfinView(local(), null)).toEqual({ kind: "installOffer" });
    expect(localJellyfinView(local({ installer: "unsupported_arch" }), null)).toEqual({ kind: "manual", reason: "unsupported_arch" });
    expect(localJellyfinView(local({ installer: "disabled" }), null)).toEqual({ kind: "manual", reason: "disabled" });
    expect(localJellyfinView(null, null)).toEqual({ kind: "checking" });
  });

  it("l'installation en cours, finie ou en échec prend la place de l'offre", () => {
    expect(localJellyfinView(local(), install({ phase: "installing" }))).toEqual({ kind: "installing", message: { key: "install_installing" } });
    expect(localJellyfinView(local(), install({ phase: "done" }))).toEqual({ kind: "installing", message: { key: "install_done" } });
    expect(localJellyfinView(local(), install({ phase: "failed", failure: "checksum" }))).toEqual({ kind: "installFailed", failure: "checksum" });
    expect(localJellyfinView(local({ installing: true }), null)).toMatchObject({ kind: "installing" });
  });

  it("le téléchargement dit son pourcentage quand la taille est connue", () => {
    expect(installMessage(install({ phase: "downloading", receivedBytes: 52, totalBytes: 208 }))).toEqual({ key: "install_downloading", values: { version: "12.1.0", percent: 25 } });
    expect(installMessage(install({ phase: "downloading", receivedBytes: 52 }))).toEqual({ key: "install_downloadingUnknown", values: { version: "12.1.0" } });
  });
});
