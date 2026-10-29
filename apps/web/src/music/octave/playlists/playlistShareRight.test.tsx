/**
 * Règle 15 : « Partager » n'existe dans le menu d'une playlist qu'avec le droit du partage (capacité
 * `music.playlistShare` + « Partage public » du compte). Sans lui, ni l'entrée, ni la boîte.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { collectionActions } from "@tentacle-tv/shared/octave";

const h = vi.hoisted(() => ({ shareable: false, members: false }));
vi.mock("react-i18next", () => ({ useTranslation: (ns?: string) => ({ t: (key: string) => `${ns ?? "music"}:${key}` }) }));
vi.mock("@tentacle-tv/api-client", () => ({
  useMusicPlaylistShareAvailable: () => h.shareable,
  useMusicPlaylistMembersAvailable: () => h.members,
  usePlaylistSharingRules: (p: MusicPlaylist) => ({ isMember: p.sharing?.role === "member" }),
  // Le crochet du menu, sur le VRAI modèle partagé (serveur sans favoris : ni cœur, ni ordre).
  useCollectionMenu: (subject: { item: { playlist: MusicPlaylist } }) => ({
    key: "k",
    favorite: undefined,
    run: () => false,
    actions: collectionActions({
      kind: "playlist", favorite: undefined, canFavorite: false, ordered: false, atTop: true, canReorder: false,
      playlist: { editable: subject.item.playlist.editable, isMember: subject.item.playlist.sharing?.role === "member", canShareWith: h.members, canShareLink: h.shareable },
    }),
  }),
}));
vi.mock("./usePlaylistManagement", () => ({ usePlaylistManagement: () => ({ duplicate: async () => true }) }));
vi.mock("../../../components/floating/FloatingLayer", () => ({ FloatingLayer: ({ children }: { children: unknown }) => children }));

const { PlaylistMenuPanel } = await import("./PlaylistMenu");
const playlist: MusicPlaylist = { jellyfinId: "c".repeat(32), name: "Route", trackCount: 3, durationMs: null, artworkUrl: null, editable: true };
const render = (p: MusicPlaylist = playlist) => renderToStaticMarkup(<PlaylistMenuPanel playlist={p} anchor={{ current: null }} onClose={() => undefined} />);

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

  it("« Partager avec… » (comptes du serveur) seulement si le serveur le sait", () => {
    h.members = false;
    expect(render()).not.toContain("musicPlaylistMembers:shareWith");
    h.members = true;
    expect(render()).toContain("musicPlaylistMembers:shareWith");
  });

  it("une playlist qu'on m'a partagée : « Personnes » et « Quitter », jamais modifier, partager ni supprimer", () => {
    h.shareable = true;
    h.members = true;
    const html = render({ ...playlist, editable: false, sharing: { role: "member", right: "add", owner: { userId: "a".repeat(32), name: "Knaoxtest", imageTag: null }, members: [] } });
    expect(html).toContain("musicPlaylistMembers:people");
    expect(html).toContain("musicPlaylistMembers:leave");
    expect(html).not.toContain("music:playlistManage.delete");
    expect(html).not.toContain("musicShare:action");
    expect(html).not.toContain("music:playlistManage.editDetails");
  });
});
