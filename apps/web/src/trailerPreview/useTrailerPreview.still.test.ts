/**
 * La révélation SUR L'IMAGE du titre, par le crochet (horloge factice,
 * requête simulée) : la bande-annonce vérifiée par le serveur et l'image
 * signalée par la mini-carte, la mini-carte se montre à 800 ms pile sans
 * attendre la vidéo ; la vidéo la rejoint à sa première image. Sans image :
 * comme avant. La vidéo qui lâche après : sortie.
 */
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRAILER_PREVIEW_TIMING as T } from "@tentacle-tv/shared";
import { FOUND, createPreviewRig } from "./previewTestRig";

const h = vi.hoisted(() => ({ result: undefined as unknown, fresh: false, receivedAt: 0, loading: false }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: "fr" } }) }));
vi.mock("@tentacle-tv/api-client", async () => {
  const rules = await vi.importActual<typeof import("@tentacle-tv/api-client")>("@tentacle-tv/api-client");
  return {
    isTransientPreviewRefusal: rules.isTransientPreviewRefusal,
    previewRetryDelayMs: rules.previewRetryDelayMs,
    trailerPreviewResultTtl: rules.trailerPreviewResultTtl,
    useTrailerPreviewStream: () => ({
      result: h.result, fresh: h.fresh, receivedAt: h.receivedAt, loading: h.loading, capable: true, retry: vi.fn(), forget: vi.fn(),
    }),
  };
});
vi.mock("../pictureInPicture/pictureInPictureStore", () => ({ usePipSession: () => null }));
vi.mock("./previewEnvironment", () => ({ useTrailerPreviewBlock: () => null }));
vi.mock("../lib/backendBase", () => ({ getBackendBase: () => "http://serveur:3001" }));
vi.mock("./previewSource", () => ({ loadPreviewHls: async () => undefined }));

const { useTrailerPreview } = await import("./useTrailerPreview");
const { forgetTrailerPreviewFailures } = await import("./previewFailures");
const { handles, render, wait, serve, cleanup } = createPreviewRig(useTrailerPreview, h);

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(h, { result: undefined, fresh: false, receivedAt: 0, loading: false });
  // Une vidéo qui lâche est retenue dix minutes sur l'appareil : chaque test repart sans mémoire.
  forgetTrailerPreviewFailures();
});

afterEach(async () => {
  await cleanup();
  vi.useRealTimers();
});

describe("useTrailerPreview — révélation sur l'image du titre", () => {
  it("flux qui coule et image signalée : montrée à 800 ms pile, la vidéo pas encore prête ; elle la rejoint ensuite", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await serve(FOUND);
    expect(handles.a).toMatchObject({ phase: "buffering", mount: true, visible: false, videoReady: false });
    await act(async () => handles.a.videoProps.onFragment());
    await act(async () => handles.a.reportStillReady());
    await wait(T.revealMs - T.intentMs - 1);
    expect(handles.a.visible).toBe(false);
    await wait(1);
    expect(handles.a).toMatchObject({ phase: "shown", visible: true, videoReady: false, playing: true });
    await act(async () => handles.a.onReady());
    expect(handles.a).toMatchObject({ visible: true, videoReady: true });
  });

  it("sans image signalée : rien avant la première image, comme avant", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await serve(FOUND);
    await wait(2_000);
    expect(handles.a.visible).toBe(false);
    await act(async () => handles.a.onReady());
    expect(handles.a).toMatchObject({ visible: true, videoReady: true });
  });

  it("image signalée mais flux BLOQUÉ avant son premier fragment : rien ne grandit", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await serve(FOUND);
    await act(async () => handles.a.reportStillReady());
    await wait(3_000);
    expect(handles.a).toMatchObject({ phase: "buffering", visible: false });
    await wait(T.readyTimeoutMs);
    expect(handles.a).toMatchObject({ phase: "failed", visible: false, mount: false });
  });

  it("montrée sur l'image, la vidéo cale ensuite : la mini-carte s'efface", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await serve(FOUND);
    await act(async () => handles.a.videoProps.onFragment());
    await act(async () => handles.a.reportStillReady());
    await wait(T.revealMs);
    expect(handles.a.visible).toBe(true);
    await act(async () => handles.a.onError());
    expect(handles.a).toMatchObject({ phase: "failed", visible: false });
  });

  it("le rognage du letterbox arrive AVEC la première image ; un nouveau survol repart sans", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await serve(FOUND);
    expect(handles.a.videoCrop).toBe(1);
    await act(async () => handles.a.onReady({ crop: 1.35 }));
    expect(handles.a).toMatchObject({ videoReady: true, videoCrop: 1.35 });
    await render("a", { hovered: false });
    await wait(T.exitMs + 1);
    await render("a", { hovered: true });
    expect(handles.a).toMatchObject({ phase: "intent", videoReady: false, videoCrop: 1 });
  });

  it("une image signalée sans bande-annonce vérifiée ne montre rien", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await act(async () => handles.a.reportStillReady());
    await wait(3_000);
    expect(handles.a).toMatchObject({ phase: "fetching", visible: false });
  });
});
