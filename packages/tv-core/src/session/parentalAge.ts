import type { FamilyParentalOptionsDto, GuestParentalControls } from "@tentacle-tv/shared";

/**
 * L'ÂGE MAXIMAL du contrôle parental simplifié de la TV (Apple TV, Android TV)
 * — module pur. La TV ne montre pas l'échelle de Jellyfin (des dizaines de
 * noms par pays) : quelques PALIERS lisibles, « Tout public », « 6 ans »…
 * « Sans limite ». Derrière, c'est toujours un score de la table de Jellyfin
 * (`parentalOptions`) que le serveur écrit dans la politique du profil : le
 * client n'est qu'un affichage simplifié.
 *
 * Un palier d'âge A vaut le PLUS GRAND score de la table qui ne dépasse pas A
 * (les scores de Jellyfin 10.11 sont des âges : FR « 12 » = 12, US PG-13 = 13).
 * Deux paliers qui tombent sur le même score n'en font qu'un, le plus jeune
 * gardé : il dit ce qui passe vraiment. Un réglage fait ailleurs (bureau, web,
 * administration) qui ne tombe sur aucun palier se montre TEL QUEL
 * (`custom`) — jamais remplacé en silence.
 */

/** Les âges des paliers, du plus strict au plus large (0 : « Tout public »). */
export const PARENTAL_AGE_TIERS = [0, 6, 10, 12, 16] as const;

export type ParentalAgeChoice =
  | { kind: "age"; key: string; age: number; score: number }
  | { kind: "none"; key: "none" };

/** Ce que le profil a aujourd'hui : un palier, ou un réglage fait ailleurs. */
export type ParentalAgeCurrent =
  | { kind: "choice"; key: string }
  | { kind: "custom"; key: "custom"; score: number; subScore: number | null; names: string[] };

export const PARENTAL_AGE_NONE_KEY = "none";
export const PARENTAL_AGE_CUSTOM_KEY = "custom";

export function parentalAgeKey(age: number): string {
  return `age:${age}`;
}

type Ratings = FamilyParentalOptionsDto["parentalRatings"];

/** Les paliers que la table de Jellyfin permet, puis « Sans limite ». Table vide : « Sans limite » seul. */
export function parentalAgeChoices(ratings: Ratings): ParentalAgeChoice[] {
  const scores = [...new Set(ratings.map((rating) => rating.score))].sort((a, b) => a - b);
  const choices: ParentalAgeChoice[] = [];
  for (const age of PARENTAL_AGE_TIERS) {
    const score = scores.filter((value) => value <= age).pop();
    if (score === undefined || choices.some((choice) => choice.kind === "age" && choice.score === score)) continue;
    choices.push({ kind: "age", key: parentalAgeKey(age), age, score });
  }
  return [...choices, { kind: "none", key: PARENTAL_AGE_NONE_KEY }];
}

/** Le palier qui correspond à la note posée ; sinon le réglage tel quel, avec ses noms dans la table. */
export function currentParentalAge(choices: readonly ParentalAgeChoice[], controls: GuestParentalControls, ratings: Ratings): ParentalAgeCurrent {
  const score = controls.maxParentalRating;
  if (score === null) return { kind: "choice", key: PARENTAL_AGE_NONE_KEY };
  const subScore = controls.maxParentalSubRating;
  const match = subScore === null ? choices.find((choice) => choice.kind === "age" && choice.score === score) : undefined;
  if (match) return { kind: "choice", key: match.key };
  const names = ratings.filter((rating) => rating.score === score && (rating.subScore ?? null) === subScore).map((rating) => rating.name);
  return { kind: "custom", key: PARENTAL_AGE_CUSTOM_KEY, score, subScore, names: [...new Set(names)] };
}

/**
 * Le contrôle ENTIER à envoyer pour ce palier : seule la note change (sans
 * sous-note) ; types non classés, étiquettes et plages réglés ailleurs
 * repartent tels quels — la TV ne les montre pas, elle ne les efface pas.
 */
export function withParentalAge(controls: GuestParentalControls, choice: ParentalAgeChoice): GuestParentalControls {
  return {
    ...controls,
    maxParentalRating: choice.kind === "age" ? choice.score : null,
    maxParentalSubRating: null,
  };
}

/**
 * Le plafond (le créateur d'un invité, la base d'un membre) est-il plus strict
 * que ce palier ? Alors Jellyfin appliquera le plafond : la vue le dit, sans
 * interdire le choix (le serveur prend toujours le plus strict des deux).
 */
export function cappedByCeiling(choice: ParentalAgeChoice, ceiling: { maxParentalRating: number | null } | null): boolean {
  if (!ceiling || ceiling.maxParentalRating === null) return false;
  return choice.kind === "none" || choice.score > ceiling.maxParentalRating;
}

export type ParentalAgeSlot = ParentalAgeChoice | Extract<ParentalAgeCurrent, { kind: "custom" }>;

/** L'ordre des pastilles : les paliers, et un réglage fait ailleurs à SA place dans l'échelle (avant le premier palier plus large). */
export function parentalAgeSlots(choices: readonly ParentalAgeChoice[], current: ParentalAgeCurrent): ParentalAgeSlot[] {
  if (current.kind !== "custom") return [...choices];
  const at = choices.findIndex((choice) => choice.kind === "none" || choice.score > current.score);
  const slots: ParentalAgeSlot[] = [...choices];
  slots.splice(at < 0 ? slots.length : at, 0, current);
  return slots;
}

/** Ce qui est retenu (palier ou réglage fait ailleurs) dépasse-t-il le plafond ? Alors Jellyfin appliquera le plafond. */
export function currentCappedByCeiling(
  choices: readonly ParentalAgeChoice[],
  current: ParentalAgeCurrent,
  ceiling: { maxParentalRating: number | null } | null,
): boolean {
  if (current.kind === "custom") return ceiling?.maxParentalRating != null && current.score > ceiling.maxParentalRating;
  const choice = choices.find((candidate) => candidate.key === current.key);
  return choice ? cappedByCeiling(choice, ceiling) : false;
}
