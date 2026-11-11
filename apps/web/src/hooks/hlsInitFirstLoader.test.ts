/**
 * Le chargeur « l'init d'abord » : un segment de média ne part qu'après la
 * réponse de l'init en vol, et un init vide est un échec — la course mesurée
 * face à Jellyfin 10.11 (init et premier segment demandés ensemble).
 */
import { describe, expect, it, vi } from "vitest";
import { initFirstFragmentLoader, type FragmentLoaderClass } from "./hlsInitFirstLoader";

type Callbacks = Record<"onSuccess" | "onError" | "onTimeout" | "onAbort", (...args: unknown[]) => void>;

/** Un chargeur de base qui retient ses appels : le test répond à sa place. */
function fakeBase() {
  const loads: { sn: unknown; callbacks: Callbacks }[] = [];
  class Base {
    context = null;
    stats = { aborted: false } as never;
    load(context: { frag: { sn: unknown } }, _config: unknown, callbacks: Callbacks) {
      loads.push({ sn: context.frag.sn, callbacks });
    }
    abort = vi.fn();
    destroy = vi.fn();
  }
  return { Base: Base as unknown as FragmentLoaderClass, loads };
}

const ctx = (sn: unknown) => ({ frag: { sn } }) as never;
const callbacks = () => ({ onSuccess: vi.fn(), onError: vi.fn(), onTimeout: vi.fn(), onAbort: vi.fn() });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("initFirstFragmentLoader", () => {
  it("le segment demandé avec l'init attend sa réponse, puis part", async () => {
    const { Base, loads } = fakeBase();
    const Loader = initFirstFragmentLoader(Base);
    const init = callbacks();
    new Loader({} as never).load(ctx("initSegment"), {} as never, init as never);
    new Loader({} as never).load(ctx(19), {} as never, callbacks() as never);
    await flush();
    expect(loads.map((l) => l.sn)).toEqual(["initSegment"]);
    loads[0].callbacks.onSuccess({ data: new ArrayBuffer(1321) }, {}, {}, null);
    await flush();
    expect(init.onSuccess).toHaveBeenCalledTimes(1);
    expect(loads.map((l) => l.sn)).toEqual(["initSegment", 19]);
  });

  it("un init au corps vide est un échec de chargement, jamais un init valide — et le segment part quand même", async () => {
    const { Base, loads } = fakeBase();
    const Loader = initFirstFragmentLoader(Base);
    const init = callbacks();
    new Loader({} as never).load(ctx("initSegment"), {} as never, init as never);
    new Loader({} as never).load(ctx(19), {} as never, callbacks() as never);
    loads[0].callbacks.onSuccess({ data: new ArrayBuffer(0) }, {}, {}, null);
    await flush();
    expect(init.onSuccess).not.toHaveBeenCalled();
    expect(init.onError).toHaveBeenCalledWith({ code: 200, text: "empty init segment" }, {}, null, {});
    expect(loads).toHaveLength(2);
  });

  it("l'init en erreur, en délai dépassé ou abandonné libère aussi le segment", async () => {
    for (const end of ["onError", "onTimeout", "onAbort"] as const) {
      const { Base, loads } = fakeBase();
      const Loader = initFirstFragmentLoader(Base);
      new Loader({} as never).load(ctx("initSegment"), {} as never, callbacks() as never);
      new Loader({} as never).load(ctx(7), {} as never, callbacks() as never);
      loads[0].callbacks[end]({}, {}, null, {});
      await flush();
      expect(loads.map((l) => l.sn)).toEqual(["initSegment", 7]);
    }
  });

  it("sans init en vol (flux en TS, segments suivants) : rien n'attend", () => {
    const { Base, loads } = fakeBase();
    const Loader = initFirstFragmentLoader(Base);
    new Loader({} as never).load(ctx(0), {} as never, callbacks() as never);
    new Loader({} as never).load(ctx(1), {} as never, callbacks() as never);
    expect(loads.map((l) => l.sn)).toEqual([0, 1]);
  });

  it("un segment abandonné pendant l'attente ne part jamais, et l'abandon est rendu", async () => {
    const { Base, loads } = fakeBase();
    const Loader = initFirstFragmentLoader(Base);
    new Loader({} as never).load(ctx("initSegment"), {} as never, callbacks() as never);
    const waiting = new Loader({} as never);
    const media = callbacks();
    waiting.load(ctx(19), {} as never, media as never);
    waiting.abort();
    loads[0].callbacks.onSuccess({ data: new ArrayBuffer(8) }, {}, {}, null);
    await flush();
    expect(loads.map((l) => l.sn)).toEqual(["initSegment"]);
    expect(media.onAbort).toHaveBeenCalledTimes(1);
  });

  it("une fabrique par lecteur : l'init d'une lecture ne retient pas les segments d'une autre", () => {
    const { Base, loads } = fakeBase();
    const First = initFirstFragmentLoader(Base);
    const Second = initFirstFragmentLoader(Base);
    new First({} as never).load(ctx("initSegment"), {} as never, callbacks() as never);
    new Second({} as never).load(ctx(3), {} as never, callbacks() as never);
    expect(loads.map((l) => l.sn)).toEqual(["initSegment", 3]);
  });
});
