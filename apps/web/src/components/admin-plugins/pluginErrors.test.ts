/**
 * Les messages du serveur ramenés à un motif traduisible — et le détail brut
 * gardé quand lui seul dit que la faute vient de la source.
 */

import { describe, expect, it } from "vitest";
import { PluginApiError, describePluginError } from "./pluginErrors";

describe("describePluginError", () => {
  it("une erreur réseau ou inconnue est une coupure", () => {
    expect(describePluginError(new PluginApiError(0, ""))).toEqual({ reason: "network" });
    expect(describePluginError(new TypeError("Failed to fetch"))).toEqual({ reason: "network" });
  });

  it("reconnaît les messages du serveur", () => {
    const reason = (status: number, detail: string) => describePluginError(new PluginApiError(status, detail)).reason;
    expect(reason(503, "The server is restarting")).toBe("restarting");
    expect(reason(409, "Another operation is already running for this plugin")).toBe("busy");
    expect(reason(409, "Plugin already installed")).toBe("alreadyInstalled");
    expect(reason(404, "This plugin version is no longer published by the source")).toBe("versionGone");
    expect(reason(409, "Source already exists")).toBe("sourceExists");
    expect(reason(500, "No SHA-256 checksum published for this plugin version: integrity cannot be verified")).toBe("noChecksum");
    expect(reason(500, "Checksum verification failed: file may be corrupted or tampered")).toBe("checksumMismatch");
    expect(reason(400, "Validation error")).toBe("invalidRequest");
    expect(reason(404, "Plugin not found")).toBe("notFound");
  });

  it("garde le détail là où il est le seul à expliquer", () => {
    expect(describePluginError(new PluginApiError(500, "Download failed: HTTP 404"))).toEqual({
      reason: "downloadFailed",
      detail: "Download failed: HTTP 404",
    });
    expect(describePluginError(new PluginApiError(500, "Refused plugin archive: remontee de dossier : ../x"))).toMatchObject({ reason: "archiveRefused" });
    expect(describePluginError(new PluginApiError(500, "EACCES: permission denied"))).toEqual({
      reason: "generic",
      detail: "EACCES: permission denied",
    });
  });
});
