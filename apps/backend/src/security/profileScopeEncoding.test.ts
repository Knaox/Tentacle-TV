/**
 * Une session de PROFIL de TV (la Famille) n'atteint ni le jumelage, ni les
 * téléchargements, ni la gestion du compte ; un invité, ni Watch Together, ni
 * les tickets, ni le partage. Le routeur DÉCODE le chemin avant de choisir la
 * route (`/api/%70air/tv-token` EST `/api/pair/tv-token`) : la liste des
 * refus doit juger ce chemin-là, jamais l'URL brute — sinon un enfant devant
 * la TV se frappe un jeton d'appareil sans profil (`POST /api/pair/tv-token`).
 */

import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

vi.mock("../services/family/familyGuestMarkers", () => ({ isFamilyGuest: async () => true }));
vi.mock("../services/family/familyGuestExtensions", () => ({ EXTENSIONS_PREFIX: "/api/plugins", guestExtensionAccess: async () => "denied" }));

import { profileSessionScope } from "../services/family/profileSessionLimits";

const PROFILE = { userId: "enfant", username: "Léo", session: "tvProfile", pairingId: "salon" };

describe("périmètre d'une session de profil : le chemin décodé fait foi", () => {
  it("le routeur décode bien `%70air` en `pair` (la route visée est atteinte)", async () => {
    const app = Fastify();
    app.post("/api/pair/tv-token", async () => ({ reached: true }));
    const res = await app.inject({ method: "POST", url: "/api/%70air/tv-token" });
    expect(res.json()).toEqual({ reached: true });
  });

  it.each([
    "/api/%70air/tv-token",
    "/api/pai%72/generate",
    "/api/%64ownloads/abc",
    "/api/auth/%61ccount",
    "/api/auth/change%2Dpassword",
    "/api/%70ush/register",
  ])("refuse %s comme sa forme en clair", async (url) => {
    expect((await profileSessionScope(url, PROFILE)).kind).toBe("refuse");
  });

  it.each(["/api/%74ickets", "/api/%73hare/abc", "/api/watch%2Dtogether/group", "/api/%70lugins/vigie/titles"])(
    "un invité : refuse %s comme sa forme en clair",
    async (url) => {
      expect((await profileSessionScope(url, PROFILE)).kind).toBe("refuse");
    },
  );

  it("une route permise reste permise, encodée ou non", async () => {
    expect((await profileSessionScope("/api/preferences/playback", PROFILE)).kind).toBe("pass");
    expect((await profileSessionScope("/api/%70references/playback", PROFILE)).kind).toBe("pass");
  });
});
