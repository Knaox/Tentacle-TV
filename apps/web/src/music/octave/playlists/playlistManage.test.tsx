import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MusicPlaylist, PendingMusicItem } from "@tentacle-tv/shared/music";
import { removeWaiting, waitingOf } from "@tentacle-tv/shared/octave";

/**
 * Octave — gérer une playlist : seule une playlist que le serveur dit modifiable a son « … » ; la suppression
 * retire chez l'extension SES attentes (et elles seules), sans qu'un échec arrête les autres ; « Modifier les
 * détails » n'envoie que ce qui a changé, et pas de description face à un serveur qui ne la déclare pas.
 */
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key) }) }));
vi.mock("./usePlaylistManagement", () => ({ usePlaylistManagement: () => ({ duplicate: async () => true }) }));
vi.mock("@tentacle-tv/api-client", async (original) => ({
  ...(await original<typeof import("@tentacle-tv/api-client")>()),
  useMusicShelvesCapability: () => false,
  usePlaylistSharingRules: (p: MusicPlaylist) => ({ isMember: p.sharing?.role === "member", isShared: !!p.sharing, people: [], sharing: p.sharing ?? null, canAdd: p.editable, canRemove: p.editable }),
}));

const { PlaylistMenuButton } = await import("./PlaylistMenu");
const { detailsChange } = await import("./PlaylistDetailsDialog");

const playlist = (editable: boolean): MusicPlaylist => ({ jellyfinId: "c".repeat(32), name: "Route", trackCount: 3, durationMs: null, artworkUrl: null, editable });
const wait = (operationId: string, playlistId: string | null, kind: PendingMusicItem["kind"] = "playlistAdd") => ({ operationId, playlistId, kind }) as PendingMusicItem;

describe("le menu « … » d'une playlist", () => {
  it("une playlist modifiable : un bouton nommé qui ouvre un menu", () => {
    const html = renderToStaticMarkup(<PlaylistMenuButton playlist={playlist(true)} open={false} onOpenChange={() => undefined} />);
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain("playlistManage.more");
  });

  it("une playlist d'un autre compte (non modifiable) : rien", () => {
    expect(renderToStaticMarkup(<PlaylistMenuButton playlist={playlist(false)} open={false} onOpenChange={() => undefined} />)).toBe("");
  });

  it("une playlist qu'un autre compte m'a partagée : un « … » (pour voir les personnes ou la quitter)", () => {
    const shared: MusicPlaylist = { ...playlist(false), sharing: { role: "member", right: "read", owner: { userId: "a".repeat(32), name: "Knaoxtest", imageTag: null }, members: [] } };
    expect(renderToStaticMarkup(<PlaylistMenuButton playlist={shared} open={false} onOpenChange={() => undefined} />)).toContain('aria-haspopup="menu"');
  });
});

describe("supprimer : les attentes de la playlist chez l'extension", () => {
  const id = "c".repeat(32);
  const dashed = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;

  it("seulement celles de CETTE playlist (identifiant avec ou sans tirets), jamais un like ni une autre playlist", () => {
    const pending = [wait("a", id), wait("b", dashed.toUpperCase()), wait("c", "d".repeat(32)), wait("d", null, "like")];
    expect(waitingOf(pending, id).map((p) => p.operationId)).toEqual(["a", "b"]);
  });

  it("un titre importé DÉJÀ ARRIVÉ (entrée Jellyfin, plus une attente) : aucun appel à l'extension, il reste dans la bibliothèque", async () => {
    const calls: string[] = [];
    // Plus d'attente pour cette playlist : ses titres importés sont tous arrivés.
    const waiting = waitingOf([wait("x", "d".repeat(32))], id).map((p) => p.operationId);
    expect(await removeWaiting(waiting, async (op) => (calls.push(op), true))).toBe(0);
    expect(calls).toEqual([]);
  });

  it("retirées quatre à la fois au plus ; un refus n'arrête pas les autres", async () => {
    let running = 0;
    let peak = 0;
    const seen: string[] = [];
    const removed = await removeWaiting(Array.from({ length: 10 }, (_, i) => `op${i}`), async (op) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 1));
      running -= 1;
      seen.push(op);
      if (op === "op3") throw new Error("503");
      return op !== "op5";
    });
    expect(seen).toHaveLength(10);
    expect(removed).toBe(8);
    expect(peak).toBeLessThanOrEqual(4);
  });
});

describe("modifier les détails", () => {
  const before = { name: "Route", description: "Pour rouler" };

  it("seulement ce qui a changé ; rien si rien n'a changé ou si le nom est vide", () => {
    expect(detailsChange(before, { name: "Route", description: "Pour rouler" }, true)).toBeNull();
    expect(detailsChange(before, { name: "  Été  ", description: "Pour rouler" }, true)).toEqual({ name: "Été" });
    expect(detailsChange(before, { name: "Route", description: "" }, true)).toEqual({ description: "" });
    expect(detailsChange(before, { name: "   ", description: "x" }, true)).toBeNull();
  });

  it("serveur sans `music.playlistManage` : jamais de description envoyée", () => {
    expect(detailsChange(before, { name: "Route", description: "autre" }, false)).toBeNull();
    expect(detailsChange(before, { name: "Neuf", description: "autre" }, false)).toEqual({ name: "Neuf" });
  });
});
