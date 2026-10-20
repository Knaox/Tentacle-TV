import { describe, expect, it, vi } from "vitest";
import { fetchLibraryVisibility } from "./libraryVisibility";

/** Les titres gardés jugés par lots de 200, sans doublon ; une erreur remonte. */

const id = (n: number) => n.toString(16).padStart(32, "0");

describe("fetchLibraryVisibility", () => {
  it("découpe en lots et rassemble les verdicts", async () => {
    const fetcher = vi.fn(async (_path: string, init: RequestInit) => {
      const { itemIds } = JSON.parse(String(init.body)) as { itemIds: string[] };
      return { visible: itemIds.filter((_x, i) => i % 2 === 0), hidden: itemIds.filter((_x, i) => i % 2 === 1), gone: [] };
    });
    const ids = Array.from({ length: 250 }, (_x, i) => id(i));
    const verdict = await fetchLibraryVisibility([...ids, id(0)], fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toBe("/api/library/visibility");
    expect(verdict.visible.length + verdict.hidden.length).toBe(250);
  });

  it("une erreur du serveur remonte (le verdict d'avant reste)", async () => {
    await expect(fetchLibraryVisibility([id(1)], async () => { throw new Error("503"); })).rejects.toThrow("503");
  });
});
