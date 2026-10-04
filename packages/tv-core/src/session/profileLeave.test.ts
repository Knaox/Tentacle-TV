import { describe, expect, it } from "vitest";

import {
  ACCOUNT_STORAGE_KEYS,
  PROFILE_STORAGE_KEYS,
  UNPAIR_PENDING_KEY,
  beginProfileLeave,
  beginUnpair,
  deferRevocation,
  endWipe,
  readUnpairJournal,
  resumeUnpair,
  settleRevocation,
  wipeAccount,
  type SessionStorage,
} from "./unpairJournal";
import { TV_PAIRING_TOKEN_KEY, TV_PROFILE_KEY } from "./tvProfileKeys";

function fakeStorage(initial: Record<string, string> = {}) {
  const content = new Map(Object.entries(initial));
  const storage: SessionStorage = {
    getItem: (k) => content.get(k) ?? null,
    setItem: (k, v) => { content.set(k, v); },
    removeItem: (k) => { content.delete(k); },
  };
  return { storage, content };
}

/** Une Apple TV passée aux profils, un profil ouvert. */
const PROFILE_TV = {
  tentacle_server_url: "https://tentacle.example",
  [TV_PAIRING_TOKEN_KEY]: "jwt-jumelage",
  tentacle_token: "jwt-session-lea",
  tentacle_user: '{"Id":"lea","Name":"Léa"}',
  [TV_PROFILE_KEY]: '{"profileId":"lea"}',
  tentacle_query_cache_v1: '{"entries":{}}',
  tentacle_playback_outbox: "{}",
  tentacle_language: "fr",
  "tentacle_scrub_countdown:lea": '{"outcome":"resume","delay":10}',
};

describe("quitter un profil (Famille, Apple TV)", () => {
  it("efface la session du profil, garde le jumelage et les réglages de l'appareil", () => {
    const { storage, content } = fakeStorage(PROFILE_TV);
    beginProfileLeave(storage, { serverUrl: "https://tentacle.example", token: "jwt-session-lea" }, 1_000);
    wipeAccount(storage, PROFILE_STORAGE_KEYS);
    endWipe(storage);

    for (const key of PROFILE_STORAGE_KEYS) expect(content.has(key)).toBe(false);
    expect(content.get(TV_PAIRING_TOKEN_KEY)).toBe("jwt-jumelage");
    expect(content.get("tentacle_server_url")).toBe("https://tentacle.example");
    expect(content.get("tentacle_language")).toBe("fr");
    expect(content.has("tentacle_scrub_countdown:lea")).toBe(true);
    // Le jeton de la session reste à révoquer — et c'est la seule copie.
    expect(readUnpairJournal(storage)).toEqual({
      wiping: false,
      revocations: [{ serverUrl: "https://tentacle.example", token: "jwt-session-lea", since: 1_000, attempts: 0, notBefore: 1_000 }],
    });
  });

  it("interrompue, elle se rejoue au démarrage sur la seule session : la TV reste jumelée", () => {
    const { storage, content } = fakeStorage(PROFILE_TV);
    beginProfileLeave(storage, { serverUrl: "https://tentacle.example", token: "jwt-session-lea" }, 1_000);
    // L'app est tuée ici : rien n'est encore effacé.
    expect(readUnpairJournal(storage).scope).toBe("profile");

    expect(resumeUnpair(storage)).toBe(false);
    expect(content.has("tentacle_token")).toBe(false);
    expect(content.has(TV_PROFILE_KEY)).toBe(false);
    expect(content.get(TV_PAIRING_TOKEN_KEY)).toBe("jwt-jumelage");
    expect(readUnpairJournal(storage).wiping).toBe(false);
  });

  it("ne rétrograde jamais un déjumelage en cours en simple sortie de profil", () => {
    const { storage, content } = fakeStorage(PROFILE_TV);
    beginUnpair(storage, { serverUrl: "https://tentacle.example", token: "jwt-jumelage" }, 1_000);
    beginProfileLeave(storage, { serverUrl: "https://tentacle.example", token: "jwt-session-lea" }, 1_001);
    expect(readUnpairJournal(storage).scope).toBeUndefined();

    expect(resumeUnpair(storage)).toBe(true);
    for (const key of ACCOUNT_STORAGE_KEYS) expect(content.has(key)).toBe(false);
    expect(readUnpairJournal(storage).revocations.map((r) => r.token)).toEqual(["jwt-jumelage", "jwt-session-lea"]);
  });

  it("un déjumelage après une sortie interrompue efface TOUT, jeton de jumelage compris", () => {
    const { storage, content } = fakeStorage(PROFILE_TV);
    beginProfileLeave(storage, { serverUrl: "https://tentacle.example", token: "jwt-session-lea" }, 1_000);
    beginUnpair(storage, { serverUrl: "https://tentacle.example", token: "jwt-jumelage" }, 1_001);
    expect(resumeUnpair(storage)).toBe(true);
    expect(content.has(TV_PAIRING_TOKEN_KEY)).toBe(false);
  });

  it("la vidange des révocations garde la portée de la purge en cours", () => {
    const { storage } = fakeStorage(PROFILE_TV);
    beginProfileLeave(storage, { serverUrl: "https://tentacle.example", token: "jwt-session-lea" }, 1_000);
    deferRevocation(storage, "jwt-session-lea", 2_000, 5_000);
    expect(readUnpairJournal(storage).scope).toBe("profile");
    settleRevocation(storage, "jwt-session-lea");
    expect(readUnpairJournal(storage)).toEqual({ wiping: true, scope: "profile", revocations: [] });
  });

  it("le déjumelage efface le jeton de jumelage ; la sortie de profil, jamais", () => {
    expect(ACCOUNT_STORAGE_KEYS).toContain(TV_PAIRING_TOKEN_KEY);
    expect(PROFILE_STORAGE_KEYS).not.toContain(TV_PAIRING_TOKEN_KEY);
    expect(PROFILE_STORAGE_KEYS).toContain("tentacle_token");
    expect(PROFILE_STORAGE_KEYS).toContain("tentacle_playback_outbox");
    expect(PROFILE_STORAGE_KEYS).toContain("tentacle_query_cache_v1");
    for (const key of PROFILE_STORAGE_KEYS) expect(ACCOUNT_STORAGE_KEYS).toContain(key);
  });

  it("un marqueur à portée inconnue se lit comme un déjumelage", () => {
    const { storage } = fakeStorage({ [UNPAIR_PENDING_KEY]: '{"wiping":true,"scope":"autre","revocations":[]}' });
    expect(readUnpairJournal(storage)).toEqual({ wiping: true, revocations: [] });
  });
});
