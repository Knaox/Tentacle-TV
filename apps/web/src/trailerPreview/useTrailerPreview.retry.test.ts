/**
 * Le refus PASSAGER sous un survol qui tient (horloge factice) : un 429 — le
 * serveur décide déjà trop d'aperçus, une rangée balayée vient d'en lancer
 * plusieurs — ou une panne ne coûte pas l'aperçu de la carte où l'on s'arrête :
 * il redemande à l'échéance, deux fois au plus, et la mini-carte ne se montre
 * toujours qu'à la seconde, vidéo prête.
 */
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRAILER_PREVIEW_TIMING as T } from "@tentacle-tv/shared";
import { FOUND, createPreviewRig } from "./previewTestRig";

const h = vi.hoisted(() => ({
  result: undefined as unknown,
  fresh: false,
  receivedAt: 0,
  loading: false,
  retry: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: "fr" } }) }));
vi.mock("@tentacle-tv/api-client", async () => {
  const rules = await vi.importActual<typeof import("@tentacle-tv/api-client")>("@tentacle-tv/api-client");
  return {
    isTransientPreviewRefusal: rules.isTransientPreviewRefusal,
    previewRetryDelayMs: rules.previewRetryDelayMs,
    useTrailerPreviewStream: () => ({
      result: h.result, fresh: h.fresh, receivedAt: h.receivedAt, loading: h.loading, capable: true, cancel: h.cancel, retry: h.retry,
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

const LIMITED = { status: "missing", reason: "rate_limited" };
const LIMITED_3S = { status: "missing", reason: "rate_limited", retryAfterMs: 3_000 };
const FAILED = { status: "missing", reason: "failed" };

/** Survol tenu jusqu'à la demande ; le serveur répond `first`. */
async function hoverUntilAnswer(first: unknown) {
  await render("a", { hovered: true });
  await wait(T.intentMs);
  await serve(first);
}

/** L'échéance est passée : le crochet a redemandé ; la demande est en vol. */
async function inFlight() {
  h.loading = true;
  await render("a");
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(h, { result: undefined, fresh: false, receivedAt: 0, loading: false });
  h.retry.mockClear();
  forgetTrailerPreviewFailures();
});

afterEach(async () => {
  await cleanup();
  vi.useRealTimers();
});

describe("useTrailerPreview — un refus passager se redemande", () => {
  it("un 429 sur la carte où l'on s'arrête : nouvelle demande à l'échéance, puis l'aperçu", async () => {
    await hoverUntilAnswer(LIMITED_3S);
    expect(handles.a).toMatchObject({ phase: "fetching", mount: false });
    await wait(2_999);
    expect(h.retry).not.toHaveBeenCalled();
    await wait(1);
    expect(h.retry).toHaveBeenCalledTimes(1);
    await inFlight();
    await serve(FOUND);
    expect(handles.a).toMatchObject({ phase: "buffering", mount: true, visible: false });
    await act(async () => handles.a.onReady());
    // Plus d'une seconde depuis le début du survol : montrée dès la première image.
    expect(handles.a).toMatchObject({ phase: "shown", visible: true });
  });

  it("délai inconnu (en-tête caché au bureau) : 2 s, puis 4 s", async () => {
    await hoverUntilAnswer(LIMITED);
    await wait(T.rateLimitDefaultMs);
    expect(h.retry).toHaveBeenCalledTimes(1);
    await inFlight();
    await serve(LIMITED);
    await wait(2 * T.rateLimitDefaultMs - 1);
    expect(h.retry).toHaveBeenCalledTimes(1);
    await wait(1);
    expect(h.retry).toHaveBeenCalledTimes(2);
  });

  it("deux nouvelles demandes au plus : au troisième refus, rien à montrer", async () => {
    await hoverUntilAnswer(LIMITED_3S);
    await wait(3_000);
    await inFlight();
    await serve(LIMITED_3S);
    await wait(3_000);
    await inFlight();
    await serve(LIMITED_3S);
    expect(handles.a).toMatchObject({ phase: "failed", mount: false });
    await wait(30_000);
    expect(h.retry).toHaveBeenCalledTimes(2);
  });

  it("une panne se redemande après 10 s", async () => {
    await hoverUntilAnswer(FAILED);
    await wait(T.transientFailureMs - 1);
    expect(h.retry).not.toHaveBeenCalled();
    await wait(1);
    expect(h.retry).toHaveBeenCalledTimes(1);
  });

  it("une même réponse ne se lit qu'une fois ; une demande en vol n'est pas lue", async () => {
    await hoverUntilAnswer(LIMITED_3S);
    await wait(3_000);
    // L'ancienne réponse est encore là pendant que la nouvelle demande vole : rien ne se recompte.
    await inFlight();
    await wait(10_000);
    expect(h.retry).toHaveBeenCalledTimes(1);
    expect(handles.a.phase).toBe("fetching");
    // Et même relue sans demande en vol, la même réponse ne compte pas deux fois.
    h.loading = false;
    await render("a");
    await wait(10_000);
    expect(h.retry).toHaveBeenCalledTimes(1);
  });

  it("le survol perdu pendant l'attente : aucune nouvelle demande", async () => {
    await hoverUntilAnswer(LIMITED_3S);
    await render("a", { hovered: false });
    await wait(10_000);
    expect(h.retry).not.toHaveBeenCalled();
    expect(handles.a.phase).toBe("idle");
  });

  it("un nouveau survol pendant la garde du refus attend son échéance, puis redemande", async () => {
    await hoverUntilAnswer(LIMITED_3S);
    await render("a", { hovered: false });
    await wait(500);
    // Le refus d'il y a 500 ms vaut encore : le cycle suivant le lit et attend la fin de sa garde.
    await render("a", { hovered: true });
    await wait(T.intentMs);
    expect(handles.a.phase).toBe("fetching");
    expect(h.retry).not.toHaveBeenCalled();
    await wait(3_000 - 500 - T.intentMs);
    expect(h.retry).toHaveBeenCalledTimes(1);
  });
});
