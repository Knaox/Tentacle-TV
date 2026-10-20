import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { AppNotification } from "../hooks/useNotifications";
import {
  applyNotificationPatch,
  notificationsOf,
  patchNotificationList,
  restoreNotificationSnapshot,
  type NotificationPage,
} from "./notificationCache";

function notif(id: string, read = false): AppNotification {
  return { id, jellyfinUserId: "u1", type: "request_status", title: id, body: null, refId: null, read, createdAt: "2026-10-20T12:00:00Z" };
}

const paged = (...pages: AppNotification[][]) => ({
  pages: pages.map((items, i): NotificationPage => ({ items, next: i < pages.length - 1 ? `c${i}` : null })),
  pageParams: pages.map((_, i) => (i === 0 ? null : `c${i - 1}`)),
});

describe("patchNotificationList", () => {
  it("tout lu : chaque page du centre, pas seulement la première", () => {
    const data = paged([notif("a"), notif("b", true)], [notif("c")]);
    const { data: next, unreadTouched } = patchNotificationList(data, { read: () => true });
    expect(notificationsOf(next).every((n) => n.read)).toBe(true);
    expect(unreadTouched.sort()).toEqual(["a", "c"]);
  });

  it("retirer : la ligne disparaît, une non lue retirée compte", () => {
    const { data, unreadTouched } = patchNotificationList([notif("a"), notif("b", true)], { remove: (n) => n.id !== "x" });
    expect(data).toEqual([]);
    expect(unreadTouched).toEqual(["a"]);
  });
});

describe("applyNotificationPatch", () => {
  function seeded() {
    const qc = new QueryClient();
    qc.setQueryData(["notifications", 20], [notif("a"), notif("b")]);
    qc.setQueryData(["notifications", "pages", "u1"], paged([notif("a"), notif("b")], [notif("c")]));
    qc.setQueryData(["notifications", "unread-count", "u1"], { count: 3 });
    return qc;
  }

  it("une ligne lue : partout où elle figure, et la pastille baisse d'UNE (pas une fois par liste)", async () => {
    const qc = seeded();
    await applyNotificationPatch(qc, { read: (n) => n.id === "a" });
    expect(qc.getQueryData<AppNotification[]>(["notifications", 20])?.find((n) => n.id === "a")?.read).toBe(true);
    expect(notificationsOf(qc.getQueryData(["notifications", "pages", "u1"])).find((n) => n.id === "a")?.read).toBe(true);
    expect(qc.getQueryData(["notifications", "unread-count", "u1"])).toEqual({ count: 2 });
  });

  it("tout lu : la pastille passe à zéro, même pour ce qui n'est pas chargé", async () => {
    const qc = seeded();
    qc.setQueryData(["notifications", "unread-count", "u1"], { count: 40 });
    await applyNotificationPatch(qc, { read: () => true, allRead: true });
    expect(qc.getQueryData(["notifications", "unread-count", "u1"])).toEqual({ count: 0 });
    expect(notificationsOf(qc.getQueryData(["notifications", "pages", "u1"])).some((n) => !n.read)).toBe(false);
  });

  it("un échec rend tout tel qu'avant", async () => {
    const qc = seeded();
    const snapshot = await applyNotificationPatch(qc, { remove: () => true, allRemoved: true });
    expect(qc.getQueryData(["notifications", 20])).toEqual([]);
    restoreNotificationSnapshot(qc, snapshot);
    expect(qc.getQueryData<AppNotification[]>(["notifications", 20])).toHaveLength(2);
    expect(qc.getQueryData(["notifications", "unread-count", "u1"])).toEqual({ count: 3 });
  });
});
