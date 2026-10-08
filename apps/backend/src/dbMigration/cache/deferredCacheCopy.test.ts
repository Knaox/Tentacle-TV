import { afterEach, describe, expect, it, vi } from "vitest";
import { resetCacheCopyGate, setCacheCopyGate, whenCachesReady } from "./cacheCopyGate";
import { cacheCopyPercent, cacheCopyState, resetCacheCopyState, startDeferredCacheCopy } from "./deferredCacheCopy";
import { CACHE_DONE_KEY } from "./cacheCopyProtocol";

const REPORT = JSON.stringify({ version: 1, tables: [], deferred: [{ table: "tmdb_meta_cache", sourceRows: 16656 }] });

afterEach(() => {
  resetCacheCopyGate();
  resetCacheCopyState();
});

describe("la porte des tâches gourmandes en TMDB", () => {
  it("rien à attendre sans copie de fond", async () => {
    await expect(whenCachesReady(10)).resolves.toBeUndefined();
  });

  it("s'ouvre à la fin de la copie, réussie ou non", async () => {
    let finish!: () => void;
    setCacheCopyGate(new Promise<void>((resolve) => (finish = resolve)));
    let open = false;
    const waiting = whenCachesReady(60_000).then(() => (open = true));
    await Promise.resolve();
    expect(open).toBe(false);
    finish();
    await waiting;
    expect(open).toBe(true);
    setCacheCopyGate(Promise.reject(new Error("arrêt")));
    await expect(whenCachesReady(60_000)).resolves.toBeUndefined();
  });

  it("ne reste jamais fermée : le plafond l'ouvre", async () => {
    vi.useFakeTimers();
    try {
      setCacheCopyGate(new Promise<void>(() => undefined));
      const waiting = whenCachesReady(30 * 60_000);
      vi.advanceTimersByTime(30 * 60_000);
      await expect(waiting).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("la copie de fond, côté serveur", () => {
  const read = (values: Record<string, string>) => async (key: string) => values[key] ?? null;

  it("une base sans table différée (ou d'avant la migration) : rien", async () => {
    await startDeferredCacheCopy({ url: "mysql://u:p@db/t", path: "/x", readConfig: read({}) });
    expect(cacheCopyState().phase).toBe("none");
  });

  it("marqueur de fin posé : copie faite, 100 %", async () => {
    await startDeferredCacheCopy({ url: "mysql://u:p@db/t", path: "/x", readConfig: read({ sqlite_migration_report: REPORT, [CACHE_DONE_KEY]: "1" }) });
    expect(cacheCopyState().phase).toBe("done");
    expect(cacheCopyPercent()).toBe(100);
  });

  it("ancienne base retirée avant la fin : une seule ligne au journal, jamais une erreur, le cache se reconstruit", async () => {
    const log = vi.fn();
    await startDeferredCacheCopy({ url: null, path: "/x", readConfig: read({ sqlite_migration_report: REPORT }), log });
    expect(cacheCopyState().phase).toBe("stopped");
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/^\[db-migration\] Cache TMDB/);
  });
});
