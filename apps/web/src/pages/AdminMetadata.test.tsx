import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

/**
 * Les trois visages de la page Métadonnées, rendus à plat comme les autres
 * bancs de composants : squelette pendant la première lecture, erreur avec
 * « Réessayer », puis les cartes. L'ancienne page rendait `null` dans les
 * deux premiers cas — une page blanche. `t()` rend la clé ; l'api-client et
 * les briques animées sont remplacés (chargés en vrai, framer-motion tire une
 * seconde copie de React).
 */

type StatusResult = { data?: unknown; isError: boolean; isFetching: boolean; refetch: () => void; dataUpdatedAt?: number };
const status = vi.hoisted(() => ({ current: null as unknown as StatusResult }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "fr" } }),
}));
vi.mock("@tentacle-tv/api-client", () => ({
  useAdminMetadataStatus: () => status.current,
  useUpdateAdminMetadata: () => ({ mutate: () => undefined, reset: () => undefined, isPending: false }),
  useTestTmdbKey: () => ({ mutate: () => undefined, reset: () => undefined, isPending: false }),
  useJellyfinClient: () => ({}),
  useAdminMetadataRegions: () => ({ data: [{ code: "FR", providers: 102 }, { code: "BE", providers: 61 }] }),
  useAdminRegionProviders: () => ({ data: undefined, isPlaceholderData: false }),
  adminMetadataErrorCode: () => "failed",
}));
vi.mock("../components/PageTransition", () => ({
  PageTransition: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("../components/ui/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
vi.mock("framer-motion", () => ({
  motion: { div: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  useReducedMotion: () => false,
}));
vi.mock("../components/userMenu/menuItems", () => ({ getUserInfo: () => ({ isAdmin: true }) }));
// Le vrai module importe `main.tsx` (l'URL du backend), qui démarre l'app.
vi.mock("./adminUtils", () => ({
  cls: new Proxy({}, { get: (_target, name) => `cls-${String(name)}` }),
}));

const { AdminMetadata } = await import("./AdminMetadata");

const render = () => renderToStaticMarkup(<AdminMetadata />);

beforeEach(() => {
  status.current = { data: undefined, isError: false, isFetching: true, refetch: () => undefined };
});

describe("la page Admin → Métadonnées", () => {
  it("pendant la première lecture : l'en-tête et un squelette, jamais une page blanche", () => {
    const html = render();
    expect(html).toContain("title");
    expect(html).toContain("animate-pulse");
    expect(html).not.toContain('role="alert"');
  });

  it("lecture en échec : une alerte qui explique, et « Réessayer »", () => {
    status.current = { data: undefined, isError: true, isFetching: false, refetch: () => undefined };
    const html = render();
    expect(html).toContain('role="alert"');
    expect(html).toContain("loadError");
    expect(html).toContain("loadErrorHint");
    expect(html).toContain("retry");
  });

  it("état lu : la carte TMDB et celle de la région, chacune avec son bouton", () => {
    status.current = {
      data: { tmdb: { configured: false, source: null, last4: null }, watchRegion: "FR" },
      isError: false,
      isFetching: false,
      refetch: () => undefined,
    };
    const html = render();
    expect(html).toContain("tmdbTitle");
    expect(html).toContain("statusMissing");
    expect(html).toContain("regionTitle");
    // Le sélecteur de pays, fermé, sur la région enregistrée.
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(">FR<");
    expect(html).not.toContain("animate-pulse");
    // Pas de clé, pas de bilan de calcul.
    expect(html).not.toContain("fanout");
  });

  it("calcul en cours : une barre de progression lisible par les lecteurs d'écran", () => {
    status.current = {
      data: {
        tmdb: { configured: true, source: "db", last4: "a1b2" },
        watchRegion: "FR",
        fanout: { running: true, processed: 3, total: 12, failed: 0, finishedAt: null },
      },
      isError: false,
      isFetching: false,
      refetch: () => undefined,
      dataUpdatedAt: Date.now(),
    };
    const html = render();
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="3"');
    expect(html).toContain('aria-valuemax="12"');
    expect(html).toContain("scaleX(0.25)");
  });
});
