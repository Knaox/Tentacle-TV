/**
 * Transposition des cinq `#[test]` de `session.rs` : c'est le TTL glissant et
 * la conservation de la policy qui décident si l'utilisateur reste utilisable
 * hors ligne — ni l'un ni l'autre ne se voit à l'écran avant trente jours.
 */

import { describe, expect, it } from "vitest";
import { openInMemory } from "./db";
import { clear, get, SESSION_TTL_MS, set } from "./session";

const USER = "u-123";

describe("cache de session", () => {
  it("ecriture puis relecture, encore fraiche", () => {
    const db = openInMemory();
    set(db, USER, '{"Name":"a"}', '{"p":1}', 1_000);

    const s = get(db, USER, 2_000);

    expect(s).not.toBeNull();
    expect(s?.profileJson).toBe('{"Name":"a"}');
    expect(s?.policyJson).toBe('{"p":1}');
    expect(s?.expiresAt).toBe(1_000 + SESSION_TTL_MS);
    expect(s?.expired).toBe(false);
  });

  it("expire au-dela du TTL, sans rien detruire", () => {
    const db = openInMemory();
    set(db, USER, "{}", null, 1_000);

    const s = get(db, USER, 1_000 + SESSION_TTL_MS + 1);

    expect(s).not.toBeNull();
    expect(s?.expired).toBe(true);
  });

  it("le TTL glisse a chaque ecriture", () => {
    const db = openInMemory();
    set(db, USER, "{}", null, 1_000);
    set(db, USER, "{}", null, 500_000);

    const s = get(db, USER, 500_001);

    expect(s?.expiresAt).toBe(500_000 + SESSION_TTL_MS);
    expect(s?.expired).toBe(false);
  });

  it("une ecriture sans policy conserve la policy connue", () => {
    // Profil et droits sont rafraichis par des chemins differents cote web :
    // ecrire l'un ne doit pas effacer l'autre.
    const db = openInMemory();
    set(db, USER, "{}", '{"droits":true}', 1_000);
    set(db, USER, '{"maj":1}', null, 2_000);

    const s = get(db, USER, 3_000);

    expect(s?.profileJson).toBe('{"maj":1}');
    expect(s?.policyJson).toBe('{"droits":true}');
  });

  it("clear supprime, et les utilisateurs restent cloisonnes", () => {
    const db = openInMemory();
    set(db, USER, "{}", null, 1_000);
    set(db, "autre", "{}", null, 1_000);

    clear(db, USER);

    expect(get(db, USER, 1_500)).toBeNull();
    expect(get(db, "autre", 1_500)).not.toBeNull();
  });

  it("sans entree, il n'y a rien a rendre", () => {
    expect(get(openInMemory(), USER, 1_000)).toBeNull();
  });
});
