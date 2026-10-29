import { describe, expect, it, vi } from "vitest";

const sent: unknown[] = [];
vi.mock("electron", () => ({ app: { on: vi.fn() } }));
vi.mock("./window", () => ({
  getMainWindow: () => ({ webContents: { isLoading: () => false, send: (...args: unknown[]) => sent.push(args) }, isMinimized: () => false, focus: vi.fn() }),
}));

import { appLinkFromArgv, appLinkOf, deliverAppLink } from "./appLinks";

describe("liens tentacle://octave/… remis par le système", () => {
  it("seul l'hôte d'Octave passe, borné", () => {
    expect(appLinkOf("tentacle://octave/playlist/abc")).toBe("tentacle://octave/playlist/abc");
    expect(appLinkOf("tentacle://app/index.html")).toBeNull();
    expect(appLinkOf("https://exemple.fr/octave/playlist/abc")).toBeNull();
    expect(appLinkOf(`tentacle://octave/${"x".repeat(9000)}`)).toBeNull();
    expect(appLinkOf(42)).toBeNull();
  });

  it("la ligne de commande de Windows et Linux : le lien parmi les drapeaux", () => {
    expect(appLinkFromArgv(["C:\\Tentacle TV.exe", "--allow-file-access", "tentacle://octave/search?q=x"])).toBe("tentacle://octave/search?q=x");
    expect(appLinkFromArgv(["/usr/bin/tentacle-tv"])).toBeNull();
  });

  it("une fenêtre prête reçoit le lien aussitôt", () => {
    expect(deliverAppLink("tentacle://octave/playlist/abc")).toBe(true);
    expect(sent).toEqual([["tentacle:app-link", "tentacle://octave/playlist/abc"]]);
    expect(deliverAppLink("tentacle://app/x")).toBe(false);
  });
});
