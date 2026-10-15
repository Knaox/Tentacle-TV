import { describe, expect, it } from "vitest";
import { USER_RIGHTS_FIELDS, USER_RIGHTS_KEYS, type UserRightsOptions } from "./userRightsContract";
import { normalizeJellyfinId, parseUserRightsPatch, patchAgainstOptions } from "./userRightsPatch";
import { USER_RIGHTS_ROUTES, userRightsPath } from "./userRightsRoutes";

const LIB = "f137a2dd21bbc1b99aa5c0f6bf02a805";
const CHANNEL = "0a1b2c3d4e5f60718293a4b5c6d7e8f9";

const OPTIONS: UserRightsOptions = {
  libraries: [{ id: LIB, name: "Films", collectionType: "movies" }],
  channels: [{ id: CHANNEL, name: "Chaîne" }],
  parentalRatings: [
    { name: "FR-10", score: 10, subScore: null },
    { name: "FR-12", score: 12, subScore: null },
  ],
  unratedItemTypes: ["Movie", "Series"],
  knownTags: [],
};

describe("le contrat des droits", () => {
  it("chaque champ nomme un champ distinct de la UserPolicy", () => {
    const names = USER_RIGHTS_KEYS.map((key) => USER_RIGHTS_FIELDS[key].jellyfin);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[A-Z][A-Za-z]+$/);
  });

  it("une liste de dossiers dit dans quoi elle choisit, un enum ses valeurs", () => {
    for (const key of USER_RIGHTS_KEYS) {
      const spec: { kind: string; among?: string; values?: readonly string[] } = USER_RIGHTS_FIELDS[key];
      if (spec.kind === "folderList") expect(spec.among).toBeDefined();
      if (spec.kind === "enum") expect(spec.values?.length).toBeGreaterThan(0);
    }
  });

  it("les routes sont celles du carnet", () => {
    expect(userRightsPath("read", { userId: "abc" })).toBe("/api/admin/users/abc/rights");
    expect(USER_RIGHTS_ROUTES.update.method).toBe("PATCH");
    expect(USER_RIGHTS_ROUTES.options.path).toBe("/api/admin/users/rights/options");
    expect(() => userRightsPath("read")).toThrow();
  });
});

describe("parseUserRightsPatch", () => {
  it("accepte un correctif valide et le met en forme", () => {
    const result = parseUserRightsPatch({
      isDisabled: true,
      maxParentalRating: null,
      blockedTags: [" horreur ", "horreur"],
      enabledFolders: ["F137A2DD-21BB-C1B9-9AA5-C0F6BF02A805"],
      syncPlayAccess: "JoinGroups",
      accessSchedules: [{ dayOfWeek: "Weekday", startHour: 8, endHour: 20.5 }],
    });
    expect(result).toEqual({
      ok: true,
      patch: {
        isDisabled: true,
        maxParentalRating: null,
        blockedTags: ["horreur"],
        enabledFolders: [LIB],
        syncPlayAccess: "JoinGroups",
        accessSchedules: [{ dayOfWeek: "Weekday", startHour: 8, endHour: 20.5 }],
      },
    });
  });

  it("refuse un corps vide, une clé inconnue, sans la nommer", () => {
    expect(parseUserRightsPatch({})).toEqual({ ok: false, fields: [] });
    expect(parseUserRightsPatch([])).toEqual({ ok: false, fields: [] });
    expect(parseUserRightsPatch({ isDisabled: true, AuthenticationProviderId: "x" })).toEqual({ ok: false, fields: [] });
  });

  it("nomme chaque clé dont la valeur est refusée", () => {
    const result = parseUserRightsPatch({
      isAdministrator: "true",
      maxActiveSessions: -1,
      remoteClientBitrateLimit: 1.5,
      maxParentalSubRating: null,
      loginAttemptsBeforeLockout: null,
      syncPlayAccess: "All",
      blockUnratedItems: ["Movie", "Porn"],
      blockedTags: ["a\nb"],
      enabledChannels: ["pas-un-guid"],
      accessSchedules: [{ dayOfWeek: "Monday", startHour: 20, endHour: 8 }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.sort()).toEqual(
        [
          "isAdministrator",
          "maxActiveSessions",
          "remoteClientBitrateLimit",
          "loginAttemptsBeforeLockout",
          "syncPlayAccess",
          "blockUnratedItems",
          "blockedTags",
          "enabledChannels",
          "accessSchedules",
        ].sort(),
      );
    }
  });

  it("refuse une plage horaire avec un champ de trop", () => {
    const result = parseUserRightsPatch({ accessSchedules: [{ dayOfWeek: "Monday", startHour: 1, endHour: 2, Id: 3 }] });
    expect(result).toEqual({ ok: false, fields: ["accessSchedules"] });
  });
});

describe("patchAgainstOptions", () => {
  it("laisse passer ce qui existe dans Jellyfin", () => {
    expect(patchAgainstOptions({ enabledFolders: [LIB], enabledChannels: [CHANNEL], maxParentalRating: 12 }, OPTIONS)).toEqual([]);
  });

  it("refuse une bibliothèque, un canal ou une note inconnus", () => {
    expect(
      patchAgainstOptions(
        {
          enabledFolders: [CHANNEL],
          enableContentDeletionFromFolders: [LIB, CHANNEL],
          enabledChannels: [LIB],
          maxParentalRating: 11,
          maxParentalSubRating: 1,
        },
        OPTIONS,
      ).sort(),
    ).toEqual(["enableContentDeletionFromFolders", "enabledChannels", "enabledFolders", "maxParentalRating", "maxParentalSubRating"]);
  });

  it("compare les identifiants normalisés", () => {
    expect(normalizeJellyfinId("AB-CD")).toBe("abcd");
  });
});
