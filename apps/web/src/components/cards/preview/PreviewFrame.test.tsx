import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Le dessin de la mini-carte, dans ses deux états : MONTÉE cachée pendant le
 * préchargement (opacité nulle, inerte, rien du survol), puis VUE — le
 * groupe du survol rendu, le son, le titre. Aucune transition ne se joue ici :
 * la feuille s'en charge, à partir des attributs que ces tests figent.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { title?: string }) => (options?.title ? `${key}(${options.title})` : key),
  }),
}));
// Les fiches `["item", id]` du banc, et les demandes qu'on en fait.
const details = new Map<string, MediaItem>();
const detailRequests: Array<{ id: string | undefined; enabled: boolean | undefined }> = [];
vi.mock("@tentacle-tv/api-client", () => ({
  useJellyfinClient: () => ({
    getImageUrl: (id: string, type: string, options: { tag?: string }) => `/img/${id}/${type}?tag=${options.tag ?? ""}`,
  }),
  useMediaItem: (id: string | undefined, options?: { enabled?: boolean }) => {
    detailRequests.push({ id, enabled: options?.enabled });
    return { data: id && options?.enabled !== false ? details.get(id) : undefined };
  },
}));

const { PreviewFrame } = await import("./PreviewFrame");
const { CardHoverShell } = await import("../CardHoverShell");

const holds: boolean[] = [];
function view(over: { shown?: boolean; settled?: boolean; muted?: boolean; panel?: boolean; crop?: number } = {}) {
  return {
    placement: over.panel
      ? { left: 120, top: 300, width: 344, height: 350, videoHeight: 194, from: { x: -4, y: 2, scale: 0.6453 } }
      : { left: 120, top: 300, width: 360, height: 203, videoHeight: 203, from: { x: -4, y: 2, scale: 0.5556 } },
    shown: over.shown ?? false,
    settled: over.settled ?? false,
    engine: {
      mount: true,
      visible: over.shown ?? false,
      videoReady: true,
      videoCrop: over.crop ?? 1,
      reportStillReady: () => undefined,
      muted: over.muted ?? false,
      toggleMute: () => undefined,
      renderVideo: ({ hold, className }: { hold: boolean; className: string }) => {
        holds.push(hold);
        return <video className={className} data-hold={hold} />;
      },
    },
    portalRef: { current: null },
    close: () => undefined,
    focusInsideRef: { current: false },
  };
}

const movie = {
  Id: "m1", Name: "Metropolis", Type: "Movie", ImageTags: { Logo: "logo-tag" }, BackdropImageTags: ["bd-tag"],
} as unknown as MediaItem;

function render(
  v: ReturnType<typeof view>,
  artItem: MediaItem | null = null,
  backdropUrl: string | null = null,
  detailItemId: string | null = null,
  meta: string | null = null,
) {
  return renderToStaticMarkup(
    <PreviewFrame view={v} title="Metropolis" artItem={artItem} detailItemId={detailItemId} backdropUrl={backdropUrl} meta={meta}>
      {(visible) => <div data-group={visible}>survol</div>}
    </PreviewFrame>,
  );
}

describe("PreviewFrame — préchargement caché", () => {
  it("est montée hors du flux, cachée, inerte, sans rien du survol", () => {
    const html = render(view());
    expect(html).toContain('class="card-preview"');
    expect(html).toContain('data-shown="false"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("inert");
    expect(html).not.toContain("data-group");
  });

  it("porte déjà sa place et son départ, posés depuis la carte", () => {
    const html = render(view());
    expect(html).toContain("left:120px");
    expect(html).toContain("top:300px");
    expect(html).toContain("width:360px");
    expect(html).toContain("height:203px");
    expect(html).toContain("--preview-from:translate(-4px, 2px) scale(0.5556)");
    expect(html).toContain("--preview-exit-ms:220ms");
  });

  it("garde la vidéo sur sa première image tant que la mini-carte n'est pas posée", () => {
    holds.length = 0;
    render(view({ shown: true, settled: false }));
    render(view({ shown: true, settled: true }));
    expect(holds).toEqual([true, false]);
  });
});

describe("PreviewFrame — vue", () => {
  it("rend le groupe du survol, nommé pour les lecteurs d'écran", () => {
    const html = render(view({ shown: true }));
    expect(html).toContain('data-shown="true"');
    expect(html).toContain('data-group="true"');
    expect(html).toContain('aria-label="previewLabel(Metropolis)"');
    expect(html).not.toContain('aria-hidden="true" inert');
  });

  it("rogne le letterbox incrusté par l'échelle que mesure le moteur, sur la scène de la vidéo", () => {
    expect(render(view({ shown: true, crop: 1.349 }))).toContain('class="card-preview-stage" style="--pv-video-crop:1.349"');
    expect(render(view({ shown: true }))).toContain('class="card-preview-stage" style="--pv-video-crop:1"');
  });

  it("dit le geste du bouton du son, pas son état", () => {
    expect(render(view({ shown: true, muted: true }))).toContain('aria-label="unmute"');
    expect(render(view({ shown: true, muted: false }))).toContain('aria-label="mute"');
  });

  it("grandit sur le FOND du titre annoncé par Jellyfin, ou sur l'image que la carte donne", () => {
    const withArt = render(view(), movie);
    expect(withArt).toContain('src="/img/m1/Backdrop?tag=bd-tag"');
    expect(withArt).toContain('class="card-preview-backdrop"');
    expect(render(view(), movie, "https://x/still.jpg")).toContain('src="https://x/still.jpg"');
    expect(render(view(), null)).not.toContain("card-preview-backdrop");
  });

  it("écrit le LOGO annoncé par Jellyfin, sinon le nom", () => {
    expect(render(view({ shown: true }), movie)).toContain('src="/img/m1/Logo?tag=logo-tag"');
    const plain = render(view({ shown: true }), null);
    expect(plain).not.toContain("<img");
    expect(plain).toContain(">Metropolis</p>");
  });
});

describe("PreviewFrame — le logo d'une carte de rangée", () => {
  // Une rangée ne demande pas l'image Logo : son item n'en annonce aucun.
  const rowMovie = { Id: "c1", Name: "Charade", Type: "Movie", BackdropImageTags: ["bd"] } as unknown as MediaItem;
  const rowEpisode = {
    Id: "e1", Name: "Chute libre", Type: "Episode", SeriesId: "s1", ParentBackdropItemId: "s1", ParentBackdropImageTags: ["pb"],
  } as unknown as MediaItem;

  it("lit le logo dans la FICHE du titre quand la carte ne l'annonce pas", () => {
    details.set("c1", { ...rowMovie, ImageTags: { Logo: "logo-c" } } as unknown as MediaItem);
    expect(render(view({ shown: true }), rowMovie)).toContain('src="/img/c1/Logo?tag=logo-c"');
  });

  it("écrit le nom tant que la fiche n'est pas là", () => {
    details.delete("c1");
    const html = render(view({ shown: true }), rowMovie);
    expect(html).not.toContain("/Logo");
    expect(html).toContain(">Metropolis</p>");
  });

  it("prend le logo de la SÉRIE dans la fiche d'un épisode", () => {
    details.set("e1", { ...rowEpisode, ParentLogoItemId: "s1", ParentLogoImageTag: "logo-s" } as unknown as MediaItem);
    expect(render(view({ shown: true }), rowEpisode, "https://x/still.jpg")).toContain('src="/img/s1/Logo?tag=logo-s"');
  });

  it("lit la fiche d'une recommandation de la bibliothèque, qui n'a pas d'item", () => {
    details.set("r1", { Id: "r1", Name: "Metropolis", Type: "Movie", ImageTags: { Logo: "logo-r" } } as unknown as MediaItem);
    expect(render(view({ shown: true }), null, null, "r1")).toContain('src="/img/r1/Logo?tag=logo-r"');
  });

  it("ne demande aucune fiche quand la carte annonce déjà logo et fond", () => {
    detailRequests.length = 0;
    render(view({ shown: true }), movie);
    expect(detailRequests.every((request) => request.enabled === false)).toBe(true);
  });
});

describe("PreviewFrame — le bandeau", () => {
  const film = {
    Id: "f1", Name: "Charade", Type: "Movie", ProductionYear: 1963, RunTimeTicks: 113 * 60 * 10_000_000,
    OfficialRating: "FR-12", Genres: ["Comédie", "Mystère"], ImageTags: { Logo: "lg" }, BackdropImageTags: ["bd"],
  } as unknown as MediaItem;

  it("pose la vidéo en haut et le bandeau dessous : titre, survol, puis les infos", () => {
    const html = render(view({ shown: true, panel: true }), film);
    expect(html).toContain('data-layout="panel"');
    expect(html).toContain("--preview-video-h:194px");
    expect(html).toContain('class="card-preview-panel"');
    expect(html).toContain('data-group="true"');
    expect(html).toContain('<span class="card-preview-year">1963</span>');
    expect(html).toContain("1h 53min");
    expect(html).toContain('aria-label="trailerPreview:ratingLabel">12</span>');
    expect(html).toContain("<span>Comédie</span>");
    // Rien ne s'écrit sur la vidéo : le titre est dans le bandeau, le DOM dit
    // le titre avant ses gestes, puis les infos (la feuille range l'écran).
    const panel = html.indexOf('class="card-preview-panel"');
    const logo = html.indexOf('src="/img/f1/Logo');
    const group = html.indexOf("data-group");
    const facts = html.indexOf("card-preview-facts");
    expect(panel).toBeLessThan(logo);
    expect(logo).toBeLessThan(group);
    expect(group).toBeLessThan(facts);
  });

  it("prend l'année que la carte donne quand elle n'a pas d'item (recommandation, hors bibliothèque)", () => {
    expect(render(view({ shown: true, panel: true }), null, null, null, "2016")).toContain('<span class="card-preview-year">2016</span>');
  });

  it("sans place pour un bandeau, pose le même bandeau sur la vidéo", () => {
    const html = render(view({ shown: true }), film);
    expect(html).toContain('data-layout="overlay"');
    expect(html).toContain('class="card-preview-panel"');
  });
});

describe("CardHoverShell — dans la mini-carte", () => {
  it("ne rend que le groupe, transparent à la mise en page, sans voile (la mini-carte pose le sien)", () => {
    const html = renderToStaticMarkup(
      <CardHoverShell variant="poster" visible surface="preview">
        <span>plateau</span>
      </CardHoverShell>,
    );
    expect(html).toContain('data-card-surface="preview"');
    expect(html).toContain('class="card-preview-group"');
    expect(html).not.toContain("--card-hover-veil");
    expect(html).not.toContain("hover-reveal");
  });

  it("effacé, sort du parcours du clavier — sur la carte comme dans la mini-carte", () => {
    for (const surface of ["card", "preview"] as const) {
      const html = renderToStaticMarkup(
        <CardHoverShell variant="poster" visible={false} surface={surface}>
          <button type="button">vu</button>
        </CardHoverShell>,
      );
      expect(html).toContain("inert");
    }
  });
});
