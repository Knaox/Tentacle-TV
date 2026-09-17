/**
 * La colle vivante, sans KWin (le pont est joué) : une seule pose par
 * processus, partagée par deux demandes croisées, et une repose qui décroche
 * d'abord — c'est tout ce que `waylandGlueSurface.ts` attend d'elle.
 */

import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { bridge } = vi.hoisted(() => ({
  bridge: {
    filePaths: [] as string[],
    detached: [] as string[],
    /** Les numéros rendus tour à tour ; le dernier vaut pour tous les suivants. */
    loadReturns: [0] as (number | null)[],
  },
}));

vi.mock("./kwinScripting", () => ({
  loadDeclarativeScript: (filePath: string) => {
    bridge.filePaths.push(filePath);
    const render = bridge.loadReturns.length > 1 ? bridge.loadReturns.shift() : bridge.loadReturns[0];
    return Promise.resolve(render ?? null);
  },
  runScript: () => Promise.resolve(true),
  unloadScript: (name: string) => {
    bridge.detached.push(name);
    return Promise.resolve(true);
  },
  unloadScriptSync: (name: string) => {
    bridge.detached.push(name);
  },
}));

import { ensureLiveGlue, forgetLiveGlue, liveGlue, reposeLiveGlue } from "./liveGlue";

const PLUGIN_ID = `tentacle-colle-${String(process.pid)}`;

beforeEach(() => {
  forgetLiveGlue();
  bridge.filePaths.length = 0;
  bridge.detached.length = 0;
  bridge.loadReturns = [0];
});

describe("la colle vivante du processus", () => {
  it("se pose une fois, puis sert à toutes les lectures", async () => {
    expect(liveGlue()).toBeNull();
    expect(await ensureLiveGlue()).toEqual({ live: true, fresh: true });
    expect(await ensureLiveGlue()).toEqual({ live: true, fresh: false });
    expect(bridge.filePaths).toHaveLength(1);
    expect(liveGlue()).not.toBeNull();
  });

  it("deux poses croisées partagent la même — KWin refuserait un second greffon du même nom", async () => {
    const [a, b] = await Promise.all([ensureLiveGlue(), ensureLiveGlue()]);
    expect(a).toEqual({ live: true, fresh: true });
    expect(b).toEqual({ live: true, fresh: true });
    expect(bridge.filePaths).toHaveLength(1);
  });

  it("une pose refusée ne laisse rien de vivant, et la suivante réessaie", async () => {
    bridge.loadReturns = [null, null];
    expect(await ensureLiveGlue()).toEqual({ live: false, fresh: false });
    expect(liveGlue()).toBeNull();
    bridge.loadReturns = [4];
    expect((await ensureLiveGlue()).live).toBe(true);
  });

  it("reposer décroche la vivante et en pose une neuve, dans un dossier neuf", async () => {
    await ensureLiveGlue();
    const first = bridge.filePaths[0] ?? "";
    expect(await reposeLiveGlue()).toBe(true);
    expect(bridge.detached.filter((n) => n === PLUGIN_ID).length).toBeGreaterThanOrEqual(2);
    expect(path.dirname(bridge.filePaths[1] ?? "")).not.toBe(path.dirname(first));
    expect(liveGlue()).not.toBeNull();
    await liveGlue()?.remove();
  });
});
