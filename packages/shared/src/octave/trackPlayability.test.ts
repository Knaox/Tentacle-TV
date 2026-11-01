import { describe, expect, it } from "vitest";
import { externalTrack, libraryTrack } from "./fixtures";
import { reasonOf, trackPlayability, unplayableActions, unplayableNotice, unplayableReasonKey, withPlayability } from "./trackPlayability";
import { isTrackUnavailable } from "./unavailableTrack";

/** Lot « ol » (01/11) : la lisibilité vérifiée par l'extension, lue de la même façon partout. */
describe("trackPlayability — le contrat d'ol3", () => {
  it("« yes » et « unknown » ne sont jamais grisés ; « no » l'est, avec sa raison", () => {
    expect(trackPlayability(externalTrack("sillon", "ytm:1", { playable: "yes" }))).toEqual({ state: "playable", reason: null, greyed: false });
    expect(trackPlayability(externalTrack("sillon", "ytm:1", { playable: "unknown" }))).toEqual({ state: "unknown", reason: null, greyed: false });
    expect(trackPlayability(externalTrack("sillon", "ytm:1", { playable: "no", unavailable: "notStreamable", playableReason: "region" }))).toEqual({ state: "unplayable", reason: "region", greyed: true });
  });

  it("« no » sans raison, ou une raison inconnue de ce client : « other », toujours grisé", () => {
    expect(trackPlayability(externalTrack("sillon", "ytm:1", { playable: "no" })).reason).toBe("other");
    expect(trackPlayability(externalTrack("sillon", "ytm:1", { playable: "no", unavailable: "notStreamable" })).reason).toBe("notStreamable");
    const future = externalTrack("sillon", "ytm:1", { playable: "no", playableReason: "copyrightClaim" as never });
    expect(trackPlayability(future)).toEqual({ state: "unplayable", reason: "other", greyed: true });
  });

  it("le contrat fait foi sur une vieille marque : « yes » ou « unknown » avec `unavailable` ne grise pas", () => {
    expect(isTrackUnavailable(externalTrack("sillon", "ytm:1", { playable: "yes", unavailable: "notStreamable" }))).toBe(false);
    expect(isTrackUnavailable(externalTrack("sillon", "ytm:1", { playable: "unknown", unavailable: "notStreamable" }))).toBe(false);
  });

  it("une extension d'AVANT (sans `playable`) : la marque de « fl » seule, comportement d'avant", () => {
    expect(trackPlayability(externalTrack("sillon", "imp:1", { unavailable: "notStreamable" }))).toEqual({ state: "unplayable", reason: "notStreamable", greyed: true });
    expect(trackPlayability(externalTrack("sillon", "ytm:1"))).toEqual({ state: "playable", reason: null, greyed: false });
  });

  it("une valeur de `playable` inconnue de ce client se lit comme absente", () => {
    expect(isTrackUnavailable(externalTrack("sillon", "ytm:1", { playable: "maybe" as never }))).toBe(false);
    expect(isTrackUnavailable(externalTrack("sillon", "ytm:1", { playable: "maybe" as never, unavailable: "notPublic" }))).toBe(true);
  });

  it("un titre de la bibliothèque se lit toujours", () => {
    expect(isTrackUnavailable(libraryTrack("a", { playable: "no", playableReason: "unavailable" }))).toBe(false);
  });
});

describe("trackPlayability — les mots et les gestes", () => {
  it("chaque raison a sa clé, les inconnues tombent sur « other »", () => {
    expect(unplayableReasonKey("region")).toBe("unplayableTrack.reason.region");
    expect(unplayableReasonKey(null)).toBe("unplayableTrack.reason.other");
    expect(reasonOf(undefined)).toBe("other");
  });

  it("l'avis ne propose que ce que le compte peut faire", () => {
    expect(unplayableActions({ canLike: true, canAddToPlaylist: true, liked: false })).toEqual({ like: true, liked: false, addToPlaylist: true });
    expect(unplayableActions({ canLike: false, canAddToPlaylist: true, liked: true })).toEqual({ like: false, liked: false, addToPlaylist: true });
  });
});

describe("withPlayability — un état arrivé après coup", () => {
  it("pose l'état sans changer d'objet quand rien ne change (aucun rendu de trop)", () => {
    const track = externalTrack("sillon", "ytm:1", { playable: "unknown" });
    const no = withPlayability(track, { playable: "no", reason: "members" });
    expect(no).toMatchObject({ playable: "no", unavailable: "notStreamable", playableReason: "members" });
    expect(isTrackUnavailable(no)).toBe(true);
    expect(withPlayability(no, { playable: "no", reason: "members" })).toBe(no);
    expect(withPlayability(no, { playable: "yes" })).toMatchObject({ playable: "yes", unavailable: null, playableReason: null });
    const lib = libraryTrack("a");
    expect(withPlayability(lib, { playable: "no" })).toBe(lib);
  });
});

describe("unplayableNotice — l'avis au clic", () => {
  const track = externalTrack("sillon", "ytm:1", { playable: "no", unavailable: "notStreamable", playableReason: "unavailable" });
  it("dit la raison et garde la playlist (en tête) et le favori", () => {
    expect(unplayableNotice(track, { canLike: true, canAddToPlaylist: true, liked: false })).toEqual({
      titleKey: "unplayableTrack.title",
      reasonKey: "unplayableTrack.reason.unavailable",
      keepKey: "unplayableTrack.keep",
      gestures: ["addToPlaylist", "like"],
      liked: false,
    });
  });
  it("déjà aimé : plus de « Favori », la phrase reste ; aucun geste possible : la raison seule", () => {
    expect(unplayableNotice(track, { canLike: true, canAddToPlaylist: false, liked: true })).toMatchObject({ gestures: [], keepKey: "unplayableTrack.keep", liked: true });
    expect(unplayableNotice(track, { canLike: false, canAddToPlaylist: false, liked: false })).toMatchObject({ gestures: [], keepKey: null });
  });
});
