/**
 * Ce qui interdit tout aperçu sur l'appareil, en un seul blocage lu par toutes
 * les cartes — et « Réduire les animations » n'en fait pas partie.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ dataSaver: false, dataSaverListeners: new Set<() => void>() }));
vi.mock("@tentacle-tv/api-client", () => ({
  isDataSaverActive: () => h.dataSaver,
  subscribeDataSaver: (listener: () => void) => {
    h.dataSaverListeners.add(listener);
    return () => h.dataSaverListeners.delete(listener);
  },
}));

type MediaListener = () => void;
const media = new Map<string, { matches: boolean; listeners: Set<MediaListener> }>();
function setMedia(query: string, matches: boolean) {
  const entry = media.get(query) ?? { matches, listeners: new Set() };
  entry.matches = matches;
  media.set(query, entry);
  entry.listeners.forEach((listener) => listener());
}
const docListeners = new Set<() => void>();
const fakeDocument = {
  hidden: false,
  addEventListener: (_type: string, listener: () => void) => docListeners.add(listener),
  removeEventListener: (_type: string, listener: () => void) => docListeners.delete(listener),
};

const g = globalThis as Record<string, unknown>;
g.window ??= globalThis;
g.document = fakeDocument;
(g.window as Record<string, unknown>).matchMedia = (query: string) => {
  if (!media.has(query)) media.set(query, { matches: false, listeners: new Set() });
  const entry = media.get(query)!;
  return {
    get matches() {
      return entry.matches;
    },
    addEventListener: (_type: string, listener: MediaListener) => entry.listeners.add(listener),
    removeEventListener: (_type: string, listener: MediaListener) => entry.listeners.delete(listener),
  };
};

const { getTrailerPreviewBlock, setTrailerPreviewHostState, subscribeTrailerPreviewBlock } = await import("./previewEnvironment");
const { trailerPreviewsFlag } = await import("./previewSettings");

const FINE = "(hover: hover) and (pointer: fine)";
const REDUCED_DATA = "(prefers-reduced-data: reduce)";

beforeEach(() => {
  setMedia(FINE, true);
  setMedia(REDUCED_DATA, false);
  fakeDocument.hidden = false;
  h.dataSaver = false;
  trailerPreviewsFlag.set(true);
  setTrailerPreviewHostState({ offline: false, mirror: false });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("le blocage de l'aperçu sur l'appareil", () => {
  it("une souris, une page affichée, rien de coupé : rien ne bloque", () => {
    expect(getTrailerPreviewBlock()).toBeNull();
  });

  it("chaque cause bloque, dans l'ordre", () => {
    trailerPreviewsFlag.set(false);
    expect(getTrailerPreviewBlock()).toBe("setting");
    trailerPreviewsFlag.set(true);
    setTrailerPreviewHostState({ offline: true, mirror: false });
    expect(getTrailerPreviewBlock()).toBe("offline");
    setTrailerPreviewHostState({ offline: false, mirror: true });
    expect(getTrailerPreviewBlock()).toBe("mirror");
    setTrailerPreviewHostState({ offline: false, mirror: false });
    fakeDocument.hidden = true;
    expect(getTrailerPreviewBlock()).toBe("hidden");
    fakeDocument.hidden = false;
    setMedia(FINE, false);
    expect(getTrailerPreviewBlock()).toBe("pointer");
    setMedia(FINE, true);
    setMedia(REDUCED_DATA, true);
    expect(getTrailerPreviewBlock()).toBe("reducedData");
    setMedia(REDUCED_DATA, false);
    h.dataSaver = true;
    expect(getTrailerPreviewBlock()).toBe("dataSaver");
  });

  it("les cartes abonnées sont prévenues d'un changement, et seulement d'un changement", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTrailerPreviewBlock(listener);
    setMedia(FINE, false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getTrailerPreviewBlock()).toBe("pointer");
    // Rien ne change : personne n'est réveillé.
    setTrailerPreviewHostState({ offline: false, mirror: false });
    expect(listener).toHaveBeenCalledTimes(1);
    setMedia(FINE, true);
    fakeDocument.hidden = true;
    docListeners.forEach((l) => l());
    expect(getTrailerPreviewBlock()).toBe("hidden");
    fakeDocument.hidden = false;
    docListeners.forEach((l) => l());
    h.dataSaver = true;
    h.dataSaverListeners.forEach((l) => l());
    expect(getTrailerPreviewBlock()).toBe("dataSaver");
    unsubscribe();
    // Plus personne n'écoute : les sources du navigateur sont relâchées.
    expect(docListeners.size).toBe(0);
    expect(h.dataSaverListeners.size).toBe(0);
    expect(media.get(FINE)!.listeners.size).toBe(0);
  });
});
