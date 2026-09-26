/**
 * Les deux décisions pures de la page Admin → Métadonnées : quel refus le
 * serveur a-t-il expliqué, et faut-il continuer de sonder le calcul.
 */

import { describe, expect, it } from "vitest";
import { TentacleApiError } from "./usePreferences";
import { adminMetadataErrorCode, fanoutRefetchInterval, FANOUT_POLL_MS } from "./useAdminMetadata";

const status = (fanout?: { running: boolean; processed: number; total: number }) => ({
  tmdb: { configured: true, source: "db" as const, last4: "cdef" },
  fanout,
});

describe("adminMetadataErrorCode", () => {
  it("lit le code expliqué dans le corps JSON", () => {
    expect(adminMetadataErrorCode(new TentacleApiError('{"error":"tmdb-key-invalid"}', 400))).toBe("tmdb-key-invalid");
    expect(adminMetadataErrorCode(new TentacleApiError('{"error":"tmdb-unreachable"}', 502))).toBe("tmdb-unreachable");
    expect(adminMetadataErrorCode(new TentacleApiError('{"error":"tmdb-key-missing"}', 400))).toBe("tmdb-key-missing");
  });

  it("un 404 veut dire serveur trop ancien pour la route", () => {
    expect(adminMetadataErrorCode(new TentacleApiError("Not Found", 404))).toBe("unsupported");
  });

  it("le reste est un échec sans détail : code inconnu, corps illisible, panne réseau", () => {
    expect(adminMetadataErrorCode(new TentacleApiError('{"message":"Validation error"}', 400))).toBe("failed");
    expect(adminMetadataErrorCode(new TentacleApiError('{"error":"autre"}', 400))).toBe("failed");
    expect(adminMetadataErrorCode(new TentacleApiError("<html>", 500))).toBe("failed");
    expect(adminMetadataErrorCode(new TypeError("Failed to fetch"))).toBe("failed");
  });
});

describe("fanoutRefetchInterval", () => {
  it("sonde tant que le calcul tourne, se tait sinon", () => {
    expect(fanoutRefetchInterval(status({ running: true, processed: 3, total: 12 }))).toBe(FANOUT_POLL_MS);
    expect(fanoutRefetchInterval(status({ running: false, processed: 12, total: 12 }))).toBe(false);
    // Serveur d'avant le compteur, ou état pas encore lu.
    expect(fanoutRefetchInterval(status())).toBe(false);
    expect(fanoutRefetchInterval(undefined)).toBe(false);
  });
});
