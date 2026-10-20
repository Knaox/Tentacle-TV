import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useFamilyParentalOptions, useSetFamilyGuestParental, useSetFamilyMemberParental } from "@tentacle-tv/api-client";
import {
  GUEST_PARENTAL_NONE, currentCappedByCeiling, currentParentalAge, parentalAgeChoices, parentalAgeSlots, parentalRatingNames, withParentalAge,
  type FamilyProfileDto, type ParentalAgeChoice, type ParentalAgeSlot,
} from "@tentacle-tv/shared";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { useFamilyText } from "@/family/useFamilyText";
import { showToast } from "@/notices/toastStore";

/**
 * L'âge maximal d'un profil en paliers (« Tout public », « 6 ans »… « Sans
 * limite ») — la règle de la TV, partagée (`familyParentalAge`) : seule la note
 * change, ce qui est réglé au bureau (non classés, étiquettes, horaires) repart
 * tel quel ; une note posée ailleurs hors palier se montre « Réglé ailleurs »,
 * jamais remplacée en silence. Le plafond plus strict (créateur, administrateur)
 * se dit sous la liste. Invité : `setGuestParental` ; membre mineur : `setMemberParental`.
 */
export function AgeSection({ profile }: { profile: FamilyProfileDto }) {
  const { t } = useTranslation(["parentalTv", "familyWeb"]);
  const { errorText } = useFamilyText();
  const options = useFamilyParentalOptions();
  const guestParental = useSetFamilyGuestParental();
  const memberParental = useSetFamilyMemberParental();
  const ratings = options.data?.parentalRatings;
  const controls = profile.parental ?? GUEST_PARENTAL_NONE;
  const choices = useMemo(() => (ratings ? parentalAgeChoices(ratings) : []), [ratings]);
  const current = useMemo(() => (ratings ? currentParentalAge(choices, controls, ratings) : null), [ratings, choices, controls]);
  if (!ratings || !current) return null;
  const slots = parentalAgeSlots(choices, current);
  const ceiling = profile.parentalCeiling ?? null;
  const capped = currentCappedByCeiling(choices, current, ceiling);
  const ceilingNames = capped && ceiling?.maxParentalRating != null
    ? parentalRatingNames(ratings, ceiling.maxParentalRating, ceiling.maxParentalSubRating).join(", ")
    : "";
  const pending = guestParental.isPending || memberParental.isPending;

  const choose = (choice: ParentalAgeChoice) => {
    const input = { userId: profile.userId, parental: withParentalAge(controls, choice) };
    const done = { onSuccess: () => showToast({ title: t("parentalTv:saved"), tone: "success" as const }), onError: (e: unknown) => showToast({ title: errorText(e) }) };
    if (profile.kind === "guest") guestParental.mutate(input, done);
    else memberParental.mutate(input, done);
  };
  const label = (slot: ParentalAgeSlot) => {
    if (slot.kind === "custom") return `${t("parentalTv:age.custom")}${slot.names.length ? ` · ${slot.names.join(", ")}` : ""}`;
    if (slot.kind === "none") return t("parentalTv:age.none");
    return slot.age === 0 ? t("parentalTv:age.allAges") : t("parentalTv:age.years", { age: slot.age });
  };

  return (
    <SettingsSection
      title={t("parentalTv:age.title")}
      caption={capped ? t(profile.kind === "guest" ? "parentalTv:age.ceilingGuest" : "parentalTv:age.ceilingMember", { names: ceilingNames }) : undefined}
    >
      {slots.map((slot, index) => (
        <SettingsRow
          key={slot.key}
          label={label(slot)}
          checked={slot.key === current.key}
          disabled={pending || slot.kind === "custom"}
          last={index === slots.length - 1}
          onPress={slot.kind === "custom" || slot.key === current.key ? undefined : () => choose(slot)}
        />
      ))}
    </SettingsSection>
  );
}
