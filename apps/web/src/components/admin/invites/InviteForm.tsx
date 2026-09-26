import { useId, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { cls } from "../../../pages/adminUtils";
import { useClock } from "../../../hooks/useAdminInvites";
import { ChoiceChips, type Choice } from "./ChoiceChips";
import {
  EXPIRY_PRESET_DAYS, USES_PRESETS, resolveDraft,
  type ExpiryUnit, type InviteDraft,
} from "./inviteDraft";
import { formatDeadline } from "./inviteFormat";

interface InviteFormProps {
  draft: InviteDraft;
  onChange: (draft: InviteDraft) => void;
  /** Un envoi a été tenté : les erreurs se montrent même sur un champ vide. */
  submitted: boolean;
  pending: boolean;
  failed: boolean;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}

const HOUR = 3_600_000;
const ERROR = "mt-1.5 text-xs text-status-error-fg";
// Les options d'un `<select>` natif ne suivent pas le fond translucide du champ.
const SELECT = `${cls.inp} pr-8 [&>option]:bg-tentacle-surface [&>option]:text-content-primary`;

/**
 * Les réglages d'une nouvelle invitation : combien de personnes, combien de
 * temps. Des pastilles pour les cas courants, « Autre » pour le reste, et le
 * récapitulatif en toutes lettres avant de créer.
 */
export function InviteForm({ draft, onChange, submitted, pending, failed, onSubmit, onCancel }: InviteFormProps) {
  const { t, i18n } = useTranslation(["adminInvites", "common"]);
  const now = useClock();
  const ids = { usesError: useId(), expiryError: useId() };
  const result = resolveDraft(draft);
  const set = (patch: Partial<InviteDraft>) => onChange({ ...draft, ...patch });

  // Une erreur se montre dès que la saisie libre a du contenu, ou après un envoi refusé.
  const usesError = !result.ok && result.usesError && (submitted || draft.customUses.trim() !== "")
    ? t("errorUses") : null;
  const expiryError = !result.ok && result.expiryError && (submitted || draft.customExpiry.trim() !== "")
    ? t(result.expiryError === "tooLong" ? "errorExpiryTooLong" : "errorExpiry") : null;

  const usesChoices: Choice<number | "custom">[] = [
    ...USES_PRESETS.map((count) => ({ value: count, label: String(count) })),
    { value: "custom", label: t("custom") },
  ];
  const expiryChoices: Choice<number | "custom">[] = [
    ...EXPIRY_PRESET_DAYS.map((days) => ({ value: days * 24, label: t("days", { count: days }) })),
    { value: "custom", label: t("custom") },
  ];

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 px-6 pb-6 pt-5">
      <ChoiceChips name="invite-uses" legend={t("usesLabel")} choices={usesChoices} value={draft.uses} onChange={(uses) => set({ uses })}>
        {/* Largeurs portées par un conteneur : `cls.inp` impose `w-full`, qui
            l'emportait sur un `w-24` posé à côté. */}
        {draft.uses === "custom" && (
          <div className="mt-2 w-32">
            <input
              autoFocus
              inputMode="numeric"
              value={draft.customUses}
              onChange={(e) => set({ customUses: e.target.value })}
              aria-label={t("customUsesLabel")}
              aria-invalid={usesError !== null}
              aria-describedby={usesError ? ids.usesError : undefined}
              placeholder="1 – 100"
              className={cls.inp}
            />
          </div>
        )}
        {usesError && <p id={ids.usesError} className={ERROR}>{usesError}</p>}
      </ChoiceChips>

      <ChoiceChips name="invite-expiry" legend={t("expiryLabel")} choices={expiryChoices} value={draft.expiryHours} onChange={(expiryHours) => set({ expiryHours })}>
        {draft.expiryHours === "custom" && (
          <div className="mt-2 flex gap-2">
            <div className="w-24">
              <input
                autoFocus
                inputMode="numeric"
                value={draft.customExpiry}
                onChange={(e) => set({ customExpiry: e.target.value })}
                aria-label={t("customExpiryLabel")}
                aria-invalid={expiryError !== null}
                aria-describedby={expiryError ? ids.expiryError : undefined}
                className={cls.inp}
              />
            </div>
            <div className="w-32">
              <select
                value={draft.customUnit}
                onChange={(e) => set({ customUnit: e.target.value as ExpiryUnit })}
                aria-label={t("unitLabel")}
                className={SELECT}
              >
                <option value="hours">{t("unitHours")}</option>
                <option value="days">{t("unitDays")}</option>
              </select>
            </div>
          </div>
        )}
        {expiryError && <p id={ids.expiryError} className={ERROR}>{expiryError}</p>}
      </ChoiceChips>

      {result.ok && (
        <p aria-live="polite" className="rounded-lg bg-fill-subtle px-3 py-2.5 text-sm text-content-secondary">
          {t("summary", {
            people: t("people", { count: result.request.maxUses }),
            date: formatDeadline(now + result.request.expiresInHours * HOUR, i18n.language),
          })}
        </p>
      )}
      {failed && <p role="alert" className="text-sm text-status-error-fg">{t("createFailed")}</p>}

      <div className="flex flex-col-reverse gap-2 xs:flex-row xs:justify-end">
        <button type="button" onClick={onCancel} className={cls.bs}>{t("common:cancel")}</button>
        <button type="submit" disabled={pending} className={cls.bp}>{pending ? t("creating") : t("create")}</button>
      </div>
    </form>
  );
}
