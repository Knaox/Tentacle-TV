/**
 * Les fausses dépendances des bancs de la Famille, pour `vi.mock` — sans
 * aucun import de `src/` (une fabrique de mock qui chargerait le code testé
 * le chargerait avant ses propres mocks). Chaque fichier de test tient son
 * état dans `vi.hoisted` et passe un accesseur.
 */

import { createFamilyDb } from "./fakeFamilyDb";
import { createFakeJellyfinUsers } from "./fakeJellyfinUsers";

export interface HarnessState {
  db: ReturnType<typeof createFamilyDb>;
  jf: ReturnType<typeof createFakeJellyfinUsers>;
  config: Map<string, string>;
  socket: Array<{ userId: string; msg: { type: string } & Record<string, unknown> }>;
  ended: Array<[string, string]>;
  unpaired: string[];
  closed: string[];
  pushes: Array<{ userId: string; title: string; body: string; data?: Record<string, unknown> }>;
}

export function freshState(): HarnessState {
  return {
    db: createFamilyDb(),
    jf: createFakeJellyfinUsers(),
    config: new Map([["jwt_secret", "secret-des-bancs-de-la-famille"]]),
    socket: [],
    ended: [],
    unpaired: [],
    closed: [],
    pushes: [],
  };
}

type Get = () => HarnessState;

export function configStoreMock(get: Get) {
  return {
    getJellyfinUrl: () => "http://jf.test",
    getJellyfinApiKey: () => "cle-admin",
    getPublicUrl: () => null,
    getConfigValue: (key: string) => get().config.get(key),
    setConfigValue: async (key: string, value: string) => void get().config.set(key, value),
    deleteConfigValue: async (key: string) => void get().config.delete(key),
    getDirectStreamingConfig: () => ({ enabled: false, publicUrl: null, privateUrl: null }),
    isSetupComplete: () => true,
  };
}

export function dbMock(get: Get) {
  return { hasPrisma: () => true, getPrisma: () => get().db.client };
}

export function wsManagerMock(get: Get) {
  return {
    sendToUser: (userId: string, msg: { type: string }) => void get().socket.push({ userId, msg }),
    endProfileSessionSockets: (hash: string, reason: string) => void get().ended.push([hash, reason]),
    revokeDeviceByTokenHash: (hash: string) => void get().unpaired.push(hash),
    closeDeviceSockets: (hash: string) => void get().closed.push(hash),
    broadcastToUser: () => undefined,
    isUserOnline: () => false,
  };
}

export function pushServiceMock(get: Get) {
  const send = async (userId: string, payload: { title: string; body: string; data?: Record<string, unknown> }) => {
    get().pushes.push({ userId, ...payload });
    return { sent: 1, invalid: 0 };
  };
  return { sendToUser: send, sendToUsers: async () => ({ sent: 0, invalid: 0 }), isPushDeliveryEnabled: () => true };
}

export function deviceAuthMock() {
  return { pairedDeviceIdForHash: async (hash: string) => `derive-${hash.slice(0, 16)}` };
}

export function gatewayMock() {
  return { endPairedDeviceSessions: async () => undefined };
}
