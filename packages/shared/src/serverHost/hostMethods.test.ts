import { describe, expect, it } from "vitest";
import { HOST_METHODS } from "./hostProtocol";
import {
  HOST_METHOD_TIMEOUTS_MS, parseInstallStatus, parseJellyfinDetection, parsePickFolderParams, parsePickFolderResult, parseStartResult,
} from "./hostMethods";

describe("gestes servis par l'hôte", () => {
  it("chaque geste annoncé a son délai", () => {
    expect(Object.keys(HOST_METHOD_TIMEOUTS_MS).sort()).toEqual([...HOST_METHODS].sort());
  });

  it("la détection se lit, et une forme inconnue est refusée", () => {
    const raw = { state: "running", mode: "tray", version: "12.1.0", url: "http://127.0.0.1:8096", port: 8096, canStart: false, installer: "available", installing: false };
    expect(parseJellyfinDetection(raw)).toEqual(raw);
    expect(parseJellyfinDetection({ ...raw, state: "sleeping" })).toBeNull();
    expect(parseJellyfinDetection({ ...raw, mode: "portable", version: "" })).toEqual({ ...raw, mode: null, version: null });
    expect(parseJellyfinDetection(null)).toBeNull();
  });

  it("un échec d'installation sans cause lisible reste un échec", () => {
    expect(parseInstallStatus({ phase: "failed", failure: "boom" })).toEqual({
      phase: "failed", version: null, receivedBytes: 0, totalBytes: null, failure: "installer_failed",
    });
    expect(parseInstallStatus({ phase: "downloading", version: "12.1", receivedBytes: 10, totalBytes: 100, failure: "network" })).toEqual({
      phase: "downloading", version: "12.1", receivedBytes: 10, totalBytes: 100, failure: null,
    });
    expect(parseInstallStatus({ phase: "later" })).toBeNull();
  });

  it("« Démarrer Jellyfin » refusé garde sa raison", () => {
    expect(parseStartResult({ started: true })).toEqual({ started: true });
    expect(parseStartResult({ started: false, reason: "service" })).toEqual({ started: false, reason: "service" });
    expect(parseStartResult({ started: false, reason: "?" })).toEqual({ started: false, reason: "failed" });
    expect(parseStartResult({})).toBeNull();
  });

  it("la boîte « Choisir un dossier » : annulée, choisie, ou illisible", () => {
    expect(parsePickFolderResult({ path: null })).toEqual({ path: null });
    expect(parsePickFolderResult({ path: "Z:\\Films", unc: "\\\\NAS\\films" })).toEqual({ path: "Z:\\Films", unc: "\\\\NAS\\films" });
    expect(parsePickFolderResult({ path: "" })).toBeNull();
    expect(parsePickFolderParams({ initial: "D:\\Films", title: 3 })).toEqual({ initial: "D:\\Films" });
  });
});
