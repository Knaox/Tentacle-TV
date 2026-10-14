import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Les lignes d'infos du bandeau, telles qu'elles s'écrivent : l'épisode et sa
 * progression d'un titre commencé, sinon les faits et les genres ; rien pour
 * une ligne qui n'a rien à dire.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}(${Object.entries(options).map(([name, value]) => `${name}=${String(value)}`).join(",")})` : key,
  }),
}));

const { PreviewInfoLines } = await import("./PreviewInfoLines");
const { previewInfoOf } = await import("./previewInfo");

const MINUTE = 60 * 10_000_000;
const render = (card: MediaItem | null, detail: MediaItem | null = null, year: number | null = null) =>
  renderToStaticMarkup(<PreviewInfoLines info={previewInfoOf(card, detail, year)} />);

describe("PreviewInfoLines", () => {
  it("un épisode commencé : son code et son titre, puis la barre et « vu sur la durée »", () => {
    const html = render({
      Id: "e", Name: "Chute libre", Type: "Episode", ParentIndexNumber: 1, IndexNumber: 1, RunTimeTicks: 58 * MINUTE,
      UserData: { PlaybackPositionTicks: 54 * MINUTE, PlayedPercentage: 93.1 },
    } as unknown as MediaItem);
    expect(html).toContain('<b>S01E01</b><span aria-hidden="true" class="card-preview-dot"></span>Chute libre');
    expect(html).toContain('style="width:93.1%"');
    expect(html).toContain("progressMinutes(watched=54,total=58)");
    expect(html.indexOf('data-line="first"')).toBeLessThan(html.indexOf('data-line="last"'));
  });

  it("au-delà de l'heure, les durées de l'app : « 1h 12min sur 2h 33min »", () => {
    const html = render({
      Id: "m", Name: "Metropolis", Type: "Movie", ProductionYear: 1927, RunTimeTicks: 153 * MINUTE,
      UserData: { PlaybackPositionTicks: 72 * MINUTE, PlayedPercentage: 47 },
    } as unknown as MediaItem);
    expect(html).toContain("progressTime(watched=1h 12min,total=2h 33min)");
    // Les faits passent en première ligne, la progression remplace les genres.
    expect(html).toContain('<span class="card-preview-year">1927</span>');
  });

  it("un épisode à suivre (pas commencé) : ses faits sous son code, sans l'année", () => {
    const html = render({
      Id: "e", Name: "Le Chat dans le sac", Type: "Episode", ParentIndexNumber: 1, IndexNumber: 2, ProductionYear: 2008,
      RunTimeTicks: 48 * MINUTE, OfficialRating: "FR-16",
    } as unknown as MediaItem);
    expect(html).toContain("<b>S01E02</b>");
    expect(html).toContain("48min");
    expect(html).not.toContain("2008");
  });

  it("seul le 4K porte la marque, chaque badge garde son nom entier pour les lecteurs d'écran", () => {
    const html = render({
      Id: "m", Name: "x", Type: "Movie", MediaStreams: [
        { Type: "Video", Width: 3840, Height: 2160, VideoRangeType: "DOVI" },
        { Type: "Audio", Profile: "Dolby TrueHD + Dolby Atmos" },
      ],
    } as unknown as MediaItem);
    expect(html).toContain('data-accent="true" aria-label="4K" title="4K">4K</span>');
    expect(html).toContain('data-accent="false" aria-label="Dolby Vision" title="Dolby Vision">VISION</span>');
    expect(html).toContain(">ATMOS</span>");
  });

  it("hors bibliothèque, l'année que donne la carte ; rien du tout sans elle", () => {
    expect(render(null, null, 2016)).toContain('<span class="card-preview-year">2016</span>');
    expect(render(null)).toBe("");
  });
});
