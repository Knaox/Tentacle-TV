/**
 * L'âge maximal du contrôle parental simplifié : la règle vit dans shared
 * (`family/familyParentalAge.ts`), partagée avec le mobile — ré-exportée ici
 * pour que la TV garde ses imports.
 */
export {
  PARENTAL_AGE_TIERS, PARENTAL_AGE_NONE_KEY, PARENTAL_AGE_CUSTOM_KEY, parentalAgeKey, parentalAgeChoices,
  parentalRatingNames, currentParentalAge, withParentalAge, cappedByCeiling, parentalAgeSlots, currentCappedByCeiling,
  type ParentalAgeChoice, type ParentalAgeCurrent, type ParentalAgeSlot,
} from "@tentacle-tv/shared";
