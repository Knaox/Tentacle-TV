import { describe, expect, it } from "vitest";
import { computePageFlags } from "./pageFlags";

const base = {
  state: "ready" as const,
  bootstrapping: false,
  rebuilding: false,
  poolAbsent: false,
  poolGenerating: false,
  snapshotPoolPreliminary: false,
  snapshotBehindPool: false,
};

describe("computePageFlags", () => {
  it("page à jour : silence", () => {
    expect(computePageFlags(base)).toEqual({ generating: false, refining: false, exploring: false });
  });

  it("pool absent : generating et refining ; préliminaire ou en retard : refining seul", () => {
    expect(computePageFlags({ ...base, poolAbsent: true, poolGenerating: true })).toEqual({ generating: true, refining: true, exploring: false });
    expect(computePageFlags({ ...base, snapshotPoolPreliminary: true })).toEqual({ generating: false, refining: true, exploring: false });
    expect(computePageFlags({ ...base, snapshotBehindPool: true })).toEqual({ generating: false, refining: true, exploring: false });
  });

  it("premier contact : exploring et refining", () => {
    expect(computePageFlags({ ...base, state: "warming", bootstrapping: true })).toEqual({ generating: false, refining: true, exploring: true });
  });

  it("froid avec un rebuild en vol : generating (le client continue de sonder)", () => {
    expect(computePageFlags({ ...base, state: "cold", rebuilding: true })).toEqual({ generating: true, refining: true, exploring: false });
    expect(computePageFlags({ ...base, state: "cold" })).toEqual({ generating: false, refining: false, exploring: false });
  });
});
