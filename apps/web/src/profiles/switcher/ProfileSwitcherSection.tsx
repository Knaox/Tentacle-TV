import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Check, Lock, UserCog } from "lucide-react";
import { FamilyAvatar } from "../../family/FamilyAvatar";
import type { PickerProfile } from "../picker/pickerTypes";

interface ProfileSwitcherSectionProps {
  profiles: readonly PickerProfile[];
  /** Le profil de la session active. */
  activeId: string;
  /** « Gérer les profils » : en session personnelle seulement. */
  canManage: boolean;
  /** La bascule en cours : plus rien ne se clique. */
  busy: boolean;
  onSwitch: (id: string) => void;
  onManage: () => void;
}

const ROW =
  "flex w-full items-center gap-3 px-4 py-2 text-left text-sm focus-visible:bg-fill-subtle focus-visible:outline-none disabled:cursor-default";

/**
 * Le CHANGEMENT RAPIDE de profil, en tête du menu de l'avatar (barre du haut
 * du bureau) : les profils de la famille — le sien en tête —, une coche sur
 * le profil actif, un cadenas sur ceux qu'un code PIN protège, puis « Gérer
 * les profils ». Des `menuitemradio` : un lecteur d'écran dit lequel est actif.
 */
export const ProfileSwitcherSection = memo(function ProfileSwitcherSection({
  profiles,
  activeId,
  canManage,
  busy,
  onSwitch,
  onManage,
}: ProfileSwitcherSectionProps) {
  const { t } = useTranslation(["profilePicker", "family"]);
  return (
    <div role="group" aria-label={t("profilePicker:switcher.title")} className="border-b border-line-subtle py-1.5">
      <p aria-hidden className="px-4 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-content-quaternary">
        {t("profilePicker:switcher.title")}
      </p>
      {profiles.map((profile) => {
        const active = profile.id === activeId;
        const caption = profile.guest ? t("family:kindGuest") : null;
        return (
          <button
            key={profile.id}
            type="button"
            role="menuitemradio"
            aria-checked={active}
            disabled={busy}
            onClick={() => onSwitch(profile.id)}
            className={`${ROW} ${active ? "text-content-primary" : "text-content-secondary hover:bg-fill-subtle hover:text-content-primary"}`}
          >
            <FamilyAvatar userId={profile.id} name={profile.name} color={profile.color} imageTag={profile.imageTag} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{profile.name}</span>
              {caption && <span className="block truncate text-xs text-content-tertiary">{caption}</span>}
            </span>
            {profile.hasPin && !active && (
              <Lock size={14} aria-label={t("profilePicker:hasPin")} className="flex-shrink-0 text-content-tertiary" />
            )}
            {active && <Check size={16} aria-hidden className="flex-shrink-0 text-[var(--brand-light)]" />}
          </button>
        );
      })}
      {canManage && (
        <button
          type="button"
          role="menuitem"
          disabled={busy}
          onClick={onManage}
          className={`${ROW} text-content-secondary hover:bg-fill-subtle hover:text-content-primary`}
        >
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
            <UserCog size={17} aria-hidden />
          </span>
          {t("profilePicker:manageProfiles")}
        </button>
      )}
    </div>
  );
});
