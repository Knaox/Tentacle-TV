import { beforeEach, describe, expect, it, vi } from "vitest";
import { REQUESTED_ACTION, hideRequestedTitle, requestedTitleKey, requestedTitleKeys } from "./requestedTitles";

// vi.mock est remonté avant les imports : les doublures passent par vi.hoisted.
const { createMany, findMany, pokePage } = vi.hoisted(() => ({ createMany: vi.fn(), findMany: vi.fn(), pokePage: vi.fn() }));
vi.mock("../db", () => ({ getPrisma: () => ({ recommendationFeedback: { createMany, findMany } }) }));
vi.mock("./pageJobs", () => ({ pokePage: (...args: unknown[]) => pokePage(...args) }));


describe("un titre demandé sort des recommandations du compte", () => {
  beforeEach(() => {
    createMany.mockReset();
    findMany.mockReset();
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

  it("pour le seul compte qui l'a demandé, sans écraser un refus déjà posé", async () => {
    createMany.mockResolvedValue({ count: 1 });
    expect(await hideRequestedTitle("u1", { mediaType: "movie", tmdbId: 603 })).toBe(true);
    expect(createMany).toHaveBeenCalledWith({
      data: [{ jellyfinUserId: "u1", itemKey: "movie:603", action: REQUESTED_ACTION }],
      skipDuplicates: true,
    });
    // La page se reconstruit pour recombler la place.
    expect(pokePage).toHaveBeenCalledWith("u1", "feedback");
  });

  it("déjà masqué (ou déjà refusé) : rien de plus, aucune reconstruction", async () => {
    createMany.mockResolvedValue({ count: 0 });
    expect(await hideRequestedTitle("u1", { mediaType: "tv", tmdbId: 1399 })).toBe(false);
    expect(pokePage).not.toHaveBeenCalled();
  });

  it("un titre illisible ou un compte vide n'écrivent rien", async () => {
    expect(await hideRequestedTitle("", { mediaType: "movie", tmdbId: 603 })).toBe(false);
    expect(await hideRequestedTitle("u1", { mediaType: "album", tmdbId: 603 })).toBe(false);
    expect(createMany).not.toHaveBeenCalled();
  });

  it("ne relit que les demandes du compte, jamais ses refus", async () => {
    findMany.mockResolvedValue([{ itemKey: "movie:603" }]);
    expect(await requestedTitleKeys("u1")).toEqual(["movie:603"]);
    expect(findMany).toHaveBeenCalledWith({
      where: { jellyfinUserId: "u1", action: REQUESTED_ACTION },
      select: { itemKey: true },
    });
  });
});
