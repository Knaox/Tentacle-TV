/**
 * Les jetons que le SERVEUR signe (appareil jumelé, jumelage d'une TV aux
 * profils, « voir en tant que ») ne se fabriquent pas : signature d'un autre
 * secret, algorithme `none`, type échangé, usurpation expirée — tout est
 * refusé par la vérification, avant même la ligne de la base.
 */

import crypto from "crypto";
import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";

const SECRET = "secret-du-serveur-de-test";

vi.mock("../services/configStore", () => ({
  getConfigValue: (key: string) => (key === "jwt_secret" ? SECRET : undefined),
}));
vi.mock("../services/db", () => ({ hasPrisma: () => false, getPrisma: () => { throw new Error("pas de base"); } }));

import {
  signDeviceToken,
  signImpersonationToken,
  signTvPairingToken,
  verifyDeviceToken,
  verifyImpersonationToken,
  verifyTvPairingToken,
} from "../services/jwt";

const DEVICE = { userId: "u1", username: "alice", isAdmin: true, deviceId: "d1", type: "paired_device" };

/** Un JWT `alg: none` à la main : en-tête, charge, signature vide. */
function unsignedToken(payload: object): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none", typ: "JWT" })}.${part(payload)}.`;
}

describe("jetons du serveur : rien ne se fabrique", () => {
  it("un jeton d'appareil signé par un AUTRE secret est refusé", async () => {
    const forged = jwt.sign(DEVICE, "un-autre-secret");
    expect(await verifyDeviceToken(forged)).toBeNull();
  });

  it("un jeton d'appareil `alg: none` est refusé", async () => {
    expect(await verifyDeviceToken(unsignedToken(DEVICE))).toBeNull();
  });

  it("un jeton d'appareil à la signature retouchée est refusé", async () => {
    const genuine = await signDeviceToken({ userId: "u1", username: "alice", isAdmin: false, deviceId: "d1" });
    const [header, , signature] = genuine.split(".");
    const promoted = Buffer.from(JSON.stringify({ ...DEVICE, isAdmin: true })).toString("base64url");
    expect(await verifyDeviceToken(`${header}.${promoted}.${signature}`)).toBeNull();
  });

  it("un jeton signé par le serveur mais d'un autre TYPE n'ouvre pas la porte des appareils", async () => {
    const pairing = await signTvPairingToken({ pairingId: "p1", userId: "u1", username: "alice" });
    const impersonation = await signImpersonationToken({ userId: "u2", username: "bob", adminUserId: "u1", adminUsername: "alice" });
    expect(await verifyDeviceToken(pairing)).toBeNull();
    expect(await verifyDeviceToken(impersonation)).toBeNull();
    // Et l'inverse : un jeton d'appareil n'est ni un jumelage aux profils, ni une usurpation.
    const device = await signDeviceToken({ userId: "u1", username: "alice", isAdmin: true, deviceId: "d1" });
    expect(await verifyTvPairingToken(device)).toBeNull();
    expect(await verifyImpersonationToken(device)).toBeNull();
  });

  it("une usurpation EXPIRÉE est refusée (seule protection, sans ligne de révocation)", async () => {
    const expired = jwt.sign(
      { userId: "u2", username: "bob", isAdmin: false, adminUserId: "u1", adminUsername: "alice", type: "impersonation" },
      SECRET,
      { expiresIn: -10 },
    );
    expect(await verifyImpersonationToken(expired)).toBeNull();
  });

  it("une usurpation fabriquée avec un autre secret, ou sans signature, est refusée", async () => {
    const payload = { userId: "u2", username: "bob", isAdmin: false, adminUserId: "u1", adminUsername: "alice", type: "impersonation" };
    expect(await verifyImpersonationToken(jwt.sign(payload, crypto.randomBytes(32).toString("hex")))).toBeNull();
    expect(await verifyImpersonationToken(unsignedToken(payload))).toBeNull();
  });

  it("une usurpation signée par le serveur ne porte jamais l'administration", async () => {
    const token = await signImpersonationToken({ userId: "u2", username: "bob", adminUserId: "u1", adminUsername: "alice" });
    expect((await verifyImpersonationToken(token))?.isAdmin).toBe(false);
  });
});
