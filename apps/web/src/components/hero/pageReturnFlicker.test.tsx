/**
 * Le clignotement de l'accueil et de « Pour vous » (signalé le 25/10) : en
 * changeant de page, la MÊME bannière et les MÊMES affiches, déjà décodées,
 * repartaient de rien — la bannière de l'opacité nulle sur 1,2 s, les affiches
 * derrière leur squelette puis retenues ≈ 600 ms par l'entrée des rangées.
 * Mesuré image par image (avant peinture) : bannière pleine à ≈ 980 ms après le
 * clic, affiches à ≈ 740 ms ; après le correctif, ≈ 300 et ≈ 260 ms.
 *
 * Ces cas montent les vrais composants, comme au retour sur la page. Framer
 * est simulé : sous Node, la disposition « hoisted » lui donne sa propre copie
 * de React. Ce qui compte y reste observable — ce que la bannière demande à
 * `AnimatePresence` (rejouer ou non l'apparition) et la durée de l'apparition.
 */
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  const { createElement: h } = await import("react");
  return {
    ...actual,
    AnimatePresence: ({ initial, children }: { initial?: boolean; children?: unknown }) =>
      h("div", { "data-presence-initial": String(initial ?? true) }, children as never),
    motion: {
      ...actual.motion,
      img: ({ transition, initial: _i, animate: _a, exit: _e, ...rest }: Record<string, unknown>) =>
        h("img", { ...rest, "data-opacity-duration": String((transition as { opacity?: { duration?: number } })?.opacity?.duration) }),
    },
  };
});

import { HeroBackdropLayer } from "./HeroBackdrop";
import { ENTRY_FADE_S } from "./useBillboardEntry";
import { useBillboardEntry, type BillboardEntry } from "./useBillboardEntry";
import { CardImage } from "../cards/CardImage";
import { useRowEntrance } from "../rows/useRowEntrance";
import { hasRowEntered, markRowEntered, resetRowEntranceMemoryForTests, rowEntranceId } from "../rows/rowEntranceMemory";
import { markImageSeen, resetSeenImagesForTests } from "../../lib/seenImages";

const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = {
  nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml",
  ownerDocument: doc, addEventListener() {}, removeEventListener() {},
};
let root: Root | null = null;

beforeEach(() => {
  resetSeenImagesForTests();
  resetRowEntranceMemoryForTests();
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  vi.unstubAllGlobals();
});

async function render(element: ReturnType<typeof createElement>) {
  root ??= createRoot(container as never);
  await act(async () => root!.render(element));
}

describe("retour sur la page — la bannière", () => {
  it("une image DÉJÀ montrée est posée d'emblée : l'apparition ne se rejoue pas", () => {
    markImageSeen("/fond-a.jpg");
    const markup = renderToStaticMarkup(<HeroBackdropLayer imageKey="a" url="/fond-a.jpg" />);
    expect(markup).toContain('data-presence-initial="false"');
  });

  it("une image jamais vue paraît, mais en un temps d'affiche — jamais 1,2 s depuis le noir", () => {
    const markup = renderToStaticMarkup(<HeroBackdropLayer imageKey="b" url="/fond-b.jpg" />);
    expect(markup).toContain('data-presence-initial="true"');
    expect(markup).toContain(`data-opacity-duration="${ENTRY_FADE_S}"`);
  });
});

describe("useBillboardEntry — la première image, puis le fondu enchaîné", () => {
  let probe: BillboardEntry;
  function Rig({ k, url }: { k: string | null; url: string | null }) {
    probe = useBillboardEntry(k, url);
    return null;
  }

  it("image disponible au montage : rien ne se rejoue (AnimatePresence initial faux)", async () => {
    markImageSeen("/a.jpg");
    await render(createElement(Rig, { k: "a", url: "/a.jpg" }));
    expect(probe.presenceInitial).toBe(false);
  });

  it("la première image est l'entrée (courte) ; les diapositives suivantes, même revenues, enchaînent", async () => {
    await render(createElement(Rig, { k: null, url: null }));
    expect(probe.isEntry).toBe(false);
    await render(createElement(Rig, { k: "a", url: "/a.jpg" }));
    expect(probe.isEntry).toBe(true);
    await render(createElement(Rig, { k: "b", url: "/b.jpg" }));
    expect(probe.isEntry).toBe(false);
    await render(createElement(Rig, { k: "a", url: "/a.jpg" }));
    expect(probe.isEntry).toBe(false);
  });
});

describe("retour sur la page — les affiches", () => {
  it("une affiche déjà montrée ne remonte pas son squelette scintillant", () => {
    markImageSeen("/affiche.jpg");
    expect(renderToStaticMarkup(<CardImage src="/affiche.jpg" alt="" />)).not.toContain("skeleton-shimmer");
  });

  it("une affiche jamais vue garde son squelette", () => {
    expect(renderToStaticMarkup(<CardImage src="/neuve.jpg" alt="" />)).toContain("skeleton-shimmer");
  });
});

describe("retour sur la page — l'entrée des rangées", () => {
  let hold: (el: HTMLElement | null) => void;
  class FakeElement { hasAttribute() { return false; } }
  function Rig({ id, ready }: { id: string; ready: boolean }) {
    const scrollRef = { current: { children: [new FakeElement()] } as unknown as HTMLElement };
    hold = useRowEntrance(scrollRef, ready, id);
    return null;
  }
  const section = () => ({ setAttribute: vi.fn(), removeAttribute: vi.fn(), firstElementChild: null });

  it("une rangée revenue avec le MÊME contenu n'est plus retenue invisible", async () => {
    const id = rowEntranceId("Derniers ajouts", ["a", "b", "c"]);
    markRowEntered(id);
    await render(createElement(Rig, { id, ready: false }));
    const el = section();
    hold(el as unknown as HTMLElement);
    expect(el.setAttribute).not.toHaveBeenCalled();
  });

  it("une rangée nouvelle est retenue puis entre, et son contenu est retenu", async () => {
    vi.stubGlobal("IntersectionObserver", class {
      constructor(private cb: (e: Array<{ intersectionRatio: number }>) => void) {}
      observe() { this.cb([{ intersectionRatio: 1 }]); }
      disconnect() {}
    });
    vi.stubGlobal("MutationObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("HTMLElement", FakeElement);
    const id = rowEntranceId("Pour vous", ["x", "y"]);
    await render(createElement(Rig, { id, ready: false }));
    const el = section();
    hold(el as unknown as HTMLElement);
    expect(el.setAttribute).toHaveBeenCalledWith("data-row-entrance", "held");
    await render(createElement(Rig, { id, ready: true }));
    expect(el.removeAttribute).toHaveBeenCalledWith("data-row-entrance");
    expect(hasRowEntered(id)).toBe(true);
  });
});
