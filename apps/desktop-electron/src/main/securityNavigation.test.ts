import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le verrou de navigation d'un `WebContents` : ce sont les gestionnaires
 * RÉELLEMENT posés par `lockNavigation` qu'on rejoue, sur un faux contenu.
 */

const opened = vi.hoisted(() => [] as string[]);

vi.mock("electron", () => ({
  app: {},
  net: {},
  protocol: {},
  session: {},
  shell: {
    openExternal: async (url: string) => {
      opened.push(url);
    },
  },
}));

import { lockNavigation } from "./security";

type Listener = (...args: unknown[]) => void;

function fakeContents(): { contents: Electron.WebContents; listeners: Map<string, Listener> } {
  const listeners = new Map<string, Listener>();
  const fake = {
    on: (name: string, listener: Listener) => {
      listeners.set(name, listener);
      return fake;
    },
    setWindowOpenHandler: () => undefined,
  };
  return { contents: fake as unknown as Electron.WebContents, listeners };
}

/** Rejoue un évènement de navigation ; rend vrai s'il a été bloqué. */
function emit(listener: Listener | undefined, details: { url: string; isMainFrame: boolean }): boolean {
  if (!listener) throw new Error("aucun gestionnaire posé");
  let prevented = false;
  listener({ ...details, preventDefault: () => { prevented = true; } }, details.url);
  return prevented;
}

beforeEach(() => {
  opened.length = 0;
});

describe("lockNavigation — redirections", () => {
  it("bloque une redirection du cadre principal hors de l'application, sans l'ouvrir", () => {
    const { contents, listeners } = fakeContents();
    lockNavigation(contents);
    expect(emit(listeners.get("will-redirect"), { url: "https://evil.example/", isMainFrame: true })).toBe(true);
    expect(opened).toEqual([]);
  });

  it("laisse passer une redirection interne, et celles des cadres (bande-annonce)", () => {
    const { contents, listeners } = fakeContents();
    lockNavigation(contents);
    expect(emit(listeners.get("will-redirect"), { url: "tentacle://app/home", isMainFrame: true })).toBe(false);
    expect(emit(listeners.get("will-redirect"), { url: "https://www.youtube.com/embed/x", isMainFrame: false })).toBe(false);
  });
});

describe("lockNavigation — navigations et liens externes", () => {
  it("garde la page sur l'application et n'ouvre dehors que les schémas permis", async () => {
    const { contents, listeners } = fakeContents();
    lockNavigation(contents);
    const navigate = listeners.get("will-navigate");
    expect(emit(navigate, { url: "tentacle://app/settings", isMainFrame: true })).toBe(false);
    for (const url of ["https://tentacletv.app/", "file:///etc/passwd", "smb://host/share", "javascript:alert(1)", "tentacle://plugin/x"]) {
      expect(emit(navigate, { url, isMainFrame: true })).toBe(true);
    }
    await Promise.resolve();
    expect(opened).toEqual(["https://tentacletv.app/"]);
  });
});
