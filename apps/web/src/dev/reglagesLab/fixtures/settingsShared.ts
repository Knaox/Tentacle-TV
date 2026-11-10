/** Deux outils des données factices des réglages : lire un corps inconnu, typer une réponse calculée. */

import type { LabHandler } from "../labFetch";

export type Json = Record<string, unknown>;

/** Un corps (ou une réponse) lu comme un objet ; tout le reste vaut un objet vide. */
export const record = (value: unknown): Json => (typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : {});

/** La requête reçue par une réponse CALCULÉE (`reply` est `unknown` : ses paramètres ne se déduisent pas). */
export type LabRequest = Parameters<LabHandler>[0];
