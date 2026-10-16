/**
 * L'intention du crochet branchée sur le VRAI pointeur (`pointerMotion.ts`,
 * remplacé ici par un émetteur) : tant que le pointeur bouge sur la carte —
 * un balayage de rangée, la molette —, la requête ne s'active pas ; arrêté,
 * elle part `intentStillMs` plus tard. Rien n'écoute le pointeur hors de
 * l'intention.
 */
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TRAILER_PREVIEW_DELAY, TRAILER_PREVIEW_TIMING, WEB_TRAILER_PREVIEW_PACE, trailerPreviewTimingFor,
} from "@tentacle-tv/shared";

/** Les temps de la machine au délai par défaut (800 ms) : ceux que l'appareil neuf applique. */
const T = trailerPreviewTimingFor(TRAILER_PREVIEW_TIMING, DEFAULT_TRAILER_PREVIEW_DELAY, WEB_TRAILER_PREVIEW_PACE);
import { createPreviewRig } from "./previewTestRig";

const h = vi.hoisted(() => ({
  result: undefined as unknown,
  fresh: false,
  receivedAt: 0,
  loading: false,
  enabled: [] as boolean[],
  motion: new Set<() => void>(),
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: "fr" } }) }));
vi.mock("@tentacle-tv/api-client", async () => {
  const rules = await vi.importActual<typeof import("@tentacle-tv/api-client")>("@tentacle-tv/api-client");
  return {
    isTransientPreviewRefusal: rules.isTransientPreviewRefusal,
    previewRetryDelayMs: rules.previewRetryDelayMs,
    trailerPreviewResultTtl: rules.trailerPreviewResultTtl,
    useTrailerPreviewStream: (_subject: unknown, _lang: string, options: { enabled: boolean }) => {
      h.enabled.push(options.enabled);
      return { result: h.result, fresh: h.fresh, receivedAt: h.receivedAt, loading: h.loading, capable: true, retry: vi.fn(), forget: vi.fn() };
    },
  };
});
vi.mock("./pointerMotion", () => ({
  subscribePointerMotion: (listener: () => void) => {
    h.motion.add(listener);
    return () => h.motion.delete(listener);
  },
}));
vi.mock("../pictureInPicture/pictureInPictureStore", () => ({ usePipSession: () => null }));
vi.mock("./previewEnvironment", () => ({ useTrailerPreviewBlock: () => null }));
vi.mock("../lib/backendBase", () => ({ getBackendBase: () => "http://serveur:3001" }));
vi.mock("./previewSource", () => ({ loadPreviewHls: async () => undefined }));

const { useTrailerPreview } = await import("./useTrailerPreview");
const { handles, render, wait, cleanup } = createPreviewRig(useTrailerPreview, h);

/** Le pointeur bouge (au-delà du seuil) : chaque écouteur de l'intention l'apprend. */
async function move() {
  await act(async () => {
    for (const listener of [...h.motion]) listener();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(h, { result: undefined, fresh: false, receivedAt: 0, loading: false, enabled: [] });
  h.motion.clear();
});

afterEach(async () => {
  await cleanup();
  vi.useRealTimers();
});

describe("useTrailerPreview — l'intention attend un pointeur arrêté", () => {
  it("un pointeur qui ne cesse de bouger sur la carte : aucune requête, même au bout de deux secondes", async () => {
    await render("a", { hovered: true });
    for (let elapsed = 0; elapsed < 2_000; elapsed += 50) {
      await wait(50);
      await move();
    }
    await render("a");
    expect(handles.a.phase).toBe("intent");
    expect(h.enabled.some(Boolean)).toBe(false);
  });

  it("arrêté, la requête part `intentStillMs` après le dernier mouvement", async () => {
    await render("a", { hovered: true });
    for (let elapsed = 0; elapsed < 600; elapsed += 50) {
      await wait(50);
      await move();
    }
    await wait(T.intentStillMs - 1);
    await render("a");
    expect(handles.a.phase).toBe("intent");
    await wait(1);
    await render("a");
    expect(handles.a.phase).toBe("fetching");
    expect(h.enabled.at(-1)).toBe(true);
  });

  it("rien n'écoute le pointeur hors de l'intention : ni au repos, ni une fois la demande partie", async () => {
    await render("a", { hovered: false });
    expect(h.motion.size).toBe(0);
    await render("a", { hovered: true });
    expect(h.motion.size).toBe(1);
    await wait(T.intentMs);
    await render("a");
    expect(handles.a.phase).toBe("fetching");
    expect(h.motion.size).toBe(0);
  });
});
