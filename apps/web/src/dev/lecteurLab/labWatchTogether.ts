/**
 * La séance Watch Together du labo : une valeur de contexte FACTICE, pour rendre les vraies
 * surfaces (salle, invitations, chat, avis) sans socket ni serveur. Chaque geste est inerte.
 */

import type { WatchTogetherContextValue } from "@tentacle-tv/api-client";

const settled = () => Promise.resolve();

export function labWtContext(overrides: Partial<WatchTogetherContextValue> = {}): WatchTogetherContextValue {
  return {
    room: null,
    invites: [],
    selfId: "lab-user",
    isInGroup: false,
    isHost: false,
    pendingInvites: [],
    mayJoin: true,
    mayCreate: true,
    elsewhere: null,
    send: () => true,
    serverNow: () => Date.now(),
    actions: {
      create: () => new Promise(() => {}),
      invite: () => Promise.resolve(0),
      respond: settled,
      leave: settled,
      kick: settled,
      joinHere: settled,
      joinPlayback: settled,
    },
    ...overrides,
  };
}
