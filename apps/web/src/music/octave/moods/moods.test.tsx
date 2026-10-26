import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ExternalMusicMood } from "@tentacle-tv/shared/music";

/**
 * Octave — les ambiances montées : sans extension qui déclare `moods` ET `mood`, rien (ni titre, ni squelette, ni
 * requête) ; avec, la rangée de l'accueil, les puces de la recherche vide, le résultat d'une recherche qui en nomme
 * une.
 */
const h = vi.hoisted(() => ({ music: {} as Record<string, string>, data: undefined as unknown, enabled: [] as boolean[] }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "fr" } }) }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ enabled }: { enabled: boolean }) => {
    h.enabled.push(enabled);
    return { data: enabled ? h.data : undefined, isPending: enabled && h.data === undefined };
  },
  useQueryClient: () => ({ fetchQuery: async () => null }),
}));
vi.mock("../mode/useOctaveProvider", () => ({ useOctaveProvider: () => ({ pluginId: "sillon", name: "Sillon", music: { search: "/s", resolve: "/r", ...h.music } }) }));
vi.mock("../player/OctavePlayerProvider", () => ({ useOctavePlayer: () => ({ prefetch: () => undefined, playList: () => undefined }), usePlayerSelector: () => null }));
vi.mock("react-router-dom", () => ({ Link: ({ to, children, className }: { to: string; children?: React.ReactNode; className?: string }) => <a href={to} className={className}>{children}</a> }));
vi.mock("../components/CardRow", () => ({
  CardRow: ({ items, render }: { items: unknown[]; render: (i: unknown) => React.ReactNode }) => <div>{items.map(render)}</div>,
  CardRowSkeleton: () => <div data-skeleton />,
}));

const { HomeMoodsSlot, SearchHomeMoodsSlot, SearchMoodResultsSlot } = await import("../home/ambianceSlots");

const MOODS: ExternalMusicMood[] = [
  { id: "chill", name: "Détente", color: "#2f6f8f", artworkUrl: null, keywords: ["détente", "chill"] },
  { id: "sleep", name: "Sommeil", color: "#2d3a63", artworkUrl: null, keywords: ["sommeil", "dormir"] },
];
const render = () => [
  renderToStaticMarkup(<HomeMoodsSlot />),
  renderToStaticMarkup(<SearchHomeMoodsSlot onSearch={() => undefined} />),
  renderToStaticMarkup(<SearchMoodResultsSlot query="chill" onSearch={() => undefined} />),
];

beforeEach(() => {
  h.music = {};
  h.data = undefined;
  h.enabled = [];
});

describe("les ambiances dans Octave", () => {
  it("une extension d'avant (ou un seul des deux points) : rien, aucune requête", () => {
    expect(render()).toEqual(["", "", ""]);
    h.music = { moods: "/music/moods" };
    expect(render()).toEqual(["", "", ""]);
    expect(h.enabled.every((e) => e === false)).toBe(true);
  });

  it("avec les deux points : la rangée, les puces, l'ambiance nommée par la recherche", () => {
    h.music = { moods: "/music/moods", mood: "/music/mood" };
    h.data = MOODS;
    const [home, chips, results] = render();
    expect(home).toContain("moods.shelf");
    expect(home).toContain("Détente");
    expect(home).toContain('href="/octave/mood/chill"');
    expect(chips).toContain("moods.searchTitle");
    expect(chips).toContain("Sommeil");
    expect(results).toContain("Détente");
    expect(results).not.toContain("Sommeil");
    expect(renderToStaticMarkup(<SearchMoodResultsSlot query="daft punk" onSearch={() => undefined} />)).toBe("");
  });

  it("pendant l'attente : la place de la rangée, rien dans la recherche", () => {
    h.music = { moods: "/music/moods", mood: "/music/mood" };
    const [home, chips, results] = render();
    expect(home).toContain("data-skeleton");
    expect([chips, results]).toEqual(["", ""]);
  });
});
