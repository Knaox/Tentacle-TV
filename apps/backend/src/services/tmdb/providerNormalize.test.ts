import { describe, expect, it, vi } from "vitest";

vi.mock("../configStore", () => ({ getConfigValue: () => undefined }));

import { normalizeProviders, watchRegion } from "./providerNormalize";

describe("normalizeProviders", () => {
  it("bloc absent → null (inconnu) ; région sans offre → [] (aucune)", () => {
    expect(normalizeProviders(undefined, "FR")).toBeNull();
    expect(normalizeProviders({ results: {} }, "FR")).toEqual([]);
    expect(normalizeProviders({ results: { US: { flatrate: [{ provider_id: 8 }] } } }, "FR")).toEqual([]);
  });

  it("flatrate, ads, free dans cet ordre, dédoublonnés ; rent/buy ignorés", () => {
    const out = normalizeProviders(
      {
        results: {
          FR: {
            free: [{ provider_id: 234, provider_name: "Arte", logo_path: "/arte.jpg" }],
            ads: [{ provider_id: 1796, provider_name: "Netflix Standard with Ads" }],
            flatrate: [
              { provider_id: 8, provider_name: "Netflix", logo_path: "/n.jpg" },
              { provider_id: 1796, provider_name: "Netflix Standard with Ads" },
            ],
            rent: [{ provider_id: 2, provider_name: "Apple TV Store" }],
            buy: [{ provider_id: 10, provider_name: "Amazon Video" }],
          },
        },
      },
      "FR"
    );
    expect(out?.map((p) => p.id)).toEqual([8, 1796, 234]);
    expect(out?.[0]).toEqual({ id: 8, name: "Netflix", logoPath: "/n.jpg" });
    expect(out?.[1].logoPath).toBeNull();
  });
});

describe("watchRegion", () => {
  it("vaut FR sans réglage", () => {
    expect(watchRegion()).toBe("FR");
  });
});
