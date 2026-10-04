import { describe, expect, it } from "vitest";

import { authVerdictApplies, refreshAction, type RefreshVerdict } from "./authVerdict";

/**
 * La propriété verrouillée (relecture de T8, correctif 06865bdbe) : un verdict
 * du serveur ne s'applique qu'au jeton qui l'a reçu — une révocation sur le
 * jeton COURANT est appliquée, une révocation sur un jeton remplacé pendant
 * l'appel est ignorée.
 */

const REVOKED: RefreshVerdict = { ok: false, reason: "expired", revoked: true };
const PROFILE_ENDED: RefreshVerdict = { ok: false, reason: "expired", revoked: true, profileEnded: true };

describe("le verdict du serveur sur un jeton", () => {
  it("vaut pour la session tant qu'elle porte encore ce jeton", () => {
    expect(authVerdictApplies("ancien", "ancien")).toBe(true);
  });

  it("ne vaut plus si l'échange ou un profil a remplacé le jeton pendant l'appel", () => {
    // L'échange a ôté l'ancien jeton (la TV n'a plus que son jeton de jumelage) : « révoqué » ne la déjumelle pas.
    expect(authVerdictApplies("ancien", null)).toBe(false);
    expect(authVerdictApplies("ancien", "session-de-profil")).toBe(false);
  });
});

describe("la décision d'un rafraîchissement", () => {
  it("jeton inchangé, « révoqué » : la révocation est APPLIQUÉE — fin du profil, ou déjumelage", () => {
    expect(refreshAction("T", "T", PROFILE_ENDED)).toEqual({ kind: "endProfile" });
    expect(refreshAction("T", "T", REVOKED)).toEqual({ kind: "revoked" });
  });

  it("jeton changé pendant l'appel : le verdict est IGNORÉ, quel qu'il soit", () => {
    expect(refreshAction("T", "autre", REVOKED)).toEqual({ kind: "ignore" });
    expect(refreshAction("T", null, REVOKED)).toEqual({ kind: "ignore" });
    expect(refreshAction("T", "autre", PROFILE_ENDED)).toEqual({ kind: "ignore" });
    // Même un jeton rafraîchi : l'ancien ne remplace jamais la session qui l'a remplacé.
    expect(refreshAction("T", "autre", { ok: true, accessToken: "T2" })).toEqual({ kind: "ignore" });
  });

  it("T → autre → T pendant l'appel : la session porte de nouveau T, le verdict s'applique", () => {
    // Seul compte le jeton de la session À LA RÉPONSE ; il est revenu à T : la révocation de T la concerne.
    expect(refreshAction("T", "T", REVOKED)).toEqual({ kind: "revoked" });
    expect(refreshAction("T", "T", PROFILE_ENDED)).toEqual({ kind: "endProfile" });
  });

  it("le reste, sur le jeton courant : rafraîchi, gardé, ou reconnecté", () => {
    expect(refreshAction("T", "T", { ok: true, accessToken: "T2" })).toEqual({ kind: "adopt", accessToken: "T2" });
    expect(refreshAction("T", "T", { ok: false, reason: "network" })).toEqual({ kind: "keep" });
    expect(refreshAction("T", "T", { ok: false, reason: "server" })).toEqual({ kind: "keep" });
    // Un 401 nu (non révoqué) ne ferme rien : une nouvelle connexion.
    expect(refreshAction("T", "T", { ok: false, reason: "expired" })).toEqual({ kind: "reauth" });
  });
});
