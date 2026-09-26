import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PlaybackOverlayResult } from "@tentacle-tv/api-client";
import type { MediaItem, PlayerOverlay } from "@tentacle-tv/shared";

/**
 * Rendu statique de la surcouche : on prouve ce qui est à l'écran selon l'état
 * (chargement, habillage, pilule de l'arbitre), pas le geste. `t()` rend la
 * clé ; l'api-client et le trickplay sont remplacés.
 */
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, opts?: { seconds?: number }) => (opts?.seconds != null ? `${key}:${opts.seconds}` : key) }),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => () => undefined }));
vi.mock("@tentacle-tv/api-client", () => ({
  useEpisodeNavigation: () => ({ nextEpisode: null, previousEpisode: null, isLoading: false }),
  useEndCardRating: () => null,
  useJellyfinClient: () => ({ getImageUrl: (id: string, type: string) => `/img/${id}/${type}` }),
  useSeasons: () => ({ data: [] }),
  useEpisodes: () => ({ data: [] }),
  useWatchedToggle: () => ({ markWatched: { mutate: () => undefined }, markUnwatched: { mutate: () => undefined } }),
  useBatchWatchedToggle: () => ({ markWatched: { mutate: () => undefined, isPending: false }, markUnwatched: { mutate: () => undefined, isPending: false } }),
}));
vi.mock("../../hooks/useTrickplay", () => ({
  useTrickplay: () => ({ available: false, info: null, getFrameAt: () => null, preloadNeighbors: () => undefined }),
}));
vi.mock("../../components/rating/StarRating", () => ({ StarRating: () => null }));

const { MirrorPlayerOverlay } = await import("./MirrorPlayerOverlay");

const noop = () => undefined;
const episode = { Id: "ep1", Name: "Pilote", Type: "Episode", SeriesId: "s1", SeasonId: "se1" } as MediaItem;

function render(opts: { hasStarted?: boolean; visible?: boolean; overlay?: PlayerOverlay; subtitles?: boolean }) {
  const playback = {
    overlay: opts.overlay ?? { kind: "none" },
    countdownTotals: { skipMs: 5000, nextMs: 10000 },
    skipNow: noop, dismissOverlay: noop, playNow: noop, cancelNextCountdown: noop,
  } as unknown as PlaybackOverlayResult;
  return renderToStaticMarkup(
    <MirrorPlayerOverlay
      controls={{
        playing: true, currentTime: 65, duration: 1300, buffered: 0.2, volume: 1, fullscreen: false,
        item: episode, title: "Série",
        audioTracks: [{ index: 1, label: "French - AAC" }],
        subtitleTracks: opts.subtitles ? [{ index: 3, label: "English - SRT" }] : [],
        currentAudio: 1, currentSubtitle: null, currentQuality: "original",
        onTogglePlay: noop, onSeek: noop, onVolumeChange: noop, onToggleMute: noop,
        onToggleFullscreen: noop, onBack: noop, onAudioChange: noop, onSubtitleChange: noop,
      }}
      playback={playback}
      bridge={{ visible: opts.visible ?? true, setVisible: noop, setScrubbing: noop }}
      media={{
        hasStarted: opts.hasStarted ?? true, loading: false, showPlayButton: false, setShowPlayButton: noop,
        videoRef: { current: null }, userInteractedRef: { current: false },
      }}
    />,
  );
}

describe("MirrorPlayerOverlay", () => {
  it("montre l'écran de chargement de l'app, et rien d'autre, avant la première image", () => {
    const html = render({ hasStarted: false });
    expect(html).toContain('role="progressbar"');
    expect(html).not.toContain('aria-label="settings"');
  });

  it("pose l'habillage : retour, titre de l'épisode, temps, épisodes et réglages", () => {
    const html = render({});
    expect(html).toContain('aria-label="back"');
    expect(html).toContain("Pilote");
    expect(html).toContain("1:05");
    expect(html).toContain("21:40");
    expect(html).toContain('aria-label="episodes"');
    expect(html).toContain('aria-label="settings"');
    expect(html).not.toContain('role="progressbar"');
  });

  it("n'offre les sous-titres que s'il y a des pistes", () => {
    expect(render({})).not.toContain('aria-label="subtitles"');
    expect(render({ subtitles: true })).toContain('aria-label="subtitles"');
  });

  it("retire l'habillage masqué mais garde la pilule de l'arbitre", () => {
    const html = render({
      visible: false,
      overlay: {
        kind: "skip", segmentType: "Intro", labelKey: "skipIntro", action: "seek",
        countdownSeconds: 4, auto: true, dismissible: true,
      } as unknown as PlayerOverlay,
    });
    expect(html).not.toContain('aria-label="back"');
    expect(html).toContain("skipIntroIn:4");
    expect(html).toContain('aria-label="dismiss"');
  });
});
