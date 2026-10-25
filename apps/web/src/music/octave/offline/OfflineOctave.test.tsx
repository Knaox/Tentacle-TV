/**
 * Octave sans réseau : toute adresse du mode mène à « Sur cet appareil » — une
 * adresse ABSOLUE (relative, elle s'empilait : `…/album/x/device/device…`, vu au
 * banc du bureau), et en ligne les routes d'avant, intactes.
 */

import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ offline: true }));

vi.mock("../../../offline/useOfflineMode", () => ({ useOfflineMode: () => h.offline }));
vi.mock("./DeviceView", () => ({ DeviceView: () => null }));
vi.mock("./useKeptMusic", () => ({ useKeptMusic: () => ({ loaded: true, tracks: [] }) }));
vi.mock("react-router-dom", () => ({
  Navigate: (props: { to: string }) => props,
  Route: (props: { path: string; element: ReactNode }) => props,
  Routes: (props: { children: ReactNode }) => props,
}));

import { OfflineOctaveRoutes, octaveOfflineAware } from "./OfflineOctave";

type Props = { children?: ReactNode; path?: string; element?: ReactElement<{ to?: string }> };

function routesOf(tree: ReactNode): Props[] {
  if (!isValidElement<Props>(tree)) return [];
  const children = tree.props.children;
  return (Array.isArray(children) ? children : [children]).filter(isValidElement<Props>).map((c) => c.props);
}

describe("OfflineOctaveRoutes", () => {
  it("hors ligne : « Sur cet appareil », et tout le reste y mène par une adresse ABSOLUE", () => {
    h.offline = true;
    const routes = routesOf(OfflineOctaveRoutes({ children: "en ligne" }));
    expect(routes.map((r) => r.path)).toEqual(["device", "*"]);
    expect(routes[1]!.element!.props.to).toBe("/octave/device");
  });

  it("en ligne : les routes d'avant, intactes", () => {
    h.offline = false;
    const tree = OfflineOctaveRoutes({ children: "en ligne" });
    expect(isValidElement<Props>(tree) && tree.props.children).toBe("en ligne");
  });
});

describe("octaveOfflineAware", () => {
  it("la même enveloppe en ligne et hors ligne : la coupure du serveur ne remonte pas Octave (ni son lecteur)", () => {
    const app = <i />;
    const online = octaveOfflineAware(false, app);
    const offline = octaveOfflineAware(true, app);
    expect(isValidElement(online) && isValidElement(offline) && online.type === offline.type).toBe(true);
  });
});
