/**
 * Le suivi d'un retrait automatique ne doit jamais gêner le geste qu'il
 * accompagne : chemins et méthodes exacts, silence sans série, et un backend
 * qui échoue n'échoue pas la promesse.
 */

import { describe, expect, it } from "vitest";
import { AUTO_RETIRED_PATH, forgetAutoRetired, recordAutoRetired, type BackendFetcher } from "./watchlistAutoRetired";

interface Call {
  path: string;
  init?: RequestInit;
}

function fakeBackend(fails = false): BackendFetcher & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    fetch<T>(path: string, init?: RequestInit): Promise<T> {
      calls.push({ path, init });
      return fails ? Promise.reject(new Error("réseau")) : Promise.resolve(undefined as T);
    },
  };
}

describe("le suivi d'un retrait automatique", () => {
  it("se mémorise par un PUT portant la série", async () => {
    const backend = fakeBackend();
    await recordAutoRetired("s1", backend);
    expect(backend.calls).toEqual([
      { path: AUTO_RETIRED_PATH, init: { method: "PUT", body: '{"seriesId":"s1"}' } },
    ]);
  });

  it("s'oublie par un DELETE sur la série", async () => {
    const backend = fakeBackend();
    await forgetAutoRetired("s1", backend);
    expect(backend.calls).toEqual([{ path: `${AUTO_RETIRED_PATH}/s1`, init: { method: "DELETE" } }]);
  });

  it("ne demande rien sans série", async () => {
    const backend = fakeBackend();
    await forgetAutoRetired(undefined, backend);
    expect(backend.calls).toHaveLength(0);
  });

  it("avale l'échec du backend", async () => {
    const backend = fakeBackend(true);
    await expect(recordAutoRetired("s1", backend)).resolves.toBeUndefined();
    await expect(forgetAutoRetired("s1", backend)).resolves.toBeUndefined();
  });
});
