/**
 * La souris dans la carte survolée (`usePreviewPointer.ts`, règle
 * `previewPointer.ts`) — la règle de Damien : l'aperçu ne part que sur l'IMAGE
 * d'une carte, jamais sous un bouton. Le crochet est monté pour de vrai
 * (React, sans DOM) sur un document factice ; chaque trou du relevé du 10/11
 * a son scénario, et CHAQUE rendu est relevé : la réponse doit être juste dès
 * le premier.
 */
import { act, createElement, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeElement, fakeCard, installPointerEnv } from "./previewPointerTestKit";

const env = installPointerEnv();
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
const { setHoverCompanion } = await import("../../../hooks/hoverCompanion");
const { NO_HOLD, pointerHold, pointerSpot } = await import("./previewPointer");
const { usePreviewPointer } = await import("./usePreviewPointer");

const container = () => ({
  nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml",
  ownerDocument: (globalThis as Record<string, unknown>).document, addEventListener() {}, removeEventListener() {},
});

/** Les verdicts de CHAQUE rendu où le survol est actif, dans l'ordre. */
let seen: Array<{ onControl: boolean; offImage: boolean }> = [];
let root: Root | null = null;

function Rig({ anchor, active }: { anchor: FakeElement; active: boolean }) {
  const hold = usePreviewPointer({ current: anchor } as unknown as RefObject<HTMLElement | null>, active);
  if (active) seen.push({ onControl: hold.onControl, offImage: hold.offImage });
  return null;
}
async function render(anchor: FakeElement, active: boolean) {
  root ??= createRoot(container() as never);
  await act(async () => root?.render(createElement(Rig, { anchor, active })));
}
const last = () => seen[seen.length - 1];
const frame = () => act(async () => env.frame());

beforeEach(() => {
  seen = [];
  env.under = null;
  env.hoverState = null;
  env.focus(null);
});
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = null;
});
afterAll(() => env.restore());

describe("la place de la souris (previewPointer.ts)", () => {
  const card = fakeCard(env);

  it("l'image, une commande du plateau, sa zone, la légende, l'inconnu", () => {
    expect(pointerSpot(card.anchor, card.image, false)).toBe("image");
    expect(pointerSpot(card.anchor, card.seen, false)).toBe("control");
    // Entre deux boutons du plateau, entre deux étoiles : on vise toujours une commande.
    expect(pointerSpot(card.anchor, card.tray, false)).toBe("control");
    expect(pointerSpot(card.anchor, card.stars, false)).toBe("control");
    expect(pointerSpot(card.anchor, card.caption, false)).toBe("outside");
    expect(pointerSpot(card.anchor, null, false)).toBe("unknown");
    // La mini-carte ouverte EST sa carte : ses propres boutons ne la referment pas.
    expect(pointerSpot(card.anchor, new FakeElement("button"), true)).toBe("image");
  });

  it("la carte elle-même (souvent un lien ou un bouton) n'est pas une commande de son plateau", () => {
    const link = fakeCard(env, { focusable: true });
    expect(pointerSpot(link.anchor, link.image, false)).toBe("image");
  });

  it("ce que chaque place interdit", () => {
    expect(pointerHold("image", false)).toBe(NO_HOLD);
    expect(pointerHold("unknown", false)).toBe(NO_HOLD);
    expect(pointerHold("control", false)).toEqual({ onControl: true, offImage: false });
    expect(pointerHold("outside", false)).toEqual({ onControl: false, offImage: true });
    // Le survol vient du CLAVIER (focus sur la carte) : la souris, ailleurs, ne retient rien.
    expect(pointerHold("outside", true)).toBe(NO_HOLD);
  });
});

describe("trou 1 — le premier rendu", () => {
  it("souris posée sur un bouton quand le survol commence : retenu DÈS le premier rendu", async () => {
    const card = fakeCard(env);
    env.moveTo(card.seen);
    await render(card.anchor, true);
    // Aucun rendu « libre », pas même le temps d'un effet : le moteur ne voit jamais de survol.
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((hold) => hold.onControl)).toBe(true);
  });

  it("sur l'image : libre dès le premier rendu, et retenu dès qu'elle passe sur un bouton", async () => {
    const card = fakeCard(env);
    env.moveTo(card.image);
    await render(card.anchor, true);
    expect(seen.every((hold) => !hold.onControl && !hold.offImage)).toBe(true);
    await act(async () => env.moveTo(card.seen));
    expect(last()).toEqual({ onControl: true, offImage: false });
    await act(async () => env.moveTo(card.image));
    expect(last()).toEqual({ onControl: false, offImage: false });
  });

  it("entre deux étoiles, entre deux boutons du plateau : toujours retenu", async () => {
    const card = fakeCard(env);
    env.moveTo(card.star);
    await render(card.anchor, true);
    await act(async () => env.moveTo(card.stars));
    expect(last().onControl).toBe(true);
    await act(async () => env.moveTo(card.tray));
    expect(last().onControl).toBe(true);
  });
});

describe("trou 2 — la carte non focalisable, hors de son image", () => {
  it("la souris sur la légende d'une carte d'accueil : rien ne part ; sur l'image : l'aperçu repart", async () => {
    const card = fakeCard(env);
    env.moveTo(card.caption);
    await render(card.anchor, true);
    expect(seen.every((hold) => hold.offImage)).toBe(true);
    await act(async () => env.moveTo(card.image));
    expect(last()).toEqual({ onControl: false, offImage: false });
    await act(async () => env.moveTo(card.caption));
    expect(last()).toEqual({ onControl: false, offImage: true });
  });

  it("une carte focalisée au CLAVIER garde son aperçu, où que soit la souris", async () => {
    const card = fakeCard(env, { focusable: true });
    env.moveTo(new FakeElement("div", {}, env));  // la souris, ailleurs dans la page
    env.focus(card.root);
    await render(card.anchor, true);
    expect(last()).toEqual({ onControl: false, offImage: false });
    // Le focus la quitte, la souris est sur sa légende : elle seule la survole, hors de l'image.
    env.under = card.caption;
    await act(async () => env.focus(null));
    expect(last()).toEqual({ onControl: false, offImage: true });
  });

  it("la mini-carte ouverte compte comme l'image", async () => {
    const card = fakeCard(env);
    const mini = new FakeElement("div", {}, env);
    const miniButton = mini.append(new FakeElement("button", {}, env));
    const release = setHoverCompanion(card.anchor as never, mini as never);
    env.moveTo(card.image);
    await render(card.anchor, true);
    await act(async () => env.moveTo(miniButton));
    expect(last()).toEqual({ onControl: false, offImage: false });
    release();
  });
});

describe("trou 3 — le bouton né ou remplacé sous une souris immobile", () => {
  it("le plateau naît sous la souris (aucun pointerover) : retenu à l'image d'animation suivante", async () => {
    const card = fakeCard(env);
    env.moveTo(card.image);
    await render(card.anchor, true);
    expect(last()).toEqual({ onControl: false, offImage: false });
    // « Marquer comme vu » paraît sous la souris, qui n'a pas bougé : seul le document a changé.
    await act(async () => env.replaceUnder(card.seen));
    await frame();
    expect(last()).toEqual({ onControl: true, offImage: false });
  });

  it("le bouton cliqué est REMPLACÉ, la session remontée, `:hover` en retard : retenu dès le premier rendu", async () => {
    const card = fakeCard(env);
    env.moveTo(card.seen);
    await render(card.anchor, true);
    expect(last().onControl).toBe(true);
    // Le clic bascule « vu » : un autre bouton prend la place, la session d'aperçu repart de zéro.
    const replaced = card.tray.append(new FakeElement("button", { "aria-label": "Marquer comme non vu" }, env));
    await render(card.anchor, false);
    env.under = replaced;
    env.hoverState = card.anchor;  // le navigateur n'a pas encore recalculé `:hover`
    seen = [];
    await render(card.anchor, true);
    await frame();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((hold) => hold.onControl)).toBe(true);
  });

  it("le survol fini, plus rien n'écoute ni n'observe", async () => {
    const card = fakeCard(env);
    env.moveTo(card.image);
    await render(card.anchor, true);
    await render(card.anchor, false);
    seen = [];
    await act(async () => env.moveTo(card.seen));
    await act(async () => env.replaceUnder(card.seen));
    await frame();
    expect(seen).toEqual([]);
  });
});
