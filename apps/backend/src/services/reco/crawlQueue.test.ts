import { describe, expect, it } from "vitest";
import { CRAWL_FAIL_COOLDOWN_MS, CrawlQueue } from "./crawlQueue";

const t = (id: number, mediaType: "movie" | "tv" = "tv") => ({ mediaType, tmdbId: id });

describe("CrawlQueue", () => {
  it("sert les seaux en tour de rôle, chaque seau dans l'ordre d'arrivée", () => {
    const q = new CrawlQueue();
    expect(q.enqueue("u1", [t(1), t(2), t(3)])).toBe(3);
    expect(q.enqueue("u2", [t(10), t(11)])).toBe(2);
    const order: string[] = [];
    for (let n = q.next(); n; n = q.next()) order.push(`${n.bucket}:${n.target.tmdbId}`);
    expect(order).toEqual(["u1:1", "u2:10", "u1:2", "u2:11", "u1:3"]);
    expect(q.size).toBe(0);
    expect(q.next()).toBeNull();
  });

  it("dédoublonne entre seaux et respecte le refroidissement d'un échec", () => {
    const q = new CrawlQueue();
    q.enqueue("u1", [t(1)]);
    expect(q.enqueue("u2", [t(1), t(2)])).toBe(1);
    q.next();
    q.markFailed("tv:1", 1_000);
    expect(q.enqueue("u1", [t(1)], 1_000 + CRAWL_FAIL_COOLDOWN_MS - 1)).toBe(0);
    expect(q.enqueue("u1", [t(1)], 1_000 + CRAWL_FAIL_COOLDOWN_MS)).toBe(1);
  });

  it("une cible sortie de la file peut y revenir", () => {
    const q = new CrawlQueue();
    q.enqueue("u1", [t(1)]);
    q.next();
    expect(q.enqueue("u1", [t(1)])).toBe(1);
  });
});
