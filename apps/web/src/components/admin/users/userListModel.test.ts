import { describe, expect, it } from "vitest";
import {
  absoluteTime,
  countActiveSince,
  countByFilter,
  groupByUser,
  relativeTime,
  sameUserId,
  visibleUsers,
  type AdminUser,
} from "./userListModel";

/**
 * La liste des comptes de l'administration : ce qui s'affiche, dans quel
 * ordre, et comment se dit « la dernière fois ».
 */

const user = (over: Partial<AdminUser> & { name: string }): AdminUser => ({
  id: over.name.toLowerCase(),
  hasAvatar: false,
  lastActivityDate: null,
  isAdministrator: false,
  isDisabled: false,
  ...over,
});

const USERS: AdminUser[] = [
  user({ name: "zoé", lastActivityDate: "2026-09-20T10:00:00Z" }),
  user({ name: "Jean-Luc", isAdministrator: true, lastActivityDate: "2026-09-26T09:00:00Z" }),
  user({ name: "Émile", isDisabled: true }),
  user({ name: "Admin", isAdministrator: true, isDisabled: true, lastActivityDate: "2026-09-01T00:00:00Z" }),
  user({ name: "bruno", lastActivityDate: "pas une date" }),
];

const fr = new Intl.Collator("fr", { sensitivity: "base", numeric: true });
const names = (list: AdminUser[]) => list.map((u) => u.name);

describe("visibleUsers", () => {
  it("trie par nom selon la langue : accents et casse ne déplacent personne", () => {
    expect(names(visibleUsers(USERS, { query: "", filter: "all", sort: "name" }, fr))).toEqual([
      "Admin", "bruno", "Émile", "Jean-Luc", "zoé",
    ]);
  });

  it("trie par activité : la plus récente d'abord, « jamais » et l'illisible en dernier, départagés par le nom", () => {
    expect(names(visibleUsers(USERS, { query: "", filter: "all", sort: "activity" }, fr))).toEqual([
      "Jean-Luc", "zoé", "Admin", "bruno", "Émile",
    ]);
  });

  it("trie par rôle : les admins actifs, puis les admins désactivés, puis les autres", () => {
    expect(names(visibleUsers(USERS, { query: "", filter: "all", sort: "role" }, fr))).toEqual([
      "Jean-Luc", "Admin", "bruno", "zoé", "Émile",
    ]);
  });

  it("filtre, et cherche comme partout ailleurs : « jean luc » retrouve « Jean-Luc », « emile » retrouve « Émile »", () => {
    expect(names(visibleUsers(USERS, { query: "", filter: "admins", sort: "name" }, fr))).toEqual(["Admin", "Jean-Luc"]);
    expect(names(visibleUsers(USERS, { query: "", filter: "disabled", sort: "name" }, fr))).toEqual(["Admin", "Émile"]);
    expect(names(visibleUsers(USERS, { query: "jean luc", filter: "all", sort: "name" }, fr))).toEqual(["Jean-Luc"]);
    expect(names(visibleUsers(USERS, { query: "  emile ", filter: "disabled", sort: "name" }, fr))).toEqual(["Émile"]);
    expect(visibleUsers(USERS, { query: "emile", filter: "admins", sort: "name" }, fr)).toEqual([]);
  });

  it("ne touche pas à la liste reçue — c'est le cache de la requête", () => {
    const before = names(USERS);
    visibleUsers(USERS, { query: "", filter: "all", sort: "activity" }, fr);
    expect(names(USERS)).toEqual(before);
  });
});

describe("countByFilter", () => {
  it("compte chaque filtre — un admin désactivé compte des deux côtés", () => {
    expect(countByFilter(USERS)).toEqual({ all: 5, admins: 2, disabled: 2 });
    expect(countByFilter([])).toEqual({ all: 0, admins: 0, disabled: 0 });
  });
});

describe("countActiveSince", () => {
  it("compte les comptes vus depuis l'instant donné — une date illisible ou absente n'en est pas", () => {
    expect(countActiveSince(USERS, Date.parse("2026-09-19T00:00:00Z"))).toBe(2);
    expect(countActiveSince(USERS, Date.parse("2026-09-26T00:00:00Z"))).toBe(1);
    expect(countActiveSince(USERS, 0)).toBe(3);
  });
});

describe("identifiants de compte", () => {
  it("compare la forme nue : tirets et casse varient selon l'appelant Jellyfin", () => {
    expect(sameUserId("B52628A7-0430-4F06-A682-F6037183B976", "b52628a704304f06a682f6037183b976")).toBe(true);
    expect(sameUserId("a1", "a2")).toBe(false);
    expect(sameUserId(null, "a1")).toBe(false);
  });

  it("regroupe les appareils par compte, quelle que soit la graphie de l'identifiant", () => {
    const devices = [
      { id: "d1", jellyfinUserId: "AB-CD" },
      { id: "d2", jellyfinUserId: "abcd" },
      { id: "d3", jellyfinUserId: "ef" },
    ];
    const grouped = groupByUser(devices, (d) => d.jellyfinUserId);
    expect(grouped.get("abcd")?.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(grouped.get("ef")?.map((d) => d.id)).toEqual(["d3"]);
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-09-26T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it("dit le temps écoulé à la bonne échelle", () => {
    expect(relativeTime(ago(20_000), now, "fr")).toBe("maintenant");
    expect(relativeTime(ago(5 * MIN), now, "fr")).toBe("il y a 5 minutes");
    expect(relativeTime(ago(3 * HOUR), now, "fr")).toBe("il y a 3 heures");
    expect(relativeTime(ago(DAY + HOUR), now, "fr")).toBe("hier");
    expect(relativeTime(ago(10 * DAY), now, "fr")).toBe("la semaine dernière");
    expect(relativeTime(ago(21 * DAY), now, "fr")).toBe("il y a 3 semaines");
    expect(relativeTime(ago(95 * DAY), now, "fr")).toBe("il y a 3 mois");
    expect(relativeTime(ago(800 * DAY), now, "fr")).toBe("il y a 2 ans");
    expect(relativeTime(ago(3 * HOUR), now, "en")).toBe("3 hours ago");
  });

  it("une date à venir (horloges décalées) vaut « maintenant », une date absente ou illisible ne dit rien", () => {
    expect(relativeTime(new Date(now + 90_000).toISOString(), now, "fr")).toBe("maintenant");
    expect(relativeTime(null, now, "fr")).toBeNull();
    expect(relativeTime(undefined, now, "fr")).toBeNull();
    expect(relativeTime("pas une date", now, "fr")).toBeNull();
  });

  it("lit les dates de Jellyfin, à sept décimales", () => {
    expect(relativeTime("2026-09-26T09:00:00.0000000Z", now, "fr")).toBe("il y a 3 heures");
    expect(absoluteTime("2026-09-26T09:00:00.0000000Z", "fr")).toContain("2026");
    expect(absoluteTime(null, "fr")).toBeNull();
  });
});
