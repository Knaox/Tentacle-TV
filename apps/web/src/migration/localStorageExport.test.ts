import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le module dépend de deux choses qui n'existent pas sous vitest : la commande
 * native et la détection du shell. On les remplace AVANT l'import, sinon
 * `isTauriShell()` renverrait false et tout serait court-circuité.
 *
 * La garde est bien `isTauriShell` et non « suis-je sur le bureau » : cette
 * sauvegarde est le côté ÉCRITURE de la migration, réservé à l'app Tauri.
 * Electron relit le dépôt, il ne le réécrit jamais.
 */
const invoke = vi.fn<(cmd: string, args?: unknown) => Promise<unknown>>();

vi.mock("../desktop/bridge", () => ({
  invoke: (c: string, a?: unknown) => invoke(c, a),
  isTauriShell: () => true,
}));

/**
 * Les tests du projet tournent en environnement `node` : ni `localStorage`,
 * ni `window`, ni `navigator`. On pose le strict minimum plutôt que d'ajouter
 * jsdom au projet pour un seul fichier.
 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

const globals = globalThis as unknown as Record<string, unknown>;
globals.localStorage = new MemoryStorage();
globals.window = { location: { origin: "http://tauri.localhost" }, addEventListener: () => {} };
// `navigator` est un accesseur en lecture seule sous Node : passer par
// defineProperty plutôt qu'une affectation directe.
Object.defineProperty(globalThis, "navigator", {
  value: { userAgent: "vitest" },
  configurable: true,
  writable: true,
});

const { MIGRATION_KEY, exportLocalStorageOnce } = await import("./localStorageExport");

interface SetArgs {
  userId: string;
  profileJson: string;
  policyJson: string | null;
}

/** Dernier appel à `session_cache_set`, typé. */
function lastSet(): SetArgs {
  const call = invoke.mock.calls.at(-1);
  expect(call?.[0]).toBe("session_cache_set");
  return call?.[1] as SetArgs;
}

describe("sauvegarde du stockage local", () => {
  beforeEach(() => {
    localStorage.clear();
    invoke.mockReset();
    invoke.mockResolvedValue(undefined);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("depose les cles sous un identifiant synthetique", async () => {
    localStorage.setItem("tentacle_server_url", "https://jellyfin.exemple.net");
    localStorage.setItem("tentacle_token", "jeton-abc");
    localStorage.setItem("tentacle_theme_mode", "dark");

    expect(await exportLocalStorageOnce()).toBe(true);

    const args = lastSet();
    expect(args.userId).toBe(MIGRATION_KEY);
    // Jamais un vrai identifiant Jellyfin : aucune collision possible.
    expect(MIGRATION_KEY.startsWith("__")).toBe(true);

    const payload = JSON.parse(args.profileJson) as {
      version: number;
      entries: Record<string, string>;
    };
    expect(payload.version).toBe(1);
    expect(payload.entries.tentacle_server_url).toBe("https://jellyfin.exemple.net");
    expect(payload.entries.tentacle_token).toBe("jeton-abc");
    expect(payload.entries.tentacle_theme_mode).toBe("dark");
  });

  it("ecarte les cles volatiles", async () => {
    localStorage.setItem("tentacle_language", "fr");
    localStorage.setItem("tentacle_mpv_log", "1");
    localStorage.setItem("_test", "x");

    await exportLocalStorageOnce();

    const payload = JSON.parse(lastSet().profileJson) as { entries: Record<string, string> };
    expect(payload.entries.tentacle_language).toBe("fr");
    expect(payload.entries.tentacle_mpv_log).toBeUndefined();
    expect(payload.entries._test).toBeUndefined();
  });

  it("n'ecrit pas deux fois le meme contenu", async () => {
    localStorage.setItem("tentacle_user", "damien");

    expect(await exportLocalStorageOnce()).toBe(true);
    // Deuxieme passage sans changement : aucune ecriture SQLite.
    expect(await exportLocalStorageOnce()).toBe(false);
    expect(invoke).toHaveBeenCalledTimes(1);

    // Le contenu change : on reecrit.
    localStorage.setItem("tentacle_user", "autre");
    expect(await exportLocalStorageOnce()).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("survit a un echec d'ecriture sans propager l'erreur", async () => {
    localStorage.setItem("tentacle_user", "damien");
    invoke.mockRejectedValue(new Error("base verrouillee"));

    // Best-effort : l'utilisateur ne doit jamais voir passer cet echec.
    await expect(exportLocalStorageOnce()).resolves.toBe(false);
  });
});
