/**
 * Le chat interactif (20/10) : une vraie rafale passe — une dizaine de
 * messages, vingt réactions, six GIF d'affilée —, l'abus est tenu par membre ;
 * « est en train d'écrire » est relayé aux AUTRES seulement, s'éteint seul
 * après 6 s sans nouvelle, et à l'envoi d'un message.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const sent: Array<{ to: string; msg: { type: string; typing?: boolean; userId?: string } }> = [];
vi.mock("../wsManager", () => ({
  isUserOnline: () => true,
  sendToUser: (to: string, msg: { type: string }) => sent.push({ to, msg }),
}));

import { addMember, createRoom, removeMember } from "./roomStore";
import { handleChat, handleGif, handleReaction } from "./chat";
import { handleTyping } from "./chatTyping";
import { parseWtClientMessage } from "./protocolParse";
import { WT_TYPING_TTL_MS } from "./protocol";
import type { Room } from "./roomTypes";

const host = { userId: "u-hote", username: "Hôte", isAdmin: false };
const guest = { userId: "u-invite", username: "Invité", isAdmin: false };
const of = (type: string) => sent.filter((s) => s.msg.type === type);

let room: Room;
beforeAll(() => { vi.useFakeTimers(); });
beforeEach(() => {
  sent.length = 0;
  room = createRoom({ ...host, hasAvatar: false }, null)!;
  addMember(room, { ...guest, hasAvatar: false });
});
afterEach(() => {
  removeMember(guest.userId);
  removeMember(host.userId);
  vi.clearAllTimers();
});

describe("le débit du chat : la rafale passe, l'abus non", () => {
  it("dix messages d'affilée passent, le onzième attend que le rythme rende un jeton", () => {
    for (let i = 0; i < 11; i += 1) handleChat(room, host, `m${i}`);
    expect(room.chat).toHaveLength(10);
    vi.advanceTimersByTime(500); // deux par seconde
    handleChat(room, host, "encore");
    expect(room.chat).toHaveLength(11);
  });

  it("vingt réactions d'un coup passent toutes ; le débit est par membre", () => {
    for (let i = 0; i < 20; i += 1) handleReaction(room, host, "🔥");
    expect(of("wt:reaction")).toHaveLength(20 * 2); // à chacun des deux membres
    handleReaction(room, host, "🔥");
    expect(of("wt:reaction")).toHaveLength(40);
    handleReaction(room, guest, "😂");
    expect(of("wt:reaction")).toHaveLength(42);
  });

  it("six GIF d'affilée, puis un par seconde", () => {
    const gif = { url: "https://media.klipy.com/x.gif" };
    for (let i = 0; i < 7; i += 1) handleGif(room, host, gif);
    expect(of("wt:gif")).toHaveLength(6 * 2);
    vi.advanceTimersByTime(1_000);
    handleGif(room, host, gif);
    expect(of("wt:gif")).toHaveLength(7 * 2);
  });
});

describe("« est en train d'écrire »", () => {
  it("relayé aux autres, jamais à soi-même", () => {
    handleTyping(room, host, true);
    const typing = of("wt:typing");
    expect(typing.map((s) => s.to)).toEqual([guest.userId]);
    expect(typing[0].msg).toEqual({ type: "wt:typing", userId: host.userId, username: "Hôte", typing: true });
  });

  it("s'éteint seul après 6 s sans nouvelle ; redit, il tient", () => {
    handleTyping(room, host, true);
    vi.advanceTimersByTime(WT_TYPING_TTL_MS - 1_000);
    handleTyping(room, host, true);
    vi.advanceTimersByTime(WT_TYPING_TTL_MS - 1_000);
    expect(of("wt:typing").some((s) => s.msg.typing === false)).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(of("wt:typing").at(-1)?.msg.typing).toBe(false);
  });

  it("envoyer un message l'éteint ; une fin sans début n'envoie rien", () => {
    handleTyping(room, guest, false);
    expect(of("wt:typing")).toHaveLength(0);
    handleTyping(room, host, true);
    handleChat(room, host, "salut");
    const typing = of("wt:typing");
    expect(typing.at(-1)?.msg.typing).toBe(false);
    expect(room.typing.size).toBe(0);
  });

  it("un départ éteint sa minuterie", () => {
    handleTyping(room, guest, true);
    removeMember(guest.userId);
    expect(room.typing.has(guest.userId)).toBe(false);
  });

  it("le message entrant est vérifié", () => {
    expect(parseWtClientMessage({ type: "wt:typing", typing: true })).toEqual({ type: "wt:typing", typing: true });
    expect(parseWtClientMessage({ type: "wt:typing", typing: "oui" })).toBeNull();
  });
});
