/**
 * La boîte des invitations ne présente qu'UNE fois chaque invitation sur un
 * appareil — rechargement, nouvel onglet, démarrage suivant compris.
 */

import { describe, expect, it } from "vitest";
import { readShownInvites, rememberShownInvites, WT_INVITES_SHOWN_KEY, WT_INVITES_SHOWN_MAX } from "./inboxShown";
import { shouldAutoOpenInbox } from "./inboxRule";

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("les invitations déjà présentées", () => {
  it("une invitation présentée ne rouvre plus la boîte après un rechargement", () => {
    const store = memoryStore();
    const firstPage = readShownInvites(store);
    expect(shouldAutoOpenInbox({ pathname: "/", startupQuiet: true, inviteIds: ["inv-1"], shownIds: firstPage })).toBe(true);
    rememberShownInvites(store, firstPage, ["inv-1"]);

    const reloaded = readShownInvites(store);
    expect(shouldAutoOpenInbox({ pathname: "/", startupQuiet: true, inviteIds: ["inv-1"], shownIds: reloaded })).toBe(false);
    // Une NOUVELLE invitation, elle, rouvre la boîte.
    expect(shouldAutoOpenInbox({ pathname: "/", startupQuiet: true, inviteIds: ["inv-1", "inv-2"], shownIds: reloaded })).toBe(true);
  });

  it("garde les dernières seulement, les plus récentes au bout", () => {
    const store = memoryStore();
    const shown = new Set<string>();
    const ids = Array.from({ length: WT_INVITES_SHOWN_MAX + 5 }, (_, i) => `inv-${i}`);
    rememberShownInvites(store, shown, ids);
    const kept = JSON.parse(store.data.get(WT_INVITES_SHOWN_KEY)!) as string[];
    expect(kept).toHaveLength(WT_INVITES_SHOWN_MAX);
    expect(kept.at(-1)).toBe(`inv-${WT_INVITES_SHOWN_MAX + 4}`);
    expect(kept).not.toContain("inv-0");
  });

  it("rien de neuf : rien n'est réécrit", () => {
    const store = memoryStore({ [WT_INVITES_SHOWN_KEY]: JSON.stringify(["inv-1"]) });
    let writes = 0;
    const counting = { getItem: store.getItem, setItem: (key: string, value: string) => { writes += 1; store.setItem(key, value); } };
    rememberShownInvites(counting, readShownInvites(store), ["inv-1"]);
    expect(writes).toBe(0);
  });

  it("une valeur illisible, ou un stockage qui refuse, ne casse rien", () => {
    expect(readShownInvites(memoryStore({ [WT_INVITES_SHOWN_KEY]: "{pas du json" }))).toEqual(new Set());
    expect(readShownInvites(memoryStore({ [WT_INVITES_SHOWN_KEY]: JSON.stringify([1, "inv-1", null]) }))).toEqual(new Set(["inv-1"]));
    const refusing = { getItem: () => null, setItem: () => { throw new Error("plein"); } };
    const shown = new Set<string>();
    expect(() => rememberShownInvites(refusing, shown, ["inv-1"])).not.toThrow();
    expect(shown.has("inv-1")).toBe(true);
  });
});
