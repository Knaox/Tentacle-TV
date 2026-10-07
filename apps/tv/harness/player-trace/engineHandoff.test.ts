// La garde du décodeur de mpv (Android TV, mode Lite) : quand mpv retombe sur
// le décodage logiciel, le repli passe à ExoPlayer — le MÊME flux servi, sans
// rien perdre de l'état (transcodage forcé gardé, position reprise). Les
// vrais crochets de l'état de rechargement et du routage, montés sans DOM.
// Apple TV : rien de tout cela n'existe — l'état d'avant, à l'identique.
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { mpvDecoderVerdict } from "@tentacle-tv/tv-core";
import { PLAYBACK_TIER } from "@tv/lib/playbackTier";
import { useTVPlayerRouting } from "@tv/hooks/useTVPlayerRouting";
import { useTVReloadState } from "@tv/hooks/useTVReloadState";

const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = { nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml", ownerDocument: doc, addEventListener() {}, removeEventListener() {} };

type Probe = ReturnType<typeof useTVReloadState> & { useExoPlayer: boolean };
let probe: Probe | null = null;
const ref = { current: null };

function Rig({ itemId }: { itemId: string }) {
  const reload = useTVReloadState({
    itemId, defaultAudio: 1, isLoading: false, positionRef: { current: 42 },
    setAudioIndexRef: { current: () => {} }, setSubtitleIndexRef: { current: () => {} }, setVideoError: () => {},
    resetPrefsAppliedRef: { current: () => {} }, qualityReset: () => {},
  });
  const { useExoPlayer } = useTVPlayerRouting({
    forceTranscode: reload.forceTranscode, servedToExo: reload.servedToExo, isTranscodingQuality: false, exoRef: ref, mpvRef: ref,
  });
  probe = { ...reload, useExoPlayer };
  return null;
}

async function mount(itemId: string) {
  const root = createRoot(container as never);
  await act(async () => { root.render(createElement(Rig, { itemId })); });
  return root;
}

const androidtv = process.env.TRACE_PLATFORM === "androidtv";

describe("garde du décodeur de mpv — le repli rendu à ExoPlayer", () => {
  it("le niveau de lecture : `normal` sans forçage (Apple TV toujours)", () => {
    expect(PLAYBACK_TIER).toBe("normal");
  });

  it("erreur d'Exo → mpv ; mpv en logiciel (Lite) → Exo lit le repli, transcodage gardé", async () => {
    const root = await mount("film");
    expect(probe?.useExoPlayer).toBe(true);
    await act(async () => { probe?.setForceTranscode(true); });
    expect(probe).toMatchObject({ forceTranscode: true, servedToExo: false, useExoPlayer: false });
    expect(mpvDecoderVerdict({ lite: true, hwdec: "software", videoHeight: 1080 })).toBe("toExo");
    await act(async () => { probe?.handToExo(); });
    expect(probe).toMatchObject({ forceTranscode: true, servedToExo: true, useExoPlayer: true });
    await act(async () => { root.unmount(); });
  });

  it("le titre suivant repart de zéro : Exo, sans repli", async () => {
    const root = await mount("film");
    await act(async () => { probe?.handToExo(); });
    await act(async () => { root.render(createElement(Rig, { itemId: "suivant" })); });
    expect(probe).toMatchObject({ forceTranscode: false, servedToExo: false, useExoPlayer: true });
    await act(async () => { root.unmount(); });
  });

  it.runIf(!androidtv)("Apple TV : sans garde, le repli reste à son moteur (l'état d'avant)", async () => {
    const root = await mount("film");
    await act(async () => { probe?.setForceTranscode(true); });
    expect(probe).toMatchObject({ forceTranscode: true, servedToExo: false });
    await act(async () => { root.unmount(); });
  });
});
