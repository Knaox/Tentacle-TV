/**
 * Les destinataires d'une arrivée : le demandeur (revendication active), sous
 * sa forme personnelle et sans attendre Jellyseerr ; les abonnés à tous les
 * ajouts, demandes des autres comprises ; personne d'autre. Et le registre :
 * ce qui vient d'être annoncé ne l'est pas deux fois, un épisode d'une saison
 * tout juste annoncée est absorbé, celui de la semaine suivante part.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 8, 24, 12);
const HOUR = 60 * 60_000;

const store = {
  devices: [] as Array<{ jellyfinUserId: string }>,
  claims: [] as Array<{ tmdbId: number; jellyfinUserId: string; title: string; mediaType: string; expiresAt: Date }>,
  prefs: [] as Array<{ jellyfinUserId: string; libraryAdded: boolean; seerAvailable: boolean; tickets: boolean }>,
  announced: [] as Array<{ jellyfinUserId: string; contentKey: string; notifiedAt: Date }>,
  langs: [] as Array<{ key: string; value: string }>,
};

vi.mock("./db", () => ({
  getPrisma: () => ({
    pushDevice: {
      findMany: async () => [...new Map(store.devices.map((d) => [d.jellyfinUserId, d])).values()],
    },
    contentClaim: {
      findMany: async (args: { where: { expiresAt: { gt: Date } } }) =>
        store.claims.filter((c) => c.expiresAt > args.where.expiresAt.gt),
    },
    notificationPreference: {
      findMany: async (args: { where: { jellyfinUserId: { in: string[] } } }) =>
        store.prefs.filter((p) => args.where.jellyfinUserId.in.includes(p.jellyfinUserId)),
    },
    announcedContent: {
      findMany: async (args: {
        where: { jellyfinUserId: string; contentKey: { in: string[] }; notifiedAt?: { gte: Date } };
      }) =>
        store.announced.filter(
          (a) =>
            a.jellyfinUserId === args.where.jellyfinUserId &&
            args.where.contentKey.in.includes(a.contentKey) &&
            (!args.where.notifiedAt || a.notifiedAt >= args.where.notifiedAt.gte),
        ),
    },
    serverConfig: {
      findMany: async (args: { where: { key: { in: string[] } } }) =>
        store.langs.filter((l) => args.where.key.in.includes(l.key)),
    },
  }),
}));

import type { LibItem } from "./jellyfinLibrary";
import { planRecipients } from "./libraryAddedRecipients";

const dune: LibItem = { Id: "m-dune", Name: "Dune", Type: "Movie", tmdbId: 438631 };
const heat: LibItem = { Id: "m-heat", Name: "Heat", Type: "Movie", tmdbId: 949 };
const bear = (e: number, s = 2): LibItem => ({
  Id: `bear-${s}-${e}`,
  Name: `Épisode ${e}`,
  Type: "Episode",
  SeriesName: "The Bear",
  SeriesId: "series-bear",
  seriesTmdbId: 136315,
  ParentIndexNumber: s,
  IndexNumber: e,
});
const claim = (userId: string, tmdbId: number, title: string, expiresIn = HOUR, mediaType = "movie") => ({
  tmdbId,
  jellyfinUserId: userId,
  title,
  mediaType,
  expiresAt: new Date(NOW + expiresIn),
});
const showClaim = (userId: string, tmdbId: number, title: string) => claim(userId, tmdbId, title, HOUR, "tv");
const pref = (userId: string, libraryAdded: boolean, seerAvailable = true) => ({
  jellyfinUserId: userId,
  libraryAdded,
  seerAvailable,
  tickets: true,
});
const byUser = (plans: Awaited<ReturnType<typeof planRecipients>>) => new Map(plans.map((p) => [p.userId, p]));
const ids = (items: LibItem[]) => items.map((i) => i.Id);

beforeEach(() => {
  store.devices = ["alice", "bob", "carol"].map((jellyfinUserId) => ({ jellyfinUserId }));
  store.claims = [];
  store.prefs = [];
  store.announced = [];
  store.langs = [];
});

describe("qui reçoit une arrivée", () => {
  it("le demandeur reçoit sa demande, et lui seul", async () => {
    store.claims = [claim("alice", 438631, "Dune")];
    store.prefs = [pref("alice", false, true)];
    const plans = byUser(await planRecipients([dune], NOW));
    expect(ids(plans.get("alice")!.requested)).toEqual(["m-dune"]);
    expect(plans.has("bob")).toBe(false);
    expect(plans.has("carol")).toBe(false);
  });

  it("l'abonné à tous les ajouts reçoit AUSSI la demande d'un autre", async () => {
    store.claims = [claim("alice", 438631, "Dune")];
    store.prefs = [pref("alice", false, true), pref("bob", true)];
    const plans = byUser(await planRecipients([dune], NOW));
    expect(ids(plans.get("alice")!.requested)).toEqual(["m-dune"]);
    expect(ids(plans.get("bob")!.others)).toEqual(["m-dune"]);
    expect(plans.get("bob")!.requested).toEqual([]);
  });

  it("un demandeur abonné à tout reçoit sa demande une fois, sous sa forme personnelle", async () => {
    store.claims = [claim("alice", 438631, "Dune")];
    store.prefs = [pref("alice", true)];
    const plan = byUser(await planRecipients([dune, heat], NOW)).get("alice")!;
    expect(ids(plan.requested)).toEqual(["m-dune"]);
    expect(ids(plan.others)).toEqual(["m-heat"]);
  });

  it("sans ligne de préférences, le demandeur est prévenu : c'est le défaut", async () => {
    store.claims = [claim("alice", 438631, "Dune")];
    const plans = byUser(await planRecipients([dune], NOW));
    expect(ids(plans.get("alice")!.requested)).toEqual(["m-dune"]);
  });

  it("« demandé disponible » coupé et rien d'autre : silence", async () => {
    store.claims = [claim("alice", 438631, "Dune")];
    store.prefs = [pref("alice", false, false)];
    expect(await planRecipients([dune], NOW)).toEqual([]);
  });

  it("une revendication expirée ne désigne plus personne", async () => {
    store.claims = [claim("alice", 438631, "Dune", -1)];
    expect(await planRecipients([dune], NOW)).toEqual([]);
  });

  it("un épisode se rattache à la demande par le TMDB de sa série", async () => {
    store.claims = [showClaim("alice", 136315, "The Bear")];
    store.prefs = [pref("alice", false, true)];
    const plan = byUser(await planRecipients([bear(1)], NOW)).get("alice")!;
    expect(ids(plan.requested)).toEqual(["bear-2-1"]);
  });

  it("un film demandé au même numéro TMDB qu'une série n'est pas cette série", async () => {
    // TMDB numérote films et séries dans deux espaces qui se chevauchent.
    store.claims = [claim("alice", 136315, "Un film")];
    store.prefs = [pref("alice", false, true)];
    expect(await planRecipients([bear(1)], NOW)).toEqual([]);
  });

  it("une série demandée se reconnaît à son nom quand son TMDB manque", async () => {
    store.claims = [showClaim("alice", 1, "The Bear")];
    store.prefs = [pref("alice", false, true)];
    const plan = byUser(await planRecipients([{ ...bear(1), seriesTmdbId: undefined }], NOW)).get("alice")!;
    expect(ids(plan.requested)).toEqual(["bear-2-1"]);
  });

  it("sans appareil inscrit, personne", async () => {
    store.devices = [];
    store.claims = [claim("alice", 438631, "Dune")];
    expect(await planRecipients([dune], NOW)).toEqual([]);
  });

  it("la langue suit le choix de l'utilisateur", async () => {
    store.claims = [claim("alice", 438631, "Dune")];
    store.prefs = [pref("alice", false, true)];
    store.langs = [{ key: "user_lang_alice", value: "en" }];
    expect(byUser(await planRecipients([dune], NOW)).get("alice")!.lang).toBe("en");
  });
});

describe("ce qui vient d'être annoncé", () => {
  it("un film déjà annoncé il y a moins de 48 h (pipeline Seer) ne repart pas", async () => {
    store.claims = [claim("alice", 438631, "Dune")];
    store.prefs = [pref("alice", false, true)];
    store.announced = [{ jellyfinUserId: "alice", contentKey: "m:t:438631", notifiedAt: new Date(NOW - HOUR) }];
    expect(await planRecipients([dune], NOW)).toEqual([]);
  });

  it("un épisode d'une saison annoncée il y a 2 h est absorbé (saison rangée en plusieurs fois)", async () => {
    store.prefs = [pref("bob", true)];
    store.announced = [{ jellyfinUserId: "bob", contentKey: "s:t:136315:2", notifiedAt: new Date(NOW - 2 * HOUR) }];
    const plan = byUser(await planRecipients([bear(4)], NOW)).get("bob")!;
    expect(plan.others).toEqual([]);
    expect(ids(plan.absorbed)).toEqual(["bear-2-4"]);
  });

  it("l'épisode de la semaine suivante part (diffusion hebdomadaire)", async () => {
    store.prefs = [pref("bob", true)];
    store.announced = [
      { jellyfinUserId: "bob", contentKey: "s:t:136315:2", notifiedAt: new Date(NOW - 7 * 24 * HOUR) },
      { jellyfinUserId: "bob", contentKey: "e:t:136315:2:1", notifiedAt: new Date(NOW - 7 * 24 * HOUR) },
    ];
    const plan = byUser(await planRecipients([bear(2)], NOW)).get("bob")!;
    expect(ids(plan.others)).toEqual(["bear-2-2"]);
  });

  it("les épisodes d'un même lot partent ensemble", async () => {
    store.prefs = [pref("bob", true)];
    const plan = byUser(await planRecipients([bear(1), bear(2), bear(3)], NOW)).get("bob")!;
    expect(ids(plan.others)).toEqual(["bear-2-1", "bear-2-2", "bear-2-3"]);
  });
});
