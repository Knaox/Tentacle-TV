/**
 * Le départ depuis la mini-carte, lu dans le DOM (simulé ici : le banc de
 * tests n'a pas de navigateur). Ce qui compte : une carte SANS mini-carte vue
 * garde l'ouverture ordinaire ; avec elle, c'est l'image de la mini-carte qui
 * part, la mini-carte se tait — et ne s'efface que quand le calque pose
 * l'image qui la remplace.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { capturePreviewLaunch, hidePreviewSource } from "./previewLaunch";

interface FakeStage {
  video: { readyState: number; videoWidth: number; videoHeight: number; muted: boolean; classList: { contains: () => boolean } } | null;
  still: { complete: boolean; naturalWidth: number; currentSrc: string; src: string } | null;
}

function fakeDom({ video, still }: FakeStage) {
  const rect = { top: 100, left: 50, width: 400, height: 225 };
  const stage = {
    getBoundingClientRect: () => rect,
    querySelector: (selector: string) => (selector === "video" ? video : selector === ".card-preview-backdrop" ? still : null),
  };
  const preview = { dataset: {} as Record<string, string>, querySelector: () => stage };
  vi.stubGlobal("document", { querySelector: () => preview, createElement: () => ({ getContext: () => null }) });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
  return { preview, rect };
}

const concealed = { dataset: { concealed: "true" } } as unknown as HTMLElement;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("capturePreviewLaunch", () => {
  it("une carte que rien ne recouvre : l'ouverture ordinaire", () => {
    const { preview } = fakeDom({ video: null, still: { complete: true, naturalWidth: 10, currentSrc: "s", src: "s" } });
    expect(capturePreviewLaunch({ dataset: {} } as unknown as HTMLElement)).toBeNull();
    expect(preview.dataset.launched).toBeUndefined();
  });

  it("une mini-carte qui montre l'image du titre : cette image part, à sa place", () => {
    const { preview, rect } = fakeDom({ video: null, still: { complete: true, naturalWidth: 1280, currentSrc: "still.webp", src: "x" } });
    const launch = capturePreviewLaunch(concealed);
    expect(launch).toEqual({ rect, frame: null, stillUrl: "still.webp", source: preview });
    // Encore visible : rien ne la remplace tant que le calque n'est pas posé.
    expect(preview.dataset.launched).toBeUndefined();
    hidePreviewSource(launch!);
    expect(preview.dataset.launched).toBe("true");
  });

  it("la vidéo se tait au départ", () => {
    const video = { readyState: 4, videoWidth: 1280, videoHeight: 720, muted: false, classList: { contains: () => false } };
    fakeDom({ video, still: { complete: true, naturalWidth: 1280, currentSrc: "still.webp", src: "x" } });
    capturePreviewLaunch(concealed);
    expect(video.muted).toBe(true);
  });

  it("rien de visible à faire partir (ni vidéo vue, ni image chargée) : l'ouverture ordinaire", () => {
    const { preview } = fakeDom({ video: null, still: { complete: false, naturalWidth: 0, currentSrc: "", src: "" } });
    expect(capturePreviewLaunch(concealed)).toBeNull();
    expect(preview.dataset.launched).toBeUndefined();
  });
});
