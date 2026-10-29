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
// Le « + » lit les playlists (client de requêtes) : ici, une marque — sa règle a son propre test (lastPlaylist).
vi.mock("./QuickAddButton", () => ({ QuickAddButton: () => <span data-quick-add /> }));
vi.mock("react-router-dom", () => ({
  Link: ({ to, children, className }: { to: string; children?: React.ReactNode; className?: string }) => <a href={to} className={className}>{children}</a>,
  useNavigate: () => () => undefined,
}));

vi.mock("../actions/useCollectionPlayback", () => ({ useCollectionPlayback: () => ({ play: () => undefined, warm: () => undefined }) }));
vi.mock("../data/entityIntent", () => ({ useEntityIntent: () => ({}) }));
vi.mock("./Artwork", () => ({ Artwork: () => null }));
// Le menu d'une carte (favori, ordre, gestion) lit le serveur : ici, la carte seule — son modèle a ses tests.
vi.mock("../collections/CardMenuFrame", () => ({ CardMenuFrame: ({ children }: { children: (h: object) => React.ReactNode }) => children({}) }));

const { AvailabilityMark } = await import("./AvailabilityMark");
const { AlbumCard } = await import("./Cards");
const { TrackRow } = await import("./TrackRow");
const { FormatBadge } = await import("../shell/FormatBadge");

const actions = (canLike: boolean): TrackActions => ({
  canLike: () => canLike,
  toggleLike: () => undefined,
  canAddToPlaylist: () => canLike,
  addToPlaylist: async () => true,
  canRemoveFromPlaylist: () => canLike,
  removeFromPlaylist: async () => true,
  removePending: async () => true,
  createPlaylistAndAdd: async () => true,
  quickAdd: async () => true,
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
  it("un échec dit POURQUOI, en mot : la note de l'extension (25/10)", () => {
    const note = "Ne peut pas entrer dans la bibliothèque : aucun identifiant MusicBrainz.";
    const html = inRouter(<TrackRow track={externalTrack("demo", "r1", { availability: "pending" })} number={1} current={false} failed note={note} actions={actions(true)} index={0} onPlayIndex={() => undefined} />);
    expect(html).toContain("availability.failed");
    expect(html).toContain(`· ${note}`);
  });
  it("chaque rangée porte le « + » de l'ajout rapide (25/10)", () => {
    expect(row(libraryTrack("a"), true)).toContain("data-quick-add");
  });
  it("un titre de la bibliothèque n'affiche aucune marque d'état", () => {
    expect(row(libraryTrack("a"), true)).not.toContain("availability.");
  });
  it("dans une liste qui mêle, le titre de la bibliothèque porte sa marque (mot pour les lecteurs d'écran)", () => {
    const html = inRouter(<TrackRow track={libraryTrack("a")} number={1} current={false} markLibrary actions={actions(true)} index={0} onPlayIndex={() => undefined} />);
    expect(html).toContain("availability.library");
  });
});

describe("carte d'album", () => {
  const album = { key: "ext:demo:al", jellyfinId: null, external: { pluginId: "demo", id: "al" }, title: "Al", artists: [], year: null, releaseDate: null, kind: "album" as const, artworkUrl: null, trackCount: 3, durationMs: null, mbids: { release: null, releaseGroup: null } };
  it("en entier ou en partie dans la bibliothèque : la pastille, en mot", () => {
    expect(inRouter(<AlbumCard album={{ ...album, key: "jf:x", jellyfinId: "x", external: null }} ownership="full" />)).toContain("availability.albumFull");
    const partial = inRouter(<AlbumCard album={album} ownership="partial" />);
    expect(partial).toContain("availability.albumPartial");
    expect(partial).toContain("availability.partlyShort");
  });
  it("sans correspondance, aucune pastille", () => {
    expect(inRouter(<AlbumCard album={album} />)).not.toContain("availability.");
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

/** La sélection multiple (25/10) : la case est une vraie case, la rangée choisie le dit ; le « − » d'une playlist nomme le titre. */
describe("sélection et retrait d'une rangée", () => {
  const row = (extra: Record<string, unknown>) =>
    inRouter(<TrackRow track={libraryTrack("a")} number={1} current={false} actions={actions(true)} index={0} onPlayIndex={() => undefined} {...extra} />);

  it("sans sélection possible : aucune case, aucun état choisi", () => {
    const html = row({});
    expect(html).not.toContain('role="checkbox"');
    expect(html).not.toContain("aria-selected");
  });

  it("choisie : case cochée, rangée « selected », case visible sans survol", () => {
    const html = row({ onSelect: () => undefined, selected: true, selecting: true });
    expect(html).toMatch(/role="checkbox" aria-checked="true"/);
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("selection.select");
    expect(html).not.toMatch(/role="checkbox"[^>]*octave-hover-reveal/);
  });

  it("hors sélection : la case attend le survol", () => {
    expect(row({ onSelect: () => undefined })).toMatch(/role="checkbox" aria-checked="false"[^>]*octave-hover-reveal/);
  });

  it("dans une playlist modifiable : le « − » rapide, au nom du titre", () => {
    const html = row({ rowKey: "a", onRemoveRow: () => undefined });
    expect(html).toContain("playlist.removeQuick");
    expect(row({})).not.toContain("playlist.removeQuick");
  });
});
