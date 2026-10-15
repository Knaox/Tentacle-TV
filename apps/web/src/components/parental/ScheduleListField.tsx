import { memo, useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Clock, Plus, X } from "lucide-react";
import type { AccessScheduleDay, AccessScheduleDto } from "@tentacle-tv/shared";
import { CHIP_REMOVE, FIELD_HINT, FIELD_LABEL, SELECT, SMALL_BUTTON } from "./fieldStyles";
import {
  SCHEDULE_DAYS,
  SCHEDULE_HOURS,
  addSchedule,
  formatHour,
  isNeverSchedule,
  removeSchedule,
  sameSchedule,
  scheduleIsValid,
} from "./parentalModel";

interface ScheduleListFieldProps {
  value: readonly AccessScheduleDto[];
  disabled?: boolean;
  onChange: (next: AccessScheduleDto[]) => void;
}

const DEFAULT_DRAFT: AccessScheduleDto = { dayOfWeek: "Everyday", startHour: 8, endHour: 21 };

/**
 * Le programme d'accès — les plages PERMISES : une ligne par plage (le jour,
 * puis « 8:00 - 20:30 », comme Jellyfin), retirée d'une croix ; dessous, jour
 * de la semaine, heure de début et heure de fin (à la demi-heure, les listes
 * de Jellyfin) pour en ajouter une. Sans plage, l'accès est permis à toute
 * heure — la phrase le dit.
 */
export const ScheduleListField = memo(function ScheduleListField({ value, disabled, onChange }: ScheduleListFieldProps) {
  const { t } = useTranslation("userRights");
  const titleId = useId();
  const errorId = useId();
  const [draft, setDraft] = useState<AccessScheduleDto>(DEFAULT_DRAFT);
  const valid = scheduleIsValid(draft);
  const never = isNeverSchedule(value);
  const duplicate = !never && value.some((existing) => sameSchedule(existing, draft));
  const dayName = (day: AccessScheduleDay) => t(`parental.days.${day}`);

  return (
    <fieldset aria-labelledby={titleId}>
      <legend id={titleId} className={FIELD_LABEL}>{t("fields.accessSchedules.label")}</legend>
      <span className={FIELD_HINT}>{t("fields.accessSchedules.hint")}</span>
      {never ? (
        <p className="mt-2 flex items-center gap-2.5 rounded-lg border border-line-subtle bg-fill-subtle px-3 py-2 text-sm text-content-primary">
          <Clock aria-hidden className="h-3.5 w-3.5 shrink-0 text-content-tertiary" />
          {t("parental.scheduleNever")}
        </p>
      ) : value.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {value.map((schedule, index) => {
            const from = formatHour(schedule.startHour);
            const to = formatHour(schedule.endHour);
            return (
              <li key={`${schedule.dayOfWeek}-${schedule.startHour}-${schedule.endHour}`}
                className="flex items-center gap-2.5 rounded-lg border border-line-subtle bg-fill-subtle py-1 pl-3 pr-1 text-sm">
                <Clock aria-hidden className="h-3.5 w-3.5 shrink-0 text-content-tertiary" />
                <span className="min-w-0 flex-1 truncate text-content-primary">{dayName(schedule.dayOfWeek)}</span>
                <span className="tabular-nums text-content-secondary">{t("parental.scheduleRange", { from, to })}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(removeSchedule(value, index))}
                  aria-label={t("parental.scheduleRemove", { day: dayName(schedule.dayOfWeek), from, to })}
                  className={CHIP_REMOVE}
                >
                  <X aria-hidden className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-content-quaternary">{t("parental.scheduleEmpty")}</p>
      )}
      <div className="mt-2 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] items-end gap-2">
        <Labelled label={t("parental.scheduleDay")}>
          <select value={draft.dayOfWeek} disabled={disabled} className={SELECT}
            onChange={(event) => setDraft({ ...draft, dayOfWeek: event.target.value as AccessScheduleDay })}>
            {SCHEDULE_DAYS.map((day) => <option key={day} value={day}>{dayName(day)}</option>)}
          </select>
        </Labelled>
        <Labelled label={t("parental.scheduleFrom")}>
          <HourSelect value={draft.startHour} hours={SCHEDULE_HOURS.slice(0, -1)} disabled={disabled} describedBy={valid ? undefined : errorId}
            onChange={(startHour) => setDraft({ ...draft, startHour })} />
        </Labelled>
        <Labelled label={t("parental.scheduleTo")}>
          <HourSelect value={draft.endHour} hours={SCHEDULE_HOURS.slice(1)} disabled={disabled} describedBy={valid ? undefined : errorId}
            onChange={(endHour) => setDraft({ ...draft, endHour })} />
        </Labelled>
      </div>
      {!valid && <p id={errorId} role="alert" className="mt-1.5 text-xs text-status-error-fg">{t("parental.scheduleInvalid")}</p>}
      <button
        type="button"
        disabled={disabled || !valid || duplicate}
        onClick={() => onChange(addSchedule(value, draft))}
        className={`${SMALL_BUTTON} mt-2`}
      >
        <Plus aria-hidden className="h-3.5 w-3.5" />
        {t("parental.scheduleAdd")}
      </button>
    </fieldset>
  );
});

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-content-tertiary">{label}</span>
      <span className="relative block">
        {children}
        <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
      </span>
    </label>
  );
}

function HourSelect({ value, hours, disabled, describedBy, onChange }: {
  value: number;
  hours: readonly number[];
  disabled?: boolean;
  describedBy?: string;
  onChange: (hour: number) => void;
}) {
  return (
    <select value={value} disabled={disabled} aria-describedby={describedBy} className={`${SELECT} tabular-nums`}
      onChange={(event) => onChange(Number(event.target.value))}>
      {hours.map((hour) => <option key={hour} value={hour}>{formatHour(hour)}</option>)}
    </select>
  );
}
