import type { TFunction } from "i18next";
import type { FamilyParentalOptionsDto, FamilyProfileDto, GuestParentalCeiling, GuestParentalControls } from "@tentacle-tv/shared";
import {
  currentCappedByCeiling,
  currentParentalAge,
  parentalAgeChoices,
  parentalAgeSlots,
  parentalLibrariesCount,
  parentalLibraryRows,
  parentalRatingNames,
  type ParentalAgeChoice,
  type ParentalAgeSlot,
  type ParentalLibraryOption,
} from "@tentacle-tv/tv-core";
import type { IconName } from "../../redesign/icons/Icon";
import type { ParentalAgeView, ParentalLibrariesView } from "../../redesign/screens/parental/ParentalView";

/**
 * Ce que montre le contrôle parental simplifié, tiré de l'état du serveur et de
 * ce qui part en ce moment (`draft`). Les décisions sont celles de tv-core
 * (`session/parentalAge`, `session/parentalLibraries`) ; ici, les mots.
 */

type Ratings = FamilyParentalOptionsDto["parentalRatings"];

/** Les noms d'une note de la table, trois au plus (« 12 / PG-13 / FSK-12 ») ; la note seule si la table ne la nomme pas. */
function ratingNames(ratings: Ratings, score: number, subScore: number | null): string {
  return parentalRatingNames(ratings, score, subScore).slice(0, 3).join(" / ") || String(score);
}

function optionLabel(slot: ParentalAgeSlot, t: TFunction): string {
  if (slot.kind === "custom") return t("parentalTv:age.custom");
  if (slot.kind === "none") return t("parentalTv:age.none");
  return slot.age === 0 ? t("parentalTv:age.allAges") : t("parentalTv:age.years", { age: slot.age });
}

/** L'âge : les paliers, le retenu, la phrase de ce qui passe, et le plafond s'il est plus strict. */
export function parentalAgeView(input: {
  controls: GuestParentalControls;
  ceiling: GuestParentalCeiling | null;
  ratings: Ratings;
  kind: FamilyProfileDto["kind"];
  creatorName: string | null;
  t: TFunction;
}): { view: ParentalAgeView; selectedKey: string; choices: ParentalAgeChoice[] } {
  const { controls, ceiling, ratings, t } = input;
  const choices = parentalAgeChoices(ratings);
  const current = currentParentalAge(choices, controls, ratings);
  // Un réglage fait ailleurs : montré à sa place dans l'échelle, jamais remplacé en silence.
  const options: ParentalAgeView["options"] = parentalAgeSlots(choices, current).map((slot) => ({
    key: slot.key,
    label: optionLabel(slot, t),
    detail: slot.kind === "custom" ? slot.names.slice(0, 2).join(" / ") || undefined : undefined,
    selected: current.key === slot.key,
  }));
  const selected = current.kind === "choice" ? choices.find((choice) => choice.key === current.key) : undefined;
  let summary: string;
  if (current.kind === "custom") {
    summary = current.names.length
      ? t("parentalTv:age.summaryCustom", { names: current.names.slice(0, 3).join(" / ") })
      : t("parentalTv:age.summaryCustomUnnamed");
  } else if (!selected || selected.kind === "none") summary = t("parentalTv:age.summaryNone");
  else summary = selected.age === 0 ? t("parentalTv:age.summaryAllAges") : t("parentalTv:age.summaryYears", { age: selected.age });

  let ceilingNote: string | null = null;
  if (currentCappedByCeiling(choices, current, ceiling) && ceiling?.maxParentalRating != null) {
    const names = ratingNames(ratings, ceiling.maxParentalRating, ceiling.maxParentalSubRating);
    ceilingNote =
      input.kind === "guest"
        ? input.creatorName
          ? t("parentalTv:age.ceilingGuestNamed", { creator: input.creatorName, names })
          : t("parentalTv:age.ceilingGuest", { names })
        : t("parentalTv:age.ceilingMember", { names });
  }
  return { view: { options, summary, ceilingNote }, selectedKey: current.key, choices };
}

/** Les bibliothèques : une case chacune, et le résumé (« Toutes », « 2 sur 4 »). */
export function parentalLibrariesView(input: {
  available: readonly ParentalLibraryOption[];
  allowed: readonly string[] | null;
  iconOf: (collectionType: string | null) => IconName;
  t: TFunction;
}): ParentalLibrariesView {
  const rows = parentalLibraryRows(input.available, input.allowed).map((row) => ({
    id: row.id,
    name: row.name,
    icon: input.iconOf(row.collectionType),
    checked: row.checked,
  }));
  const count = parentalLibrariesCount(input.available, input.allowed);
  const summary = !count ? "" : count.on === count.total ? input.t("parentalTv:libraries.all") : input.t("parentalTv:libraries.count", count);
  return { rows, summary };
}
