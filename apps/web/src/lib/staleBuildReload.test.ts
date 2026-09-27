import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("staleBuildReload — une page d'avant la mise à jour recharge", () => {
  const reload = vi.fn();
  const fetchMock = vi.fn();
  let store: Map<string, string>;

  beforeEach(() => {
    // Le module garde en mémoire une attente en cours : chaque test repart
    // d'une copie neuve.
    vi.resetModules();
    vi.useFakeTimers();
    store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });
    reload.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      location: { reload, protocol: "http:", pathname: "/tv/media/abc", search: "" },
      addEventListener: vi.fn(),
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const load = () => import("./staleBuildReload");

  it("reconnaît l'échec d'un import dynamique, pas une erreur ordinaire", async () => {
    const { isModuleLoadFailure } = await load();
    expect(isModuleLoadFailure(new TypeError("Failed to fetch dynamically imported module: /tv/assets/Watch-x.js"))).toBe(true);
    expect(isModuleLoadFailure(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isModuleLoadFailure(new Error("Invalid token"))).toBe(false);
  });

  it("recharge dès que le serveur répond au document courant", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const { reloadForStaleBuild } = await load();
    expect(reloadForStaleBuild()).toBe(true);
    await vi.runOnlyPendingTimersAsync();
    expect(reload).toHaveBeenCalledTimes(1);
    // La sonde vise la page elle-même, avec un paramètre qui déjoue le cache.
    expect(fetchMock.mock.calls[0][0]).toMatch(/^\/tv\/media\/abc\?probe=\d+$/);
  });

  it("n'emmène pas l'application vers un serveur absent : il attend qu'il revienne", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValue({ ok: true });
    const { reloadForStaleBuild } = await load();
    reloadForStaleBuild();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4_000);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("une seule attente à la fois, même si plusieurs imports échouent", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const { reloadForStaleBuild } = await load();
    reloadForStaleBuild();
    reloadForStaleBuild();
    await vi.runOnlyPendingTimersAsync();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("ne recharge pas deux fois en 30 s, sauf demande explicite", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    store.set("tentacle_stale_build_reload", String(Date.now()));
    const { reloadForStaleBuild } = await load();
    expect(reloadForStaleBuild()).toBe(false);
    await vi.runOnlyPendingTimersAsync();
    expect(reload).not.toHaveBeenCalled();
    expect(reloadForStaleBuild({ force: true })).toBe(true);
    await vi.runOnlyPendingTimersAsync();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
