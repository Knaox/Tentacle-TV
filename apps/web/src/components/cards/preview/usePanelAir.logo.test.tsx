import { act, createElement, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { panelAirApplied, panelLayoutKey, usePanelAir } from "./usePanelAir";

/**
 * L'air du bandeau quand le LOGO du titre arrive APRÈS la mesure : posé, il
 * peut élargir le titre au point de faire passer les étoiles dessous — le
 * contenu grandit d'une ligne. Le bandeau se remesure alors UNE fois, et sa
 * dernière ligne n'est jamais rognée (« ça ne casse jamais l'UI »).
 *
 * React sans DOM (comme `trailerPreview/previewTestRig.ts`) : un faux conteneur,
 * un composant qui ne rend rien, un faux bandeau qui pose son contenu.
 */
const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
g.getComputedStyle = () => ({ paddingTop: "10px" });
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = () => ({
  nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml",
  ownerDocument: doc, addEventListener() {}, removeEventListener() {},
});

const HEIGHT = 164;
const FOOT = 10;
const LOGO = "/img/c/Logo";
const INFO = { genres: ["Comédie"], episode: null, progress: null };

/** Le bandeau : son contenu se pose jusqu'à `natural`, décalé de l'air que la feuille applique. */
const panel = { natural: 112, air: 0 };
const element = {
  clientHeight: HEIGHT,
  querySelectorAll: () => [{ offsetTop: 0, offsetHeight: panel.natural + panelAirApplied(panel.air) }],
};

function Probe({ logoSettled }: { logoSettled: string | null }) {
  const ref = useRef(element as unknown as HTMLDivElement);
  const key = panelLayoutKey({ height: HEIGHT, logoUrl: LOGO, logoSettled, info: INFO });
  // Ce que `PreviewPanel` pose en style dans le même rendu.
  panel.air = usePanelAir(ref, key, true);
  return null;
}

async function render(root: Root, logoSettled: string | null) {
  await act(async () => root.render(createElement(Probe, { logoSettled })));
}

describe("usePanelAir — le logo posé après la mesure", () => {
  it("se remesure une fois : l'air cède, la dernière ligne n'est jamais rognée", async () => {
    const root = createRoot(container() as never);
    await render(root, null);
    // Logo en route : 42 px d'excédent, réparti.
    expect(panel.air).toBe(HEIGHT - 112 - FOOT);

    // Le logo se pose ; plus large que le nom, il fait passer les étoiles sous le titre.
    panel.natural = 132;
    await render(root, LOGO);
    const bottom = panel.natural + panelAirApplied(panel.air);
    expect(bottom + FOOT).toBeLessThanOrEqual(HEIGHT);
    expect(panel.air).toBe(HEIGHT - 132 - FOOT);

    await act(async () => root.unmount());
  });
});
