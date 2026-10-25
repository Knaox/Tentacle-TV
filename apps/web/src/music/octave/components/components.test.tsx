import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TrackActions } from "../actions/useTrackActions";
import { externalTrack, libraryTrack } from "@tentacle-tv/shared/octave/testing";

/**
 * Octave — les composants qui disent l'état d'un titre : l'entrée du mode
 * n'apparaît qu'avec la musique, l'état hors bibliothèque se dit en MOT
 * (jamais la couleur seule), le cœur n'existe que si un geste est possible.
 */
const h = vi.hoisted(() => ({ available: true }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key), i18n: { language: "fr" } }),
}));
vi.mock("../mode/useOctaveAvailability", () => ({ useOctaveAvailability: () => ({ available: h.available, settled: true }) }));
vi.mock("../player/OctavePlayerProvider", () => ({
  useOctavePlayer: () => ({ prefetch: () => undefined }),
  useCurrentKey: () => null,
  usePlayerSelector: () => null,
}));
vi.mock("react-router-dom", () => ({
  Link: ({ to, children, className }: { to: string; children?: React.ReactNode; className?: string }) => <a href={to} className={className}>{children}</a>,
  useNavigate: () => () => undefined,
}));

const { AvailabilityMark } = await import("./AvailabilityMark");
const { TrackRow } = await import("./TrackRow");
const { FormatBadge } = await import("../shell/FormatBadge");

const actions = (canLike: boolean): TrackActions => ({
  canLike: () => canLike,
  toggleLike: () => undefined,
  canAddToPlaylist: () => canLike,
  addToPlaylist: async () => true,
});

const inRouter = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>);

beforeEach(() => {
  h.available = true;
});

describe("état d'un titre", () => {
  it("bibliothèque : rien par défaut, le mot sur demande", () => {
    expect(renderToStaticMarkup(<AvailabilityMark availability="library" />)).toBe("");
    expect(renderToStaticMarkup(<AvailabilityMark availability="library" showLibrary variant="chip" />)).toContain("availability.library");
  });
  it("en attente, prêt, hors bibliothèque, échec : chacun son mot", () => {
    for (const a of ["pending", "cache", "remote"] as const) {
      expect(renderToStaticMarkup(<AvailabilityMark availability={a} />)).toContain(`availability.${a}`);
    }
    expect(renderToStaticMarkup(<AvailabilityMark availability="pending" failed />)).toContain("availability.failed");
  });
});

describe("rangée de titre", () => {
  const row = (track: ReturnType<typeof libraryTrack>, canLike: boolean) =>
    inRouter(<TrackRow track={track} number={1} current={false} actions={actions(canLike)} index={0} onPlayIndex={() => undefined} />);

  it("un titre en attente dit son état et porte un cœur plein", () => {
    const html = row(externalTrack("demo", "r1", { availability: "pending", favorite: true }), true);
    expect(html).toContain("availability.pending");
    expect(html).toContain('aria-pressed="true"');
  });
  it("sans geste possible (aucune extension), pas de cœur", () => {
    const html = row(externalTrack("demo", "r1"), false);
    expect(html).not.toContain("track.like");
    expect(html).not.toContain("aria-pressed");
  });
  it("un titre de la bibliothèque n'affiche aucune marque d'état", () => {
    expect(row(libraryTrack("a"), true)).not.toContain("availability.");
  });
});

describe("qualité réelle", () => {
  it("le badge dit le codec, le détail et la mention haute résolution", () => {
    const html = renderToStaticMarkup(<FormatBadge format={libraryTrack("a").format} />);
    expect(html).toContain("FLAC");
    expect(html).toContain("player.hiRes");
    expect(html).toContain("96 kHz");
  });
  it("rien sans format connu", () => {
    expect(renderToStaticMarkup(<FormatBadge format={null} />)).toBe("");
  });
});
