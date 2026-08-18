import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revaliderSession } from "./sessionGuardTv";

/**
 * Le verdict qui décide si un téléviseur garde ou rend sa session.
 *
 * Ce qui se joue ici : un 401 nu (Jellyfin grognon, secret en avarie) ne doit
 * JAMAIS être pris pour une révocation — seule la réponse `revoked: true`
 * (ligne paired_devices supprimée, verdict de base) autorise la purge.
 */
describe("revaliderSession", () => {
  // Environnement node : pas de localStorage — un Map fait l'affaire.
  const entrepot = new Map<string, string>();
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: (cle: string) => entrepot.get(cle) ?? null,
      setItem: (cle: string, valeur: string) => void entrepot.set(cle, valeur),
      removeItem: (cle: string) => void entrepot.delete(cle),
    });
    entrepot.set(
      "tentacle_token",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl",
    );
  });

  afterEach(() => {
    entrepot.clear();
    vi.unstubAllGlobals();
  });

  const reponse = (status: number, corps: unknown) =>
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(corps), { status }),
      ),
    );

  it("lit revoked:true comme une révocation", async () => {
    reponse(401, { message: "Appareil révoqué", revoked: true });
    expect(await revaliderSession()).toBe("revoquee");
  });

  it("lit un 401 nu comme une simple expiration — session conservée par l'appelant", async () => {
    reponse(401, { message: "Token invalide" });
    expect(await revaliderSession()).toBe("expiree");
  });

  it("lit un 503 comme une panne, pas comme un refus", async () => {
    reponse(503, { message: "Base de données indisponible" });
    expect(await revaliderSession()).toBe("injoignable");
  });

  it("lit un refresh réussi comme ok", async () => {
    reponse(200, { AccessToken: "jeton-frais" });
    expect(await revaliderSession()).toBe("ok");
  });

  it("lit une panne réseau comme injoignable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("réseau coupé")));
    expect(await revaliderSession()).toBe("injoignable");
  });
});
