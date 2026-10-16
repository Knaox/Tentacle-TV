import { describe, expect, it } from "vitest";
import {
  PIN_SETUP_STORAGE_KEY,
  isPinSetupPending,
  markPinSetupOffered,
  pinSetupEligible,
  pinSetupEntry,
  pinSetupReason,
  pinSetupSubjectOf,
  readPinSetupOffered,
  type PinSetupSubject,
} from "./pinSetup";
import type { TvProfileRecord } from "./tvProfileSession";
import type { SessionStorage } from "./unpairJournal";

function memory(initial: Record<string, string> = {}): SessionStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

/** Un profil neuf du propriétaire, sans code, face à un serveur 1.30.0. */
const FRESH_OWNER: PinSetupSubject = { kind: "owner", hasPin: false, launch: "picked", manageNeedsPin: true };

describe("l'étape « Code PIN conseillé » — pour qui", () => {
  it("un profil neuf sans code (propriétaire ou membre) : proposée", () => {
    expect(pinSetupEligible(FRESH_OWNER)).toBe(true);
    expect(pinSetupEligible({ ...FRESH_OWNER, kind: "member" })).toBe(true);
    expect(pinSetupEligible({ ...FRESH_OWNER, launch: "sticky" })).toBe(true);
  });

  it("un profil déjà réglé (il a son code) : jamais", () => {
    expect(pinSetupEligible({ ...FRESH_OWNER, hasPin: true, manageNeedsPin: false })).toBe(false);
  });

  it("un invité : jamais — il garde le code de son propriétaire", () => {
    expect(pinSetupEligible({ ...FRESH_OWNER, kind: "guest", manageNeedsPin: false })).toBe(false);
    expect(pinSetupEligible({ ...FRESH_OWNER, kind: "guest" })).toBe(false);
  });

  it("un membre simple ou mineur, sans code ni droit de gestion : proposée (protéger son profil)", () => {
    const simple: PinSetupSubject = { kind: "member", hasPin: false, launch: "picked", manageNeedsPin: false };
    expect(pinSetupEligible(simple)).toBe(true);
    expect(pinSetupReason(simple)).toBe("protect");
    expect(pinSetupEligible({ ...simple, manageNeedsPin: undefined })).toBe(true);
  });

  it("le compte de démonstration : jamais — il est toujours ouvert d'office, seul, sans code", () => {
    expect(pinSetupEligible({ kind: "owner", hasPin: false, launch: "solo", manageNeedsPin: false })).toBe(false);
  });

  it("le compte seul ouvert d'office (aucune famille) : jamais", () => {
    expect(pinSetupEligible({ ...FRESH_OWNER, launch: "solo" })).toBe(false);
  });

  it("un serveur d'avant la 1.30.0 (sans `manageNeedsPin`) : proposée, texte « protéger » seul", () => {
    expect(pinSetupEligible({ kind: "member", hasPin: false, launch: "picked" })).toBe(true);
    expect(pinSetupReason({})).toBe("protect");
  });

  it("aucun profil ouvert : rien", () => {
    expect(pinSetupEligible(null)).toBe(false);
  });
});

describe("le texte : conseillé, et pourquoi", () => {
  it("un profil qui gérerait avec un code apprend qu'il gérera la famille depuis la TV", () => {
    expect(pinSetupReason(FRESH_OWNER)).toBe("protectAndManage");
    expect(pinSetupReason({ manageNeedsPin: false })).toBe("protect");
    expect(pinSetupReason({})).toBe("protect");
  });
});

describe("une fois par profil et par appareil", () => {
  it("« Plus tard » la marque pour ce profil seulement", () => {
    const storage = memory();
    expect(readPinSetupOffered(storage, "lea")).toBe(false);
    markPinSetupOffered(storage, "lea", 1_000);
    expect(readPinSetupOffered(storage, "lea")).toBe(true);
    expect(readPinSetupOffered(storage, "tom")).toBe(false);
    markPinSetupOffered(storage, "tom", 2_000);
    expect(JSON.parse(storage.data[PIN_SETUP_STORAGE_KEY])).toEqual({ lea: 1_000, tom: 2_000 });
  });

  it("une valeur abîmée vaut « jamais proposée », et se répare à la marque suivante", () => {
    const storage = memory({ [PIN_SETUP_STORAGE_KEY]: "{oops" });
    expect(readPinSetupOffered(storage, "lea")).toBe(false);
    markPinSetupOffered(storage, "lea", 5);
    expect(readPinSetupOffered(storage, "lea")).toBe(true);
    expect(readPinSetupOffered(memory({ [PIN_SETUP_STORAGE_KEY]: "[\"lea\"]" }), "lea")).toBe(false);
  });

  it("déjà proposée : plus en attente", () => {
    expect(isPinSetupPending({ subject: FRESH_OWNER, offered: false })).toBe(true);
    expect(isPinSetupPending({ subject: FRESH_OWNER, offered: true })).toBe(false);
    expect(isPinSetupPending({ subject: null, offered: false })).toBe(false);
  });
});

describe("à l'arrivée sur l'étape", () => {
  it("hors ligne : passée, sans rien marquer (elle reviendra)", () => {
    expect(pinSetupEntry({ pending: true, online: false })).toBe("skip");
    expect(pinSetupEntry({ pending: true, online: true })).toBe("show");
    expect(pinSetupEntry({ pending: false, online: true })).toBe("skip");
  });
});

describe("le profil retenu de la TV", () => {
  const RECORD: TvProfileRecord = {
    profileId: "damien", name: "Damien", kind: "owner", color: "violet", imageTag: null, hasPin: false, launch: "picked",
    ownerId: "damien", ownerName: "Damien", canManage: false, manages: false, manageNeedsPin: true,
  };

  it("un profil ouvert d'un serveur 1.30.0, sans code : l'étape et sa raison", () => {
    expect(pinSetupEligible(pinSetupSubjectOf(RECORD))).toBe(true);
    expect(pinSetupReason(pinSetupSubjectOf(RECORD))).toBe("protectAndManage");
  });

  it("un enregistrement d'avant (ni `manages` ni `manageNeedsPin`) : proposée, texte « protéger »", () => {
    const { manages: _m, manageNeedsPin: _n, ...before } = RECORD;
    expect(pinSetupEligible(pinSetupSubjectOf(before))).toBe(true);
    expect(pinSetupReason(pinSetupSubjectOf(before))).toBe("protect");
    expect(pinSetupEligible(pinSetupSubjectOf({ ...before, launch: "solo" }))).toBe(false);
  });
});
