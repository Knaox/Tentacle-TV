import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adoptFreshUser,
  mergeFreshUser,
  parseStoredUser,
  profilePhotoUrl,
  refreshStoredUser,
  STORED_USER_KEY,
  subscribeStoredUser,
  type StoredUser,
} from "./storedUser";

const USER_ID = "b52628a704304f06a682f6037183b976";

/** Un DTO Jellyfin complet, tel que le rendent le login et `/Users/Me`. */
const dto = (over: Record<string, unknown> = {}): StoredUser => ({
  Name: "Knaoxtest",
  ServerId: "srv",
  Id: USER_ID,
  HasPassword: true,
  LastActivityDate: "2026-09-26T10:00:00.0000000Z",
  Configuration: { AudioLanguagePreference: "fre" },
  Policy: { IsAdministrator: false },
  ...over,
});

function memoryStorage(user: StoredUser | null) {
  const values = new Map<string, string>();
  if (user !== null) values.set(STORED_USER_KEY, JSON.stringify(user));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    stored: () => parseStoredUser(values.get(STORED_USER_KEY) ?? null),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("parseStoredUser", () => {
  it("rend null pour une valeur absente, illisible ou sans identifiant", () => {
    expect(parseStoredUser(null)).toBeNull();
    expect(parseStoredUser("{pas du json")).toBeNull();
    expect(parseStoredUser(JSON.stringify({ Name: "Sans Id" }))).toBeNull();
    expect(parseStoredUser(JSON.stringify([USER_ID]))).toBeNull();
  });

  it("rend le profil stocké tel quel", () => {
    expect(parseStoredUser(JSON.stringify(dto({ PrimaryImageTag: "a1" }))))
      .toEqual(dto({ PrimaryImageTag: "a1" }));
  });
});

describe("mergeFreshUser", () => {
  it("prend la nouvelle étiquette d'une photo changée ailleurs", () => {
    expect(mergeFreshUser(dto({ PrimaryImageTag: "a1" }), dto({ PrimaryImageTag: "b2" }))?.PrimaryImageTag).toBe("b2");
  });

  it("oublie l'étiquette quand la photo a été retirée — le DTO complet l'omet", () => {
    const merged = mergeFreshUser(dto({ PrimaryImageTag: "a1" }), dto());
    expect(merged).not.toBeNull();
    expect(merged?.PrimaryImageTag).toBeUndefined();
  });

  it("garde les droits connus si la réponse complète n'en porte pas", () => {
    const stored = dto({ Policy: { IsAdministrator: true } });
    const fresh: Record<string, unknown> = { ...dto({ PrimaryImageTag: "b2" }) };
    delete fresh.Policy;
    const merged = mergeFreshUser(stored, fresh);
    expect(merged?.Policy?.IsAdministrator).toBe(true);
    expect(merged?.PrimaryImageTag).toBe("b2");
  });

  it("ne reprend que le nom d'un DTO partiel — ni la photo ni les droits ne s'effacent", () => {
    const stored = dto({ PrimaryImageTag: "a1", Policy: { IsAdministrator: true } });
    expect(mergeFreshUser(stored, { Id: USER_ID, Name: "Nouveau nom" }))
      .toEqual({ ...stored, Name: "Nouveau nom" });
  });

  it("refuse le profil d'un autre compte, une réponse illisible, ou l'absence de profil stocké", () => {
    expect(mergeFreshUser(dto(), dto({ Id: "autre" }))).toBeNull();
    expect(mergeFreshUser(dto(), null)).toBeNull();
    expect(mergeFreshUser(dto(), "Users/Me")).toBeNull();
    expect(mergeFreshUser(dto(), { Name: "Sans Id" })).toBeNull();
    expect(mergeFreshUser(null, dto())).toBeNull();
  });
});

describe("adoptFreshUser", () => {
  it("écrit la photo ajoutée après le login, prévient les abonnés et signale le changement", () => {
    const storage = memoryStorage(dto());
    const listener = vi.fn();
    const unsubscribe = subscribeStoredUser(listener);
    expect(adoptFreshUser(storage, dto({ PrimaryImageTag: "b2" }))).toBe(true);
    unsubscribe();
    expect(storage.stored()?.PrimaryImageTag).toBe("b2");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("écrit le retrait de la photo et le signale", () => {
    const storage = memoryStorage(dto({ PrimaryImageTag: "a1" }));
    expect(adoptFreshUser(storage, dto())).toBe(true);
    expect(storage.stored()?.PrimaryImageTag).toBeUndefined();
  });

  it("n'écrit rien quand seul l'horodatage d'activité a bougé — les extensions ne se rechargent pas", () => {
    const storage = memoryStorage(dto({ PrimaryImageTag: "a1" }));
    const listener = vi.fn();
    const unsubscribe = subscribeStoredUser(listener);
    const later = dto({ PrimaryImageTag: "a1", LastActivityDate: "2026-09-26T18:00:00.0000000Z" });
    expect(adoptFreshUser(storage, later)).toBe(false);
    unsubscribe();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it("écrit un nom changé sans signaler de photo neuve", () => {
    const storage = memoryStorage(dto({ PrimaryImageTag: "a1" }));
    expect(adoptFreshUser(storage, { Id: USER_ID, Name: "Nouveau nom" })).toBe(false);
    expect(storage.stored()).toEqual(dto({ PrimaryImageTag: "a1", Name: "Nouveau nom" }));
  });

  it("ne crée pas de profil sans connexion", () => {
    const storage = memoryStorage(null);
    expect(adoptFreshUser(storage, dto({ PrimaryImageTag: "b2" }))).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

/** Un client dont `fetch` rend `answer` (une promesse, pour les réponses en retard). */
const reader = (answer: () => Promise<unknown>) => ({ fetch: vi.fn((_path: string) => answer()) });

describe("refreshStoredUser", () => {
  it("relit `Users/Me` — `Users/{id}` est refusé par le proxy — hors du seuil d'expiration", async () => {
    const storage = memoryStorage(dto());
    const client = reader(async () => dto({ PrimaryImageTag: "b2" }));
    await expect(refreshStoredUser(storage, client)).resolves.toBe(true);
    expect(client.fetch).toHaveBeenCalledWith("/Users/Me", undefined, { noAuthExpiry: true });
    expect(storage.stored()?.PrimaryImageTag).toBe("b2");
  });

  it("laisse le profil en place quand la relecture échoue, sans rejeter", async () => {
    const storage = memoryStorage(dto({ PrimaryImageTag: "a1" }));
    await expect(refreshStoredUser(storage, reader(() => Promise.reject(new Error("hors ligne"))))).resolves.toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("espace les relectures de confort, jamais les autres", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    const storage = memoryStorage(dto());
    const client = reader(async () => dto());
    await refreshStoredUser(storage, client, { minIntervalMs: 60_000 });
    vi.setSystemTime(new Date("2030-01-01T00:00:30Z"));
    await refreshStoredUser(storage, client, { minIntervalMs: 60_000 });
    expect(client.fetch).toHaveBeenCalledTimes(1);
    await refreshStoredUser(storage, client);
    expect(client.fetch).toHaveBeenCalledTimes(2);
    vi.setSystemTime(new Date("2030-01-01T00:02:00Z"));
    await refreshStoredUser(storage, client, { minIntervalMs: 60_000 });
    expect(client.fetch).toHaveBeenCalledTimes(3);
  });

  it("jette une réponse arrivée après celle d'une relecture plus récente", async () => {
    const storage = memoryStorage(dto({ PrimaryImageTag: "a1" }));
    let answerOld: (value: unknown) => void = () => undefined;
    const old = refreshStoredUser(storage, reader(() => new Promise((resolve) => { answerOld = resolve; })));
    await expect(refreshStoredUser(storage, reader(async () => dto({ PrimaryImageTag: "b2" })))).resolves.toBe(true);
    answerOld(dto({ PrimaryImageTag: "a1" }));
    await expect(old).resolves.toBe(false);
    expect(storage.stored()?.PrimaryImageTag).toBe("b2");
  });
});

describe("profilePhotoUrl", () => {
  it("adresse la photo par son étiquette, identifiant et étiquette encodés", () => {
    expect(profilePhotoUrl("https://tentacle.example", "a b", "t/1"))
      .toBe("https://tentacle.example/api/jellyfin/Users/a%20b/Images/Primary?tag=t%2F1&quality=90&maxWidth=200");
  });

  it("rend null sans photo ou sans serveur", () => {
    expect(profilePhotoUrl("https://tentacle.example", USER_ID, null)).toBeNull();
    expect(profilePhotoUrl("https://tentacle.example", USER_ID, undefined)).toBeNull();
    expect(profilePhotoUrl("https://tentacle.example", USER_ID, "")).toBeNull();
    expect(profilePhotoUrl("", USER_ID, "a1")).toBeNull();
  });
});
