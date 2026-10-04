import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import type { FamilyProfileDto } from "@tentacle-tv/shared";
import { FamilyAvatar } from "../FamilyAvatar";
import { useFamilyText } from "../useFamilyText";
import { SMALL_BUTTON, SMALL_DANGER_BUTTON } from "./familyUi";

interface ProfileRowProps {
  profile: FamilyProfileDto;
  last: boolean;
  /** Les gestes du propriétaire (absents en « Voir en tant que »). */
  canManage: boolean;
  onRemove: (profile: FamilyProfileDto) => void;
  onDeleteGuest: (profile: FamilyProfileDto) => void;
  onGuestPin: (profile: FamilyProfileDto) => void;
}

const KIND_KEY = { owner: "family:kindOwner", member: "family:kindMember", guest: "family:kindGuest" } as const;

/**
 * Un profil de MA famille : avatar à sa couleur, nom, rôle, ancienneté, code
 * PIN. Les gestes : retirer un membre (son compte n'est jamais touché) ;
 * pour un invité, son code PIN et sa suppression.
 */
export const ProfileRow = memo(function ProfileRow({ profile, last, canManage, onRemove, onDeleteGuest, onGuestPin }: ProfileRowProps) {
  const { t } = useTranslation(["familyWeb", "family"]);
  const { formatDate } = useFamilyText();
  const isOwner = profile.kind === "owner";

  return (
    <li className={`flex flex-wrap items-center gap-3 px-4 py-3 ${last ? "" : "border-b border-line-subtle"}`}>
      <FamilyAvatar userId={profile.userId} name={profile.name} color={profile.color} imageTag={profile.imageTag} size={40} />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-content-primary">{profile.name}</span>
          {isOwner && <span className="text-xs text-content-tertiary">· {t("familyWeb:owned.you")}</span>}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-content-tertiary">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              profile.kind === "guest" ? "bg-[rgba(var(--brand-rgb),0.14)] text-[var(--brand-light)]" : "bg-fill-soft text-content-secondary"
            }`}
          >
            {t(KIND_KEY[profile.kind])}
          </span>
          {profile.since && <span>{t("familyWeb:owned.since", { date: formatDate(profile.since) })}</span>}
          {profile.hasPin && (
            <span className="inline-flex items-center gap-1">
              <Lock size={11} aria-hidden="true" />
              {t("familyWeb:owned.pinOn")}
            </span>
          )}
        </p>
      </div>
      {canManage && profile.kind === "member" && (
        <button type="button" onClick={() => onRemove(profile)} className={SMALL_DANGER_BUTTON}
          aria-label={`${t("familyWeb:owned.remove")} — ${profile.name}`}>
          {t("familyWeb:owned.remove")}
        </button>
      )}
      {canManage && profile.kind === "guest" && (
        <div className="flex gap-2">
          <button type="button" onClick={() => onGuestPin(profile)} className={SMALL_BUTTON}
            aria-label={`${t("familyWeb:owned.setPin")} — ${profile.name}`}>
            <Lock size={13} aria-hidden="true" />
            {t("familyWeb:owned.setPin")}
          </button>
          <button type="button" onClick={() => onDeleteGuest(profile)} className={SMALL_DANGER_BUTTON}
            aria-label={`${t("familyWeb:owned.delete")} — ${profile.name}`}>
            {t("familyWeb:owned.delete")}
          </button>
        </div>
      )}
    </li>
  );
});
