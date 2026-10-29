import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MusicHomeMix, MusicTrack } from "@tentacle-tv/shared/music";

/**
 * Octave — un mix de l'accueil se consulte comme un album : la carte OUVRE sa page (le bouton rond lit), la page
 * montre sa jaquette, ses artistes, ses titres, et dit « introuvable » pour un mix renouvelé.
 */
const h = vi.hoisted(() => ({ home: undefined as unknown, pending: false, id: "artist:air" }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, o?: Record<string, string>) => (o?.artist ? `${key}:${o.artist}` : o?.title ? `${key}:${o.title}` : key), i18n: { language: "fr" } }) }));
vi.mock("../../../lib/backendBase", () => ({ getBackendBase: () => "" }));
vi.mock("@tentacle-tv/api-client", () => ({ useJellyfinClient: () => ({ getToken: () => null, useCredentials: true }), useMusicHome: () => ({ data: h.home, isPending: h.pending, fetchStatus: h.pending ? "fetching" : "idle", refetch: () => undefined }) }));
vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...rest }: { to: string; children?: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
  useParams: () => ({ id: h.id }),
}));
vi.mock("../player/OctavePlayerProvider", () => ({ useOctavePlayer: () => ({ prefetch: () => undefined, playList: () => undefined, togglePlay: () => undefined }), usePlayerSelector: () => false }));
vi.mock("../motion/NowSwell", () => ({ CollectionSwell: () => null }));
vi.mock("../components/TrackList", () => ({
  rowsOf: (tracks: MusicTrack[]) => tracks,
  TrackList: ({ rows, contextId }: { rows: MusicTrack[]; contextId: string }) => <ol data-context={contextId}>{rows.map((r) => <li key={r.key}>{r.title}</li>)}</ol>,
}));
vi.mock("../components/CollectionHeader", () => ({
  CollectionHeader: ({ kicker, title, art, meta }: { kicker: string; title: string; art: React.ReactNode; meta: React.ReactNode }) => (
    <header>
      <span>{kicker}</span>
      <h1>{title}</h1>
      {art}
      <p>{meta}</p>
    </header>
  ),
  Dot: () => <span>·</span>,
  useCountAndDuration: (n: number) => `${n} titres`,
}));

const { MixCard } = await import("./MixCard");
const { MixView } = await import("./MixView");

const track = (i: number): MusicTrack => ({ key: `t${i}`, title: `Titre ${i}`, artworkUrl: `/art/${i}`, durationMs: 1000, artists: [], album: null, jellyfinId: `j${i}` }) as unknown as MusicTrack;
const MIX: MusicHomeMix = { id: "artist:air", kind: "artist", artist: { name: "Air" } as MusicHomeMix["artist"], artistNames: ["Air", "Justice"], tracks: [1, 2, 3, 4, 5].map(track) };

beforeEach(() => {
  h.home = { forYou: { mixes: [MIX] } };
  h.pending = false;
  h.id = "artist:air";
});

describe("MixCard", () => {
  it("la carte ouvre la page du mix ; le bouton rond, à part, le lit", () => {
    const html = renderToStaticMarkup(<MixCard mix={MIX} />);
    expect(html).toContain('href="/octave/home-mix/artist%3Aair"');
    expect(html).toContain('aria-label="octaveHome.mixOpen:octaveHome.mixArtist:Air"');
    expect(html).toContain('aria-label="octaveHome.mixPlay:octaveHome.mixArtist:Air"');
  });
});

describe("MixView", () => {
  it("la page : sa nature, son nom, la jaquette 2 × 2, ses artistes, ses titres, la file de la carte", () => {
    const html = renderToStaticMarkup(<MixView />);
    expect(html).toContain("octaveHome.mixKicker");
    expect(html).toContain("<h1>octaveHome.mixArtist:Air</h1>");
    expect(html).toContain("Air et Justice");
    expect(html.match(/<img /g)).toHaveLength(4);
    expect(html).toContain('data-context="home:mix:artist:air"');
    expect(html).toContain("Titre 5");
  });
  it("un mix renouvelé depuis : « introuvable », sans erreur", () => {
    h.id = "artist:old";
    expect(renderToStaticMarkup(<MixView />)).toContain("octaveHome.mixNotFound");
  });
  it("l'accueil pas encore là : l'attente, pas « introuvable »", () => {
    h.home = undefined;
    h.pending = true;
    expect(renderToStaticMarkup(<MixView />)).not.toContain("octaveHome.mixNotFound");
  });
});
