/**
 * La livraison push des lignes de la cloche. Pour une demande, seule
 * l'annonce de DISPONIBILITÉ part — et pas si le notifier bibliothèque l'a
 * déjà faite à l'arrivée dans Jellyfin. « En cours de téléchargement »,
 * refus, échec : la cloche seule. Les tickets passent comme avant, et chaque
 * ligne balayée est marquée pour ne pas repasser.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Notif {
  id: string;
  jellyfinUserId: string;
  type: string;
  title: string;
  body: string | null;
  refId: string | null;
  createdAt: Date;
  pushedAt: Date | null;
}

const store = {
  notifications: [] as Notif[],
  announced: [] as Array<{ contentKey: string; jellyfinUserId: string }>,
  langs: [] as Array<{ key: string; value: string }>,
  marked: [] as string[],
};
const sendToUser = vi.fn(async (_userId: string, _payload: { title: string; body: string }) => ({ sent: 1, invalid: 0 }));

vi.mock("./db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    notification: {
      findMany: async () => store.notifications.filter((n) => n.pushedAt === null),
      updateMany: async (args: { where: { id: { in: string[] } } }) => {
        store.marked.push(...args.where.id.in);
        return { count: args.where.id.in.length };
      },
    },
    notificationPreference: {
      findMany: async () => [
        { jellyfinUserId: "alice", libraryAdded: false, seerAvailable: true, tickets: true },
        { jellyfinUserId: "eve", libraryAdded: false, seerAvailable: true, tickets: true },
      ],
    },
    serverConfig: {
      findMany: async (args: { where: { key: { in: string[] } } }) =>
        store.langs.filter((l) => args.where.key.in.includes(l.key)),
    },
    contentClaim: {
      findMany: async () => [
        { jellyfinUserId: "alice", tmdbId: 438631, title: "Dune", mediaType: "movie" },
        { jellyfinUserId: "eve", tmdbId: 438631, title: "Dune", mediaType: "movie" },
      ],
    },
    announcedContent: {
      findFirst: async (args: { where: { jellyfinUserId: string; contentKey: { in: string[] } } }) =>
        store.announced.find(
          (a) => a.jellyfinUserId === args.where.jellyfinUserId && args.where.contentKey.in.includes(a.contentKey),
        ) ?? null,
      findMany: async (args: { where: { jellyfinUserId: string; contentKey: { in: string[] } } }) =>
        store.announced.filter(
          (a) => a.jellyfinUserId === args.where.jellyfinUserId && args.where.contentKey.in.includes(a.contentKey),
        ),
      createMany: async (args: { data: Array<{ contentKey: string; jellyfinUserId: string }> }) => {
        store.announced.push(...args.data);
        return { count: args.data.length };
      },
    },
  }),
}));

vi.mock("./pushService", () => ({
  sendToUser: (userId: string, payload: { title: string; body: string }) => sendToUser(userId, payload),
}));

vi.mock("./seerAvailabilityGuard", async () => {
  const actual = await vi.importActual<typeof import("./seerAvailabilityGuard")>("./seerAvailabilityGuard");
  return {
    ...actual,
    resolveSeerContent: async (n: { title: string }) => ({ tmdbId: 438631, mediaType: "movie", title: n.title }),
    checkJellyfinPresence: async () => "present" as const,
  };
});

import { deliverPendingNotifications } from "./notificationPushWorker";

let seq = 0;
function row(jellyfinUserId: string, type: string, title: string, body: string): Notif {
  seq += 1;
  return { id: `n${seq}`, jellyfinUserId, type, title, body, refId: `req${seq}`, createdAt: new Date(), pushedAt: null };
}

beforeEach(() => {
  store.notifications = [];
  store.announced = [];
  store.langs = [];
  store.marked = [];
  sendToUser.mockClear();
});

describe("livraison push des demandes", () => {
  it("« en cours de téléchargement » reste dans la cloche", async () => {
    const n = row("alice", "request_status", "Dune", "« Dune » est en cours de téléchargement");
    store.notifications = [n];
    await deliverPendingNotifications();
    expect(sendToUser).not.toHaveBeenCalled();
    expect(store.marked).toEqual([n.id]);
  });

  it("un refus ou un échec reste dans la cloche", async () => {
    store.notifications = [
      row("alice", "request_status", "Dune", "Votre demande pour « Dune » a été refusée"),
      row("alice", "request_status", "Dune", "Échec définitif pour « Dune » après 3 tentatives"),
    ];
    await deliverPendingNotifications();
    expect(sendToUser).not.toHaveBeenCalled();
    expect(store.marked).toHaveLength(2);
  });

  it("une disponibilité déjà annoncée à l'arrivée dans Jellyfin ne repart pas", async () => {
    store.announced = [{ jellyfinUserId: "alice", contentKey: "m:t:438631" }];
    store.notifications = [row("alice", "request_status", "Dune", "« Dune » est sorti sur Tentacle TV")];
    await deliverPendingNotifications();
    expect(sendToUser).not.toHaveBeenCalled();
    expect(store.marked).toHaveLength(1);
  });

  it("filet : une disponibilité jamais annoncée et vraie dans Jellyfin part", async () => {
    store.notifications = [row("alice", "request_status", "Dune", "« Dune » est sorti sur Tentacle TV")];
    await deliverPendingNotifications();
    expect(sendToUser).toHaveBeenCalledWith("alice", expect.objectContaining({
      title: "Dune",
      body: "« Dune » est sorti sur Tentacle TV",
    }));
    expect(store.announced.some((a) => a.jellyfinUserId === "alice" && a.contentKey === "m:t:438631")).toBe(true);
  });

  it("le filet parle anglais à qui l'a choisi", async () => {
    store.langs = [{ key: "user_lang_eve", value: "en" }];
    store.notifications = [row("eve", "request_status", "Dune", "« Dune » est sorti sur Tentacle TV")];
    await deliverPendingNotifications();
    expect(sendToUser).toHaveBeenCalledWith("eve", expect.objectContaining({ body: "Now on Tentacle TV" }));
  });
});

describe("livraison push des tickets", () => {
  it("une réponse de ticket part, dans la langue de l'utilisateur", async () => {
    store.notifications = [row("alice", "ticket_reply", "Lecture qui coupe", "Essayez la lecture directe")];
    await deliverPendingNotifications();
    expect(sendToUser).toHaveBeenCalledWith("alice", expect.objectContaining({ title: "Réponse sur « Lecture qui coupe »" }));
  });
});
