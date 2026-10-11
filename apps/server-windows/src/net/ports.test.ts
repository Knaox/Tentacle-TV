import { createServer, type Server } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { isPortFree, isValidPort, suggestPorts } from "./ports";

describe("suggestPorts", () => {
  it("écarte le port actuel et les ports pris, dans l'ordre des candidats", async () => {
    const taken = new Set([3100, 8000]);
    expect(await suggestPorts(3000, async (p) => !taken.has(p))).toEqual([3200, 8080, 8090, 8200]);
  });

  it("rend une liste vide si tout est pris", async () => {
    expect(await suggestPorts(3000, async () => false)).toEqual([]);
  });
});

describe("isValidPort", () => {
  it("refuse les ports réservés et les valeurs absurdes", () => {
    expect(isValidPort(3000)).toBe(true);
    expect(isValidPort(80)).toBe(false);
    expect(isValidPort(70000)).toBe(false);
    expect(isValidPort("3000")).toBe(false);
  });
});

describe("isPortFree", () => {
  let blocker: Server | null = null;
  afterEach(() => new Promise<void>((done) => (blocker ? blocker.close(() => done()) : done())));

  it("voit un port tenu sur la boucle locale seulement", async () => {
    blocker = createServer();
    const port = await new Promise<number>((resolve) => {
      blocker?.listen(0, "127.0.0.1", () => {
        const address = blocker?.address();
        resolve(typeof address === "object" && address !== null ? address.port : 0);
      });
    });
    expect(await isPortFree(port)).toBe(false);
  });
});
