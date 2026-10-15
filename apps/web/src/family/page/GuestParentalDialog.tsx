import { useId, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { useFamilyParentalOptions, useSetFamilyGuestParental } from "@tentacle-tv/api-client";
import type { FamilyProfileDto, GuestParentalControls } from "@tentacle-tv/shared";
import { useToast } from "../../contexts/ToastContext";
import { Modal } from "../../components/ui/Modal";
import { RatingSelect, UnratedTypesField } from "../../components/parental/RatingFields";
import { ScheduleListField } from "../../components/parental/ScheduleListField";
import { TagListField } from "../../components/parental/TagListField";
import { guestCeilingOf, guestParentalOf, sameGuestParental } from "../../components/parental/guestParental";
import { currentRating, ratingChoices, ratingLabel } from "../../components/parental/parentalModel";
import { useFamilyText } from "../useFamilyText";
import { BRAND_BUTTON, BRAND_BUTTON_STYLE, SECONDARY_BUTTON } from "./familyUi";

interface GuestParentalDialogProps {
  guest: FamilyProfileDto;
  /** Le créateur de l'invité, nommé dans l'avertissement « jamais au-delà ». */
  creatorName: string;
  onClose: () => void;
}

/**
 * Le contrôle parental d'un invité — note maximale, types bloqués sans note,
 * étiquettes bloquées, plages horaires —, réglé par le propriétaire ou par le
 * membre qui l'a créé. On compose, puis « Enregistrer » envoie tout d'un
 * coup : c'est le serveur qui l'écrit dans la politique Jellyfin de l'invité,
 * jamais plus large que celle de son créateur (l'intersection des deux).
 */
export function GuestParentalDialog({ guest, creatorName, onClose }: GuestParentalDialogProps) {
  const { t } = useTranslation(["familyWeb", "userRights"]);
  const { errorText } = useFamilyText();
  const toast = useToast();
  const titleId = useId();
  const introId = useId();
  const options = useFamilyParentalOptions();
  const save = useSetFamilyGuestParental();
  const initial = useMemo(() => guestParentalOf(guest), [guest]);
  const ceiling = guestCeilingOf(guest);
  const [draft, setDraft] = useState<GuestParentalControls>(initial);
  const set = (patch: Partial<GuestParentalControls>) => setDraft((current) => ({ ...current, ...patch }));

  const ratings = useMemo(() => options.data?.parentalRatings ?? [], [options.data]);
  const ceilingRating = useMemo(() => {
    if (!ceiling || ceiling.maxParentalRating === null) return null;
    const choice = currentRating(ratingChoices(ratings), ceiling.maxParentalRating, ceiling.maxParentalSubRating);
    return choice && choice.names.length ? ratingLabel(choice, 2) : String(ceiling.maxParentalRating);
  }, [ceiling, ratings]);

  const pending = save.isPending;
  const unchanged = sameGuestParental(draft, initial);
  const close = pending ? () => undefined : onClose;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (unchanged) return onClose();
    save.mutate({ userId: guest.userId, parental: draft }, {
      onSuccess: () => {
        toast.show("success", t("familyWeb:parental.saved"));
        onClose();
      },
      onError: (error) => toast.show("error", errorText(error)),
    });
  };

  return (
    <Modal open onClose={close} maxWidth={520} labelledBy={titleId} describedBy={introId} dismissOnBackdrop={false}>
      <form onSubmit={submit} noValidate className="flex max-h-[85dvh] flex-col">
        <header className="flex items-start gap-3 border-b border-line-subtle p-6 pb-4">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-cta-brand-fg" style={BRAND_BUTTON_STYLE}>
            <ShieldCheck size={20} />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">
              {t("familyWeb:parental.title", { name: guest.name })}
            </h2>
            <p id={introId} className="mt-1 text-sm leading-relaxed text-content-tertiary">
              {t("familyWeb:parental.intro", { name: guest.name })}
            </p>
          </div>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <p className="rounded-lg border border-line-subtle bg-fill-subtle px-3 py-2.5 text-xs leading-relaxed text-content-secondary">
            {t("familyWeb:parental.ceiling", { name: guest.name, creator: creatorName })}
            {ceilingRating && <> {t("familyWeb:parental.ceilingRating", { creator: creatorName, rating: ceilingRating })}</>}
          </p>
          {options.isError && <p role="alert" className="text-sm text-status-error-fg">{t("familyWeb:parental.optionsError")}</p>}
          <RatingSelect
            ratings={ratings}
            score={draft.maxParentalRating}
            subScore={draft.maxParentalSubRating}
            disabled={pending || !options.data}
            onChange={(maxParentalRating, maxParentalSubRating) => set({ maxParentalRating, maxParentalSubRating })}
          />
          <UnratedTypesField
            types={options.data?.unratedItemTypes ?? []}
            value={draft.blockUnratedItems}
            disabled={pending}
            onChange={(blockUnratedItems) => set({ blockUnratedItems })}
          />
          <TagListField
            field="blockedTags"
            value={draft.blockedTags}
            known={options.data?.knownTags ?? []}
            disabled={pending}
            onChange={(blockedTags) => set({ blockedTags })}
          />
          <ScheduleListField value={draft.accessSchedules} disabled={pending} onChange={(accessSchedules) => set({ accessSchedules })} />
        </div>

        <footer className="flex justify-end gap-2 border-t border-line-subtle p-4">
          <button type="button" onClick={onClose} disabled={pending} className={SECONDARY_BUTTON}>
            {t("familyWeb:parental.cancel")}
          </button>
          <button type="submit" disabled={pending || unchanged} className={BRAND_BUTTON} style={BRAND_BUTTON_STYLE}>
            {t("familyWeb:parental.save")}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
