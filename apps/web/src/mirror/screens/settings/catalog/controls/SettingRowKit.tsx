import type { LucideIcon } from "lucide-react";
import type { SettingScope } from "@tentacle-tv/shared";
import { ToggleSwitch } from "../../../../../components/settings/ToggleSwitch";
import { CompactSegmented, type ChoiceOption } from "../../ui/SettingsChoiceRow";
import { ScopeBadge } from "../../ui/ScopeBadge";
import { SettingsRow } from "../../ui/SettingsRow";

/** Ce que reçoit chaque réglage sur place rendu par le catalogue. */
export interface ControlRowProps {
  scope: SettingScope | null;
  last?: boolean;
}

/**
 * Un choix parmi deux à quatre valeurs courtes — `SegmentedSettingRow` du
 * mobile : le nom (et sa pastille) en tête, le segmenté dessous, puis la
 * phrase de l'option CHOISIE (on lit ce qu'elle fait sans liste à dérouler).
 */
export function SegmentedSettingRow({ icon: Icon, label, scope, options, value, onChange, hint, last }: {
  icon: LucideIcon;
  label: string;
  scope: SettingScope | null;
  options: readonly ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  last?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 px-3 py-2.5 ${last ? "" : "border-b border-line-subtle"}`}>
      <div className="flex items-start gap-2">
        <span aria-hidden className="flex w-[22px] shrink-0 justify-center pt-0.5 text-content-secondary">
          <Icon size={19} strokeWidth={2} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-medium tracking-[-0.075px] text-content-primary">{label}</span>
          {scope ? <ScopeBadge scope={scope} /> : null}
        </span>
      </div>
      <div className="pl-[30px]">
        <CompactSegmented options={options} value={value} onChange={onChange} label={label} />
        {hint ? <p className="mt-2 text-[12px] leading-4 text-content-tertiary">{hint}</p> : null}
      </div>
    </div>
  );
}

/** Un oui / non : la ligne de réglage et son interrupteur. */
export function SwitchSettingRow({ icon, label, description, scope, value, onChange, last }: {
  icon: LucideIcon;
  label: string;
  description?: string;
  scope: SettingScope | null;
  value: boolean;
  onChange: (value: boolean) => void;
  last?: boolean;
}) {
  return (
    <SettingsRow
      icon={icon}
      label={label}
      description={description}
      scope={scope}
      last={last}
      trailing={<ToggleSwitch checked={value} onChange={onChange} label={label} />}
    />
  );
}
