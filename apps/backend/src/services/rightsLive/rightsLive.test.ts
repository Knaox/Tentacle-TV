/**
 * Un droit changé au bureau (fiche des droits, Famille) s'annonce aux appareils
 * du compte : `rights:changed` sur leurs sockets, une fois par rafale — et les
 * sockets d'une session de profil, rangées au nom du profil, reçoivent
 * l'annonce de LEUR profil seulement.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listeners = vi.hoisted(() => [] as Array<(userId: string | null) => void>);
const ws = vi.hoisted(() => ({ connected: [] as string[], sent: [] as Array<{ userId: string; type: string }> }));

vi.mock("../contentPolicy", () => ({
  onContentPolicyInvalidated: (listener: (userId: string | null) => void) => {
    listeners.push(listener);
    return () => listeners.splice(listeners.indexOf(listener), 1);
  },
}));
vi.mock("../wsManager", () => ({
  connectedUserIds: () => ws.connected,
  sendToUser: (userId: string, msg: { type: string }) => ws.sent.push({ userId, type: msg.type }),
}));

import { RIGHTS_LIVE_DEBOUNCE_MS, announceRightsChanged, resetRightsLiveForTests, watchRightsLive } from "./rightsLive";

/** Ce que fait le socle à une écriture de politique (identifiant normalisé, sans tirets). */
const policyWritten = (userId: string | null) => listeners.forEach((listener) => listener(userId));

beforeEach(() => {
  vi.useFakeTimers();
  resetRightsLiveForTests();
  ws.connected = ["a1b2c3d4-0000-4000-8000-00000000000a", "guest00000000000000000000000000b", "libre000000000000000000000000000"];
  ws.sent = [];
  watchRightsLive();
});

afterEach(() => vi.useRealTimers());

describe("rights:changed", () => {
  it("une écriture de politique s'annonce aux appareils du compte, identifiant comparé sans tirets", () => {
    policyWritten("a1b2c3d400004000800000000000000a");
    expect(ws.sent).toEqual([]);
    vi.advanceTimersByTime(RIGHTS_LIVE_DEBOUNCE_MS);
    expect(ws.sent).toEqual([{ userId: "a1b2c3d4-0000-4000-8000-00000000000a", type: "rights:changed" }]);
  });

  it("le profil d'un invité (session de profil du mobile) reçoit la sienne, pas le compte voisin", () => {
    policyWritten("GUEST00000000000000000000000000B");
    vi.advanceTimersByTime(RIGHTS_LIVE_DEBOUNCE_MS);
    expect(ws.sent.map((s) => s.userId)).toEqual(["guest00000000000000000000000000b"]);
  });

  it("une rafale (âge puis bibliothèques) ne fait qu'une annonce", () => {
    policyWritten("guest00000000000000000000000000b");
    policyWritten("guest00000000000000000000000000b");
    announceRightsChanged("guest00000000000000000000000000b");
    vi.advanceTimersByTime(RIGHTS_LIVE_DEBOUNCE_MS);
    expect(ws.sent).toHaveLength(1);
  });

  it("tous les comptes (cache vidé) : chaque compte connecté", () => {
    policyWritten(null);
    vi.advanceTimersByTime(RIGHTS_LIVE_DEBOUNCE_MS);
    expect(ws.sent).toHaveLength(3);
  });

  it("un compte sans appareil connecté : rien", () => {
    policyWritten("absent0000000000000000000000000");
    vi.advanceTimersByTime(RIGHTS_LIVE_DEBOUNCE_MS);
    expect(ws.sent).toEqual([]);
  });
});
