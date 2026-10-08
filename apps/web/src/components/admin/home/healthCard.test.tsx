import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readServicesHealth } from "./overviewSummary";
import { HealthCard } from "./HealthCard";

/**
 * La carte « Services » de la vue d'ensemble : la base y est nommée par son
 * moteur (« SQLite 3.46.0 ») — « Version 3.46.0 » ne disait pas laquelle.
 * Jellyfin garde « Version … ».
 */
const h = vi.hoisted(() => ({ raw: {} as object }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { version?: string }) => (values?.version ? `${key}:${values.version}` : key),
    i18n: { resolvedLanguage: "fr", language: "fr" },
  }),
}));
// Le lien « Gérer » seulement : un routeur réel n'apporte rien à ce rendu.
vi.mock("react-router-dom", () => ({ Link: ({ children }: { children: unknown }) => children }));
vi.mock("./overviewApi", () => ({ useServicesHealth: () => ({ data: readServicesHealth(h.raw), loading: false }) }));

const html = (raw: object) => {
  h.raw = raw;
  return renderToStaticMarkup(<HealthCard />);
};

describe("la carte « Services » de la vue d'ensemble", () => {
  it("SQLite : le moteur avec sa version, sans « Version » devant", () => {
    const out = html({
      jellyfin: { status: "connected", version: "10.11.0" },
      database: { status: "connected", version: "3.46.0", engine: "sqlite" },
    });
    expect(out).toContain("SQLite 3.46.0");
    expect(out).not.toContain("homeVersion:3.46.0");
    expect(out).toContain("homeVersion:10.11.0");
  });

  it("serveur d'avant 1.25 : la base dit aussi son moteur", () => {
    const out = html({
      jellyfin: { status: "connected", version: "10.10.7" },
      database: { status: "connected", version: "11.4.4-MariaDB-ubu2404" },
    });
    expect(out).toContain("MariaDB 11.4.4");
  });
});
