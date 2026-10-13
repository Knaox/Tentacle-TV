/**
 * Le crochet de l'aperçu d'une carte, monté pour de vrai (React, sans DOM) sur
 * une horloge factice — la requête, le PiP et l'environnement simulés : quand
 * il demande, quand il montre, et qu'il ne fait RIEN quand il ne doit pas.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRAILER_PREVIEW_TIMING as T, type TrailerPreviewSubject } from "@tentacle-tv/shared";
import type { TrailerPreviewHandle } from "./previewTypes";

const h = vi.hoisted(() => ({
  result: undefined as unknown,
  fresh: false,
  capable: true,
  cancel: vi.fn(),
  enabled: [] as boolean[],
  pip: null as unknown,
  block: null as string | null,
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: "fr-FR" } }) }));
vi.mock("@tentacle-tv/api-client", () => ({
  useTrailerPreviewStream: (_subject: unknown, _lang: string, options: { enabled: boolean }) => {
    h.enabled.push(options.enabled);
    return { result: h.result, fresh: h.fresh, capable: h.capable, cancel: h.cancel };
  },
}));
vi.mock("../pictureInPicture/pictureInPictureStore", () => ({ usePipSession: () => h.pip }));
vi.mock("./previewEnvironment", () => ({ useTrailerPreviewBlock: () => h.block }));
vi.mock("../lib/backendBase", () => ({ getBackendBase: () => "http://serveur:3001" }));

const { useTrailerPreview } = await import("./useTrailerPreview");
const { forgetTrailerPreviewFailures } = await import("./previewFailures");

const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = () => ({
  nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml",
  ownerDocument: doc, addEventListener() {}, removeEventListener() {},
});

const METROPOLIS: TrailerPreviewSubject = { kind: "item", itemId: "90d50b74d48412cfc9db9a256b1d0c64" };
const KID: TrailerPreviewSubject = { kind: "item", itemId: "5ced6d65a7c6c207a2b1b872fd1d4e09" };
const FOUND = {
  status: "found",
  preview: {
    ytId: "FFUGtw7uzB4", path: "/api/trailers/hls/FFUGtw7uzB4/master.m3u8?t=abc", mimeType: "application/vnd.apple.mpegurl",
    expiresAt: Date.now() + 3_600_000, heights: [720, 1080], qualities: [],
  },
};

const handles: Record<string, TrailerPreviewHandle> = {};
const roots = new Map<string, Root>();
const props = new Map<string, { subject: TrailerPreviewSubject | null; hovered: boolean }>();

function Rig({ name, subject, hovered }: { name: string; subject: TrailerPreviewSubject | null; hovered: boolean }) {
  handles[name] = useTrailerPreview(subject, hovered);
  return null;
}

async function render(name: string, next: Partial<{ subject: TrailerPreviewSubject | null; hovered: boolean }> = {}) {
  const current = { subject: METROPOLIS, hovered: false, ...props.get(name), ...next };
  props.set(name, current);
  if (!roots.has(name)) roots.set(name, createRoot(container() as never));
  await act(async () => roots.get(name)!.render(createElement(Rig, { name, ...current })));
}

/** Le temps passe (minuteries du crochet comprises). */
async function wait(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/** La requête répond : le crochet relit son état au rendu suivant. */
async function serve(result: unknown, name = "a") {
  h.result = result;
  h.fresh = result !== undefined;
  await render(name);
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(h, { result: undefined, fresh: false, capable: true, enabled: [], pip: null, block: null });
  h.cancel.mockClear();
  forgetTrailerPreviewFailures();
});

afterEach(async () => {
  for (const root of roots.values()) await act(async () => root.unmount());
  roots.clear();
  props.clear();
  vi.useRealTimers();
});

describe("useTrailerPreview — quand demander", () => {
  it("rien avant l'intention ; la demande part au bout de 350 ms de survol", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs - 50);
    expect(h.enabled.some(Boolean)).toBe(false);
    expect(handles.a.phase).toBe("intent");
    await wait(50);
    await render("a");
    expect(handles.a.phase).toBe("fetching");
    expect(h.enabled.at(-1)).toBe(true);
  });

  it("un survol qui cesse pendant la demande l'abandonne", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await render("a", { hovered: false });
    expect(handles.a.phase).toBe("idle");
    expect(h.cancel).toHaveBeenCalled();
    expect(h.enabled.at(-1)).toBe(false);
  });

  it("un serveur sans la capacité : aucune demande, rien ne bouge", async () => {
    h.capable = false;
    await render("a", { hovered: true });
    await wait(3_000);
    await render("a");
    expect(h.enabled.some(Boolean)).toBe(false);
    expect(handles.a).toMatchObject({ phase: "idle", mount: false, visible: false });
  });

  it("bloqué (PiP, réglage, appareil) : aucune demande ; débloqué, l'aperçu repart", async () => {
    h.pip = { location: {} };
    await render("a", { hovered: true });
    await wait(2_000);
    expect(h.enabled.some(Boolean)).toBe(false);
    h.pip = null;
    h.block = "setting";
    await render("a");
    await wait(2_000);
    expect(h.enabled.some(Boolean)).toBe(false);
    h.block = null;
    await render("a");
    expect(handles.a.phase).toBe("intent");
  });

  it("sans sujet (collection, musique) : rien", async () => {
    await render("a", { subject: null, hovered: true });
    await wait(2_000);
    expect(h.enabled.some(Boolean)).toBe(false);
    expect(handles.a.phase).toBe("idle");
  });
});

describe("useTrailerPreview — quand montrer", () => {
  it("chargée cachée, montrée à la seconde, avec le son qui monte", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await serve(FOUND);
    expect(handles.a).toMatchObject({ phase: "buffering", mount: true, visible: false, playing: false });
    expect(handles.a.stream).toMatchObject({ kind: "hls", src: `http://serveur:3001${FOUND.preview.path}`, heights: [1080, 720] });
    expect(handles.a.videoProps.volume).toBe(0);

    await act(async () => handles.a.onReady());
    expect(handles.a).toMatchObject({ phase: "ready", visible: false });
    await wait(T.revealMs - T.intentMs - 1);
    expect(handles.a.visible).toBe(false);
    await wait(1);
    expect(handles.a).toMatchObject({ phase: "shown", visible: true, playing: true });
    expect(handles.a.videoProps.volume).toBe(T.volume);
  });

  it("le survol perdu : la mini-carte s'efface, la vidéo reste le temps du fondu", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await serve(FOUND);
    await act(async () => handles.a.onReady());
    await wait(T.revealMs);
    await render("a", { hovered: false });
    expect(handles.a).toMatchObject({ visible: false, mount: true, playing: true });
    expect(handles.a.videoProps.volume).toBe(0);
    await wait(T.exitMs);
    expect(handles.a).toMatchObject({ mount: false, playing: false });
  });

  it("un 404 : rien ne se monte, rien ne se montre", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await serve({ status: "missing", reason: "no_trailer" });
    await wait(5_000);
    expect(handles.a).toMatchObject({ phase: "failed", mount: false, visible: false });
  });

  it("une réponse périmée n'est pas lue : on attend la nouvelle", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs);
    h.result = FOUND;
    h.fresh = false;
    await render("a");
    expect(handles.a.phase).toBe("fetching");
    await serve(FOUND);
    expect(handles.a.phase).toBe("buffering");
  });

  it("une vidéo qui lâche n'est pas montrée, ni retentée au survol suivant", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await serve(FOUND);
    await act(async () => handles.a.onError());
    expect(handles.a).toMatchObject({ phase: "failed", mount: false, visible: false });
    await render("a", { hovered: false });
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await render("a");
    expect(handles.a.phase).toBe("failed");
  });
});

describe("useTrailerPreview — un seul à la fois, le son", () => {
  it("un second aperçu évince le premier", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await serve(FOUND);
    await render("b", { subject: KID, hovered: true });
    await wait(T.intentMs);
    await render("a");
    expect(handles.b.phase).toBe("buffering");
    expect(handles.a.phase).toBe("ended");
  });

  it("son refusé par le navigateur : muet pour cet aperçu, le bouton le rend", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await serve(FOUND);
    expect(handles.a.muted).toBe(false);
    await act(async () => handles.a.videoProps.onSoundBlocked());
    expect(handles.a.muted).toBe(true);
    await act(async () => handles.a.toggleMute());
    expect(handles.a.muted).toBe(false);
  });
});
