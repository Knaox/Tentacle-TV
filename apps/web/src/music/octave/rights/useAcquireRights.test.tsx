import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { musicRightsKey } from "@tentacle-tv/api-client";
import type { MusicRights } from "@tentacle-tv/shared/music";
import { useAcquireRights, type AcquireRights } from "./useAcquireRights";

const h = vi.hoisted(() => ({ rightsRoute: "/music/me/rights" as string | undefined, cache: new Map<string, unknown>(), invalidated: 0 }));

// Un cache minimal à la place de React Query (deux copies de React dans le banc de test du web).
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => ({ data: h.cache.get(JSON.stringify(queryKey)) }),
  useQueryClient: () => ({
    getQueryData: (key: readonly unknown[]) => h.cache.get(JSON.stringify(key)),
    setQueryData: (key: readonly unknown[], value: unknown) => h.cache.set(JSON.stringify(key), value),
    invalidateQueries: () => { h.invalidated += 1; },
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, opts?: { count?: number }) => (opts?.count !== undefined ? `${key}:${opts.count}` : key) }),
}));
vi.mock("../mode/useOctaveProvider", () => ({
  useOctaveProvider: () => ({ pluginId: "ext", name: "Ext", music: { search: "/s", resolve: "/r", rights: h.rightsRoute } }),
}));

function grab(seed: MusicRights | null): { api: AcquireRights } {
  h.cache.clear();
  if (seed) h.cache.set(JSON.stringify(musicRightsKey("ext")), seed);
  let api: AcquireRights | null = null;
  function Probe() {
    api = useAcquireRights();
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return { api: api as unknown as AcquireRights };
}

describe("useAcquireRights", () => {
  it("sans le droit : plus de bouton d'ajout", () => {
    expect(grab({ acquire: false, dailyLimit: 0, remainingToday: null, keepOffline: false, resetsAt: null }).api.canAcquire).toBe(false);
  });

  it("extension d'avant (pas de route `rights`) : comme avant", () => {
    h.rightsRoute = undefined;
    const { api } = grab(null);
    expect(api.canAcquire).toBe(true);
    expect(api.exhausted).toBe(false);
    h.rightsRoute = "/music/me/rights";
  });

  it("un ajout accepté décompte le reste et le dit près de la limite", () => {
    const { api } = grab({ acquire: true, dailyLimit: 10, remainingToday: 3, keepOffline: true, resetsAt: Date.now() + 60_000 });
    expect(api.acquired()).toBe("rights.remaining:2");
    expect((h.cache.get(JSON.stringify(musicRightsKey("ext"))) as MusicRights).remainingToday).toBe(2);
    expect(h.invalidated).toBeGreaterThan(0);
  });

  it("le refus de limite dit le nombre du jour ; un autre refus garde ses mots", () => {
    const { api } = grab({ acquire: true, dailyLimit: 5, remainingToday: 0, keepOffline: true, resetsAt: Date.now() + 60_000 });
    expect(api.exhausted).toBe(true);
    expect(api.refusal("quota")).toEqual({ title: "rights.quotaTitle", message: "rights.quotaReached:5" });
    expect(api.refusal("unavailable")).toEqual({ title: "refusal.title", message: "refusal.unavailable" });
  });
});
