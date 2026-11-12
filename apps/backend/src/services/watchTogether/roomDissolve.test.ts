/**
 * Ce que l'administration fait d'une salle entière (tableau de bord des sessions,
 * `sessions.groupChat`) : un message entre dans le CHAT — de personne, même quand
 * l'administrateur est dans la salle, lecture ou pas — et une salle où personne ne lit se
 * ferme pour tous.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const sent: Array<{ to: string; msg: { type: string; reason?: string; message?: Record<string, unknown> } }> = [];
vi.mock("../wsManager", () => ({
  isUserOnline: (userId: string) => userId !== "u-absent",
  isDeviceOnline: () => true,
  sendToUser: (to: string, msg: { type: string }) => sent.push({ to, msg }),
  sendToDevices: () => undefined,
  sendToOtherDevices: () => undefined,
}));

import { addMember, createRoom, removeMember } from "./roomStore";
import { getRoom } from "./roomRegistry";
import { postAdminChat } from "./chat";
import { dissolveRoom, isRoomIdle, onlineMemberCount } from "./roomDissolve";
import { WT_CHAT_ADMIN_ID } from "./protocol";

const admin = { userId: "u-admin", username: "Damien", hasAvatar: false };
const guest = { userId: "u-invite", username: "Invité", hasAvatar: false };
const absent = { userId: "u-absent", username: "Absent", hasAvatar: false };

afterEach(() => {
  for (const userId of [admin.userId, guest.userId, absent.userId]) removeMember(userId);
  sent.length = 0;
});

describe("le message de l'administration dans le chat", () => {
  it("dans une salle SOLO sans lecture, il entre dans le fil, d'aucun membre — même l'administrateur", () => {
    const room = createRoom(admin, null)!;
    const message = postAdminChat(room, "Damien", { header: "  ", text: "On ferme à minuit" });
    expect(message).toMatchObject({ userId: WT_CHAT_ADMIN_ID, username: "Damien", text: "On ferme à minuit", from: "admin" });
    expect(message).not.toHaveProperty("header");
    expect(room.chat).toEqual([message]);
    expect(sent).toEqual([{ to: admin.userId, msg: { type: "wt:chat", message } }]);
  });

  it("à chaque membre, titre compris ; la réponse compte ceux qui ont un appareil en ligne", () => {
    const room = createRoom(admin, null)!;
    addMember(room, guest);
    addMember(room, absent);
    const message = postAdminChat(room, "Damien", { header: "Info", text: "Bonsoir" });
    expect(message.header).toBe("Info");
    expect(sent.map((s) => s.to).sort()).toEqual([absent.userId, admin.userId, guest.userId].sort());
    expect(onlineMemberCount(room)).toBe(2);
  });
});

describe("« Arrêter pour tous » sur une salle où personne ne lit", () => {
  it("la salle est oisive tant qu'aucun membre n'est dans son lecteur", () => {
    const room = createRoom(admin, null)!;
    addMember(room, guest);
    expect(isRoomIdle(room)).toBe(true);
    room.members.get(guest.userId)!.inPlayback = true;
    expect(isRoomIdle(room)).toBe(false);
  });

  it("la salle se ferme : chacun l'apprend, elle n'existe plus", () => {
    const room = createRoom(admin, null)!;
    addMember(room, guest);
    expect(dissolveRoom(room)).toBe(2);
    expect(getRoom(room.groupId)).toBeNull();
    const dissolved = sent.filter((s) => s.msg.type === "wt:dissolved");
    expect(dissolved.map((s) => s.to).sort()).toEqual([admin.userId, guest.userId].sort());
    expect(dissolved.every((s) => s.msg.reason === "dissolved")).toBe(true);
    // Aucun départ diffusé entre-temps : toute la salle s'en va.
    expect(sent.some((s) => s.msg.type === "wt:state")).toBe(false);
  });

  it("une salle solo se ferme aussi", () => {
    const room = createRoom(admin, null)!;
    expect(dissolveRoom(room)).toBe(1);
    expect(getRoom(room.groupId)).toBeNull();
  });
});
