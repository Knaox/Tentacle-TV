import { describe, expect, it } from "vitest";
import { probePreviewDecodes } from "./previewDecode";

/** Une source média factice : elle accepte ce que `accepts` reconnaît. */
const source = (accepts: (mimeType: string) => boolean) => ({ isTypeSupported: accepts });

describe("ce que le lecteur du navigateur décode (previewDecode.ts)", () => {
  it("Chrome et Electron lisent tout : rien de plus ne sera écrit dans leurs requêtes", () => {
    expect(probePreviewDecodes({ MediaSource: source(() => true) })).toEqual(["h264", "aac", "vp9", "opus"]);
  });

  it("le bureau CEF (binaires publics, mesuré le 10/11/2026) : ni avc1 ni mp4a, le VP9 et l'Opus", () => {
    const cef = source((mimeType) => !/avc1|mp4a|hvc1|ac-3/.test(mimeType));
    expect(probePreviewDecodes({ MediaSource: cef })).toEqual(["vp9", "opus"]);
  });

  it("sans source média (un navigateur qui lit le HLS seul) : rien à déclarer", () => {
    expect(probePreviewDecodes({})).toBeNull();
    expect(probePreviewDecodes({ MediaSource: {} })).toBeNull();
    // Safari d'iPhone : la source « gérée » fait foi.
    expect(probePreviewDecodes({ ManagedMediaSource: source((mimeType) => /avc1|mp4a/.test(mimeType)) })).toEqual(["h264", "aac"]);
  });

  it("une source qui lève ne casse rien : elle ne décode rien", () => {
    expect(probePreviewDecodes({ MediaSource: source(() => { throw new Error("refus"); }) })).toEqual([]);
  });
});
