import { describe, expect, it } from "vitest";
import {
  RAIL_SETUP_MAX_WAIT_MS, decideRailSetup, railLayoutFromSetup, railSetupTargetIds, settleRailSetup, type RailSetupInput,
} from "./railSetup";

const base: RailSetupInput = { identity: "alice", setupDone: false, libraries: 3, online: true };

describe("decideRailSetup", () => {
  it("proposée : pas faite, au moins deux bibliothèques, en ligne", () => {
    expect(decideRailSetup(base)).toBe("show");
    expect(decideRailSetup({ ...base, libraries: 2 })).toBe("show");
  });

  it("déjà faite, ou sans session : rien", () => {
    expect(decideRailSetup({ ...base, setupDone: true })).toBe("skip");
    expect(decideRailSetup({ ...base, identity: null })).toBe("skip");
  });

  it("une seule bibliothèque (ou aucune) : rien à choisir", () => {
    expect(decideRailSetup({ ...base, libraries: 1 })).toBe("skip");
    expect(decideRailSetup({ ...base, libraries: 0 })).toBe("skip");
  });

  it("hors ligne, ou bibliothèques illisibles : pas maintenant", () => {
    expect(decideRailSetup({ ...base, online: false })).toBe("skip");
    expect(decideRailSetup({ ...base, libraries: "failed" })).toBe("skip");
  });

  it("bibliothèques pas encore lues : on attend, jusqu'à la borne", () => {
    expect(decideRailSetup({ ...base, libraries: null })).toBe("wait");
    expect(decideRailSetup({ ...base, libraries: null, waitedMs: RAIL_SETUP_MAX_WAIT_MS - 1 })).toBe("wait");
    expect(decideRailSetup({ ...base, libraries: null, waitedMs: RAIL_SETUP_MAX_WAIT_MS })).toBe("skip");
  });

  it("déjà faite l'emporte sur l'attente : l'accueil ne patiente pas pour rien", () => {
    expect(decideRailSetup({ ...base, libraries: null, setupDone: true })).toBe("skip");
  });
});

describe("settleRailSetup", () => {
  it("l'attente se tranche dès qu'on sait", () => {
    const waiting = settleRailSetup(null, { ...base, libraries: null });
    expect(waiting.status).toBe("wait");
    expect(settleRailSetup(waiting, base).status).toBe("show");
  });

  it("tranché « skip » : une bibliothèque arrivée en retard ne fait pas surgir la page", () => {
    const skipped = settleRailSetup(null, { ...base, libraries: 1 });
    expect(settleRailSetup(skipped, base)).toBe(skipped);
    const offline = settleRailSetup(null, { ...base, online: false });
    expect(settleRailSetup(offline, base).status).toBe("skip");
  });

  it("tranché « show » : la page reste, jusqu'à la préconfiguration faite", () => {
    const shown = settleRailSetup(null, base);
    expect(settleRailSetup(shown, { ...base, online: false }).status).toBe("show");
    expect(settleRailSetup(shown, { ...base, setupDone: true }).status).toBe("skip");
  });

  it("une autre identité recommence tout", () => {
    const skipped = settleRailSetup(null, { ...base, setupDone: true });
    expect(settleRailSetup(skipped, { ...base, identity: "bob" })).toEqual({ identity: "bob", status: "show" });
  });
});

describe("railLayoutFromSetup", () => {
  const catalog = ["Recommendations", "Library_a", "Watchlist", "Library_b", "Favorites", "Library_c"];
  const offered = ["Library_a", "Library_b", "Library_c"];

  it("les gardées prennent les places des proposées, dans l'ordre choisi ; le reste ne bouge pas", () => {
    const layout = railLayoutFromSetup({ masquees: [], order: [] }, catalog, { offered, pinned: ["Library_c", "Library_a"] });
    expect(layout.order).toEqual(["Recommendations", "Library_c", "Watchlist", "Library_a", "Favorites", "Library_b"]);
    expect(layout.masquees).toEqual(["Library_b"]);
  });

  it("les entrées masquées hors de la page le restent ; les proposées suivent le choix", () => {
    const layout = railLayoutFromSetup({ masquees: ["Watchlist", "Library_a"], order: [] }, catalog, { offered, pinned: ["Library_a", "Library_b"] });
    expect(layout.masquees).toEqual(["Watchlist", "Library_c"]);
  });

  it("doublons et clés étrangères du choix : ignorés", () => {
    const layout = railLayoutFromSetup({ masquees: [], order: [] }, catalog, { offered, pinned: ["Library_b", "Library_b", "Nope"] });
    expect(layout.order).toEqual(["Recommendations", "Library_b", "Watchlist", "Library_a", "Favorites", "Library_c"]);
    expect(layout.masquees).toEqual(["Library_a", "Library_c"]);
  });

  it("une proposée absente du catalogue se range à la suite", () => {
    const layout = railLayoutFromSetup({ masquees: [], order: [] }, ["Recommendations"], { offered: ["Library_a"], pinned: ["Library_a"] });
    expect(layout.order).toEqual(["Recommendations", "Library_a"]);
  });
});

describe("railSetupTargetIds", () => {
  const family = [
    { userId: "owner", kind: "owner" as const },
    { userId: "member", kind: "member" as const },
    { userId: "guest", kind: "guest" as const },
  ];

  it("le propriétaire : tous les autres profils de la famille", () => {
    expect(railSetupTargetIds(family, "owner")).toEqual(["member", "guest"]);
  });

  it("un membre, un invité, un inconnu : personne", () => {
    expect(railSetupTargetIds(family, "member")).toEqual([]);
    expect(railSetupTargetIds(family, "guest")).toEqual([]);
    expect(railSetupTargetIds(family, "stranger")).toEqual([]);
  });

  it("sans famille, sans session, ou seul : personne", () => {
    expect(railSetupTargetIds(null, "owner")).toEqual([]);
    expect(railSetupTargetIds(family, null)).toEqual([]);
    expect(railSetupTargetIds([family[0]], "owner")).toEqual([]);
  });
});
