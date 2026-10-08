import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { openTestPrisma, type TestPrisma } from "../../../test/sqlite/realPrisma";
import { REQUESTED_ACTION, hideRequestedTitle, requestedTitleKey, requestedTitleKeys } from "./requestedTitles";

// Une vraie base SQLite : « déjà posé » se juge sur l'unicité (compte, titre).
const { holder, pokePage } = vi.hoisted(() => ({ holder: {} as { db?: TestPrisma }, pokePage: vi.fn() }));
vi.mock("../db", () => ({ getPrisma: () => holder.db!.prisma }));
vi.mock("./pageJobs", () => ({ pokePage: (...args: unknown[]) => pokePage(...args) }));

beforeAll(async () => {
  holder.db = await openTestPrisma();
});
afterAll(async () => {
  await holder.db?.close();
});

describe("un titre demandé sort des recommandations du compte", () => {
  beforeEach(async () => {
    await holder.db!.prisma.recommendationFeedback.deleteMany();
    pokePage.mockReset();
  });

  it("se range sous la clé canonique, « series » compris", () => {
    expect(requestedTitleKey({ mediaType: "movie", tmdbId: 603 })).toBe("movie:603");
    expect(requestedTitleKey({ mediaType: "series", tmdbId: 1399 })).toBe("tv:1399");
    expect(requestedTitleKey({ mediaType: "tv", tmdbId: 1399 })).toBe("tv:1399");
    expect(requestedTitleKey({ mediaType: "person", tmdbId: 1 })).toBeNull();
    expect(requestedTitleKey({ mediaType: "movie", tmdbId: 0 })).toBeNull();
    expect(requestedTitleKey({ mediaType: "movie", tmdbId: Number.NaN })).toBeNull();
  });

  it("pour le seul compte qui l'a demandé", async () => {
    expect(await hideRequestedTitle("u1", { mediaType: "movie", tmdbId: 603 })).toBe(true);
    const rows = await holder.db!.prisma.recommendationFeedback.findMany({ select: { jellyfinUserId: true, itemKey: true, action: true } });
    expect(rows).toEqual([{ jellyfinUserId: "u1", itemKey: "movie:603", action: REQUESTED_ACTION }]);
    // La page se reconstruit pour recombler la place.
    expect(pokePage).toHaveBeenCalledWith("u1", "feedback");
  });

  it("sans écraser un refus déjà posé, et sans reconstruction", async () => {
    await holder.db!.prisma.recommendationFeedback.create({ data: { jellyfinUserId: "u1", itemKey: "tv:1399", action: "not_interested" } });
    expect(await hideRequestedTitle("u1", { mediaType: "tv", tmdbId: 1399 })).toBe(false);
    expect(await holder.db!.prisma.recommendationFeedback.findMany({ select: { action: true } })).toEqual([{ action: "not_interested" }]);
    expect(pokePage).not.toHaveBeenCalled();
  });

  it("déjà masqué : rien de plus", async () => {
    expect(await hideRequestedTitle("u1", { mediaType: "tv", tmdbId: 1399 })).toBe(true);
    expect(await hideRequestedTitle("u1", { mediaType: "tv", tmdbId: 1399 })).toBe(false);
    expect(await holder.db!.prisma.recommendationFeedback.count()).toBe(1);
  });

  it("un titre illisible ou un compte vide n'écrivent rien", async () => {
    expect(await hideRequestedTitle("", { mediaType: "movie", tmdbId: 603 })).toBe(false);
    expect(await hideRequestedTitle("u1", { mediaType: "album", tmdbId: 603 })).toBe(false);
    expect(await holder.db!.prisma.recommendationFeedback.count()).toBe(0);
  });

  it("ne relit que les demandes du compte, jamais ses refus", async () => {
    await hideRequestedTitle("u1", { mediaType: "movie", tmdbId: 603 });
    await hideRequestedTitle("u2", { mediaType: "movie", tmdbId: 11 });
    await holder.db!.prisma.recommendationFeedback.create({ data: { jellyfinUserId: "u1", itemKey: "tv:1", action: "dismissed" } });
    expect(await requestedTitleKeys("u1")).toEqual(["movie:603"]);
  });
});
