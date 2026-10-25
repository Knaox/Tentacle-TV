import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { externalTrack } from "@tentacle-tv/shared/octave/testing";

/**
 * Octave — un titre CHOISI qui ne peut pas être lu reste dans la barre, avec son message et « Réessayer »
 * (Damien, 25/10 : « je m'en fous du titre suivant, je veux lire CE titre ») ; « Réessayer » relance CE titre,
 * comme un geste, par le vrai `queueActions.retry`.
 */
const chosen = externalTrack("sillon", "ytm:t:abc");
const h = vi.hoisted(() => ({ snapshot: {} as Record<string, unknown>, starts: [] as unknown[][], invalidated: [] as string[] }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "fr" } }) }));
vi.mock("react-router-dom", () => ({ Link: ({ children }: { children?: ReactNode }) => <a>{children}</a> }));
// La pochette et le cœur ont leurs propres tests (client Jellyfin, extension) : ici, des marques.
vi.mock("../components/Artwork", () => ({ Artwork: () => <span data-artwork /> }));
vi.mock("../components/HeartButton", () => ({ HeartButton: () => <span data-heart /> }));
vi.mock("../components/TrackMenu", () => ({ TrackMenu: ({ visible }: { visible?: string }) => <span data-track-menu={visible} /> }));
vi.mock("../actions/useTrackActions", () => ({ useTrackActions: () => ({ canLike: () => false, toggleLike: () => undefined, canAddToPlaylist: () => false, addToPlaylist: async () => false }) }));
vi.mock("../player/OctavePlayerProvider", () => ({
  usePlayerSelector: (select: (s: Record<string, unknown>) => unknown) => select(h.snapshot),
  useOctavePlayer: () => ({
    snapshot: { get: () => h.snapshot },
    deps: { sources: { invalidate: (key: string) => h.invalidated.push(key) } },
    startItem: (...args: unknown[]) => h.starts.push(args),
  }),
}));

const { NowPlayingInfo } = await import("./NowPlayingInfo");

/** Le bouton de l'arbre rendu par le composant (sans DOM : on lit ses éléments). */
function findButton(node: ReactNode): ReactElement<{ onClick?: () => void; children?: ReactNode }> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findButton(child as ReactNode);
      if (hit) return hit;
    }
    return null;
  }
  const el = node as ReactElement<{ children?: ReactNode; onClick?: () => void }>;
  if (el.type === "button") return el;
  return findButton(el.props?.children);
}

const render = () => (NowPlayingInfo as unknown as { type: (p: object) => ReactNode }).type({});

beforeEach(() => {
  h.snapshot = { current: chosen, error: "noSource", notice: null, queue: { items: [], cursor: 0 } };
  h.starts = [];
  h.invalidated = [];
});

describe("un titre qui ne peut pas être lu", () => {
  it("reste affiché, avec son message et « Réessayer »", () => {
    const html = renderToStaticMarkup(<NowPlayingInfo />);
    expect(html).toContain(`data-octave-now-playing="${chosen.key}"`);
    expect(html).toContain("player.noSource");
    expect(html).toContain('role="status"');
    expect(html).toMatch(/<button type="button"[^>]*>player\.retry<\/button>/);
  });

  it("« Réessayer » relance CE titre, comme un geste (intention `retry`)", () => {
    const button = findButton(render());
    expect(button?.props.children).toBe("player.retry");
    button?.props.onClick?.();
    expect(h.invalidated).toEqual([chosen.key]);
    expect(h.starts).toEqual([[h.snapshot.queue, 0, "chosen", "retry"]]);
  });

  it("une coupure en lecture : le même « Réessayer »", () => {
    h.snapshot = { ...h.snapshot, error: "engine" };
    const html = renderToStaticMarkup(<NowPlayingInfo />);
    expect(html).toContain("player.engineError");
    expect(html).toContain("player.retry");
  });

  it("pendant le nouvel essai : plus de bouton, « Lecture dans un instant… » si la source tarde", () => {
    h.snapshot = { ...h.snapshot, error: null, notice: "retrySoon" };
    const html = renderToStaticMarkup(<NowPlayingInfo />);
    expect(html).toContain("player.retrySoon");
    expect(html).not.toContain("player.retry<");
  });

  it("tout va bien : les artistes, aucun bouton", () => {
    h.snapshot = { ...h.snapshot, error: null, notice: null };
    const html = renderToStaticMarkup(<NowPlayingInfo />);
    expect(html).not.toContain("<button type=\"button\"");
  });

  it("le titre EN COURS a son menu (playlist : ajouter, retirer), toujours visible (25/10)", () => {
    h.snapshot = { ...h.snapshot, error: null, notice: null };
    expect(renderToStaticMarkup(<NowPlayingInfo />)).toContain('data-track-menu="always"');
  });
});
