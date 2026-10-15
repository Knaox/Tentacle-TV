import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { i18n, initI18n, type MediaItem } from "@tentacle-tv/shared";

/**
 * La fiche d'un titre SANS images ni métadonnées (Jellyfin qui n'a rien
 * trouvé) : elle s'affiche — titre, visuels de repli, « Lecture » — et le
 * bouton lance bien la lecture. Rien n'y dépend d'une image : une image
 * annoncée puis en échec (404) n'empêche pas les boutons d'être là.
 *
 * Rendu statique, comme les autres bancs de composants ; le clic se prouve
 * en appelant le geste que la pilule reçoit. Les sections du bas, la note,
 * la visionneuse et les crochets de l'api-client sont remplacés (chargés en
 * vrai, ils tirent une seconde copie de React).
 */

const state = vi.hoisted(() => ({
  item: undefined as MediaItem | undefined,
  watch: undefined as unknown,
  admin: true,
  capabilities: new Set<string>(["admin.libraryRescan"]),
  clicks: [] as Array<() => void>,
  navigate: vi.fn(),
  rescans: [] as unknown[],
}));

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => undefined },
  useTranslation: (ns: string | string[]) => ({ t: i18n.getFixedT(null, ns), i18n }),
}));

// framer-motion : balises nues, sans ses props d'animation.
const MOTION_PROPS = new Set(["initial", "animate", "exit", "variants", "transition", "whileInView", "whileHover", "whileTap", "viewport", "layout", "onAnimationComplete"]);
vi.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: (_target, tag: string) => ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) =>
      createElement(tag, Object.fromEntries(Object.entries(props).filter(([key]) => !MOTION_PROPS.has(key))), children),
  }),
  AnimatePresence: ({ children }: { children?: ReactNode }) => children,
  useReducedMotion: () => false,
}));

// Le routeur embarque sa propre copie de React : remplacé par ce que la fiche en lit.
vi.mock("react-router-dom", () => ({
  useParams: () => ({ itemId: state.item?.Id }),
  useSearchParams: () => [new URLSearchParams(), () => undefined],
  useNavigate: () => state.navigate,
  Link: ({ to, children, className }: { to: string; children?: ReactNode; className?: string }) => <a href={to} className={className}>{children}</a>,
}));

vi.mock("@tentacle-tv/api-client", () => ({
  useMediaItem: (id: string | undefined) => ({
    data: id && id === state.item?.Id ? state.item : undefined,
    isLoading: false, isError: false, error: null, isFetching: false, refetch: () => undefined,
  }),
  useSeriesWatchState: (id: string | undefined) => ({ data: id ? state.watch : undefined }),
  useSimilarItems: () => ({ data: undefined }),
  useCollectionItems: () => ({ data: undefined }),
  useTmdbSeasonEpisodes: () => ({ data: undefined }),
  useJellyfinClient: () => ({ getImageUrl: (id: string, type: string) => `/img/${id}/${type}`, getAccessToken: () => "jeton" }),
  useServerCapability: (key: string) => state.capabilities.has(key),
  useAdminMetadataStatus: () => ({ data: { tmdb: { configured: false } } }),
  useMetadataArrival: () => undefined,
  useLibraryRescan: () => ({ mutate: (item: unknown) => state.rescans.push(item), isPending: false, isSuccess: false, isError: false, error: null }),
  libraryRescanErrorCode: () => "failed",
  tmdbIdForItem: () => null,
  ratingIdentityForItem: () => null,
  episodeRatingIdentityFor: () => null,
}));

vi.mock("../components/ui/PressableScale", () => ({
  PressableScale: ({ children, onClick, ...props }: { children?: ReactNode; onClick?: () => void; "aria-label"?: string }) => {
    if (onClick) state.clicks.push(onClick);
    return <button type="button" aria-label={props["aria-label"]} data-pressable>{children}</button>;
  },
}));
vi.mock("../components/userMenu/menuItems", () => ({ getUserInfo: () => ({ name: "Damien", initial: "D", isAdmin: state.admin }) }));
vi.mock("../hooks/useMediaWarmup", () => ({ useMediaWarmup: () => undefined }));
vi.mock("../hooks/useInViewport", () => ({ useInViewport: () => ({ ref: () => undefined, visible: false }) }));
vi.mock("../components/hero/HeroAmbilight", () => ({ HeroAmbilight: () => null }));
vi.mock("../components/hero/AmbilightLayer", () => ({ AmbilightLayer: () => null }));
vi.mock("../components/media/CardMetaOverlay", () => ({ CardMetaOverlay: () => null }));
vi.mock("../components/detail/DetailSections", () => ({ DetailSections: () => <section data-sections /> }));
vi.mock("../components/detail/DetailImageViewer", () => ({ DetailImageViewer: () => null }));
vi.mock("../components/detail/DetailScoreline", () => ({ DetailScoreline: () => null }));
vi.mock("../components/detail/DetailMetadata", () => ({ DetailMetadata: () => null }));
vi.mock("../components/detail/DetailPlaceholder", () => ({ DetailPlaceholder: () => <p data-placeholder /> }));
vi.mock("../components/detail/DetailActionCapsule", () => ({ DetailActionCapsule: () => null }));
vi.mock("../components/detail/TrailerButton", () => ({ TrailerButton: () => null }));
vi.mock("../components/detail/TrailerHelpHint", () => ({ TrailerHelpHint: () => null }));
vi.mock("../components/rating/DetailRating", () => ({ DetailRating: () => null }));
vi.mock("../components/detail/DetailVersionPicker", () => ({ DetailVersionPicker: () => null }));
// « ⋯ » (supprimer de la bibliothèque) lit ses droits au serveur : hors sujet ici.
vi.mock("../components/libraryDelete/ItemMoreMenu", () => ({ ItemMoreMenu: () => null }));

const { MediaDetail } = await import("./MediaDetail");

const render = (item: MediaItem) => {
  state.item = item;
  state.clicks = [];
  return renderToStaticMarkup(<MediaDetail />);
};

const EPISODE: MediaItem = { Id: "ep1", Name: "Caminandes S01E01", Type: "Episode", IndexNumber: 1, ParentIndexNumber: 1, SeriesId: "serie" };

beforeAll(async () => {
  initI18n();
  await i18n.changeLanguage("fr");
});

beforeEach(() => {
  state.navigate.mockReset();
  state.watch = { type: "start", episode: EPISODE };
  state.admin = true;
  state.capabilities = new Set(["admin.libraryRescan"]);
  state.rescans = [];
});

describe("la fiche d'un titre sans images ni métadonnées", () => {
  it("une série réduite à Id, Name, Type s'affiche, avec ses visuels de repli", () => {
    const html = render({ Id: "serie", Name: "Caminandes", Type: "Series" });
    expect(html).not.toContain("data-placeholder");
    expect(html).toContain("Caminandes");
    expect(html).toContain('data-detail-fallback="stage"');
    expect(html).toContain('data-detail-fallback="poster"');
    // Aucune image demandée : rien d'annoncé, rien à faire échouer.
    expect(html).not.toContain("/img/serie/");
  });

  it("« Lecture » est là et lance le premier épisode", () => {
    const html = render({ Id: "serie", Name: "Caminandes", Type: "Series" });
    expect(html).toContain("Lecture");
    expect(state.clicks).toHaveLength(1);
    state.clicks[0]();
    expect(state.navigate).toHaveBeenCalledWith("/watch/ep1");
  });

  it("un film sans rien se lance aussi", () => {
    render({ Id: "film", Name: "Sprite Fright", Type: "Movie" });
    state.clicks[0]();
    expect(state.navigate).toHaveBeenCalledWith("/watch/film");
  });

  it("des images annoncées (qui finiront en 404) ne retiennent ni le titre ni les boutons", () => {
    const html = render({
      Id: "film", Name: "Sprite Fright", Type: "Movie",
      ImageTags: { Primary: "p1" }, BackdropImageTags: ["b1"],
    });
    expect(html).toContain("/img/film/Backdrop");
    expect(html).toContain("Sprite Fright");
    expect(html).toContain("Lecture");
  });
});

describe("le message « images et informations à venir »", () => {
  const BARE: MediaItem = { Id: "serie", Name: "Caminandes", Type: "Series", ProviderIds: {} };

  it("se pose pour un titre que Jellyfin n'a pas trouvé, avec « Réanalyser maintenant » pour l'administrateur", () => {
    const html = render(BARE);
    expect(html).toContain("data-metadata-hint");
    expect(html).toContain("Les images et les informations viennent de Jellyfin");
    expect(html).toContain("Réanalyser maintenant");
    expect(html).toContain('href="/admin/metadata"');
    // Le message ne remplace rien : « Lecture » reste là.
    expect(html).toContain("Lecture");
  });

  it("un compte ordinaire lit le message, sans bouton", () => {
    state.admin = false;
    const html = render(BARE);
    expect(html).toContain("data-metadata-hint");
    expect(html).not.toContain("Réanalyser maintenant");
  });

  it("face à un serveur qui ne sait pas réanalyser : pas de bouton", () => {
    state.capabilities = new Set();
    expect(render(BARE)).not.toContain("Réanalyser maintenant");
  });

  it("un titre identifié n'a pas de message", () => {
    expect(render({ ...BARE, ProviderIds: { Tmdb: "12345" } })).not.toContain("data-metadata-hint");
  });
});
