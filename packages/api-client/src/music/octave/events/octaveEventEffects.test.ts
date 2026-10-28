import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { musicKeys } from "../../musicQueryKeys";
import { likeOverrideOf, setLikeOverride } from "../actions/likeOverrides";
import { applyOctaveEvent } from "./octaveEventEffects";

describe("un évènement music:* dans Octave (web, bureau, mobile)", () => {
  it("un cœur changé ailleurs : le cœur affiché d'avance s'efface, les likés se relisent — sans lecteur aussi", () => {
    const qc = new QueryClient();
    qc.setQueryData(musicKeys.liked(500), { pages: [], pageParams: [] });
    setLikeOverride("jf:t1", true);
    applyOctaveEvent(qc, null, { type: "music:userdata", changes: [{ jellyfinId: "t1", favorite: false }] });
    expect(likeOverrideOf("jf:t1")).toBeUndefined();
    expect(qc.getQueryState(musicKeys.liked(500))?.isInvalidated).toBe(true);
  });

  it("le tri d'une liste gardé par un autre appareil : sa préférence se relit", () => {
    const qc = new QueryClient();
    qc.setQueryData(musicKeys.listPrefs("playlist:p1"), { sort: "title", direction: "asc", custom: null });
    applyOctaveEvent(qc, null, { type: "music:listPrefs", key: "playlist:p1" });
    expect(qc.getQueryState(musicKeys.listPrefs("playlist:p1"))?.isInvalidated).toBe(true);
  });
});
