import { describe, it, expect } from "vitest";
import { signaturesSessions, type SessionJellyfin } from "./jellyfinWsSessions";

const lecture = (user: string, item: string, pause = false): SessionJellyfin => ({
  UserId: user,
  NowPlayingItem: { Id: item },
  PlayState: { IsPaused: pause },
});

describe("signaturesSessions", () => {
  it("ignore les sessions sans lecture", () => {
    const sig = signaturesSessions([{ UserId: "u1" }, { UserId: "u2", NowPlayingItem: null }]);
    expect(sig).toEqual({ lectures: "", etats: "" });
  });

  it("survit à une trame absente ou malformée", () => {
    expect(signaturesSessions(null)).toEqual({ lectures: "", etats: "" });
    expect(signaturesSessions(undefined)).toEqual({ lectures: "", etats: "" });
    expect(signaturesSessions({} as never)).toEqual({ lectures: "", etats: "" });
  });

  it("ne bouge pas quand seule la position avance", () => {
    const a = signaturesSessions([lecture("u1", "film-1")]);
    const b = signaturesSessions([lecture("u1", "film-1")]);
    expect(b).toEqual(a);
  });

  it("ne bouge pas quand Jellyfin renvoie les sessions dans un autre ordre", () => {
    const a = signaturesSessions([lecture("u1", "film-1"), lecture("u2", "film-2")]);
    const b = signaturesSessions([lecture("u2", "film-2"), lecture("u1", "film-1")]);
    expect(b).toEqual(a);
  });

  it("change quand quelqu'un commence une lecture", () => {
    const avant = signaturesSessions([lecture("u1", "film-1")]);
    const apres = signaturesSessions([lecture("u1", "film-1"), lecture("u2", "film-2")]);
    expect(apres.lectures).not.toBe(avant.lectures);
  });

  it("change quand quelqu'un passe à un autre épisode", () => {
    const avant = signaturesSessions([lecture("u1", "ep-1")]);
    const apres = signaturesSessions([lecture("u1", "ep-2")]);
    expect(apres.lectures).not.toBe(avant.lectures);
  });

  it("une pause borne un segment sans déranger les listes", () => {
    const avant = signaturesSessions([lecture("u1", "film-1")]);
    const apres = signaturesSessions([lecture("u1", "film-1", true)]);
    expect(apres.lectures).toBe(avant.lectures);
    expect(apres.etats).not.toBe(avant.etats);
  });

  it("deux personnes sur le même contenu comptent pour deux", () => {
    const sig = signaturesSessions([lecture("u1", "film-1"), lecture("u2", "film-1")]);
    expect(sig.lectures.split("|")).toHaveLength(2);
  });
});
