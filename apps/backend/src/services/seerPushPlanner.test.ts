/**
 * Le planificateur des annonces de disponibilité Seer (le filet derrière le
 * notifier bibliothèque) : rien pour ce qui n'est pas une disponibilité, un
 * report tant que Jellyfin n'a pas le contenu, chaque saison à son arrivée,
 * et les saisons de CE push remontées pour composer le texte anglais.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const announced = new Set<string>();
let presence: "present" | "absent" | "unknown" = "present";
let seasonsInJellyfin = new Set<number>();

vi.mock("./announcedRegistry", async () => {
  const actual = await vi.importActual<typeof import("./announcedRegistry")>("./announcedRegistry");
  return {
    ...actual,
    isAnnounced: async (_user: string, keys: string[]) => keys.some((k) => announced.has(k)),
    filterAnnounced: async (_user: string, keySets: string[][]) => keySets.map((ks) => ks.some((k) => announced.has(k))),
  };
});

vi.mock("./seerAvailabilityGuard", async () => {
  const actual = await vi.importActual<typeof import("./seerAvailabilityGuard")>("./seerAvailabilityGuard");
  return {
    ...actual,
    resolveSeerContent: async (n: { title: string }) =>
      n.title === "The Bear"
        ? { tmdbId: 136315, mediaType: "tv", title: n.title }
        : { tmdbId: 438631, mediaType: "movie", title: n.title },
    checkJellyfinPresence: async () => presence,
    checkSeasonsPresence: async (_c: unknown, seasons: number[]) => new Set(seasons.filter((s) => seasonsInJellyfin.has(s))),
  };
});

import { englishAvailabilityBody, planSeerAvailabilityPush } from "./seerPushPlanner";

const notif = (title: string, body: string) => ({ jellyfinUserId: "alice", type: "request_status", title, body, refId: "r1" });

beforeEach(() => {
  announced.clear();
  presence = "present";
  seasonsInJellyfin = new Set();
});

describe("planificateur des disponibilités", () => {
  it("pas une disponibilité : pas de plan", async () => {
    expect(await planSeerAvailabilityPush(notif("Dune", "« Dune » est en cours de téléchargement"), [])).toBeNull();
  });

  it("film absent de Jellyfin : report", async () => {
    presence = "absent";
    const plan = await planSeerAvailabilityPush(notif("Dune", "« Dune » est sorti sur Tentacle TV"), []);
    expect(plan?.action).toBe("defer");
  });

  it("film déjà annoncé par la bibliothèque : rien", async () => {
    announced.add("m:t:438631");
    const plan = await planSeerAvailabilityPush(notif("Dune", "« Dune » est sorti sur Tentacle TV"), []);
    expect(plan?.action).toBe("skip");
  });

  it("saisons : seule la saison arrivée part, la ligne reste en attente de l'autre", async () => {
    seasonsInJellyfin = new Set([1]);
    const plan = await planSeerAvailabilityPush(notif("The Bear", "Saisons 1, 2 sont sorties sur Tentacle TV"), []);
    expect(plan).toMatchObject({ action: "push", complete: false, seasons: [1], body: "Saison 1 est sortie sur Tentacle TV" });
  });

  it("saison déjà couverte par l'annonce des épisodes : rien", async () => {
    announced.add("s:t:136315:2");
    const plan = await planSeerAvailabilityPush(notif("The Bear", "Saison 2 est sortie sur Tentacle TV"), []);
    expect(plan?.action).toBe("skip");
  });
});

describe("texte anglais", () => {
  it("film ou série entière, une saison, plusieurs", () => {
    expect(englishAvailabilityBody([])).toBe("Now on Tentacle TV");
    expect(englishAvailabilityBody([2])).toBe("Season 2 is now on Tentacle TV");
    expect(englishAvailabilityBody([3, 1])).toBe("Seasons 1, 3 are now on Tentacle TV");
  });
});
