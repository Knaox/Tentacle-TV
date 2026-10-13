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
vi.mock("@tentacle-tv/api-client", () => ({
  useJellyfinClient: () => ({
    getImageUrl: (id: string, type: string, options: { tag?: string }) => `/img/${id}/${type}?tag=${options.tag ?? ""}`,
  }),
}));

const { PreviewFrame } = await import("./PreviewFrame");
const { CardHoverShell } = await import("../CardHoverShell");

const holds: boolean[] = [];
function view(over: { shown?: boolean; settled?: boolean; muted?: boolean } = {}) {
  return {
    placement: { left: 120, top: 300, width: 360, height: 203, from: { x: -4, y: 2, scale: 0.5556 } },
    shown: over.shown ?? false,
    settled: over.settled ?? false,
    engine: {
      mount: true,
      visible: over.shown ?? false,
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

function render(v: ReturnType<typeof view>, artItem: MediaItem | null = null, backdropUrl: string | null = null) {
  return renderToStaticMarkup(
    <PreviewFrame view={v} title="Metropolis" artItem={artItem} backdropUrl={backdropUrl}>
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

describe("CardHoverShell — dans la mini-carte", () => {
  it("ne rend que le groupe, rangé à droite, sans voile (la mini-carte pose le sien)", () => {
    const html = renderToStaticMarkup(
      <CardHoverShell variant="poster" visible surface="preview">
        <span>plateau</span>
      </CardHoverShell>,
    );
    expect(html).toContain('data-card-surface="preview"');
    expect(html).toContain("items-end");
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
