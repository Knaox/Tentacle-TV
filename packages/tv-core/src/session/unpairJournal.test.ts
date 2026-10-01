import { describe, expect, it } from "vitest";

import {
  ACCOUNT_STORAGE_KEYS,
  MAX_PENDING_REVOCATIONS,
  UNPAIR_PENDING_KEY,
  beginUnpair,
  endWipe,
  readUnpairJournal,
  resumeUnpair,
  settleRevocation,
  wipeAccount,
  type SessionStorage,
} from "./unpairJournal";

/** Un stockage qui journalise ses écritures, dans l'ordre où elles arrivent. */
function fakeStorage(initial: Record<string, string> = {}) {
  const content = new Map(Object.entries(initial));
  const writes: string[] = [];
  const storage: SessionStorage = {
    getItem: (k) => content.get(k) ?? null,
    setItem: (k, v) => { writes.push(`set ${k}`); content.set(k, v); },
    removeItem: (k) => { writes.push(`remove ${k}`); content.delete(k); },
  };
  return { storage, content, writes };
}

const SESSION = {
  tentacle_token: "jwt-salon",
  tentacle_user: '{"Id":"u1","Name":"Knaoxtest"}',
  tentacle_server_url: "https://tentacle.example",
  tentacle_jellyfin_token: "jf-salon",
  tentacle_query_cache_v1: '{"owner":null,"entries":{}}',
  tentacle_language: "fr",
  tentacle_device_id: "appareil",
};

/** Le déjumelage complet, tel que les applications l'enchaînent. */
function unpair(storage: SessionStorage, now = 1_000) {
  beginUnpair(storage, { serverUrl: storage.getItem("tentacle_server_url"), token: storage.getItem("tentacle_token") }, now);
  wipeAccount(storage);
  endWipe(storage);
}

describe("le marqueur passe avant le premier effacement", () => {
  it("est écrit avant que la moindre clé du compte ne soit retirée", () => {
    const { storage, writes } = fakeStorage(SESSION);
    unpair(storage);
    expect(writes[0]).toBe(`set ${UNPAIR_PENDING_KEY}`);
    expect(writes.indexOf("remove tentacle_token")).toBeGreaterThan(0);
  });

  it("met l'ancien jeton de côté avec son serveur", () => {
    const { storage } = fakeStorage(SESSION);
    unpair(storage, 42);
    expect(readUnpairJournal(storage)).toEqual({
      wiping: false,
      revocations: [{ serverUrl: "https://tentacle.example", token: "jwt-salon", since: 42, attempts: 0, notBefore: 42 }],
    });
  });

  it("n'a rien à révoquer quand le serveur l'a déjà fait", () => {
    const { storage, content } = fakeStorage(SESSION);
    beginUnpair(storage, null, 1);
    wipeAccount(storage);
    endWipe(storage);
    expect(content.has(UNPAIR_PENDING_KEY)).toBe(false);
  });

  it("ne met pas deux fois le même jeton dans la file", () => {
    const { storage } = fakeStorage(SESSION);
    const leaving = { serverUrl: "https://tentacle.example", token: "jwt-salon" };
    beginUnpair(storage, leaving, 1);
    beginUnpair(storage, leaving, 2);
    expect(readUnpairJournal(storage).revocations).toHaveLength(1);
  });

  it("garde une file bornée, les plus récents d'abord conservés", () => {
    const { storage } = fakeStorage();
    for (let i = 0; i < MAX_PENDING_REVOCATIONS + 3; i += 1) {
      beginUnpair(storage, { serverUrl: "https://s", token: `t${i}` }, i);
    }
    const tokens = readUnpairJournal(storage).revocations.map((r) => r.token);
    expect(tokens).toHaveLength(MAX_PENDING_REVOCATIONS);
    expect(tokens.at(-1)).toBe(`t${MAX_PENDING_REVOCATIONS + 2}`);
  });
});

describe("la purge efface le compte et lui seul", () => {
  it("retire toutes les clés du compte, cache persisté compris", () => {
    const { storage, content } = fakeStorage(SESSION);
    unpair(storage);
    for (const key of ACCOUNT_STORAGE_KEYS) expect(content.has(key)).toBe(false);
    expect(content.has("tentacle_query_cache_v1")).toBe(false);
  });

  it("garde les réglages de l'appareil", () => {
    const { storage, content } = fakeStorage(SESSION);
    unpair(storage);
    expect(content.get("tentacle_language")).toBe("fr");
    expect(content.get("tentacle_device_id")).toBe("appareil");
  });
});

describe("un plantage au milieu ne laisse jamais un appareil à moitié jumelé", () => {
  it("rejoue au démarrage la purge interrompue avant sa fin", () => {
    const { storage, content } = fakeStorage(SESSION);
    beginUnpair(storage, { serverUrl: SESSION.tentacle_server_url, token: SESSION.tentacle_token }, 1);
    storage.removeItem("tentacle_token"); // … et l'app est tuée ici.
    expect(resumeUnpair(storage)).toBe(true);
    expect(content.has("tentacle_jellyfin_token")).toBe(false);
    expect(content.has("tentacle_query_cache_v1")).toBe(false);
    expect(readUnpairJournal(storage).wiping).toBe(false);
    expect(readUnpairJournal(storage).revocations).toHaveLength(1);
  });

  it("ne touche pas à une session neuve quand seule une révocation attend", () => {
    const { storage, content } = fakeStorage(SESSION);
    unpair(storage);
    // Rejumelé pendant que le serveur de l'ancienne session est injoignable.
    storage.setItem("tentacle_token", "jwt-neuf");
    expect(resumeUnpair(storage)).toBe(false);
    expect(content.get("tentacle_token")).toBe("jwt-neuf");
  });

  it("traite un marqueur illisible comme une purge à refaire", () => {
    const { storage, content } = fakeStorage({ ...SESSION, [UNPAIR_PENDING_KEY]: "{pas du JSON" });
    expect(resumeUnpair(storage)).toBe(true);
    expect(content.has("tentacle_token")).toBe(false);
    expect(content.has(UNPAIR_PENDING_KEY)).toBe(false);
  });

  it("ne fait rien sans marqueur", () => {
    const { storage, writes } = fakeStorage(SESSION);
    expect(resumeUnpair(storage)).toBe(false);
    expect(writes).toEqual([]);
  });
});

describe("solder une révocation", () => {
  it("retire le jeton confirmé et le marqueur avec lui", () => {
    const { storage, content } = fakeStorage(SESSION);
    unpair(storage);
    settleRevocation(storage, "jwt-salon");
    expect(content.has(UNPAIR_PENDING_KEY)).toBe(false);
  });

  it("garde une purge en cours même quand la file se vide", () => {
    const { storage } = fakeStorage(SESSION);
    beginUnpair(storage, { serverUrl: "https://s", token: "t" }, 1);
    settleRevocation(storage, "t");
    expect(readUnpairJournal(storage)).toEqual({ wiping: true, revocations: [] });
  });
});
