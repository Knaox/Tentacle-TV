import { describe, expect, it } from "vitest";
import type { RecoReason } from "@tentacle-tv/api-client";
import { firstReasonText, reasonTexts } from "./recoReasons";

const t = (key: string, opts?: Record<string, unknown>) => `${key}:${String(opts?.name ?? opts?.title ?? "")}`;

describe("reasonTexts", () => {
  it("dédoublonne, saute les raisons muettes et borne à max", () => {
    const reasons: RecoReason[] = [
      { kind: "facet", key: "lang:en" },
      { kind: "facet", key: "actor:1", label: "Tom" },
      { kind: "facet", key: "actor:2", label: "Tom" },
      { kind: "seed", seedTitle: "Alien" },
      { kind: "facet", key: "kw:9", label: "Espace" },
      { kind: "exploration" },
    ];
    expect(reasonTexts(reasons, t)).toEqual(["reasonActor:Tom", "reasonSeed:Alien", "reasonTheme:Espace"]);
    expect(reasonTexts(reasons, t, 1)).toEqual(["reasonActor:Tom"]);
  });

  it("rend undefined quand aucune raison ne fait une phrase", () => {
    expect(firstReasonText([{ kind: "facet", key: "runtime:long" }], t)).toBeUndefined();
    expect(firstReasonText([], t)).toBeUndefined();
  });
});
