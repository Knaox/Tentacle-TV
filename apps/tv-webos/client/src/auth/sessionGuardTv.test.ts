import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revalidateSession } from "./sessionGuardTv";

/**
 * Le verdict qui décide si un téléviseur garde ou rend sa session.
 *
 * Ce qui se joue ici : un 401 nu (Jellyfin grognon, secret en avarie) ne doit
 * JAMAIS être pris pour une révocation — seule la réponse `revoked: true`
 * (ligne paired_devices supprimée, verdict de base) autorise la purge.
 */
describe("revaliderSession", () => {
  // Environnement node : pas de localStorage — un Map fait l'affaire.
  const store = new Map<string, string>();
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
    store.set(
      "tentacle_token",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl",
    );
  });

  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });

  const response = (status: number, body: unknown) =>
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(body), { status }),
      ),
    );

  it("lit revoked:true comme une révocation", async () => {
    response(401, { message: "Appareil révoqué", revoked: true });
    expect(await revalidateSession()).toBe("revoked");
  });

  it("lit un 401 nu comme une simple expiration — session conservée par l'appelant", async () => {
    response(401, { message: "Token invalide" });
    expect(await revalidateSession()).toBe("expired");
  });

  it("lit un 503 comme une panne, pas comme un refus", async () => {
    response(503, { message: "Base de données indisponible" });
    expect(await revalidateSession()).toBe("unreachable");
  });

  it("lit un refresh réussi comme ok", async () => {
    response(200, { AccessToken: "jeton-frais" });
    expect(await revalidateSession()).toBe("ok");
  });

  it("lit une panne réseau comme injoignable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("réseau coupé")));
    expect(await revalidateSession()).toBe("unreachable");
  });
});
