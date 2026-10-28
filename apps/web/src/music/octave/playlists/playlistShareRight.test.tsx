/**
 * Règle 15 : « Partager » n'existe dans le menu d'une playlist qu'avec le droit du partage (capacité
 * `music.playlistShare` + « Partage public » du compte). Sans lui, ni l'entrée, ni la boîte.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";

const h = vi.hoisted(() => ({ shareable: false }));
vi.mock("react-i18next", () => ({ useTranslation: (ns?: string) => ({ t: (key: string) => `${ns ?? "music"}:${key}` }) }));
vi.mock("@tentacle-tv/api-client", () => ({ useMusicPlaylistShareAvailable: () => h.shareable }));
vi.mock("./usePlaylistManagement", () => ({ usePlaylistManagement: () => ({ duplicate: async () => true }) }));
vi.mock("../../../components/floating/FloatingLayer", () => ({ FloatingLayer: ({ children }: { children: unknown }) => children }));

const { PlaylistMenuPanel } = await import("./PlaylistMenu");
const playlist: MusicPlaylist = { jellyfinId: "c".repeat(32), name: "Route", trackCount: 3, durationMs: null, artworkUrl: null, editable: true };
const render = () => renderToStaticMarkup(<PlaylistMenuPanel playlist={playlist} anchor={{ current: null }} onClose={() => undefined} />);

describe("le menu d'une playlist et le partage", () => {
  it("sans le droit : aucune entrée « Partager »", () => {
    h.shareable = false;
    const html = render();
    expect(html).toContain("music:playlistManage.duplicate");
    expect(html).not.toContain("musicShare:action");
  });

  it("avec le droit : « Partager » est offert", () => {
    h.shareable = true;
    expect(render()).toContain("musicShare:action");
  });
});
