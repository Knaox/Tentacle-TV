import crypto from "crypto";
import { promisify } from "util";
import { getPrisma } from "../db";
import { afterPinFailure, isValidPin, pinGate, type PinAttemptState } from "../../family/familyRules";
import { FamilyFailure, iso } from "./familyErrors";
import { withFamilyLock } from "./familyLock";

/**
 * Le code PIN d'un profil (docs/FAMILLE.md) : quatre chiffres, haché par
 * scrypt avec un sel propre, JAMAIS rendu ni envoyé à une TV — le serveur seul
 * compare. Les essais ratés se comptent PAR PROFIL, toutes TV confondues
 * (`profile_pin_attempts`) — changer de TV ne remet rien à zéro : cinq, puis
 * un blocage croissant (`familyRules.afterPinFailure`) ; une réussite efface.
 *
 * Quatre chiffres ne résistent pas à une base volée (10 000 essais) : la
 * protection, c'est le blocage, que seul le serveur applique.
 */

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>;

const COST = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 32;

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(pin, salt, KEY_LENGTH, COST);
  return `scrypt$${COST.N}$${COST.r}$${COST.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPinHash(pin: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(pin, Buffer.from(salt, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: COST.maxmem,
  });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** Les profils de la liste qui ont un PIN. */
export async function profilesWithPin(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await getPrisma().profilePin.findMany({ where: { userId: { in: userIds } }, select: { userId: true } });
  return new Set(rows.map((row) => row.userId));
}

export async function hasPin(userId: string): Promise<boolean> {
  return (await profilesWithPin([userId])).has(userId);
}

/** Pose (ou retire, `null`) le PIN d'un profil. Couper ses sessions de TV
 *  revient à l'appelant (`familyProfiles.onPinChanged`). */
export async function writePin(userId: string, pin: string | null): Promise<void> {
  if (pin === null) {
    await getPrisma().profilePin.deleteMany({ where: { userId } });
    return;
  }
  if (!isValidPin(pin)) throw new FamilyFailure("family.pin_format", "Le PIN compte quatre chiffres");
  const pinHash = await hashPin(pin);
  await getPrisma().profilePin.upsert({ where: { userId }, create: { userId, pinHash }, update: { pinHash } });
}

function toState(row: { failures: number; lockCount: number; lockedUntil: Date | null } | null): PinAttemptState | null {
  return row ? { failures: row.failures, lockCount: row.lockCount, lockedUntil: row.lockedUntil?.getTime() ?? null } : null;
}

/** Les blocages en cours parmi ces profils. */
export async function lockedProfiles(userIds: string[], now: number): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const rows = await getPrisma().profilePinAttempt.findMany({ where: { userId: { in: userIds } } });
  const locked = new Map<string, number>();
  for (const row of rows) {
    const gate = pinGate(toState(row), now);
    if (gate.locked) locked.set(row.userId, gate.until);
  }
  return locked;
}

interface PinCheck {
  /** Le jumelage de la TV ; null : une session personnelle. Pour le journal. */
  pairingId: string | null;
  userId: string;
  pin: string | undefined;
  now: number;
}

/**
 * Le PIN présenté pour un profil — sur une TV, ou pour changer le sien. Sans
 * PIN posé : rien à vérifier. Lève `pin_locked`, `pin_required`, `pin_format`
 * ou `pin_invalid` ; une réussite efface les essais ratés.
 *
 * UN ESSAI À LA FOIS PAR PROFIL, toutes TV confondues : lire le compteur,
 * comparer (scrypt, lent) puis l'écrire se font sous le verrou du profil.
 * Sans lui, des essais simultanés lisaient le même compteur et passaient
 * tous — bien plus de cinq avant que le blocage ne s'installe.
 */
export function checkProfilePin(input: PinCheck): Promise<void> {
  return withFamilyLock(`pin:${input.userId}`, () => checkNow(input));
}

/**
 * Change (ou retire, `null`) son propre PIN : le nouveau doit être bien formé
 * AVANT tout essai — une faute de frappe ne coûte pas un essai —, puis le PIN
 * actuel est vérifié comme à l'ouverture d'un profil (même compteur, même
 * blocage), et le nouveau écrit sous le MÊME verrou : rien ne s'intercale.
 */
export async function changeOwnPin(input: PinCheck & { next: string | null }): Promise<void> {
  if (input.next !== null && !isValidPin(input.next)) throw new FamilyFailure("family.pin_format", "Le PIN compte quatre chiffres");
  await withFamilyLock(`pin:${input.userId}`, async () => {
    await checkNow(input);
    await writePin(input.userId, input.next);
  });
}

async function checkNow(input: PinCheck): Promise<void> {
  const prisma = getPrisma();
  const stored = await prisma.profilePin.findUnique({ where: { userId: input.userId } });
  if (!stored) return;
  const key = { userId: input.userId };
  const attempts = toState(await prisma.profilePinAttempt.findUnique({ where: key }));
  const gate = pinGate(attempts, input.now);
  if (gate.locked) {
    throw new FamilyFailure("family.pin_locked", "Profil bloqué sur cette TV", { lockedUntil: iso(gate.until) });
  }
  if (input.pin === undefined || input.pin === "") throw new FamilyFailure("family.pin_required", "PIN requis");
  if (!isValidPin(input.pin)) throw new FamilyFailure("family.pin_format", "Le PIN compte quatre chiffres");

  if (await verifyPinHash(input.pin, stored.pinHash)) {
    await prisma.profilePinAttempt.deleteMany({ where: key });
    return;
  }
  const next = afterPinFailure(attempts, input.now);
  const data = {
    failures: next.state.failures,
    lockCount: next.state.lockCount,
    lockedUntil: next.state.lockedUntil === null ? null : new Date(next.state.lockedUntil),
  };
  await prisma.profilePinAttempt.upsert({ where: key, create: { userId: input.userId, ...data }, update: data });
  const where = input.pairingId ? `sur le jumelage ${input.pairingId}` : "en session personnelle";
  console.log(`[family] PIN refusé ${where} (${next.lockedUntil ? "bloqué" : `${next.attemptsLeft} essai(s) restant(s)`})`);
  if (next.lockedUntil !== null) {
    throw new FamilyFailure("family.pin_locked", "Trop d'essais : profil bloqué sur cette TV", { lockedUntil: iso(next.lockedUntil) });
  }
  throw new FamilyFailure("family.pin_invalid", "PIN incorrect", { attemptsLeft: next.attemptsLeft });
}
