import { describe, expect, it, vi } from "vitest";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { externalTrack, libraryTrack } from "@tentacle-tv/shared/octave/testing";

// Le composant n'est pas rendu ici (tests purs, sans React Native) : seule sa règle est lue.
vi.mock("react-native", () => ({ Pressable: () => null, StyleSheet: { create: (s: unknown) => s }, View: () => null }));
vi.mock("lucide-react-native", () => ({ Ellipsis: () => null, Heart: () => null, ListPlus: () => null }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock("@tentacle-tv/api-client", () => ({ openPlaylistChooser: () => undefined, useLiked: () => false }));
vi.mock("@/utils/haptics", () => ({ haptic: () => undefined }));
vi.mock("../pages/actions/trackSheetStore", () => ({ openTrackSheet: () => undefined }));
vi.mock("../pages/env/useMobileActionsUi", () => ({ useMobileTrackActions: () => null }));
vi.mock("./OctavePlayerContext", () => ({ usePlayerSelector: () => null }));
vi.mock("../theme/octaveColors", () => ({ useOctaveColors: () => ({}) }));

const { nowPlayingActionsShown } = await import("./NowPlayingActions");

/**
 * Règle 15 du lot : dans le lecteur plein écran, le cœur et « Ajouter à une playlist » ne paraissent que si les
 * gestes PARTAGÉS (`useTrackActions`, droits du compte compris) les permettent pour ce titre ; le menu reste.
 */
describe("lecteur plein écran : les gestes du titre et leurs droits", () => {
  const external = externalTrack("sillon", "yt:1");
  const library = libraryTrack("a");

  it("sans le droit d'ajouter (titre hors bibliothèque, compte sans « Peut ajouter ») : ni cœur ni playlist", () => {
    const denied = { canLike: (t: MusicTrack) => t.availability === "library", canAddToPlaylist: (t: MusicTrack) => t.availability === "library" };
    expect(nowPlayingActionsShown(denied, external)).toEqual({ like: false, addToPlaylist: false, menu: true });
    expect(nowPlayingActionsShown(denied, library)).toEqual({ like: true, addToPlaylist: true, menu: true });
  });

  it("avec le droit : les deux gestes, comme au bureau", () => {
    const allowed = { canLike: () => true, canAddToPlaylist: () => true };
    expect(nowPlayingActionsShown(allowed, external)).toEqual({ like: true, addToPlaylist: true, menu: true });
  });

  it("chaque geste se lit à part (le cœur sans la playlist, par exemple)", () => {
    const likeOnly = { canLike: () => true, canAddToPlaylist: () => false };
    expect(nowPlayingActionsShown(likeOnly, external)).toEqual({ like: true, addToPlaylist: false, menu: true });
  });
});
