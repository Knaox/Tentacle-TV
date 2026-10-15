import { describe, expect, it } from "vitest";
import { applyRailOrder } from "./railOrder";
import { RAIL_STORAGE_KEY, type RailStorage } from "./railPinning";
import { createProfileRailStore } from "./railProfileStore";
import { decideRailSetup, railLayoutFromSetup, railSetupTargetIds } from "./railSetup";

/**
 * De bout en bout, sans écran : une TV mise à jour, un propriétaire qui fait
 * sa préconfiguration et l'applique, un membre qui ouvre son profil ensuite.
 */

function fakeStorage(initial: Record<string, string>): RailStorage {
  const content = new Map(Object.entries(initial));
  return { getItem: (key) => content.get(key) ?? null, setItem: (key, value) => void content.set(key, value) };
}

const family = [
  { userId: "owner", kind: "owner" as const },
  { userId: "member", kind: "member" as const },
  { userId: "guest", kind: "guest" as const },
];

/** Le rail tel que le catalogue le rangerait : l'ordre choisi, sans les masquées. */
function visibleRail(keys: readonly string[], layout: { masquees: string[]; order: string[] }): string[] {
  return applyRailOrder(keys, layout.order, (key) => key).filter((key) => !layout.masquees.includes(key));
}

describe("préconfiguration du rail — parcours complet", () => {
  it("mise à jour → préconfiguration du propriétaire → appliquée → le membre la retrouve, sans page", () => {
    // Avant la mise à jour : une disposition d'appareil, Musique masquée.
    let who: string | null = "owner";
    const store = createProfileRailStore(fakeStorage({ [RAIL_STORAGE_KEY]: '{"masquees":["Library_music"]}' }), () => who);
    const ownerKeys = ["Recommendations", "Watchlist", "Favorites", "Library_movies", "Library_shows", "Library_music"];

    // Rien ne bouge au premier lancement : la disposition héritée, la page proposée.
    expect(visibleRail(ownerKeys, store.readSnapshot())).not.toContain("Library_music");
    expect(decideRailSetup({ identity: who, setupDone: store.readSnapshot().setupDone, libraries: 3, online: true })).toBe("show");

    // La page : Séries d'abord, Films ensuite, Musique écartée.
    const choice = railLayoutFromSetup(store.readSnapshot(), ownerKeys, {
      offered: ["Library_movies", "Library_shows", "Library_music"],
      pinned: ["Library_shows", "Library_movies"],
    });
    store.completeSetup("owner", choice);
    expect(visibleRail(ownerKeys, store.readSnapshot())).toEqual(["Recommendations", "Watchlist", "Favorites", "Library_shows", "Library_movies"]);
    expect(decideRailSetup({ identity: who, setupDone: store.readSnapshot().setupDone, libraries: 3, online: true })).toBe("skip");

    // Appliquée aux autres profils de la famille.
    const targets = railSetupTargetIds(family, "owner");
    store.applyLayoutTo("owner", targets);

    // Le membre ouvre son profil : il ne voit pas « Films » (pas le droit) — sa clé s'ignore ; pas de page.
    who = "member";
    store.syncIdentity();
    const memberKeys = ["Recommendations", "Watchlist", "Favorites", "Library_shows", "Library_kids"];
    expect(visibleRail(memberKeys, store.readSnapshot())).toEqual(["Recommendations", "Watchlist", "Favorites", "Library_shows", "Library_kids"]);
    expect(decideRailSetup({ identity: who, setupDone: store.readSnapshot().setupDone, libraries: 2, online: true })).toBe("skip");

    // Le membre ne peut rien appliquer, et ses gestes restent les siens.
    expect(railSetupTargetIds(family, "member")).toEqual([]);
    store.toggle("Library_kids");
    who = "owner";
    store.syncIdentity();
    expect(store.readSnapshot().masquees).not.toContain("Library_kids");
  });

  it("un profil à une seule bibliothèque n'est pas marqué : proposé le jour où il en a deux", () => {
    const store = createProfileRailStore(fakeStorage({}), () => "solo");
    expect(decideRailSetup({ identity: "solo", setupDone: store.readSnapshot().setupDone, libraries: 1, online: true })).toBe("skip");
    expect(store.readSnapshot().setupDone).toBe(false);
    expect(decideRailSetup({ identity: "solo", setupDone: store.readSnapshot().setupDone, libraries: 2, online: true })).toBe("show");
  });
});
