/**
 * L'entrée « Hors ligne » de la navigation d'Octave (lot fl) : absente sans la porte du hors ligne (session de profil,
 * droit refusé), nommée « Hors ligne », et sa pastille seulement tant que des titres partent.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

const h = vi.hoisted(() => ({ visible: true, tracks: [] as { status: string; pausedByUser?: boolean }[] }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-router-dom", () => ({
  NavLink: ({ children, className, ...rest }: { children: ReactNode; className: unknown; "aria-label"?: string }) => (
    <a className={typeof className === "string" ? className : ""} aria-label={rest["aria-label"]}>{children}</a>
  ),
}));
vi.mock("./offlineSurfaceContext", () => ({ useOfflineSurface: () => ({ visible: h.visible, library: h.visible, externalFrom: null }) }));
vi.mock("./keptMusicStore", () => ({ keptMusicState: () => ({ tracks: h.tracks }), subscribeKeptMusic: () => () => undefined }));

import { DeviceHeaderButton, DeviceNavItem } from "./DeviceNavItem";

const nav = () => renderToStaticMarkup(<DeviceNavItem className="x" />);

describe("DeviceNavItem — « Hors ligne »", () => {
  it("sans la porte du hors ligne (profil, droit refusé) : rien, ni au rail ni dans l'en-tête", () => {
    h.visible = false;
    expect(nav()).toBe("");
    expect(renderToStaticMarkup(<DeviceHeaderButton />)).toBe("");
    h.visible = true;
  });

  it("au repos : « Hors ligne », sans pastille", () => {
    h.tracks = [{ status: "complete" }, { status: "error" }, { status: "paused", pausedByUser: true }];
    const html = nav();
    expect(html).toContain("nav.offline");
    expect(html).not.toContain("data-octave-offline-badge");
    expect(html).not.toContain("nav.offlineBusy");
  });

  it("des titres partent : la pastille, et le nom le dit au lecteur d'écran", () => {
    h.tracks = [{ status: "complete" }, { status: "downloading" }];
    const html = nav();
    expect(html).toContain("data-octave-offline-badge");
    expect(html).toContain('aria-label="nav.offlineBusy"');
    expect(renderToStaticMarkup(<DeviceHeaderButton />)).toContain("data-octave-offline-badge");
  });
});
