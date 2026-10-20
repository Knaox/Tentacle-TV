import { describe, expect, it } from "vitest";
import { enterProfile, returnToAccount, type ActiveProfile, type KeyValueStore } from "@tentacle-tv/shared";
import { isProfileSessionIn, keepRightOf, offlineOwnerOf, offlineSessionFallback, offlineSurfaceOf } from "./offlineOwner";
import { lastKeepRight, rememberKeepRight } from "./keepRightMemory";

/**
 * Le hors ligne appartient au COMPTE DE L'APPAREIL (règle de Damien, 21/10) :
 * jamais au profil ouvert par « Qui regarde ? », membre ou invité ; plus de
 * connexion pendant un profil → retour au compte ; ses droits s'appliquent.
 */

const ACCOUNT = "account-1";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

function signedIn(): ReturnType<typeof memoryStore> {
  const store = memoryStore();
  store.setItem("tentacle_token", "account-token");
  store.setItem("tentacle_user", JSON.stringify({ Id: ACCOUNT, Name: "Compte" }));
  return store;
}

function profile(kind: ActiveProfile["kind"], id: string): ActiveProfile {
  return { id, name: kind === "guest" ? "Invité" : "Membre", kind, color: "violet", imageTag: null, hasPin: true };
}

function inProfile(kind: ActiveProfile["kind"], options: { escrowed?: boolean } = {}): ReturnType<typeof memoryStore> {
  const store = signedIn();
  const id = `${kind}-1`;
  enterProfile(store, { token: `${kind}-token`, user: { id, name: kind }, profile: profile(kind, id) }, options);
  return store;
}

const surface = { keepRight: "granted" as const, engineCanKeep: true, hasContent: true };

describe("offlineOwnerOf — le compte de l'appareil possède le hors ligne", () => {
  it("en session du compte : le compte et son jeton", () => {
    expect(offlineOwnerOf(signedIn())).toEqual({ userId: ACCOUNT, token: "account-token" });
  });

  it("pendant le profil d'un MEMBRE : toujours le compte, jamais le profil", () => {
    const store = inProfile("member");
    expect(isProfileSessionIn(store)).toBe(true);
    expect(offlineOwnerOf(store)).toEqual({ userId: ACCOUNT, token: "account-token" });
  });

  it("pendant le profil d'un INVITÉ : toujours le compte", () => {
    expect(offlineOwnerOf(inProfile("guest"))).toEqual({ userId: ACCOUNT, token: "account-token" });
  });

  it("le navigateur, dont le serveur tient le jeton : le compte, sans jeton", () => {
    expect(offlineOwnerOf(inProfile("member", { escrowed: true }))).toEqual({ userId: ACCOUNT, token: null });
  });

  it("personne de connecté : aucun propriétaire", () => {
    expect(offlineOwnerOf(memoryStore())).toBeNull();
  });
});

describe("offlineSurfaceOf — ce que l'interface montre", () => {
  it("le compte avec le droit : tout", () => {
    expect(offlineSurfaceOf({ profileSession: false, ...surface })).toEqual({ visible: true, canKeep: true });
  });

  it("une session de profil (membre ou invité) : rien, même avec le contenu du compte sur l'appareil", () => {
    expect(offlineSurfaceOf({ profileSession: true, ...surface })).toEqual({ visible: false, canKeep: false });
  });

  it("un compte sans le droit : rien, même avec des titres déjà gardés", () => {
    expect(offlineSurfaceOf({ profileSession: false, ...surface, keepRight: "refused" })).toEqual({ visible: false, canKeep: false });
  });

  it("droit jamais su (premier lancement hors ligne) : les titres déjà gardés restent lisibles, rien de nouveau", () => {
    expect(offlineSurfaceOf({ profileSession: false, ...surface, keepRight: "unknown" })).toEqual({ visible: true, canKeep: false });
    expect(offlineSurfaceOf({ profileSession: false, ...surface, keepRight: "unknown", hasContent: false }).visible).toBe(false);
  });

  it("serveur d'avant les droits : le comportement d'avant (les titres gardés avant la mise à jour restent)", () => {
    expect(offlineSurfaceOf({ profileSession: false, keepRight: "legacy", engineCanKeep: false, hasContent: true })).toEqual({ visible: true, canKeep: false });
    expect(offlineSurfaceOf({ profileSession: false, keepRight: "legacy", engineCanKeep: true, hasContent: false })).toEqual({ visible: true, canKeep: true });
  });

  it("le moteur ne sait pas garder : pas de « Garder hors ligne », le contenu reste", () => {
    expect(offlineSurfaceOf({ profileSession: false, ...surface, engineCanKeep: false })).toEqual({ visible: true, canKeep: false });
  });
});

describe("keepRightOf — le dernier mot fait foi hors ligne", () => {
  it("le serveur répond : sa réponse", () => {
    expect(keepRightOf({ kind: "known", abilities: { keepOffline: true } }, false)).toBe("granted");
    expect(keepRightOf({ kind: "known", abilities: { keepOffline: false } }, true)).toBe("refused");
  });

  it("hors ligne (requête en attente) : le dernier mot retenu, sinon inconnu", () => {
    expect(keepRightOf({ kind: "pending" }, false)).toBe("refused");
    expect(keepRightOf({ kind: "pending" }, true)).toBe("granted");
    expect(keepRightOf({ kind: "pending" }, null)).toBe("unknown");
  });

  it("serveur d'avant : legacy, quoi qu'on ait retenu", () => {
    expect(keepRightOf({ kind: "legacy" }, false)).toBe("legacy");
  });

  it("le mot retenu par compte, sans tirets ni casse, sans écriture pour rien", () => {
    const raw = rememberKeepRight(null, "AB-CD", false);
    expect(raw).not.toBeNull();
    expect(lastKeepRight(raw, "abcd")).toBe(false);
    expect(lastKeepRight(raw, "autre")).toBeNull();
    expect(rememberKeepRight(raw, "abcd", false)).toBeNull();
    expect(lastKeepRight(rememberKeepRight(raw, "abcd", true), "AB-CD")).toBe(true);
    expect(lastKeepRight("{illisible", "abcd")).toBeNull();
  });
});

describe("offlineSessionFallback — plus de connexion pendant un profil", () => {
  it("perte du réseau pendant le profil d'un membre ou d'un invité : retour au compte", () => {
    for (const kind of ["member", "guest"] as const) {
      const store = inProfile(kind);
      const fallback = offlineSessionFallback({
        profileSession: isProfileSessionIn(store),
        connectivity: "offline-auto",
        accountRestorable: offlineOwnerOf(store)?.token != null,
      });
      expect(fallback).toBe("returnToAccount");
      // Ce que l'adaptateur applique : le compte revient, sans profil ni réserve.
      expect(returnToAccount(store)).toBe(true);
      expect(isProfileSessionIn(store)).toBe(false);
      expect(offlineOwnerOf(store)).toEqual({ userId: ACCOUNT, token: "account-token" });
    }
  });

  it("retour du réseau : rien n'est rouvert au nom d'un profil", () => {
    const store = inProfile("member");
    returnToAccount(store);
    expect(offlineSessionFallback({ profileSession: isProfileSessionIn(store), connectivity: "online", accountRestorable: true })).toBe("none");
    expect(isProfileSessionIn(store)).toBe(false);
  });

  it("en ligne ou en vérification pendant un profil : rien", () => {
    expect(offlineSessionFallback({ profileSession: true, connectivity: "online", accountRestorable: true })).toBe("none");
    expect(offlineSessionFallback({ profileSession: true, connectivity: "checking", accountRestorable: true })).toBe("none");
  });

  it("le hors ligne manuel n'existe pas pour un profil", () => {
    expect(offlineSessionFallback({ profileSession: true, connectivity: "offline-manual", accountRestorable: true })).toBe("cancelManual");
  });

  it("le navigateur ne peut pas revenir sans le serveur : l'attente", () => {
    const store = inProfile("guest", { escrowed: true });
    expect(offlineSessionFallback({ profileSession: true, connectivity: "offline-auto", accountRestorable: offlineOwnerOf(store)?.token != null })).toBe("stranded");
  });

  it("la session du compte n'a rien à faire", () => {
    expect(offlineSessionFallback({ profileSession: false, connectivity: "offline-auto", accountRestorable: true })).toBe("none");
  });
});
