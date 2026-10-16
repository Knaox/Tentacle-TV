/**
 * Le crochet de l'aperçu d'une carte, monté pour de vrai (React, sans DOM) sur
 * une horloge factice — la requête, le PiP et l'environnement simulés : quand
 * il demande, quand il montre, et qu'il ne fait RIEN quand il ne doit pas.
 */
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TRAILER_PREVIEW_DELAY, TRAILER_PREVIEW_TIMING, WEB_TRAILER_PREVIEW_PACE, trailerPreviewTimingFor,
} from "@tentacle-tv/shared";

/** Les temps de la machine au délai par défaut (800 ms) : ceux que l'appareil neuf applique. */
const T = trailerPreviewTimingFor(TRAILER_PREVIEW_TIMING, DEFAULT_TRAILER_PREVIEW_DELAY, WEB_TRAILER_PREVIEW_PACE);
import { FOUND, KID, createPreviewRig } from "./previewTestRig";

const h = vi.hoisted(() => ({
  result: undefined as unknown,
  fresh: false,
  receivedAt: 0,
  loading: false,
  capable: true,
  retry: vi.fn(),
  forget: vi.fn(),
  enabled: [] as boolean[],
  pip: null as unknown,
  block: null as string | null,
  loadHls: vi.fn(async () => undefined),
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: "fr-FR" } }) }));
vi.mock("@tentacle-tv/api-client", async () => {
  // Les règles des refus passagers, vraies ; la requête, simulée.
  const rules = await vi.importActual<typeof import("@tentacle-tv/api-client")>("@tentacle-tv/api-client");
  return {
    isTransientPreviewRefusal: rules.isTransientPreviewRefusal,
    previewRetryDelayMs: rules.previewRetryDelayMs,
    trailerPreviewResultTtl: rules.trailerPreviewResultTtl,
    useTrailerPreviewStream: (_subject: unknown, _lang: string, options: { enabled: boolean }) => {
      h.enabled.push(options.enabled);
      return {
        result: h.result, fresh: h.fresh, receivedAt: h.receivedAt, loading: h.loading,
        capable: h.capable, retry: h.retry, forget: h.forget,
      };
    },
  };
});
vi.mock("../pictureInPicture/pictureInPictureStore", () => ({ usePipSession: () => h.pip }));
vi.mock("./previewEnvironment", () => ({ useTrailerPreviewBlock: () => h.block }));
vi.mock("../lib/backendBase", () => ({ getBackendBase: () => "http://serveur:3001" }));
vi.mock("./previewSource", () => ({ loadPreviewHls: h.loadHls }));

const { useTrailerPreview } = await import("./useTrailerPreview");
const { forgetTrailerPreviewFailures } = await import("./previewFailures");
const { handles, render, wait, serve, cleanup } = createPreviewRig(useTrailerPreview, h);

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(h, { result: undefined, fresh: false, receivedAt: 0, loading: false, capable: true, enabled: [], pip: null, block: null });
  h.retry.mockClear();
  // Oublier la réponse gardée : la requête simulée n'a plus rien à rendre.
  h.forget.mockReset();
  h.forget.mockImplementation(() => {
    h.result = undefined;
    h.fresh = false;
  });
  forgetTrailerPreviewFailures();
});

afterEach(async () => {
  await cleanup();
  vi.useRealTimers();
});

describe("useTrailerPreview — quand demander", () => {
  it("rien avant l'intention ; la demande part au bout de l'intention (400 ms de survol au délai par défaut)", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs - 50);
    expect(h.enabled.some(Boolean)).toBe(false);
    expect(handles.a.phase).toBe("intent");
    await wait(50);
    await render("a");
    expect(handles.a.phase).toBe("fetching");
    expect(h.enabled.at(-1)).toBe(true);
  });

  it("le lecteur se charge dès l'intention, pas avant", async () => {
    h.loadHls.mockClear();
    await render("a", { hovered: true });
    await wait(T.intentMs - 50);
    expect(h.loadHls).not.toHaveBeenCalled();
    await wait(50);
    expect(h.loadHls).toHaveBeenCalledTimes(1);
  });

  it("un survol qui cesse pendant la demande ne l'abandonne pas : la réponse arrivée entre-temps sert le retour, sans nouvelle demande", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await render("a", { hovered: false });
    expect(handles.a.phase).toBe("idle");
    expect(h.enabled.at(-1)).toBe(false);
    // Le serveur répond après le départ du pointeur : la réponse est gardée.
    await serve(FOUND);
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await render("a");
    expect(handles.a.phase).toBe("buffering");
    expect(h.retry).not.toHaveBeenCalled();
  });

  it("un autre titre sous le même survol, pendant la demande : le cycle repart pour le nouveau titre", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs);
    expect(handles.a.phase).toBe("fetching");
    await render("a", { subject: KID });
    expect(handles.a.phase).toBe("intent");
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
  it("chargée cachée, montrée au rendez-vous, avec le son qui monte", async () => {
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
    // La réponse qui la désignait est oubliée : passé la mémoire d'échec, on redemandera.
    expect(h.forget).toHaveBeenCalledTimes(1);
    await render("a", { hovered: false });
    h.enabled = [];
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await render("a");
    expect(handles.a.phase).toBe("failed");
    // La requête ne s'est même pas activée : rien n'est parti vers le serveur.
    expect(h.enabled.some(Boolean)).toBe(false);
  });

  it("une réponse GARDÉE d'un survol précédent qui lâche (jeton mort au redémarrage du serveur) : le survol suivant redemande au serveur", async () => {
    // La bande-annonce reçue il y a une minute, encore fraîche pour la requête.
    h.result = FOUND;
    h.fresh = true;
    h.receivedAt = Date.now() - 60_000;
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await render("a");
    expect(handles.a.phase).toBe("buffering");
    await act(async () => handles.a.onError());
    expect(handles.a.phase).toBe("failed");
    expect(h.forget).toHaveBeenCalledTimes(1);
    await render("a", { hovered: false });
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await render("a");
    // Pas de mémoire d'échec : la demande attend la réponse neuve du serveur.
    expect(handles.a.phase).toBe("fetching");
    expect(h.enabled.at(-1)).toBe(true);
    await serve(FOUND);
    expect(handles.a.phase).toBe("buffering");
  });

  it("l'échec se range sous le titre qui l'a vécu, pas sous celui qui le remplace sous le même survol", async () => {
    await render("a", { hovered: true });
    await wait(T.intentMs);
    await serve(FOUND);
    await act(async () => handles.a.onError());
    expect(handles.a.phase).toBe("failed");
    // La carte montre un autre titre sous le même survol : son aperçu n'est pas condamné.
    await render("a", { subject: KID });
    await wait(T.intentMs);
    await render("a");
    expect(handles.a.phase).toBe("fetching");
    await serve(FOUND);
    expect(handles.a.phase).toBe("buffering");
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
