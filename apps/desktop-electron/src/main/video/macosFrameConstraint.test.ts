import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le runtime Objective-C simulé : des classes, leurs méthodes, et
 * l'implémentation de chacune.
 *
 * koffi est remplacé — ce qu'on vérifie ici n'est pas AppKit, c'est la DÉCISION
 * de remplacer ou non une méthode. Et la plus grave des erreurs possibles est
 * de remplacer celle de `NSWindow` elle-même : ce serait retirer toute
 * contrainte à TOUTES les fenêtres du processus, les nôtres comprises.
 */
interface Pointer {
  addr: number;
}

const SELECTOR = "constrainFrameRect:toScreen:";
const NS_WINDOW_CLASS = 1;
const MPV_CLASS = 2;
const NS_WINDOW_METHOD = 10;
const MPV_METHOD = 20;
const IDENTITY = 900;

const methods = new Map<string, Pointer>();
const implementations = new Map<number, Pointer>();
const replacements: Array<{ method: number; implementation: number }> = [];
let identity: Pointer | null = null;

const addressOf = (value: unknown): number => (value as Pointer).addr;

vi.mock("koffi", () => {
  const calls: Record<string, (...args: readonly unknown[]) => unknown> = {
    object_getClass: () => ({ addr: MPV_CLASS }),
    class_getInstanceMethod: (owner, selector) =>
      methods.get(`${String(addressOf(owner))}:${String(selector)}`) ?? null,
    class_getName: () => "swift.Window",
    method_getImplementation: (method) => implementations.get(addressOf(method)) ?? null,
    method_setImplementation: (method, implementation) => {
      replacements.push({ method: addressOf(method), implementation: addressOf(implementation) });
      implementations.set(addressOf(method), implementation as Pointer);
      return null;
    },
    dlsym: () => identity,
  };
  const library = {
    func: (name: string) => (...args: readonly unknown[]) => calls[name]?.(...args),
  };
  return { default: { load: () => library, address: (p: unknown) => BigInt(addressOf(p)) } };
});
vi.mock("./native", () => ({ trace: (): void => {} }));
vi.mock("./objc", () => ({
  cls: (name: string) => (name === "NSWindow" ? { addr: NS_WINDOW_CLASS } : null),
  sel: (name: string) => name,
}));

import { releaseMpvFrameConstraint } from "./macosFrameConstraint";

const mpvWindow = { addr: 50 };

/** La classe de mpv redéfinit la méthode — le cas de toutes les versions connues. */
function mpvOverrides(): void {
  methods.set(`${String(MPV_CLASS)}:${SELECTOR}`, { addr: MPV_METHOD });
  implementations.set(MPV_METHOD, { addr: 200 });
}

beforeEach(() => {
  methods.clear();
  implementations.clear();
  replacements.length = 0;
  identity = { addr: IDENTITY };
  methods.set(`${String(NS_WINDOW_CLASS)}:${SELECTOR}`, { addr: NS_WINDOW_METHOD });
  implementations.set(NS_WINDOW_METHOD, { addr: 100 });
});

describe("releaseMpvFrameConstraint", () => {
  it("remplace la contrainte de mpv par l'identité, dans la classe de sa fenêtre", () => {
    mpvOverrides();
    expect(releaseMpvFrameConstraint(mpvWindow, "arm64")).toBe(true);
    expect(replacements).toEqual([{ method: MPV_METHOD, implementation: IDENTITY }]);
  });

  it("ne touche JAMAIS la méthode de NSWindow, même si mpv ne la redéfinit pas", () => {
    // Sans redéfinition, la recherche remonte jusqu'à `NSWindow` : remplacer ce
    // qu'elle trouve retirerait toute contrainte à nos propres fenêtres.
    methods.set(`${String(MPV_CLASS)}:${SELECTOR}`, { addr: NS_WINDOW_METHOD });
    expect(releaseMpvFrameConstraint(mpvWindow, "arm64")).toBe(false);
    expect(replacements).toEqual([]);
  });

  it("est idempotente : la fenêtre de la lecture suivante ne refait rien", () => {
    mpvOverrides();
    releaseMpvFrameConstraint(mpvWindow, "arm64");
    expect(releaseMpvFrameConstraint({ addr: 51 }, "arm64")).toBe(false);
    expect(replacements).toHaveLength(1);
  });

  it("ne fait rien hors arm64, où les deux signatures ne se recouvrent plus", () => {
    mpvOverrides();
    expect(releaseMpvFrameConstraint(mpvWindow, "x64")).toBe(false);
    expect(replacements).toEqual([]);
  });

  it("renonce sans identité à poser, plutôt que de poser un pointeur nul", () => {
    mpvOverrides();
    identity = null;
    expect(releaseMpvFrameConstraint(mpvWindow, "arm64")).toBe(false);
    expect(replacements).toEqual([]);
  });

  it("renonce sans fenêtre", () => {
    mpvOverrides();
    expect(releaseMpvFrameConstraint(null, "arm64")).toBe(false);
    expect(replacements).toEqual([]);
  });
});
