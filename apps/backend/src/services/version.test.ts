/**
 * La version du serveur fixée au BUILD (`TENTACLE_SERVER_VERSION`) : elle
 * l'emporte sur `versions.json`, accepte une métadonnée de build
 * (« +preview.<sha> »), refuse toute autre forme (repli sur `versions.json`).
 */

import { describe, expect, it } from "vitest";
import { resolveServerVersion } from "./version";

const pkg = () => "1.31.0";

describe("resolveServerVersion", () => {
  it("absente : versions.json, comme avant ; sans lui, package.json", () => {
    expect(resolveServerVersion({ versionsServer: "1.31.4", packageVersion: pkg })).toEqual({ version: "1.31.4", rejected: null });
    expect(resolveServerVersion({ override: "  ", versionsServer: "1.31.4", packageVersion: pkg })).toEqual({ version: "1.31.4", rejected: null });
    expect(resolveServerVersion({ packageVersion: pkg })).toEqual({ version: "1.31.0", rejected: null });
    expect(resolveServerVersion({})).toEqual({ version: "0.0.0", rejected: null });
  });

  it("présente : elle l'emporte, avec ou sans métadonnée de build", () => {
    expect(resolveServerVersion({ override: "1.40.0", versionsServer: "1.31.4" }).version).toBe("1.40.0");
    expect(resolveServerVersion({ override: " 1.40.0+preview.fab15c3 ", versionsServer: "1.31.4" }).version).toBe("1.40.0+preview.fab15c3");
  });

  it("illisible ou pré-version : ignorée et signalée, versions.json garde la main", () => {
    for (const forced of ["1.40", "v1.40.0", "1.40.0-preview", "1.40.0+", "latest", "1.40.0+preview/abc"]) {
      expect(resolveServerVersion({ override: forced, versionsServer: "1.31.4" }), forced).toEqual({ version: "1.31.4", rejected: forced });
    }
  });
});
