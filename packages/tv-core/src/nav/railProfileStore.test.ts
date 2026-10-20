import { describe, expect, it, vi } from "vitest";
import { RAIL_STORAGE_KEY, type RailStorage } from "./railPinning";
import { createProfileRailStore } from "./railProfileStore";
import { RAIL_LIBRARIES_STORAGE_KEY, RAIL_PROFILES_STORAGE_KEY } from "./railProfiles";

/** Un stockage en mémoire, avec ce qu'on y lit au départ. */
function fakeStorage(initial: Record<string, string> = {}): RailStorage & { content: Map<string, string> } {
  const content = new Map(Object.entries(initial));
  return {
    content,
    getItem: (key) => content.get(key) ?? null,
    setItem: (key, value) => void content.set(key, value),
  };
}

/** L'identité active, qu'un test change à volonté. */
function identity(initial: string | null) {
  let current = initial;
  return { read: () => current, set: (next: string | null) => void (current = next) };
}

const profilesOf = (storage: { content: Map<string, string> }) => JSON.parse(storage.content.get(RAIL_PROFILES_STORAGE_KEY) ?? "{}");

describe("rail par profil — héritage de la disposition d'appareil", () => {
  it("une identité sans entrée hérite de tentacle_webos_rail, préconfiguration NON faite", () => {
    const storage = fakeStorage({ [RAIL_STORAGE_KEY]: '{"masquees":["Library_b"],"order":["Library_c","Library_b"]}' });
    const store = createProfileRailStore(storage, identity("alice").read);
    expect(store.readSnapshot()).toEqual({ masquees: ["Library_b"], order: ["Library_c", "Library_b"], setupDone: false, identity: "alice" });
    // Lire n'écrit rien : la clé d'appareil et la nouvelle restent intactes.
    expect(storage.content.get(RAIL_PROFILES_STORAGE_KEY)).toBeUndefined();
  });

  it("éditer crée l'entrée de l'identité et ne réécrit JAMAIS la clé d'appareil", () => {
    const device = '{"masquees":["Library_b"]}';
    const storage = fakeStorage({ [RAIL_STORAGE_KEY]: device });
    const store = createProfileRailStore(storage, identity("alice").read);
    store.toggle("Favorites");
    expect(store.readSnapshot().masquees).toEqual(["Library_b", "Favorites"]);
    expect(storage.content.get(RAIL_STORAGE_KEY)).toBe(device);
    expect(profilesOf(storage)).toEqual({ alice: { masquees: ["Library_b", "Favorites"] } });
  });

  it("sans session, le rail reste celui de l'appareil (et s'y écrit, comme avant)", () => {
    const storage = fakeStorage();
    const store = createProfileRailStore(storage, identity(null).read);
    store.toggle("Library_a");
    expect(storage.content.get(RAIL_STORAGE_KEY)).toBe('{"masquees":["Library_a"]}');
    expect(storage.content.get(RAIL_PROFILES_STORAGE_KEY)).toBeUndefined();
  });
});

describe("rail par profil — bascule d'identité", () => {
  it("changer de profil change de disposition, sans redémarrage", () => {
    const who = identity("alice");
    const storage = fakeStorage({
      [RAIL_PROFILES_STORAGE_KEY]: JSON.stringify({ alice: { masquees: ["Library_a"] }, bob: { masquees: [], order: ["Library_b", "Library_a"], setupDone: true } }),
    });
    const store = createProfileRailStore(storage, who.read);
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.readSnapshot().masquees).toEqual(["Library_a"]);
    who.set("bob");
    store.syncIdentity();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.readSnapshot()).toEqual({ masquees: [], order: ["Library_b", "Library_a"], setupDone: true, identity: "bob" });
    // Un geste de bob ne touche pas alice.
    store.toggle("Watchlist");
    expect(profilesOf(storage).alice).toEqual({ masquees: ["Library_a"] });
    expect(profilesOf(storage).bob.masquees).toEqual(["Watchlist"]);
  });

  it("l'instantané revérifie l'identité, et la notification part quand même ensuite", () => {
    const who = identity("alice");
    const store = createProfileRailStore(fakeStorage(), who.read);
    const listener = vi.fn();
    store.subscribe(listener);
    who.set("bob");
    expect(store.readSnapshot().identity).toBe("bob");
    store.syncIdentity();
    expect(listener).toHaveBeenCalledTimes(1);
    store.syncIdentity();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("instantané stable entre deux lectures", () => {
    const store = createProfileRailStore(fakeStorage(), identity("alice").read);
    expect(store.readSnapshot()).toBe(store.readSnapshot());
  });

  it("une identité illisible vaut « pas de session »", () => {
    const store = createProfileRailStore(fakeStorage(), () => {
      throw new Error("stockage");
    });
    expect(store.readSnapshot().identity).toBeNull();
  });
});

describe("rail par profil — préconfiguration", () => {
  it("completeSetup enregistre et marque faite", () => {
    const storage = fakeStorage();
    const store = createProfileRailStore(storage, identity("alice").read);
    store.completeSetup("alice", { masquees: ["Library_c"], order: ["Library_b", "Library_a", "Library_c"] });
    expect(store.readSnapshot()).toMatchObject({ masquees: ["Library_c"], order: ["Library_b", "Library_a", "Library_c"], setupDone: true });
    expect(profilesOf(storage)).toEqual({ alice: { masquees: ["Library_c"], order: ["Library_b", "Library_a", "Library_c"], setupDone: true } });
  });

  it("skipSetup marque faite et fige la disposition héritée", () => {
    const storage = fakeStorage({ [RAIL_STORAGE_KEY]: '{"masquees":["Library_b"]}' });
    const store = createProfileRailStore(storage, identity("alice").read);
    store.skipSetup("alice");
    expect(store.readSnapshot()).toMatchObject({ masquees: ["Library_b"], setupDone: true });
    expect(profilesOf(storage)).toEqual({ alice: { masquees: ["Library_b"], setupDone: true } });
  });

  it("un geste du rail garde la préconfiguration faite", () => {
    const store = createProfileRailStore(fakeStorage(), identity("alice").read);
    store.completeSetup("alice", { masquees: [], order: [] });
    store.toggle("Library_a");
    expect(store.readSnapshot()).toMatchObject({ masquees: ["Library_a"], setupDone: true });
  });

  it("applyLayoutTo copie masquées + ordre chez les autres, chacun marqué fait", () => {
    const storage = fakeStorage({ [RAIL_PROFILES_STORAGE_KEY]: JSON.stringify({ bob: { masquees: ["Favorites"] } }) });
    const store = createProfileRailStore(storage, identity("owner").read);
    store.completeSetup("owner", { masquees: ["Library_x"], order: ["Library_y", "Library_x"] });
    const listener = vi.fn();
    store.subscribe(listener);
    store.applyLayoutTo("owner", ["bob", "guest", "owner", ""]);
    expect(listener).toHaveBeenCalledTimes(1);
    const saved = profilesOf(storage);
    expect(saved.bob).toEqual({ masquees: ["Library_x"], order: ["Library_y", "Library_x"], setupDone: true });
    expect(saved.guest).toEqual(saved.bob);
    expect(Object.keys(saved).sort()).toEqual(["bob", "guest", "owner"]);
    expect(store.readProfiles().guest.setupDone).toBe(true);
    // Les copies sont indépendantes : un geste de l'un ne touche pas l'autre.
    store.toggle("Library_y");
    expect(profilesOf(storage).bob.masquees).toEqual(["Library_x"]);
  });

  it("applyLayoutTo sans cible n'écrit rien", () => {
    const storage = fakeStorage();
    const store = createProfileRailStore(storage, identity("owner").read);
    store.applyLayoutTo("owner", ["owner"]);
    expect(storage.content.get(RAIL_PROFILES_STORAGE_KEY)).toBeUndefined();
  });
});

describe("rail par profil — stockage abîmé ou tardif", () => {
  it("JSON par profil illisible : chaque identité hérite (rail plein, jamais vide)", () => {
    const store = createProfileRailStore(fakeStorage({ [RAIL_PROFILES_STORAGE_KEY]: "{pas du JSON" }), identity("alice").read);
    expect(store.readSnapshot()).toMatchObject({ masquees: [], order: [], setupDone: false });
  });

  it("entrée abîmée : disposition vide, préconfiguration non faite", () => {
    const raw = JSON.stringify({ alice: { masquees: "Library_a", order: [3, "Library_b"], setupDone: "oui" }, bob: null, "": { masquees: ["x"] } });
    const store = createProfileRailStore(fakeStorage({ [RAIL_PROFILES_STORAGE_KEY]: raw }), identity("alice").read);
    expect(store.readSnapshot()).toMatchObject({ masquees: [], order: ["Library_b"], setupDone: false });
    expect(Object.keys(store.readProfiles())).toEqual(["alice", "bob"]);
  });

  it("une liste au lieu d'un objet : ignorée", () => {
    const store = createProfileRailStore(fakeStorage({ [RAIL_PROFILES_STORAGE_KEY]: "[1,2]" }), identity("alice").read);
    expect(store.readProfiles()).toEqual({});
  });

  it("stockage qui refuse d'écrire : le geste vaut pour la session", () => {
    const storage: RailStorage = { getItem: () => null, setItem: () => { throw new Error("plein"); } };
    const store = createProfileRailStore(storage, identity("alice").read);
    store.toggle("Library_a");
    expect(store.readSnapshot().masquees).toEqual(["Library_a"]);
  });

  it("rehydrate relit le stockage hydraté après coup (Android TV) et notifie", () => {
    const storage = fakeStorage();
    const store = createProfileRailStore(storage, identity("alice").read);
    const listener = vi.fn();
    store.subscribe(listener);
    storage.content.set(RAIL_PROFILES_STORAGE_KEY, JSON.stringify({ alice: { masquees: ["Library_a"], setupDone: true } }));
    store.rehydrate();
    expect(store.readSnapshot()).toMatchObject({ masquees: ["Library_a"], setupDone: true });
    expect(listener).toHaveBeenCalledTimes(1);
    const before = store.readSnapshot();
    store.rehydrate();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.readSnapshot()).toBe(before);
  });
});

describe("rail par profil — nombre de bibliothèques vu", () => {
  it("retenu par identité, écrit seulement s'il change, relu au démarrage", () => {
    const storage = fakeStorage();
    const writes = vi.spyOn(storage, "setItem");
    const store = createProfileRailStore(storage, identity("alice").read);
    expect(store.readLibraryCount("alice")).toBeNull();
    store.noteLibraryCount("alice", 1);
    store.noteLibraryCount("alice", 1);
    expect(writes).toHaveBeenCalledTimes(1);
    store.noteLibraryCount("bob", 4);
    expect(JSON.parse(storage.content.get(RAIL_LIBRARIES_STORAGE_KEY)!)).toEqual({ alice: 1, bob: 4 });
    expect(createProfileRailStore(storage, identity("alice").read).readLibraryCount("bob")).toBe(4);
  });

  it("n'entame pas l'héritage : aucune entrée de disposition créée", () => {
    const storage = fakeStorage({ [RAIL_STORAGE_KEY]: '{"masquees":["Library_b"]}' });
    const store = createProfileRailStore(storage, identity("alice").read);
    store.noteLibraryCount("alice", 3);
    expect(storage.content.get(RAIL_PROFILES_STORAGE_KEY)).toBeUndefined();
    expect(store.readSnapshot().masquees).toEqual(["Library_b"]);
  });

  it("valeurs abîmées ou absurdes : inconnues", () => {
    const raw = JSON.stringify({ alice: "2", bob: -1, carol: 1.5, dave: 2 });
    const store = createProfileRailStore(fakeStorage({ [RAIL_LIBRARIES_STORAGE_KEY]: raw }), identity("alice").read);
    expect(["alice", "bob", "carol", "dave"].map((id) => store.readLibraryCount(id))).toEqual([null, null, null, 2]);
    store.noteLibraryCount("alice", Number.NaN);
    expect(store.readLibraryCount("alice")).toBeNull();
  });
});

describe("rail par profil — « Reproposer » du serveur", () => {
  it("reopenSetup rend la préconfiguration à faire, la disposition gardée, et notifie", () => {
    const storage = fakeStorage();
    const store = createProfileRailStore(storage, identity("alice").read);
    store.completeSetup("alice", { masquees: ["Library_b"], order: ["Library_a"] });
    expect(store.readSnapshot().setupDone).toBe(true);
    const listener = vi.fn();
    store.subscribe(listener);
    store.reopenSetup("alice");
    expect(store.readSnapshot()).toMatchObject({ masquees: ["Library_b"], order: ["Library_a"], setupDone: false });
    expect(profilesOf(storage)).toEqual({ alice: { masquees: ["Library_b"], order: ["Library_a"] } });
    expect(listener).toHaveBeenCalled();
  });

  it("sans préconfiguration faite (ou sans entrée), rien n'est écrit", () => {
    const storage = fakeStorage();
    const store = createProfileRailStore(storage, identity("alice").read);
    store.reopenSetup("alice");
    store.reopenSetup("");
    expect(storage.content.get(RAIL_PROFILES_STORAGE_KEY)).toBeUndefined();
  });
});
