/**
 * Lecture prudente d'un JSON venu du serveur.
 *
 * Les DTO Jellyfin ne sont pas notre schéma : ils changent de version en
 * version, et un champ manquant ne doit jamais faire tomber un snapshot. Ces
 * trois fonctions rendent `null` plutôt que de lever, et elles tiennent la
 * règle « aucun `any` » sur toute la lecture des DTO.
 */

import { decodeUtf8 } from "./utf8";

/** Analyse des octets UTF-8, ou `null` si ce n'est pas du JSON. */
export function parseJson(bytes: Uint8Array): unknown {
  return parseJsonText(decodeUtf8(bytes));
}

/** Analyse un texte, ou `null` si ce n'est pas du JSON. */
export function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** L'objet, ou `null`. Un tableau n'en est pas un — c'est voulu. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Le tableau, ou `null`. */
export function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

/** L'entier, ou `null`. Les DTO rendent parfois un flottant là où on attend un entier. */
export function asInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;
}

/** La chaîne non vide, ou `null`. */
export function asString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** Champ d'un objet, en une étape. */
export function field(value: unknown, key: string): unknown {
  return asRecord(value)?.[key];
}
