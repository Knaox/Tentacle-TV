import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { useFamilyParentalOptions, useSetFamilyGuestParental, useSetFamilyMemberParental } from "@tentacle-tv/api-client";
import {
  GUEST_PARENTAL_NONE, currentCappedByCeiling, currentParentalAge, parentalAgeChoices, parentalAgeSlots, parentalRatingNames, withParentalAge,
  type FamilyProfileDto, type ParentalAgeChoice, type ParentalAgeSlot,
} from "@tentacle-tv/shared";
import { useToast } from "../../../contexts/ToastContext";
import { useFamilyText } from "../../useFamilyText";

/**
 * L'âge maximal d'un profil en paliers, dans la fenêtre étroite — `AgeSection`
 * du mobile, règle partagée (`familyParentalAge`) : seule la note change, ce
 * qui est réglé au bureau (non classés, étiquettes, horaires) repart tel quel ;
 * une note posée ailleurs hors palier se dit « Réglé ailleurs », jamais
 * remplacée en silence. Le plafond plus strict se dit sous la liste.
 */
export function NarrowAgeSection({ profile }: { profile: FamilyProfileDto }) {
  const { t } = useTranslation("parentalTv");
  const { errorText } = useFamilyText();
  const toast = useToast();
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
    const done = { onSuccess: () => toast.show("success", t("saved")), onError: (e: unknown) => toast.show("error", errorText(e)) };
    if (profile.kind === "guest") guestParental.mutate(input, done);
    else memberParental.mutate(input, done);
  };
  const label = (slot: ParentalAgeSlot) => {
    if (slot.kind === "custom") return `${t("age.custom")}${slot.names.length ? ` · ${slot.names.join(", ")}` : ""}`;
    if (slot.kind === "none") return t("age.none");
    return slot.age === 0 ? t("age.allAges") : t("age.years", { age: slot.age });
  };

  return (
    <div className="mt-3 w-full">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3px] text-content-tertiary">{t("age.title")}</p>
      <div role="radiogroup" aria-label={t("age.title")} className="mt-1.5 flex flex-wrap gap-1.5">
        {slots.map((slot) => {
          const selected = slot.key === current.key;
          return (
            <button
              key={slot.key}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={pending || slot.kind === "custom"}
              onClick={selected || slot.kind === "custom" ? undefined : () => choose(slot)}
              className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-[13px] font-semibold disabled:opacity-60 ${
                selected ? "border-transparent bg-[color:var(--surface-3)] text-content-primary" : "border-line-subtle text-content-secondary"
              }`}
            >
              {selected && <Check size={13} aria-hidden />}
              {label(slot)}
            </button>
          );
        })}
      </div>
      {capped && (
        <p className="mt-1.5 text-[12px] text-content-tertiary">
          {t(profile.kind === "guest" ? "age.ceilingGuest" : "age.ceilingMember", { names: ceilingNames })}
        </p>
      )}
    </div>
  );
}
