import type { TFunction } from "i18next";
import type { GroupLabel } from "@tentacle-tv/tv-core";
import { ratingLabel } from "../library/libraryFilterModel";

/** Le titre d'une rangée (tv-core `groups/`), en mots : « Drame », « Années 2010 », « A – C », « De 7 à 8 », « Animés ». */
export function groupTitle(t: TFunction, label: GroupLabel): string {
  switch (label.kind) {
    case "genre":
      return label.name;
    case "otherGenres":
      return t("library:groupOtherGenres");
    case "decade":
      return t("library:groupDecade", { decade: label.decade });
    case "before":
      return t("library:groupBefore", { year: label.year });
    case "letters":
      return `${label.from} – ${label.to}`;
    case "digits":
      return "0 – 9";
    case "ratingAtLeast":
      return t("library:groupRatingAtLeast", { min: ratingLabel(label.min) });
    case "ratingBetween":
      return t("library:groupRatingBetween", { min: ratingLabel(label.min), max: ratingLabel(label.max) });
    case "ratingBelow":
      return t("library:groupRatingBelow", { max: ratingLabel(label.max) });
    case "noRating":
      return t("library:groupNoRating");
    case "type":
      return t(`library:groupType_${label.type}`);
  }
}
