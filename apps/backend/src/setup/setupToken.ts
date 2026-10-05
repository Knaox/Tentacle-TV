import { randomInt, timingSafeEqual } from "crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { resolve } from "path";
import { DATA_ROOT } from "../services/dataDir";
import { SETUP_TOKEN_LENGTH } from "./setupWizardContract";

/**
 * Le code d'installation : qui le lit dans les journaux du serveur (ou dans
 * le fichier du volume de données) a accès à la machine — c'est lui, et lui
 * seul, qui peut ouvrir l'assistant. Sans lui, personne sur le réseau ne
 * revendique le serveur avant son propriétaire.
 *
 * 12 caractères base32 de Crockford (60 bits), affichés `XXXX-XXXX-XXXX` :
 * lisibles, dictables, sans I, L, O ni U. La saisie tolère casse, tirets et
 * espaces, et lit O pour 0, I et L pour 1.
 *
 * À usage unique : il s'échange une fois contre une session d'assistant, puis
 * le fichier disparaît. Un redémarrage (installation pas finie) ou la commande
 * `tentacle setup token` en donne un neuf.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ALIASES: Record<string, string> = { O: "0", I: "1", L: "1" };

export const SETUP_TOKEN_FILE = resolve(DATA_ROOT, "setup-token.txt");

export function generateSetupToken(pick: (max: number) => number = randomInt): string {
  let out = "";
  for (let i = 0; i < SETUP_TOKEN_LENGTH; i++) out += ALPHABET[pick(ALPHABET.length)];
  return out;
}

export function formatSetupToken(token: string): string {
  return token.match(/.{1,4}/g)?.join("-") ?? token;
}

/** La forme canonique d'une saisie, ou `null` si elle ne peut pas être un code. */
export function normalizeSetupToken(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const compact = input.toUpperCase().replace(/[\s-]/g, "");
  if (compact.length !== SETUP_TOKEN_LENGTH) return null;
  let out = "";
  for (const ch of compact) {
    const mapped = ALIASES[ch] ?? ch;
    if (!ALPHABET.includes(mapped)) return null;
    out += mapped;
  }
  return out;
}

/** Comparaison en temps constant de deux codes déjà canoniques. */
export function setupTokensMatch(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Le code en vigueur, lu dans son fichier ; `null` s'il n'y en a pas (déjà utilisé, ou installation finie). */
export function readSetupToken(file = SETUP_TOKEN_FILE): string | null {
  if (!existsSync(file)) return null;
  try {
    return normalizeSetupToken(readFileSync(file, "utf-8").trim());
  } catch {
    return null;
  }
}

/** Écrit un code neuf, lisible par le seul utilisateur du serveur, et le rend. */
export function writeNewSetupToken(file = SETUP_TOKEN_FILE): string {
  const token = generateSetupToken();
  writeFileSync(file, `${formatSetupToken(token)}\n`, { mode: 0o600 });
  return token;
}

/** Le code a servi, ou l'installation est finie : plus de fichier. */
export function discardSetupToken(file = SETUP_TOKEN_FILE): void {
  try {
    unlinkSync(file);
  } catch {
    /* déjà parti */
  }
}

/** Le bandeau des journaux : le code, et le lien qui le pré-remplit (fragment, jamais envoyé au serveur). */
export function setupTokenBanner(token: string, port: string | number): string[] {
  const code = formatSetupToken(token);
  return [
    "══════════════════════════════════════════════════════════════",
    `  Tentacle — setup code / code d'installation : ${code}`,
    `  http://<this-server>:${port}/setup#code=${code}`,
    "  (single use · usage unique — new code: `tentacle setup token`)",
    "══════════════════════════════════════════════════════════════",
  ];
}
