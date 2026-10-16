import { describe, expect, it } from "vitest";
import { AVATAR_INVITE_SEEN_KEY } from "@tentacle-tv/shared";
import {
  AVATAR_OFFER_MAX_WAIT_MS,
  decideAvatarOffer,
  isAvatarOfferPending,
  markAvatarOffered,
  offerGuestPhotoAtCreation,
  readAvatarOffered,
  settleAvatarOffer,
  type AvatarOfferInput,
} from "./avatarOffer";

/** Un profil sans photo, en ligne, face à un serveur qui sait : la galerie est proposée. */
const DUE: AvatarOfferInput = { identity: "lea", capable: true, online: true, hasPhoto: false, offered: [] };

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    raw: (key: string) => items.get(key),
  };
}

describe("faut-il proposer la photo ?", () => {
  it("à un profil sans photo, en ligne, face à un serveur qui le permet", () => {
    expect(decideAvatarOffer(DUE)).toBe("show");
  });

  it("une fois par profil et par appareil : déjà proposée, plus jamais", () => {
    expect(decideAvatarOffer({ ...DUE, offered: ["lea"] })).toBe("skip");
    expect(decideAvatarOffer({ ...DUE, offered: ["tom"] })).toBe("show");
  });

  it("jamais à qui a déjà une photo", () => {
    expect(decideAvatarOffer({ ...DUE, hasPhoto: true })).toBe("skip");
  });

  it("jamais hors ligne, ni sans session", () => {
    expect(decideAvatarOffer({ ...DUE, online: false })).toBe("skip");
    expect(decideAvatarOffer({ ...DUE, identity: null })).toBe("skip");
  });

  it("face à un serveur qui ne déclare pas la fonction : rien, sans erreur", () => {
    expect(decideAvatarOffer({ ...DUE, capable: false })).toBe("skip");
  });

  it("une photo illisible ne fait rien proposer (le prochain lancement redemandera)", () => {
    expect(decideAvatarOffer({ ...DUE, hasPhoto: "failed" })).toBe("skip");
  });

  it("attend ce qu'on ne sait pas encore, jamais au-delà de la borne", () => {
    expect(decideAvatarOffer({ ...DUE, hasPhoto: null })).toBe("wait");
    expect(decideAvatarOffer({ ...DUE, capable: null })).toBe("wait");
    expect(decideAvatarOffer({ ...DUE, hasPhoto: null, waitedMs: AVATAR_OFFER_MAX_WAIT_MS - 1 })).toBe("wait");
    expect(decideAvatarOffer({ ...DUE, hasPhoto: null, waitedMs: AVATAR_OFFER_MAX_WAIT_MS })).toBe("skip");
  });

  it("ce qui est su l'emporte sur l'attente : une photo connue ne fait pas attendre la capacité", () => {
    expect(decideAvatarOffer({ ...DUE, capable: null, hasPhoto: true })).toBe("skip");
    expect(decideAvatarOffer({ ...DUE, capable: false, hasPhoto: null })).toBe("skip");
  });
});

describe("à la création d'un invité", () => {
  it("la galerie s'ouvre s'il n'a que la photo par défaut, face à un serveur qui le permet", () => {
    expect(offerGuestPhotoAtCreation({ imageTag: null }, true)).toBe(true);
    expect(offerGuestPhotoAtCreation({ imageTag: "" }, true)).toBe(true);
  });

  it("rien s'il a déjà une photo, si la création a échoué, ou face à un serveur d'avant", () => {
    expect(offerGuestPhotoAtCreation({ imageTag: "abc" }, true)).toBe(false);
    expect(offerGuestPhotoAtCreation(null, true)).toBe(false);
    expect(offerGuestPhotoAtCreation({ imageTag: null }, false)).toBe(false);
  });
});

describe("la décision tenue pour une identité", () => {
  it("tranchée, elle ne bouge plus : la photo lue en retard ne fait pas surgir la galerie", () => {
    const skipped = settleAvatarOffer(null, { ...DUE, hasPhoto: true });
    expect(settleAvatarOffer(skipped, DUE).status).toBe("skip");
  });

  it("l'attente se tranche dès qu'on sait", () => {
    const waiting = settleAvatarOffer(null, { ...DUE, hasPhoto: null });
    expect(waiting.status).toBe("wait");
    expect(settleAvatarOffer(waiting, DUE).status).toBe("show");
  });

  it("affichée, elle se ferme quand la proposition est marquée faite", () => {
    const shown = settleAvatarOffer(null, DUE);
    expect(settleAvatarOffer(shown, { ...DUE, hasPhoto: true }).status).toBe("show");
    expect(settleAvatarOffer(shown, { ...DUE, offered: ["lea"] }).status).toBe("skip");
  });

  it("un autre profil recommence tout", () => {
    const skipped = settleAvatarOffer(null, { ...DUE, offered: ["lea"] });
    expect(settleAvatarOffer(skipped, { ...DUE, identity: "tom", offered: ["lea"] })).toEqual({ identity: "tom", status: "show" });
  });
});

describe("la proposition à venir, lue sans attendre", () => {
  it("tant qu'elle n'a pas été faite à cette identité", () => {
    expect(isAvatarOfferPending("lea", [])).toBe(true);
    expect(isAvatarOfferPending("lea", ["lea"])).toBe(false);
    expect(isAvatarOfferPending(null, [])).toBe(false);
  });
});

describe("le souvenir de l'appareil", () => {
  it("partage la clé du bureau et du mobile, le plus récent en tête, sans doublon", () => {
    const storage = memoryStorage({ [AVATAR_INVITE_SEEN_KEY]: JSON.stringify(["tom"]) });
    markAvatarOffered(storage, "lea");
    markAvatarOffered(storage, "tom");
    expect(readAvatarOffered(storage)).toEqual(["tom", "lea"]);
  });

  it("une valeur abîmée vaut « personne »", () => {
    expect(readAvatarOffered(memoryStorage({ [AVATAR_INVITE_SEEN_KEY]: "{oups" }))).toEqual([]);
    expect(readAvatarOffered(memoryStorage())).toEqual([]);
  });
});
